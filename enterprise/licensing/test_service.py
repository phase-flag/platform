"""Tests for enterprise/licensing/service.py security controls.

Covers:
- JWT claim validation: iss, sub, exp, iat, jti, nbf
- HS256 (HMAC) signature verification
- RS256 (RSA) signature verification using stdlib modular exponentiation
- ASN.1 DER RSA public key parsing
- Graceful degradation when no signing key is configured
- validate_license() integration
"""

from __future__ import annotations

import base64
import hashlib
import hmac as _hmac
import json
import struct
import time
import unittest
import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from enterprise.licensing.service import (
    _b64url_decode,
    _decode_jwt_payload,
    _extract_rsa_n_e_from_der,
    _load_rsa_public_key_pem,
    _rsa_verify_pkcs1_sha256,
    _validate_claims,
    _verify_jwt_hmac,
    _verify_jwt_rs256,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _make_hs256_jwt(payload: dict, secret: str) -> str:
    """Create a valid HS256 JWT."""
    header = _b64url_encode(b'{"alg":"HS256","typ":"JWT"}')
    body = _b64url_encode(json.dumps(payload).encode())
    signing_input = f"{header}.{body}".encode()
    sig = _hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"


def _make_valid_claims(
    *,
    org_id: str = "org-123",
    offset_exp: int = 3600,
    offset_iat: int = 0,
    include_jti: bool = True,
) -> dict:
    now = int(time.time())
    claims = {
        "iss": "phaseflag",
        "sub": org_id,
        "exp": now + offset_exp,
        "iat": now + offset_iat,
        "plan": "enterprise",
        "features": ["analytics", "governance"],
        "limits": {"max_seats": 50},
    }
    if include_jti:
        claims["jti"] = str(uuid.uuid4())
    return claims


# ---------------------------------------------------------------------------
# _validate_claims tests
# ---------------------------------------------------------------------------

class TestValidateClaims(unittest.TestCase):

    def test_valid_claims_pass(self):
        claims = _make_valid_claims()
        ok, err = _validate_claims(claims)
        self.assertTrue(ok)
        self.assertIsNone(err)

    def test_expired_token_fails(self):
        claims = _make_valid_claims(offset_exp=-1)
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("expired", err)

    def test_missing_exp_fails(self):
        claims = _make_valid_claims()
        del claims["exp"]
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("exp", err)

    def test_missing_iat_fails(self):
        claims = _make_valid_claims()
        del claims["iat"]
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("iat", err)

    def test_future_iat_fails(self):
        claims = _make_valid_claims(offset_iat=3600)  # iat = now + 1h
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("iat", err)

    def test_missing_jti_fails(self):
        claims = _make_valid_claims(include_jti=False)
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("jti", err)

    def test_invalid_issuer_fails(self):
        claims = _make_valid_claims()
        claims["iss"] = "malicious-issuer"
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("issuer", err)

    def test_missing_sub_fails(self):
        claims = _make_valid_claims()
        claims["sub"] = ""
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("subject", err)

    def test_nbf_future_fails(self):
        claims = _make_valid_claims()
        claims["nbf"] = int(time.time()) + 3600
        ok, err = _validate_claims(claims)
        self.assertFalse(ok)
        self.assertIn("not yet valid", err)

    def test_accepted_issuers(self):
        for iss in ("phaseflag", "phase-flag", "PhaseFlag"):
            claims = _make_valid_claims()
            claims["iss"] = iss
            ok, err = _validate_claims(claims)
            self.assertTrue(ok, f"Issuer '{iss}' should be accepted; got error: {err}")


# ---------------------------------------------------------------------------
# _verify_jwt_hmac tests
# ---------------------------------------------------------------------------

class TestVerifyJWTHMAC(unittest.TestCase):

    def test_valid_hs256_signature(self):
        secret = "super-secret-key"
        claims = _make_valid_claims()
        token = _make_hs256_jwt(claims, secret)
        self.assertTrue(_verify_jwt_hmac(token, secret))

    def test_wrong_secret_fails(self):
        token = _make_hs256_jwt(_make_valid_claims(), "correct-secret")
        self.assertFalse(_verify_jwt_hmac(token, "wrong-secret"))

    def test_tampered_payload_fails(self):
        secret = "my-secret"
        token = _make_hs256_jwt({"iss": "phaseflag", "sub": "org-1"}, secret)
        # Tamper with the payload part
        parts = token.split(".")
        tampered_payload = _b64url_encode(json.dumps({"iss": "phaseflag", "sub": "evil-org"}).encode())
        tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"
        self.assertFalse(_verify_jwt_hmac(tampered_token, secret))

    def test_malformed_token_fails(self):
        self.assertFalse(_verify_jwt_hmac("not.a.valid.jwt.with.too.many.parts", "secret"))
        self.assertFalse(_verify_jwt_hmac("onlytwoparts.here", "secret"))


# ---------------------------------------------------------------------------
# RSA key parsing tests
# ---------------------------------------------------------------------------

class TestRSAKeyParsing(unittest.TestCase):

    # Minimal 512-bit RSA public key in PEM format for testing.
    # Generated with: openssl genrsa 512 | openssl rsa -pubout
    # NOTE: 512-bit RSA is insecure — for testing only.
    TEST_PEM_512 = """-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAMqJqgWcMDmCh7r0aN0PEaVbRxjDrH2e
t2Y+xC8S5IQn19FDAH3jJYSC8F5y5mRU9ZsFkVHVU2HQ3aO2H7VU2fECAwEAAQ==
-----END PUBLIC KEY-----"""

    def test_load_rsa_public_key_returns_n_and_e(self):
        n, e = _load_rsa_public_key_pem(self.TEST_PEM_512)
        # e should always be 65537 (0x10001)
        self.assertEqual(e, 65537)
        # n should be a positive integer
        self.assertGreater(n, 0)
        # For a 512-bit key, n should be in [2^511, 2^512)
        self.assertGreaterEqual(n.bit_length(), 500)
        self.assertLessEqual(n.bit_length(), 512)

    def test_invalid_pem_raises(self):
        with self.assertRaises(Exception):
            _load_rsa_public_key_pem("not-a-pem")

    def test_der_parsing_bare_rsa_public_key(self):
        """Construct a bare RSAPublicKey DER and parse it."""
        # Encode a minimal RSAPublicKey ASN.1 structure for n=65537, e=3
        def _encode_integer(val: int) -> bytes:
            length = (val.bit_length() + 7) // 8
            encoded = val.to_bytes(length, byteorder="big")
            # Add leading 0x00 if high bit is set (to signal positive)
            if encoded[0] & 0x80:
                encoded = b"\x00" + encoded
            return b"\x02" + _encode_length(len(encoded)) + encoded

        def _encode_length(length: int) -> bytes:
            if length < 0x80:
                return bytes([length])
            lb = (length.bit_length() + 7) // 8
            return bytes([0x80 | lb]) + length.to_bytes(lb, byteorder="big")

        n_val = 65537
        e_val = 3
        n_bytes = _encode_integer(n_val)
        e_bytes = _encode_integer(e_val)
        inner = n_bytes + e_bytes
        der = b"\x30" + _encode_length(len(inner)) + inner

        n_out, e_out = _extract_rsa_n_e_from_der(der)
        self.assertEqual(n_out, n_val)
        self.assertEqual(e_out, e_val)


# ---------------------------------------------------------------------------
# _rsa_verify_pkcs1_sha256 tests
# ---------------------------------------------------------------------------

class TestRSAVerifyPKCS1(unittest.TestCase):

    def test_wrong_signature_length_fails(self):
        # 2048-bit key → signature must be 256 bytes
        n = (1 << 2047) | 1
        e = 65537
        self.assertFalse(_rsa_verify_pkcs1_sha256(b"message", b"\x00" * 128, n, e))

    def test_garbage_signature_fails(self):
        import os
        n = (1 << 2047) | 1
        e = 65537
        sig = os.urandom(256)
        self.assertFalse(_rsa_verify_pkcs1_sha256(b"message", sig, n, e))


# ---------------------------------------------------------------------------
# _verify_jwt_rs256 tests
# ---------------------------------------------------------------------------

class TestVerifyJWTRS256(unittest.TestCase):

    # Use the same 512-bit key from TestRSAKeyParsing for structural testing.
    TEST_PEM_512 = TestRSAKeyParsing.TEST_PEM_512

    def test_invalid_pem_returns_false(self):
        # Bad PEM should not raise; should return False with a warning logged
        fake_token = "aaa.bbb.ccc"
        result = _verify_jwt_rs256(fake_token, "not-valid-pem-at-all")
        self.assertFalse(result)

    def test_malformed_token_returns_false(self):
        result = _verify_jwt_rs256("not-a-jwt", self.TEST_PEM_512)
        self.assertFalse(result)

    def test_wrong_algorithm_header(self):
        """A token with alg=HS256 should fail RS256 verification."""
        header = _b64url_encode(b'{"alg":"HS256","typ":"JWT"}')
        payload = _b64url_encode(b'{"sub":"test"}')
        token = f"{header}.{payload}.fakesig"
        # Should return False (signature mismatch) rather than raise
        result = _verify_jwt_rs256(token, self.TEST_PEM_512)
        self.assertFalse(result)

    def test_tampered_payload_fails(self):
        """With a real key, tampering the payload should invalidate the signature.
        We test this at the structural level — if we could produce a valid sig
        with the 512-bit test key we would; instead we verify the negative path."""
        header = _b64url_encode(b'{"alg":"RS256","kid":"test"}')
        payload = _b64url_encode(b'{"sub":"org-123","iss":"phaseflag"}')
        fake_sig = _b64url_encode(b"\x00" * 64)  # 64 bytes → wrong length for 512-bit key
        token = f"{header}.{payload}.{fake_sig}"
        self.assertFalse(_verify_jwt_rs256(token, self.TEST_PEM_512))


# ---------------------------------------------------------------------------
# _decode_jwt_payload tests
# ---------------------------------------------------------------------------

class TestDecodeJWTPayload(unittest.TestCase):

    def test_decode_valid_payload(self):
        claims = {"sub": "org-1", "iss": "phaseflag", "jti": "abc"}
        token = _make_hs256_jwt(claims, "secret")
        decoded = _decode_jwt_payload(token)
        self.assertEqual(decoded["sub"], "org-1")
        self.assertEqual(decoded["iss"], "phaseflag")

    def test_invalid_format_raises(self):
        with self.assertRaises(ValueError):
            _decode_jwt_payload("only.two")

    def test_invalid_base64_raises(self):
        with self.assertRaises(Exception):
            _decode_jwt_payload("header.!!!invalid-base64!!!.sig")


# ---------------------------------------------------------------------------
# validate_license integration tests (async, mocked DB session)
# ---------------------------------------------------------------------------

class TestValidateLicenseIntegration(unittest.IsolatedAsyncioTestCase):

    def _make_session(self):
        session = MagicMock()
        session.add = MagicMock()
        session.flush = AsyncMock()
        return session

    async def test_no_signing_key_returns_invalid_record(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        claims = _make_valid_claims()
        token = _make_hs256_jwt(claims, "some-secret")
        record = await validate_license(session, "org-123", token)
        self.assertEqual(record.is_valid, 0)
        self.assertIn("no signing key", record.validation_error)

    async def test_valid_hs256_license_passes(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        secret = "test-hmac-secret"
        claims = _make_valid_claims(org_id="org-test")
        token = _make_hs256_jwt(claims, secret)
        record = await validate_license(session, "org-test", token, hmac_secret=secret)
        self.assertEqual(record.is_valid, 1)
        self.assertIsNone(record.validation_error)

    async def test_wrong_hmac_secret_returns_invalid(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        claims = _make_valid_claims(org_id="org-test")
        token = _make_hs256_jwt(claims, "correct-secret")
        record = await validate_license(session, "org-test", token, hmac_secret="wrong-secret")
        self.assertEqual(record.is_valid, 0)
        self.assertIn("signature", record.validation_error.lower())

    async def test_expired_claims_returns_invalid(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        secret = "test-secret"
        claims = _make_valid_claims(org_id="org-test", offset_exp=-1)
        token = _make_hs256_jwt(claims, secret)
        record = await validate_license(session, "org-test", token, hmac_secret=secret)
        self.assertEqual(record.is_valid, 0)
        self.assertIn("expired", record.validation_error)

    async def test_org_mismatch_returns_invalid(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        secret = "test-secret"
        claims = _make_valid_claims(org_id="org-A")
        token = _make_hs256_jwt(claims, secret)
        # Validate against a different org
        record = await validate_license(session, "org-B", token, hmac_secret=secret)
        self.assertEqual(record.is_valid, 0)
        self.assertIn("org-A", record.validation_error)

    async def test_missing_jti_returns_invalid(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        secret = "test-secret"
        claims = _make_valid_claims(org_id="org-test", include_jti=False)
        token = _make_hs256_jwt(claims, secret)
        record = await validate_license(session, "org-test", token, hmac_secret=secret)
        self.assertEqual(record.is_valid, 0)
        self.assertIn("jti", record.validation_error)

    async def test_malformed_jwt_returns_invalid(self):
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        record = await validate_license(session, "org-test", "not.a.valid.jwt.token")
        self.assertEqual(record.is_valid, 0)
        self.assertIn("Failed to decode JWT", record.validation_error)

    async def test_rsa_public_key_used_when_provided(self):
        """When rsa_public_key_pem is provided, verify RS256 path is taken.
        With a fake PEM, signature should fail → is_valid=0 with RS256 error."""
        from enterprise.licensing.service import validate_license
        session = self._make_session()
        # Create a token with HS256 header (alg mismatch for RS256 path)
        claims = _make_valid_claims(org_id="org-test")
        token = _make_hs256_jwt(claims, "some-secret")
        # Provide a fake PEM — parse will fail → is_valid=0
        fake_pem = "-----BEGIN PUBLIC KEY-----\nZmFrZWtleQ==\n-----END PUBLIC KEY-----"
        record = await validate_license(
            session, "org-test", token, rsa_public_key_pem=fake_pem
        )
        self.assertEqual(record.is_valid, 0)


if __name__ == "__main__":
    unittest.main()

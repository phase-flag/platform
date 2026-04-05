"""Transactional email service — supports SMTP, Resend, and SendGrid.

Provider selection via PHASEFLAG_EMAIL_PROVIDER env var:
  smtp      — Python stdlib smtplib (default when SMTP_HOST is set)
  resend    — Resend API (requires PHASEFLAG_RESEND_API_KEY)
  sendgrid  — SendGrid API (requires PHASEFLAG_SENDGRID_API_KEY)
  (unset)   — No-op: logs a warning, does not crash

Only active in SaaS/Enterprise deployment mode; silently skips in OSS mode.
"""

from __future__ import annotations

import logging
import smtplib
import urllib.request
import urllib.error
import json
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from phaseflag_api.config import DeploymentMode, settings

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


# ---------------------------------------------------------------------------
# Template loader
# ---------------------------------------------------------------------------

def _load_template(name: str, **kwargs: str) -> str:
    """Load an HTML template from the templates directory and format it."""
    path = _TEMPLATES_DIR / name
    if not path.exists():
        logger.warning("Email template '%s' not found at %s", name, path)
        return f"<p>{name}</p>"
    html = path.read_text(encoding="utf-8")
    for key, value in kwargs.items():
        html = html.replace(f"{{{{{key}}}}}", value)
    return html


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class EmailProvider(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, html_body: str) -> None:
        """Send an email. Raises on unrecoverable error."""


# ---------------------------------------------------------------------------
# SMTP provider (stdlib only)
# ---------------------------------------------------------------------------

class SMTPProvider(EmailProvider):
    def __init__(self) -> None:
        self.host: str = getattr(settings, "SMTP_HOST", "localhost")
        self.port: int = int(getattr(settings, "SMTP_PORT", 587))
        self.user: str = getattr(settings, "SMTP_USER", "")
        self.password: str = getattr(settings, "SMTP_PASSWORD", "")
        self.from_addr: str = getattr(settings, "EMAIL_FROM", "noreply@phaseflag.com")

    def send(self, to: str, subject: str, html_body: str) -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.from_addr
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        use_tls = self.port == 465
        try:
            if use_tls:
                with smtplib.SMTP_SSL(self.host, self.port, timeout=10) as srv:
                    if self.user:
                        srv.login(self.user, self.password)
                    srv.sendmail(self.from_addr, [to], msg.as_string())
            else:
                with smtplib.SMTP(self.host, self.port, timeout=10) as srv:
                    srv.ehlo()
                    srv.starttls()
                    srv.ehlo()
                    if self.user:
                        srv.login(self.user, self.password)
                    srv.sendmail(self.from_addr, [to], msg.as_string())
            logger.info("SMTP: sent '%s' → %s", subject, to)
        except Exception as exc:
            logger.error("SMTP send failed to %s: %s", to, exc)
            raise


# ---------------------------------------------------------------------------
# Resend provider
# ---------------------------------------------------------------------------

class ResendProvider(EmailProvider):
    def __init__(self) -> None:
        self.api_key: str = getattr(settings, "RESEND_API_KEY", "")
        self.from_addr: str = getattr(settings, "EMAIL_FROM", "noreply@phaseflag.com")

    def send(self, to: str, subject: str, html_body: str) -> None:
        if not self.api_key:
            raise RuntimeError("PHASEFLAG_RESEND_API_KEY is not set")
        payload = json.dumps({
            "from": self.from_addr,
            "to": [to],
            "subject": subject,
            "html": html_body,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                logger.info("Resend: sent '%s' → %s (status %s)", subject, to, resp.status)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            logger.error("Resend send failed: HTTP %s — %s", exc.code, body)
            raise


# ---------------------------------------------------------------------------
# SendGrid provider
# ---------------------------------------------------------------------------

class SendGridProvider(EmailProvider):
    def __init__(self) -> None:
        self.api_key: str = getattr(settings, "SENDGRID_API_KEY", "")
        self.from_addr: str = getattr(settings, "EMAIL_FROM", "noreply@phaseflag.com")

    def send(self, to: str, subject: str, html_body: str) -> None:
        if not self.api_key:
            raise RuntimeError("PHASEFLAG_SENDGRID_API_KEY is not set")
        payload = json.dumps({
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": self.from_addr},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_body}],
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                logger.info("SendGrid: sent '%s' → %s (status %s)", subject, to, resp.status)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            logger.error("SendGrid send failed: HTTP %s — %s", exc.code, body)
            raise


# ---------------------------------------------------------------------------
# No-op provider
# ---------------------------------------------------------------------------

class NoopProvider(EmailProvider):
    def send(self, to: str, subject: str, html_body: str) -> None:
        logger.warning(
            "Email not sent (no provider configured). "
            "Set PHASEFLAG_EMAIL_PROVIDER=smtp|resend|sendgrid to enable. "
            "Would have sent '%s' → %s",
            subject,
            to,
        )


# ---------------------------------------------------------------------------
# Provider factory
# ---------------------------------------------------------------------------

def _build_provider() -> EmailProvider:
    mode = settings.DEPLOYMENT_MODE
    if mode == DeploymentMode.OSS:
        logger.debug("Email service is disabled in OSS mode.")
        return NoopProvider()

    provider_name: str = getattr(settings, "EMAIL_PROVIDER", "").lower().strip()

    if provider_name == "smtp":
        return SMTPProvider()
    elif provider_name == "resend":
        return ResendProvider()
    elif provider_name == "sendgrid":
        return SendGridProvider()
    else:
        if provider_name:
            logger.warning("Unknown PHASEFLAG_EMAIL_PROVIDER '%s'. Using no-op.", provider_name)
        else:
            logger.warning(
                "PHASEFLAG_EMAIL_PROVIDER is not set. Transactional emails are disabled."
            )
        return NoopProvider()


_provider: EmailProvider | None = None


def _get_provider() -> EmailProvider:
    global _provider
    if _provider is None:
        _provider = _build_provider()
    return _provider


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_welcome_email(user_email: str, user_name: str) -> None:
    """Send a welcome email to a newly registered user."""
    html = _load_template("welcome.html", user_name=user_name, user_email=user_email)
    try:
        _get_provider().send(
            to=user_email,
            subject="Welcome to Phase Flag!",
            html_body=html,
        )
    except Exception as exc:
        logger.error("Failed to send welcome email to %s: %s", user_email, exc)


def send_billing_email(user_email: str, plan_name: str, action: str) -> None:
    """Send a billing confirmation email on plan upgrade or downgrade.

    Args:
        user_email: Recipient email address.
        plan_name:  Human-readable plan name (e.g. "Pro").
        action:     "upgrade" or "downgrade".
    """
    action_label = "upgraded to" if action == "upgrade" else "changed to"
    html = _load_template(
        "billing.html",
        plan_name=plan_name,
        action_label=action_label,
        user_email=user_email,
    )
    subject = f"Your Phase Flag plan has been {action_label} {plan_name}"
    try:
        _get_provider().send(to=user_email, subject=subject, html_body=html)
    except Exception as exc:
        logger.error("Failed to send billing email to %s: %s", user_email, exc)


def send_invitation_email(email: str, org_name: str, invite_link: str) -> None:
    """Send a team invitation email with an accept link."""
    html = _load_template(
        "invitation.html",
        org_name=org_name,
        invite_link=invite_link,
        email=email,
    )
    try:
        _get_provider().send(
            to=email,
            subject=f"You've been invited to join {org_name} on Phase Flag",
            html_body=html,
        )
    except Exception as exc:
        logger.error("Failed to send invitation email to %s: %s", email, exc)


def send_password_reset_email(email: str, reset_token: str, reset_url: str) -> None:
    """Send a password-reset email with a secure tokenised link."""
    html = _load_template(
        "password_reset.html",
        email=email,
        reset_token=reset_token,
        reset_url=reset_url,
    )
    try:
        _get_provider().send(
            to=email,
            subject="Reset your Phase Flag password",
            html_body=html,
        )
    except Exception as exc:
        logger.error("Failed to send password reset email to %s: %s", email, exc)

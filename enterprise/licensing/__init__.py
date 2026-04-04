"""Phase Flag Enterprise — Licensing (RSA-signed JWT license validation)."""

from .models import LicenseRecord
from .router import router

__all__ = ["router", "LicenseRecord"]

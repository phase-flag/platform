"""Phase Flag Enterprise — Verification (flag rule correctness checking)."""

from .models import VerificationResult
from .router import router

__all__ = ["router", "VerificationResult"]

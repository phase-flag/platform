"""Phase Flag Enterprise — Interactions (flag combination effect detection)."""

from .models import InteractionResult, InteractionTest
from .router import router

__all__ = ["router", "InteractionTest", "InteractionResult"]

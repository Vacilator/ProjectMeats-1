"""Resolve active OpenAI model ID.

The AI stack needs to be able to pivot models at runtime (e.g. after an RLHF
fine-tuning job completes) without changing environment variables.

This module reads the singleton ``SystemConfiguration`` row and falls back to
settings/environment defaults when unavailable.
"""

from __future__ import annotations

from typing import Optional

from django.conf import settings


def get_active_openai_model_id(*, fallback: str = "gpt-4o-mini") -> str:
    """Return the active OpenAI model ID from the database.

    Never raises: if the DB isn't ready (migrations, startup), we fall back to
    settings/env and then to the provided fallback.
    """

    # 1) Explicit settings override (legacy)
    settings_model = getattr(settings, "OPENAI_MODEL_ID", None)
    if settings_model:
        return str(settings_model)

    env_model = getattr(settings, "OPENAI_MODEL", None)
    if env_model:
        return str(env_model)

    # 2) DB-driven runtime config
    try:
        from apps.system.models import SystemConfiguration

        cfg = SystemConfiguration.objects.first()
        if cfg and getattr(cfg, "active_openai_model_id", None):
            return str(cfg.active_openai_model_id)
    except Exception:
        pass

    return fallback


def get_active_openai_model_id_optional() -> Optional[str]:
    """Optional variant: returns None if not resolvable."""

    model_id = get_active_openai_model_id(fallback="")
    return model_id or None

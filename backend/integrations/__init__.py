"""Compatibility shim for integrations routing.

This module provides a stable URLConf at `integrations.urls` while preserving the
existing integrations Django app (`apps.integrations`).

We mount `integrations.urls` at `/api/v1/integrations/` for URL stability.
"""

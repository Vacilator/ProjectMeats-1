"""Core logging helpers.

Provides a small wrapper for attaching tenant/user/request context to Sentry events.

The helper is intentionally defensive:
- If sentry-sdk is not installed or Sentry is disabled, it becomes a no-op.
- It should never raise during exception handling.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from django.conf import settings

from apps.core.utils.redaction import sanitize_data


@contextmanager
def sentry_scope(*, request: Any | None = None, extra: dict[str, Any] | None = None) -> Iterator[None]:
    """Push a Sentry scope with tenant + user context when available."""

    try:
        import sentry_sdk  # type: ignore
    except Exception:
        yield
        return

    if not getattr(settings, "SENTRY_ENABLED", False):
        yield
        return

    try:
        with sentry_sdk.push_scope() as scope:
            try:
                tenant = getattr(request, "tenant", None) if request is not None else None
                if tenant is not None:
                    scope.set_tag("tenant_id", str(getattr(tenant, "id", "")) or "")
                    slug = getattr(tenant, "slug", None)
                    if slug:
                        scope.set_tag("tenant_slug", str(slug))

                user = getattr(request, "user", None) if request is not None else None
                if user is not None and getattr(user, "is_authenticated", False):
                    scope.set_user(
                        {
                            "id": str(getattr(user, "id", "")) or "",
                        }
                    )

                if request is not None:
                    scope.set_extra("path", getattr(request, "path", ""))
                    scope.set_extra("method", getattr(request, "method", ""))

                if extra:
                    for k, v in extra.items():
                        scope.set_extra(str(k), sanitize_data(v))
            except Exception:
                # Never fail during exception handling.
                pass

            yield
    except Exception:
        yield


def capture_exception(exc: BaseException, *, request: Any | None = None, extra: dict[str, Any] | None = None) -> None:
    """Capture an exception to Sentry with tenant/user context."""

    try:
        import sentry_sdk  # type: ignore
    except Exception:
        return

    try:
        with sentry_scope(request=request, extra=extra):
            sentry_sdk.capture_exception(exc)
    except Exception:
        # Never fail during exception handling.
        return

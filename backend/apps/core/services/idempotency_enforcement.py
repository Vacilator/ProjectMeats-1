"""Idempotency enforcement decorator for DRF create endpoints (CTE-07.2).

Provides @idempotent_create — a decorator that wraps DRF ViewSet create/
custom actions with automatic idempotency key enforcement.

This prevents duplicate entity creation from:
- AI retries (email parsing → entity creation)
- Webhook replays (supplier/carrier email replies)
- Double-click form submissions
- Celery task retries

Usage:
    from apps.core.services.idempotency_enforcement import idempotent_create

    class PurchaseOrderViewSet(TenantViewSetMixin, ModelViewSet):
        @idempotent_create
        def create(self, request, *args, **kwargs):
            return super().create(request, *args, **kwargs)

    # Or for custom actions:
    class InquiryViewSet(...):
        @idempotent_create(source="ai_inbox")
        @action(detail=False, methods=["post"])
        def create_from_email(self, request):
            ...

For programmatic (non-HTTP) creation paths:
    from apps.core.services.idempotency_enforcement import enforce_idempotency

    result = enforce_idempotency(
        tenant_id=tenant_id,
        operation_key="ai_inbox:create_po:email_123",
        creator_fn=lambda: create_purchase_order(...),
    )
"""

from __future__ import annotations

import functools
import hashlib
import json
import logging
from typing import Any, Callable

from django.db import IntegrityError, transaction
from django.utils import timezone

logger = logging.getLogger("trade.idempotency")


# ---------------------------------------------------------------------------
# Programmatic Idempotency Enforcement
# ---------------------------------------------------------------------------


def enforce_idempotency(
    *,
    tenant_id: str,
    operation_key: str,
    creator_fn: Callable[[], Any],
    ttl_seconds: int = 3600,
) -> dict:
    """Enforce idempotency for a programmatic creation operation.

    If the operation_key was already used for this tenant, returns the
    cached result without calling creator_fn again.

    Args:
        tenant_id: Tenant UUID for isolation.
        operation_key: Unique key for this operation (e.g., "ai_inbox:po:email_abc123").
        creator_fn: Zero-arg callable that performs the creation.
        ttl_seconds: How long to remember this key (default 1 hour).

    Returns:
        Dict with:
        - "status": "created" | "duplicate"
        - "result": The creation result (from creator_fn or cache)
        - "operation_key": The key used
    """
    from apps.core.models import IdempotencyKey

    now = timezone.now()

    try:
        with transaction.atomic():
            # Try to reserve the key
            record, created = IdempotencyKey.objects.get_or_create(
                tenant_id=tenant_id,
                idempotency_key=operation_key,
                defaults={
                    "request_method": "PROG",
                    "request_path": operation_key.split(":")[0] if ":" in operation_key else "unknown",
                    "request_fingerprint": hashlib.sha256(
                        operation_key.encode()
                    ).hexdigest(),
                    "locked_until": now + timezone.timedelta(seconds=ttl_seconds),
                },
            )

            if not created:
                # Key already exists — this is a duplicate
                logger.info(
                    f"Idempotency: duplicate operation blocked: {operation_key}",
                    extra={
                        "operation_key": operation_key,
                        "tenant_id": tenant_id,
                        "original_created": str(record.created_on),
                    },
                )
                return {
                    "status": "duplicate",
                    "result": record.response_body,
                    "operation_key": operation_key,
                }

    except IntegrityError:
        # Race condition — another process just created this key
        logger.info(f"Idempotency: race condition resolved: {operation_key}")
        return {
            "status": "duplicate",
            "result": None,
            "operation_key": operation_key,
        }

    # Key reserved — perform the creation
    try:
        result = creator_fn()

        # Cache the result
        record.response_status = 201
        record.response_body = _serialize_result(result)
        record.locked_until = None
        record.save(update_fields=["response_status", "response_body", "locked_until", "modified_on"])

        logger.info(
            f"Idempotency: new operation completed: {operation_key}",
            extra={"operation_key": operation_key, "tenant_id": tenant_id},
        )

        return {
            "status": "created",
            "result": result,
            "operation_key": operation_key,
        }

    except Exception as exc:
        # Creation failed — release the key so it can be retried
        try:
            record.delete()
        except Exception:
            pass
        raise


# ---------------------------------------------------------------------------
# DRF Decorator
# ---------------------------------------------------------------------------


def idempotent_create(
    func: Callable | None = None,
    *,
    source: str = "api",
    key_header: str = "Idempotency-Key",
    auto_generate: bool = False,
):
    """Decorator that enforces idempotency on DRF create actions.

    If the request includes an Idempotency-Key header, the decorator will:
    1. Check if the key has been used before for this tenant
    2. If yes, return the cached response (HTTP 200)
    3. If no, proceed with creation and cache the response

    Args:
        source: Label for the creation source (e.g., "api", "ai_inbox", "webhook")
        key_header: HTTP header name to read the idempotency key from
        auto_generate: If True, auto-generate a key from request fingerprint
                      when no header is provided (useful for webhooks)
    """

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(self, request, *args, **kwargs):
            from apps.core.services.idempotency import (
                get_idempotency_key,
                release_idempotency_key,
                reserve_idempotency_key,
                store_idempotency_response,
            )
            from rest_framework.response import Response

            # Get idempotency key from header
            idem_key = get_idempotency_key(request)

            if not idem_key and auto_generate:
                # Auto-generate from request fingerprint
                payload_str = json.dumps(request.data, sort_keys=True, default=str)
                idem_key = f"{source}:{hashlib.sha256(payload_str.encode()).hexdigest()[:32]}"

            if not idem_key:
                # No idempotency key — proceed normally
                return fn(self, request, *args, **kwargs)

            # Get tenant from request
            tenant = getattr(request, "tenant", None)
            if not tenant:
                return fn(self, request, *args, **kwargs)

            # Reserve the key
            reservation = reserve_idempotency_key(
                tenant=tenant,
                idempotency_key=idem_key,
                method=request.method,
                path=request.path,
                payload=request.data,
                actor=request.user,
            )

            if reservation.state == "replay":
                # Return cached response
                logger.info(
                    f"Idempotency replay: {idem_key} ({source})",
                    extra={"idempotency_key": idem_key, "source": source},
                )
                return reservation.response

            if reservation.state == "conflict":
                # In-flight request with same key
                return Response(
                    {"detail": "Request with this idempotency key is already in progress."},
                    status=409,
                )

            # reservation.state == "reserved" — proceed with creation
            try:
                response = fn(self, request, *args, **kwargs)

                # Cache the response
                if reservation.record:
                    try:
                        store_idempotency_response(
                            record=reservation.record, response=response
                        )
                    except Exception:
                        pass

                return response

            except Exception:
                # Release the key on failure
                if reservation.record:
                    try:
                        release_idempotency_key(record=reservation.record)
                    except Exception:
                        pass
                raise

        return wrapper

    if func is not None:
        return decorator(func)
    return decorator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_result(result: Any) -> dict | None:
    """Serialize a creation result for caching."""
    if result is None:
        return None
    if isinstance(result, dict):
        return result
    if hasattr(result, "pk"):
        return {"id": str(result.pk), "type": type(result).__name__}
    return {"value": str(result)[:1000]}


def generate_operation_key(*, source: str, entity_type: str, fingerprint: str) -> str:
    """Generate a deterministic operation key for idempotency.

    Usage:
        key = generate_operation_key(
            source="ai_inbox",
            entity_type="PurchaseOrder",
            fingerprint=f"{email_id}:{po_number}",
        )
    """
    return f"{source}:{entity_type}:{hashlib.sha256(fingerprint.encode()).hexdigest()[:24]}"

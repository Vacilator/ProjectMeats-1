"""Helpers for tenant-scoped idempotent write endpoints."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from apps.core.models import IdempotencyKey


LOCK_TIMEOUT = timedelta(minutes=10)


@dataclass(frozen=True)
class IdempotencyReservation:
    """Outcome of attempting to reserve an idempotency key."""

    state: str
    record: IdempotencyKey | None = None
    response: Response | None = None


def get_idempotency_key(request: Any) -> str:
    """Return a normalized Idempotency-Key header value or empty string."""
    headers = getattr(request, "headers", None)
    if headers is None:
        return ""
    return str(headers.get("Idempotency-Key") or "").strip()


def _json_safe(value: Any) -> Any:
    if hasattr(value, "lists"):
        return {
            str(key): _json_safe(values if len(values) != 1 else values[0])
            for key, values in value.lists()
        }
    if isinstance(value, dict):
        return {
            str(key): _json_safe(inner)
            for key, inner in sorted(value.items(), key=lambda item: str(item[0]))
        }
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if hasattr(value, "chunks") and hasattr(value, "name"):
        return {
            "name": str(getattr(value, "name", "") or ""),
            "size": int(getattr(value, "size", 0) or 0),
            "content_type": str(getattr(value, "content_type", "") or ""),
            "sha256": _hash_uploaded_file(value),
        }
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def _hash_uploaded_file(uploaded_file: Any) -> str:
    hasher = hashlib.sha256()
    stream = getattr(uploaded_file, "file", uploaded_file)
    position = None
    if hasattr(stream, "tell"):
        try:
            position = stream.tell()
        except (OSError, ValueError):
            position = None

    try:
        if hasattr(stream, "seek"):
            stream.seek(0)
        for chunk in uploaded_file.chunks():
            hasher.update(chunk)
    finally:
        if position is not None and hasattr(stream, "seek"):
            stream.seek(position)

    return hasher.hexdigest()


def build_request_fingerprint(*, method: str, path: str, payload: Any) -> str:
    """Return a stable digest for an idempotent mutation request."""
    normalized = json.dumps(
        {
            "method": method.upper(),
            "path": path,
            "payload": _json_safe(payload),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def reserve_idempotency_key(
    *,
    tenant,
    idempotency_key: str,
    method: str,
    path: str,
    payload: Any,
    actor: Any | None = None,
) -> IdempotencyReservation:
    """Create, replay, or reject a tenant-scoped idempotent mutation."""
    request_fingerprint = build_request_fingerprint(method=method, path=path, payload=payload)
    actor_id = getattr(actor, "id", None)
    now = timezone.now()
    lease_until = now + LOCK_TIMEOUT

    with transaction.atomic():
        record = (
            IdempotencyKey.objects.select_for_update()
            .filter(tenant=tenant, idempotency_key=idempotency_key)
            .first()
        )

        if record is None:
            record = IdempotencyKey.objects.create(
                tenant=tenant,
                idempotency_key=idempotency_key,
                request_method=method.upper(),
                request_path=path,
                request_fingerprint=request_fingerprint,
                locked_until=lease_until,
                custom_data={"actor_id": actor_id} if actor_id is not None else {},
            )
            return IdempotencyReservation(state="started", record=record)

        if (
            record.request_method != method.upper()
            or record.request_path != path
            or record.request_fingerprint != request_fingerprint
        ):
            return IdempotencyReservation(
                state="conflict",
                record=record,
                response=Response(
                    {
                        "error": "Idempotency key cannot be reused with a different request payload.",
                        "code": "IDEMPOTENCY_CONFLICT",
                    },
                    status=status.HTTP_409_CONFLICT,
                ),
            )

        existing_actor_id = (record.custom_data or {}).get("actor_id")

        if record.response_status is not None:
            if actor_id is not None and existing_actor_id not in (None, actor_id):
                return IdempotencyReservation(
                    state="actor_conflict",
                    record=record,
                    response=Response(
                        {
                            "error": "This Idempotency-Key is already reserved by another user in the tenant.",
                            "code": "IDEMPOTENCY_ACTOR_CONFLICT",
                        },
                        status=status.HTTP_409_CONFLICT,
                    ),
                )
            return IdempotencyReservation(
                state="replay",
                record=record,
                response=Response(record.response_body, status=record.response_status),
            )

        if record.locked_until and record.locked_until > now:
            if actor_id is not None and existing_actor_id not in (None, actor_id):
                return IdempotencyReservation(
                    state="actor_conflict",
                    record=record,
                    response=Response(
                        {
                            "error": "This Idempotency-Key is already reserved by another user in the tenant.",
                            "code": "IDEMPOTENCY_ACTOR_CONFLICT",
                        },
                        status=status.HTTP_409_CONFLICT,
                    ),
                )
            retry_after = max(int((record.locked_until - now).total_seconds()), 1)
            return IdempotencyReservation(
                state="in_progress",
                record=record,
                response=Response(
                    {
                        "error": "A request with this idempotency key is already in progress.",
                        "code": "IDEMPOTENCY_IN_PROGRESS",
                        "retry_after": retry_after,
                    },
                    status=status.HTTP_409_CONFLICT,
                ),
            )

        record.request_method = method.upper()
        record.request_path = path
        record.request_fingerprint = request_fingerprint
        record.locked_until = lease_until
        record.response_status = None
        record.response_body = None
        record.custom_data = {
            **dict(record.custom_data or {}),
            "actor_id": actor_id,
            "stale_reclaimed_at": now.isoformat(),
        }
        record.save(
            update_fields=[
                "request_method",
                "request_path",
                "request_fingerprint",
                "locked_until",
                "response_status",
                "response_body",
                "custom_data",
            ]
        )
        return IdempotencyReservation(state="started", record=record)


def store_idempotency_response(*, record: IdempotencyKey, response: Response) -> None:
    """Persist a replayable response for a completed idempotent request."""
    record.response_status = response.status_code
    record.response_body = json.loads(JSONRenderer().render(response.data))
    record.locked_until = None
    record.save(update_fields=["response_status", "response_body", "locked_until"])


def release_idempotency_key(*, record: IdempotencyKey | None) -> None:
    """Discard an in-flight reservation so callers can retry after failures."""
    if not record:
        return
    record.delete()

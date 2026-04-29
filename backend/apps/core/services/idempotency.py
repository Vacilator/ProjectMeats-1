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


LOCK_TIMEOUT = timedelta(minutes=5)


@dataclass(frozen=True)
class IdempotencyReservation:
    """Outcome of attempting to reserve an idempotency key."""

    state: str
    record: IdempotencyKey | None = None
    response: Response | None = None


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def build_request_fingerprint(*, method: str, path: str, payload: Any) -> str:
    """Return a stable digest for an idempotent mutation request."""

    normalized = json.dumps(
        {
            'method': method.upper(),
            'path': path,
            'payload': _json_safe(payload),
        },
        sort_keys=True,
        separators=(',', ':'),
    )
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def reserve_idempotency_key(
    *,
    tenant,
    idempotency_key: str,
    method: str,
    path: str,
    payload: Any,
) -> IdempotencyReservation:
    """Create, replay, or reject a tenant-scoped idempotent mutation."""

    request_fingerprint = build_request_fingerprint(method=method, path=path, payload=payload)
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
            )
            return IdempotencyReservation(state='started', record=record)

        if (
            record.request_method != method.upper()
            or record.request_path != path
            or record.request_fingerprint != request_fingerprint
        ):
            return IdempotencyReservation(
                state='conflict',
                record=record,
                response=Response(
                    {
                        'error': 'Idempotency key cannot be reused with a different request payload.',
                        'code': 'IDEMPOTENCY_KEY_REUSED',
                    },
                    status=status.HTTP_409_CONFLICT,
                ),
            )

        if record.response_status is not None:
            return IdempotencyReservation(
                state='replay',
                record=record,
                response=Response(record.response_body, status=record.response_status),
            )

        if record.locked_until and record.locked_until > now:
            retry_after = max(int((record.locked_until - now).total_seconds()), 1)
            return IdempotencyReservation(
                state='in_progress',
                record=record,
                response=Response(
                    {
                        'error': 'A request with this idempotency key is already in progress.',
                        'code': 'IDEMPOTENCY_IN_PROGRESS',
                        'retry_after': retry_after,
                    },
                    status=status.HTTP_409_CONFLICT,
                ),
            )

        record.locked_until = lease_until
        record.save(update_fields=['locked_until'])
        return IdempotencyReservation(state='started', record=record)


def store_idempotency_response(*, record: IdempotencyKey, response: Response) -> None:
    """Persist a replayable response for a completed idempotent request."""

    record.response_status = response.status_code
    record.response_body = json.loads(JSONRenderer().render(response.data))
    record.locked_until = None
    record.save(update_fields=['response_status', 'response_body', 'locked_until'])


def release_idempotency_key(*, record: IdempotencyKey) -> None:
    """Discard an in-flight reservation so callers can retry after failures."""

    record.delete()

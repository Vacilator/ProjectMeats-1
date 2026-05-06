from __future__ import annotations

import hmac
import json
import os
import time
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from hashlib import sha256

from django.conf import settings
from django.core.exceptions import ValidationError

STRIPE_TREASURY_PROVIDER_CODE = 'stripe_treasury'
_MONEY_QUANTUM = Decimal('0.01')
_SIGNATURE_TOLERANCE_SECONDS = 300


def is_stripe_treasury_provider(provider_code: str) -> bool:
    return provider_code == STRIPE_TREASURY_PROVIDER_CODE


def verify_stripe_treasury_signature(*, body: bytes, signature_header: str) -> bool:
    signing_secret = getattr(settings, 'STRIPE_SETTLEMENT_WEBHOOK_SECRET', None) or os.environ.get(
        'STRIPE_SETTLEMENT_WEBHOOK_SECRET'
    )
    if not signing_secret or not signature_header:
        return False

    parsed_signature = _parse_signature_header(signature_header)
    if not parsed_signature:
        return False

    timestamp, v1_signature = parsed_signature
    now = int(time.time())
    if abs(now - timestamp) > _SIGNATURE_TOLERANCE_SECONDS:
        return False

    try:
        decoded_body = body.decode('utf-8')
    except UnicodeDecodeError:
        return False

    signed_payload = f'{timestamp}.{decoded_body}'.encode('utf-8')
    expected_signature = hmac.new(signing_secret.encode('utf-8'), signed_payload, sha256).hexdigest()
    return hmac.compare_digest(expected_signature, v1_signature)


def build_stripe_treasury_canonical_payload(raw_payload: str) -> dict[str, object]:
    try:
        event = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        raise ValidationError(f'Stripe settlement payload is not valid JSON: {exc.msg}') from exc

    if not isinstance(event, dict):
        raise ValidationError('Stripe settlement payload must be a JSON object.')

    event_id = str(event.get('id') or '').strip()
    event_type = str(event.get('type') or '').strip()
    data_object = event.get('data', {}).get('object', {})
    if not event_id or not event_type or not isinstance(data_object, dict):
        raise ValidationError('Stripe settlement payload is missing required event fields.')

    occurred_at = _resolve_occurred_at(event, data_object)
    amount_value = _resolve_amount(data_object)
    direction = 'credit' if amount_value >= 0 else 'debit'
    currency = str(data_object.get('currency') or '').upper().strip()
    if len(currency) != 3:
        raise ValidationError('Stripe settlement payload is missing a valid currency.')

    canonical_payload: dict[str, object] = {
        'external_event_id': event_id,
        'event_type': event_type,
        'direction': direction,
        'occurred_at': occurred_at.isoformat().replace('+00:00', 'Z'),
        'amount': str(abs(amount_value).quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)),
        'currency': currency,
        'transaction_id': str(data_object.get('id') or event_id),
    }
    canonical_payload.update(_extract_reference_fields(data_object))
    return canonical_payload


def _parse_signature_header(signature_header: str) -> tuple[int, str] | None:
    segments = [segment.strip() for segment in signature_header.split(',') if segment.strip()]
    values: dict[str, str] = {}
    for segment in segments:
        if '=' not in segment:
            continue
        key, value = segment.split('=', 1)
        values[key] = value

    timestamp = values.get('t')
    v1_signature = values.get('v1')
    if not timestamp or not v1_signature:
        return None
    try:
        return int(timestamp), v1_signature
    except ValueError:
        return None


def _resolve_occurred_at(event: dict[str, object], data_object: dict[str, object]) -> datetime:
    raw_timestamp = data_object.get('created') or event.get('created')
    if raw_timestamp in {None, ''}:
        raise ValidationError('Stripe settlement payload is missing created timestamp.')
    try:
        return datetime.fromtimestamp(int(raw_timestamp), tz=UTC)
    except (TypeError, ValueError, OSError) as exc:
        raise ValidationError('Stripe settlement payload has an invalid created timestamp.') from exc


def _resolve_amount(data_object: dict[str, object]) -> Decimal:
    cents_value = data_object.get('amount')
    if cents_value in {None, ''}:
        raise ValidationError('Stripe settlement payload is missing amount.')
    try:
        return (Decimal(str(cents_value)) / Decimal('100')).quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValidationError('Stripe settlement payload has an invalid amount.') from exc


def _extract_reference_fields(data_object: dict[str, object]) -> dict[str, object]:
    metadata = data_object.get('metadata')
    references = metadata if isinstance(metadata, dict) else {}
    result: dict[str, object] = {}

    for key in (
        'invoice_number',
        'invoice_no',
        'invoice_reference',
        'sales_order_number',
        'sales_order_num',
        'our_sales_order_num',
        'purchase_order_number',
        'purchase_order_num',
        'po_number',
        'po_num',
        'our_purchase_order_num',
        'supplier_confirmation_order_number',
        'supplier_confirmation_order_num',
        'payment_method',
        'reference_number',
        'payout_id',
        'trace_number',
    ):
        value = references.get(key)
        if value not in {None, ''}:
            result[key] = str(value)

    if 'reference_number' not in result and data_object.get('id'):
        result['reference_number'] = str(data_object['id'])

    return result

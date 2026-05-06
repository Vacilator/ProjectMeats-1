from __future__ import annotations

import json
import logging
import random
import time
from typing import Any, Dict

import requests
from celery import shared_task
from django.utils import timezone

from .models import SettlementEvent, SettlementEventState, TenantWebhook
from .signing import sign_timestamped_body, stable_json

logger = logging.getLogger(__name__)


@shared_task(
    name='tenant_integrations.dispatch_webhook_payload',
    bind=True,
    max_retries=6,
    soft_time_limit=20,
    time_limit=30,
)
def dispatch_webhook_payload(self, webhook_id: int, tenant_id: str, event_type: str, payload: Dict[str, Any]):
    """POST an event payload to a tenant webhook with exponential backoff.

    Retries on:
    - network errors
    - HTTP 429
    - HTTP 5xx
    """

    from apps.tenants.rls import reset_current_tenant, set_current_tenant

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        logger.warning('[Webhooks] Skipping webhook=%s (RLS set failed: %s)', webhook_id, rls.error)
        return {'success': False, 'reason': 'rls_set_failed', 'error': rls.error}

    try:
        webhook = (
            TenantWebhook.objects.select_related('tenant')
            .filter(id=webhook_id, tenant_id=tenant_id)
            .first()
        )
        if not webhook:
            return {'success': False, 'reason': 'webhook_not_found'}

        if not webhook.is_active:
            return {'success': True, 'skipped': True, 'reason': 'inactive'}

        body = stable_json(payload)
        timestamp = str(int(time.time()))

        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'ProjectMeats-Webhooks/1.0',
            'X-PM-Event': event_type,
            'X-PM-Tenant-ID': str(webhook.tenant_id),
            'X-PM-Timestamp': timestamp,
        }

        if webhook.signing_secret:
            headers['X-PM-Signature'] = sign_timestamped_body(webhook.signing_secret, timestamp, body)

        try:
            resp = requests.post(webhook.target_url, data=body, headers=headers, timeout=10)

            if resp.status_code == 429 or resp.status_code >= 500:
                raise RuntimeError(f"retryable_status:{resp.status_code}")

            if 400 <= resp.status_code < 500:
                logger.warning(
                    'Webhook delivery failed (non-retryable) webhook=%s status=%s body=%s',
                    webhook_id,
                    resp.status_code,
                    resp.text[:500],
                )
                return {
                    'success': False,
                    'webhook_id': webhook_id,
                    'status_code': resp.status_code,
                }

            return {
                'success': True,
                'webhook_id': webhook_id,
                'status_code': resp.status_code,
            }

        except Exception as e:
            # Exponential backoff with small jitter
            retries = getattr(self.request, 'retries', 0)
            countdown = min(60 * (2 ** retries), 60 * 30) + random.randint(0, 5)
            logger.error(
                'Webhook delivery error webhook=%s retries=%s countdown=%s err=%s',
                webhook_id,
                retries,
                countdown,
                str(e),
                exc_info=True,
            )
            raise self.retry(exc=e, countdown=countdown)

    finally:
        reset_current_tenant()


@shared_task(
    name='tenant_integrations.process_settlement_event',
    bind=True,
    max_retries=3,
    soft_time_limit=20,
    time_limit=30,
)
def process_settlement_event(self, event_id: int, tenant_id: str):
    """Validate and stage a settlement event without writing to the payment ledger."""

    from apps.tenants.rls import reset_current_tenant, set_current_tenant

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        logger.warning('[Settlement] Skipping event=%s (RLS set failed: %s)', event_id, rls.error)
        return {'success': False, 'reason': 'rls_set_failed', 'error': rls.error}

    try:
        event = (
            SettlementEvent.objects.select_related('source')
            .filter(id=event_id, tenant_id=tenant_id)
            .first()
        )
        if not event:
            return {'success': False, 'reason': 'event_not_found'}

        if event.state in {
            SettlementEventState.VALIDATED,
            SettlementEventState.READY_TO_POST,
            SettlementEventState.POSTED,
            SettlementEventState.IGNORED,
        }:
            return {'success': True, 'skipped': True, 'state': event.state}

        try:
            normalized_payload = json.loads(event.raw_payload)
        except json.JSONDecodeError as exc:
            event.state = SettlementEventState.FAILED
            event.last_error = f'json_parse_error:{exc.msg}'
            event.processed_at = timezone.now()
            event.save(update_fields=['state', 'last_error', 'processed_at', 'modified_on'])
            return {'success': False, 'reason': 'json_parse_error', 'state': event.state}

        event.normalized_payload = normalized_payload if isinstance(normalized_payload, dict) else {'body': normalized_payload}
        event.state = SettlementEventState.VALIDATED
        event.last_error = ''
        event.processed_at = timezone.now()
        event.save(update_fields=['normalized_payload', 'state', 'last_error', 'processed_at', 'modified_on'])
        return {'success': True, 'state': event.state}
    finally:
        reset_current_tenant()

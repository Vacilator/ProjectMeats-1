from __future__ import annotations

import hmac
import json
import logging
import random
import time
from hashlib import sha256
from typing import Any, Dict

import requests
from celery import shared_task

from .models import TenantWebhook

logger = logging.getLogger(__name__)


def _stable_json(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, separators=(',', ':'), sort_keys=True, default=str)


def _sign(secret: str, timestamp: str, body: str) -> str:
    msg = f"{timestamp}.{body}".encode('utf-8')
    digest = hmac.new(secret.encode('utf-8'), msg=msg, digestmod=sha256).hexdigest()
    return f"v1={digest}"


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

        body = _stable_json(payload)
        timestamp = str(int(time.time()))

        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'ProjectMeats-Webhooks/1.0',
            'X-PM-Event': event_type,
            'X-PM-Tenant-ID': str(webhook.tenant_id),
            'X-PM-Timestamp': timestamp,
        }

        if webhook.signing_secret:
            headers['X-PM-Signature'] = _sign(webhook.signing_secret, timestamp, body)

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

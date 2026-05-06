from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import RlsSetResult
from tenant_apps.invoices.models import PaymentTransaction

from .models import (
    SettlementEvent,
    SettlementEventState,
    SettlementSource,
    SettlementSourceAuthMode,
    TenantAPIKey,
    TenantWebhook,
    TenantWebhookEventType,
    generate_api_key,
)
from .settlement_contract import (
    SETTLEMENT_CONTRACT_VERSION,
    build_raw_payload_sha256,
    build_settlement_idempotency_key,
    get_settlement_reconciliation_contract,
)
from .signing import sign_timestamped_body
from .tasks import dispatch_webhook_payload, process_settlement_event


class TenantIntegrationsModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='pw')
        self.tenant = Tenant.objects.create(
            name='T1',
            slug='t1',
            contact_email='t1@example.com',
            created_by=self.user,
        )

    def test_api_key_verify_round_trip(self):
        full_key, prefix, secret_hash = generate_api_key()
        obj = TenantAPIKey.objects.create(
            tenant=self.tenant,
            name='Key 1',
            key_prefix=prefix,
            key_hash=secret_hash,
            created_by=self.user,
        )
        self.assertTrue(obj.verify(full_key))
        self.assertFalse(obj.verify(prefix))

    def test_webhook_rotate_secret(self):
        wh = TenantWebhook.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            target_url='https://example.com/webhook',
            event_type=TenantWebhookEventType.PURCHASE_ORDER_CREATED,
            is_active=True,
            signing_secret='old',
        )
        new_secret = wh.rotate_secret()
        self.assertNotEqual(new_secret, 'old')
        wh.refresh_from_db()
        self.assertEqual(wh.signing_secret, new_secret)

    def test_settlement_event_idempotency_scope_is_per_tenant(self):
        other_tenant = Tenant.objects.create(
            name='T2',
            slug='t2',
            contact_email='t2@example.com',
            created_by=self.user,
        )
        source_one = SettlementSource.objects.create(
            tenant=self.tenant,
            name='Provider One',
            provider_code='provider-a',
            provider_account_reference='acct-1',
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
            created_by=self.user,
        )
        source_two = SettlementSource.objects.create(
            tenant=other_tenant,
            name='Provider Two',
            provider_code='provider-a',
            provider_account_reference='acct-1',
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
            created_by=self.user,
        )
        raw_payload = '{"external_event_id":"evt-1"}'
        payload_hash = build_raw_payload_sha256(raw_payload)
        occurred_at = datetime(2026, 5, 6, 10, 0, tzinfo=dt_timezone.utc)

        event_one = SettlementEvent.objects.create(
            tenant=self.tenant,
            source=source_one,
            provider_code='provider-a',
            provider_account_reference='acct-1',
            external_event_id='evt-1',
            event_type='payment.settled',
            direction='credit',
            occurred_at=occurred_at,
            amount=Decimal('10.00'),
            currency='USD',
            raw_payload=raw_payload,
            raw_payload_sha256=payload_hash,
            idempotency_key=build_settlement_idempotency_key(
                tenant_id=str(self.tenant.id),
                provider_code='provider-a',
                external_event_id='evt-1',
                provider_account_reference='acct-1',
                occurred_at=occurred_at,
                amount=Decimal('10.00'),
                direction='credit',
                raw_payload_sha256=payload_hash,
            ),
        )
        event_two = SettlementEvent.objects.create(
            tenant=other_tenant,
            source=source_two,
            provider_code='provider-a',
            provider_account_reference='acct-1',
            external_event_id='evt-1',
            event_type='payment.settled',
            direction='credit',
            occurred_at=occurred_at,
            amount=Decimal('10.00'),
            currency='USD',
            raw_payload=raw_payload,
            raw_payload_sha256=payload_hash,
            idempotency_key=build_settlement_idempotency_key(
                tenant_id=str(other_tenant.id),
                provider_code='provider-a',
                external_event_id='evt-1',
                provider_account_reference='acct-1',
                occurred_at=occurred_at,
                amount=Decimal('10.00'),
                direction='credit',
                raw_payload_sha256=payload_hash,
            ),
        )

        self.assertNotEqual(event_one.idempotency_key, event_two.idempotency_key)


class TenantIntegrationsTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='pw')
        self.tenant = Tenant.objects.create(
            name='T1',
            slug='t1',
            contact_email='t1@example.com',
            created_by=self.user,
        )

    @patch('tenant_apps.integrations.tasks.requests.post')
    def test_dispatch_webhook_payload_signs_when_secret_present(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.text = 'ok'

        wh = TenantWebhook.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            target_url='https://example.com/webhook',
            event_type=TenantWebhookEventType.PURCHASE_ORDER_CREATED,
            is_active=True,
            signing_secret='secret',
        )

        payload = {'hello': 'world'}
        result = dispatch_webhook_payload.run(
            webhook_id=wh.id,
            tenant_id=str(self.tenant.id),
            event_type=wh.event_type,
            payload=payload,
        )
        self.assertTrue(result['success'])

        _, kwargs = mock_post.call_args
        headers = kwargs['headers']
        self.assertIn('X-PM-Signature', headers)
        self.assertEqual(headers['X-PM-Event'], wh.event_type)

    @patch('tenant_apps.integrations.tasks.requests.post')
    @patch('apps.tenants.rls.set_current_tenant', return_value=RlsSetResult(ok=False, error='db unavailable'))
    def test_dispatch_webhook_payload_skips_when_rls_set_fails(self, mock_set_current_tenant, mock_post):
        wh = TenantWebhook.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            target_url='https://example.com/webhook',
            event_type=TenantWebhookEventType.PURCHASE_ORDER_CREATED,
            is_active=True,
            signing_secret='secret',
        )

        result = dispatch_webhook_payload.run(
            webhook_id=wh.id,
            tenant_id=str(self.tenant.id),
            event_type=wh.event_type,
            payload={'hello': 'world'},
        )

        self.assertFalse(result['success'])
        self.assertEqual(result['reason'], 'rls_set_failed')
        self.assertIn('db unavailable', result.get('error', ''))
        mock_set_current_tenant.assert_called_once_with(str(self.tenant.id))
        mock_post.assert_not_called()


class SettlementSourceApiTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f'admin-{unique}', password='pw')
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name=f'Other {unique}',
            slug=f'other-{unique}',
            contact_email=f'other-{unique}@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)
        self.tenant_header = {'HTTP_X_TENANT_ID': str(self.tenant.id)}

    def test_create_settlement_source_returns_one_time_hmac_secret(self):
        response = self.client.post(
            '/api/v1/settlement-sources/',
            {
                'name': 'Stripe Settlements',
                'provider_code': 'stripe',
                'provider_account_reference': 'acct_123',
                'auth_mode': SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
            },
            format='json',
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data['provider_code'], 'stripe')
        self.assertIn('signing_secret', response.data)
        self.assertTrue(response.data['public_ingest_url'].endswith('/events/'))
        self.assertEqual(SettlementSource.objects.filter(tenant=self.tenant).count(), 1)

    def test_settlement_source_cross_tenant_detail_is_hidden(self):
        source = SettlementSource.objects.create(
            tenant=self.other_tenant,
            name='Other Source',
            provider_code='stripe',
            provider_account_reference='acct-other',
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
            created_by=self.user,
        )

        response = self.client.get(f'/api/v1/settlement-sources/{source.id}/', **self.tenant_header)

        self.assertEqual(response.status_code, 404)


class SettlementIngestApiTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f'settlement-{unique}', password='pw')
        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name=f'Other {unique}',
            slug=f'other-{unique}',
            contact_email=f'other-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

    def _create_source(self, *, tenant: Tenant, auth_mode: str) -> tuple[SettlementSource, str]:
        source = SettlementSource.objects.create(
            tenant=tenant,
            name='Settlement Source',
            provider_code='stripe',
            provider_account_reference='acct_live',
            auth_mode=auth_mode,
            created_by=self.user,
        )
        _, credential = source.provision_credential(created_by=self.user)
        source.refresh_from_db()
        return source, credential

    @patch('tenant_apps.integrations.views.process_settlement_event.delay')
    def test_public_ingest_with_hmac_journals_event_and_does_not_create_paymenttransaction(self, delay_mock):
        delay_mock.return_value = SimpleNamespace(id='task-123')
        source, secret = self._create_source(
            tenant=self.tenant,
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
        )
        body = json.dumps(
            {
                'external_event_id': 'evt-100',
                'event_type': 'payment.settled',
                'direction': 'credit',
                'occurred_at': '2026-05-06T10:00:00Z',
                'amount': '25.50',
                'currency': 'usd',
            },
            separators=(',', ':'),
        ).encode('utf-8')
        timestamp = '1715000000'
        signature = sign_timestamped_body(secret, timestamp, body)

        response = self.client.generic(
            'POST',
            f'/api/v1/tenants/{self.tenant.id}/integrations/settlement-sources/{source.public_id}/events/',
            data=body,
            content_type='application/json',
            HTTP_X_PM_TIMESTAMP=timestamp,
            HTTP_X_PM_SIGNATURE=signature,
            HTTP_X_TENANT_ID=str(self.other_tenant.id),
        )

        self.assertEqual(response.status_code, 202, response.content)
        self.assertFalse(response.data['duplicate'])
        delay_mock.assert_called_once()
        event = SettlementEvent.objects.get(tenant=self.tenant)
        self.assertEqual(event.raw_payload, body.decode('utf-8'))
        self.assertEqual(event.raw_payload_sha256, build_raw_payload_sha256(body.decode('utf-8')))
        self.assertEqual(event.provider_code, source.provider_code)
        self.assertEqual(PaymentTransaction.objects.count(), 0)

    @patch('tenant_apps.integrations.views.process_settlement_event.delay')
    def test_public_ingest_with_api_key_auth_accepts(self, delay_mock):
        delay_mock.return_value = SimpleNamespace(id='task-123')
        source, api_key = self._create_source(
            tenant=self.tenant,
            auth_mode=SettlementSourceAuthMode.TENANT_API_KEY,
        )
        body = json.dumps(
            {
                'external_event_id': 'evt-200',
                'event_type': 'payment.settled',
                'direction': 'credit',
                'occurred_at': '2026-05-06T10:00:00Z',
                'amount': '30.00',
                'currency': 'USD',
            },
            separators=(',', ':'),
        ).encode('utf-8')

        response = self.client.generic(
            'POST',
            f'/api/v1/tenants/{self.tenant.id}/integrations/settlement-sources/{source.public_id}/events/',
            data=body,
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {api_key}',
        )

        self.assertEqual(response.status_code, 202, response.content)
        self.assertEqual(SettlementEvent.objects.filter(tenant=self.tenant).count(), 1)
        delay_mock.assert_called_once()
        self.assertEqual(PaymentTransaction.objects.count(), 0)

    @patch('tenant_apps.integrations.views.process_settlement_event.delay')
    def test_public_ingest_invalid_hmac_fails_closed(self, delay_mock):
        source, _ = self._create_source(
            tenant=self.tenant,
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
        )
        body = b'{"external_event_id":"evt-300","event_type":"payment.settled","direction":"credit","occurred_at":"2026-05-06T10:00:00Z","amount":"25.50","currency":"USD"}'

        response = self.client.generic(
            'POST',
            f'/api/v1/tenants/{self.tenant.id}/integrations/settlement-sources/{source.public_id}/events/',
            data=body,
            content_type='application/json',
            HTTP_X_PM_TIMESTAMP='1715000000',
            HTTP_X_PM_SIGNATURE='v1=bad',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(SettlementEvent.objects.count(), 0)
        delay_mock.assert_not_called()

    @patch('tenant_apps.integrations.views.process_settlement_event.delay')
    def test_public_ingest_hmac_uses_exact_raw_body(self, delay_mock):
        source, secret = self._create_source(
            tenant=self.tenant,
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
        )
        signed_body = b'{"external_event_id":"evt-301","event_type":"payment.settled","direction":"credit","occurred_at":"2026-05-06T10:00:00Z","amount":"25.50","currency":"USD"}'
        sent_body = b'{ "external_event_id" : "evt-301", "event_type" : "payment.settled", "direction" : "credit", "occurred_at" : "2026-05-06T10:00:00Z", "amount" : "25.50", "currency" : "USD" }'
        signature = sign_timestamped_body(secret, '1715000000', signed_body)

        response = self.client.generic(
            'POST',
            f'/api/v1/tenants/{self.tenant.id}/integrations/settlement-sources/{source.public_id}/events/',
            data=sent_body,
            content_type='application/json',
            HTTP_X_PM_TIMESTAMP='1715000000',
            HTTP_X_PM_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(SettlementEvent.objects.count(), 0)
        delay_mock.assert_not_called()

    @patch('tenant_apps.integrations.views.process_settlement_event.delay')
    def test_duplicate_public_ingest_reuses_same_event(self, delay_mock):
        delay_mock.return_value = SimpleNamespace(id='task-123')
        source, secret = self._create_source(
            tenant=self.tenant,
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
        )
        body = b'{"external_event_id":"evt-400","event_type":"payment.settled","direction":"credit","occurred_at":"2026-05-06T10:00:00Z","amount":"25.50","currency":"USD"}'
        signature = sign_timestamped_body(secret, '1715000000', body)
        url = f'/api/v1/tenants/{self.tenant.id}/integrations/settlement-sources/{source.public_id}/events/'

        first = self.client.generic(
            'POST',
            url,
            data=body,
            content_type='application/json',
            HTTP_X_PM_TIMESTAMP='1715000000',
            HTTP_X_PM_SIGNATURE=signature,
        )
        second = self.client.generic(
            'POST',
            url,
            data=body,
            content_type='application/json',
            HTTP_X_PM_TIMESTAMP='1715000001',
            HTTP_X_PM_SIGNATURE=sign_timestamped_body(secret, '1715000001', body),
        )

        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertFalse(first.data['duplicate'])
        self.assertTrue(second.data['duplicate'])
        self.assertEqual(SettlementEvent.objects.count(), 1)
        event = SettlementEvent.objects.get()
        self.assertEqual(event.delivery_count, 2)
        delay_mock.assert_called_once()


class SettlementTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='task-user', password='pw')
        self.tenant = Tenant.objects.create(
            name='Tenant Task',
            slug='tenant-task',
            contact_email='task@example.com',
            created_by=self.user,
        )
        self.source = SettlementSource.objects.create(
            tenant=self.tenant,
            name='Task Source',
            provider_code='stripe',
            provider_account_reference='acct_task',
            auth_mode=SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
            created_by=self.user,
        )
        raw_payload = '{"external_event_id":"evt-task","event_type":"payment.settled","direction":"credit","occurred_at":"2026-05-06T10:00:00Z","amount":"25.50","currency":"USD"}'
        payload_hash = build_raw_payload_sha256(raw_payload)
        self.event = SettlementEvent.objects.create(
            tenant=self.tenant,
            source=self.source,
            provider_code='stripe',
            provider_account_reference='acct_task',
            external_event_id='evt-task',
            event_type='payment.settled',
            direction='credit',
            occurred_at=datetime(2026, 5, 6, 10, 0, tzinfo=dt_timezone.utc),
            amount=Decimal('25.50'),
            currency='USD',
            raw_payload=raw_payload,
            raw_payload_sha256=payload_hash,
            idempotency_key=build_settlement_idempotency_key(
                tenant_id=str(self.tenant.id),
                provider_code='stripe',
                external_event_id='evt-task',
                provider_account_reference='acct_task',
                occurred_at=datetime(2026, 5, 6, 10, 0, tzinfo=dt_timezone.utc),
                amount=Decimal('25.50'),
                direction='credit',
                raw_payload_sha256=payload_hash,
            ),
        )

    @patch('apps.tenants.rls.reset_current_tenant')
    @patch('apps.tenants.rls.set_current_tenant', return_value=RlsSetResult(ok=True))
    def test_process_settlement_event_preserves_tenant_context_without_ledger_write(
        self,
        mock_set_current_tenant,
        mock_reset_current_tenant,
    ):
        result = process_settlement_event.run(self.event.id, str(self.tenant.id))

        self.event.refresh_from_db()
        self.assertTrue(result['success'])
        self.assertEqual(self.event.state, SettlementEventState.VALIDATED)
        self.assertEqual(self.event.normalized_payload['external_event_id'], 'evt-task')
        self.assertEqual(PaymentTransaction.objects.count(), 0)
        mock_set_current_tenant.assert_called_once_with(str(self.tenant.id))
        mock_reset_current_tenant.assert_called_once()


class SettlementContractTests(TestCase):
    def test_settlement_contract_anchors_webhook_first_payment_ledger(self):
        contract = get_settlement_reconciliation_contract()

        self.assertEqual(contract['version'], SETTLEMENT_CONTRACT_VERSION)
        self.assertEqual(
            contract['canonical_posted_payment_ledger'],
            'tenant_apps.invoices.models.PaymentTransaction',
        )
        self.assertEqual(contract['initial_adapter'], 'webhook')
        self.assertEqual(contract['raw_payload_hash_algorithm'], 'sha256')
        self.assertEqual(contract['raw_payload_hash_input_rule'], 'utf8_exact_raw_payload_string')
        self.assertIn('tenant_api_key', contract['accepted_authentication_modes'])
        self.assertIn('provider_hmac_signature', contract['accepted_authentication_modes'])
        self.assertIn('external_event_id', contract['idempotency_key_fields'])
        self.assertIn('raw_payload_sha256', contract['idempotency_fallback_fields'])
        self.assertIn('direct_bank_feed', contract['deferred_adapters'])
        self.assertIn('invoice', contract['payment_transaction_parent_links'])

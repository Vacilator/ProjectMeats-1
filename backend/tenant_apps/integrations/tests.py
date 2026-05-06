from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from apps.tenants.models import Tenant
from apps.tenants.rls import RlsSetResult

from .models import TenantAPIKey, TenantWebhook, TenantWebhookEventType, generate_api_key
from .settlement_contract import SETTLEMENT_CONTRACT_VERSION, get_settlement_reconciliation_contract
from .tasks import dispatch_webhook_payload


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

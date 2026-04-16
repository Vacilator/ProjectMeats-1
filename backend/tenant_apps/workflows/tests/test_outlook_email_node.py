import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.nodes.outlook_email import OutlookEmailNode


class OutlookEmailNodeDegradationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f'testuser-{unique_id}',
            email=f'test-{unique_id}@example.com',
            password='testpass123',
        )
        cls.tenant = Tenant.objects.create(
            name=f'Test Company {unique_id}',
            slug=f'test-company-{unique_id}',
            contact_email=f'admin-{unique_id}@testcompany.com',
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role='owner')

    def _make_node(self) -> OutlookEmailNode:
        return OutlookEmailNode(
            node_id='n1',
            config={
                'to': ['buyer@example.com'],
                'subject': 'Hello',
                'body': 'Body',
            },
        )

    def test_missing_outlook_connection_returns_structured_code(self):
        node = self._make_node()
        result = node.execute(context={}, tenant_id=self.tenant.id)

        self.assertEqual(result.get('status'), 'error')
        self.assertEqual(result.get('error_code'), 'not_connected')
        self.assertIn('cta', result)
        self.assertEqual(result.get('cta', {}).get('url'), '/settings/email-integrations')

    def test_decryption_failure_returns_structured_code(self):
        ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            is_active=True,
            access_token='not-a-fernet-token',
            refresh_token=None,
            token_expiry=timezone.now() + timedelta(days=365),
            connected_email='connected@example.com',
            connected_name='Connected User',
        )

        node = self._make_node()
        result = node.execute(context={}, tenant_id=self.tenant.id)

        self.assertEqual(result.get('status'), 'error')
        self.assertEqual(result.get('error_code'), 'decryption_failed')
        self.assertEqual(result.get('cta', {}).get('url'), '/settings/email-integrations')

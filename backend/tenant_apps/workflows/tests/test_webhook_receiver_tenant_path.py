from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantDomain, TenantUser
from tenant_apps.workflows.models import TenantWorkflow, TriggerType, WorkflowStatus


@override_settings(ALLOWED_HOSTS=['*'])
class WorkflowWebhookTenantPathTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.client = APIClient()
        cache.clear()

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')

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

        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

        self.tenant_domain = TenantDomain.objects.create(
            tenant=self.tenant,
            domain=f'{self.tenant.slug}.example.com',
            is_primary=True,
        )

        self.webhook_token = 'tok_' + uuid.uuid4().hex
        self.webhook_secret = 'sec_' + uuid.uuid4().hex

        self.workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name='WF',
            status=WorkflowStatus.ACTIVE,
            trigger_type=TriggerType.WEBHOOK,
            trigger_config={
                'webhook_token': self.webhook_token,
                'webhook_secret': self.webhook_secret,
                'webhook_auth': 'token',
                'webhook_method': ['POST'],
            },
            created_by=self.user,
        )

    def tearDown(self):
        cache.clear()

    @patch('tenant_apps.workflows.views_triggers.set_current_tenant')
    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_tenant_scoped_webhook_executes_and_sets_rls(self, execute_workflow, set_current_tenant):
        events: list[str] = []

        def set_side_effect(tid: str):
            events.append('set_current_tenant')
            return SimpleNamespace(ok=True)

        set_current_tenant.side_effect = set_side_effect
        execute_workflow.return_value = SimpleNamespace(id=uuid.uuid4(), status='success')

        url = (
            f'/api/v1/tenants/{self.tenant.id}/workflows/webhooks/'
            f'{self.workflow.id}/{self.webhook_token}/'
        )

        orig_select_related = TenantWorkflow.objects.select_related

        def select_related_spy(*args, **kwargs):
            events.append('workflow_select_related')
            return orig_select_related(*args, **kwargs)

        with patch('tenant_apps.workflows.views_triggers.TenantWorkflow.objects.select_related', side_effect=select_related_spy):
            resp = self.client.post(
                url,
                data={'hello': 'world'},
                format='json',
                HTTP_AUTHORIZATION=f'Bearer {self.webhook_secret}',
                # Public endpoints must not honor X-Tenant-ID; path param is canonical.
                HTTP_X_TENANT_ID=str(self.other_tenant.id),
            )

        self.assertEqual(resp.status_code, 200, resp.content)
        set_current_tenant.assert_called_with(str(self.tenant.id))
        execute_workflow.assert_called()

        # Critical: RLS tenant context must be set BEFORE hitting tenant-scoped ORM.
        self.assertIn('set_current_tenant', events)
        self.assertIn('workflow_select_related', events)
        self.assertLess(events.index('set_current_tenant'), events.index('workflow_select_related'))

    @patch('tenant_apps.workflows.views_triggers.set_current_tenant')
    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_tenant_mismatch_fails_closed(self, execute_workflow, set_current_tenant):
        set_current_tenant.return_value = SimpleNamespace(ok=True)
        execute_workflow.return_value = SimpleNamespace(id=uuid.uuid4(), status='success')

        url = (
            f'/api/v1/tenants/{self.other_tenant.id}/workflows/webhooks/'
            f'{self.workflow.id}/{self.webhook_token}/'
        )

        resp = self.client.post(
            url,
            data={'hello': 'world'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {self.webhook_secret}',
        )

        self.assertEqual(resp.status_code, 404)
        execute_workflow.assert_not_called()

    @patch('tenant_apps.workflows.views_triggers.set_current_tenant')
    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_invalid_token_fails_closed(self, execute_workflow, set_current_tenant):
        set_current_tenant.return_value = SimpleNamespace(ok=True)
        execute_workflow.return_value = SimpleNamespace(id=uuid.uuid4(), status='success')

        url = (
            f'/api/v1/tenants/{self.tenant.id}/workflows/webhooks/'
            f'{self.workflow.id}/wrong-token/'
        )

        resp = self.client.post(
            url,
            data={'hello': 'world'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {self.webhook_secret}',
        )

        self.assertEqual(resp.status_code, 404)
        execute_workflow.assert_not_called()

    @patch('tenant_apps.workflows.views_triggers.set_current_tenant')
    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_legacy_webhook_endpoint_still_executes(self, execute_workflow, set_current_tenant):
        set_current_tenant.return_value = SimpleNamespace(ok=True)
        execute_workflow.return_value = SimpleNamespace(id=uuid.uuid4(), status='success')

        url = f'/api/v1/workflows/webhooks/{self.workflow.id}/{self.webhook_token}/'

        resp = self.client.post(
            url,
            data={'hello': 'world'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {self.webhook_secret}',
            HTTP_HOST=self.tenant_domain.domain,
        )

        self.assertEqual(resp.status_code, 200)
        set_current_tenant.assert_called_with(str(self.tenant.id))
        execute_workflow.assert_called()

    @patch('tenant_apps.workflows.views_triggers.set_current_tenant')
    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_public_webhooks_ignore_global_throttles(self, execute_workflow, set_current_tenant):
        set_current_tenant.return_value = SimpleNamespace(ok=True)
        execute_workflow.return_value = SimpleNamespace(id=uuid.uuid4(), status='success')

        tenant_url = (
            f'/api/v1/tenants/{self.tenant.id}/workflows/webhooks/'
            f'{self.workflow.id}/{self.webhook_token}/'
        )
        legacy_url = f'/api/v1/workflows/webhooks/{self.workflow.id}/{self.webhook_token}/'
        throttled_settings = {
            **settings.REST_FRAMEWORK,
            'DEFAULT_THROTTLE_RATES': {
                **settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}),
                'anon': '1/minute',
                'user': '1/minute',
            },
        }

        with override_settings(REST_FRAMEWORK=throttled_settings):
            first_response = self.client.post(
                tenant_url,
                data={'hello': 'world'},
                format='json',
                HTTP_AUTHORIZATION=f'Bearer {self.webhook_secret}',
            )
            second_response = self.client.post(
                legacy_url,
                data={'hello': 'world'},
                format='json',
                HTTP_AUTHORIZATION=f'Bearer {self.webhook_secret}',
                HTTP_HOST=self.tenant_domain.domain,
            )

        self.assertEqual(first_response.status_code, 200, first_response.content)
        self.assertEqual(second_response.status_code, 200, second_response.content)

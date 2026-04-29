from __future__ import annotations

import inspect
import uuid

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test.utils import override_settings
from rest_framework import status, viewsets
from rest_framework.test import APITestCase

from apps.system.models import ConfigAuditLog, SystemChoiceItem, SystemChoiceList, TenantChoiceOverride, TenantConfig
from apps.system.views import choice_viewsets
from apps.tenants.models import Tenant, TenantDomain, TenantUser


User = get_user_model()


@override_settings(ALLOWED_HOSTS=['*'])
class SystemConfigChoiceViewSetsTenantIsolationTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')
        self.client.force_authenticate(self.user)

        self.tenant_a = Tenant.objects.create(
            name=f'Tenant A {unique}',
            slug=f'tenant-a-{unique}',
            contact_email=f'{unique}-a@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f'Tenant B {unique}',
            slug=f'tenant-b-{unique}',
            contact_email=f'{unique}-b@example.com',
            is_active=True,
            created_by=self.user,
        )

        self.domain_a = TenantDomain.objects.create(
            tenant=self.tenant_a,
            domain=f'{self.tenant_a.slug}.example.com',
            is_primary=True,
        )
        self.domain_b = TenantDomain.objects.create(
            tenant=self.tenant_b,
            domain=f'{self.tenant_b.slug}.example.com',
            is_primary=True,
        )

        # Mark user as an admin for tenant A (this also promotes is_staff=True via signal).
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='admin', is_active=True)

        self.choice_list = SystemChoiceList.objects.create(
            name=f'Protein Type {unique}',
            slug=f'protein_type_{unique}',
            description='Test list',
            is_extensible=True,
            is_reorderable=True,
            created_by=self.user,
        )

        self.system_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            tenant=None,
            value='BEEF',
            label='Beef',
            order=1,
            is_active=True,
        )
        self.tenant_a_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            tenant=self.tenant_a,
            value='WAGYU',
            label='Wagyu',
            order=100,
            is_active=True,
        )
        self.tenant_b_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            tenant=self.tenant_b,
            value='VENISON',
            label='Venison',
            order=200,
            is_active=True,
        )

        self.tenant_b_config = TenantConfig.objects.create(
            tenant=self.tenant_b,
            key='ui.theme.primary_color',
            value='not-for-tenant-a',
            updated_by=self.user,
        )

        self.tenant_b_override = TenantChoiceOverride.objects.create(
            tenant=self.tenant_b,
            choice_list=self.choice_list,
            disabled_system_items=[self.system_item.id],
            display_config={},
            updated_by=self.user,
        )

        ct = ContentType.objects.get_for_model(TenantConfig)
        self.tenant_b_log = ConfigAuditLog.objects.create(
            content_type=ct,
            object_id=str(self.tenant_b_config.id),
            entity_type='TenantConfig',
            entity_name=self.tenant_b_config.key,
            change_type=ConfigAuditLog.ChangeType.UPDATE,
            tenant=self.tenant_b,
            user=self.user,
            user_email='u@example.com',
            notes='tenant b only',
        )
        self.system_log = ConfigAuditLog.objects.create(
            content_type=ct,
            object_id='system',
            entity_type='System',
            entity_name='system',
            change_type=ConfigAuditLog.ChangeType.UPDATE,
            tenant=None,
            user=self.user,
            user_email='u@example.com',
            notes='system log',
        )

        self.tenant_headers = {
            'HTTP_X_TENANT_ID': str(self.tenant_a.id),
            'HTTP_HOST': self.domain_a.domain,
        }

    def _get_results(self, resp):
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_choice_items_list_is_tenant_scoped_for_tenant_admin(self):
        resp = self.client.get('/api/v1/system/choice-items/?paginate=false', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        results = self._get_results(resp)
        ids = {row.get('id') for row in results}

        self.assertIn(str(self.system_item.id), ids)
        self.assertIn(str(self.tenant_a_item.id), ids)
        self.assertNotIn(str(self.tenant_b_item.id), ids)

    def test_choice_items_retrieve_other_tenant_fails_closed(self):
        resp = self.client.get(f'/api/v1/system/choice-items/{self.tenant_b_item.id}/', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_configs_list_excludes_other_tenant(self):
        resp = self.client.get('/api/v1/system/tenant-configs/', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        results = self._get_results(resp)
        ids = {row.get('id') for row in results}
        self.assertNotIn(str(self.tenant_b_config.id), ids)

    def test_tenant_configs_retrieve_other_tenant_fails_closed(self):
        resp = self.client.get(f'/api/v1/system/tenant-configs/{self.tenant_b_config.id}/', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_overrides_list_excludes_other_tenant(self):
        resp = self.client.get('/api/v1/system/tenant-overrides/', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        results = self._get_results(resp)
        ids = {row.get('id') for row in results}
        self.assertNotIn(str(self.tenant_b_override.id), ids)

    def test_tenant_overrides_retrieve_other_tenant_fails_closed(self):
        resp = self.client.get(f'/api/v1/system/tenant-overrides/{self.tenant_b_override.id}/', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_audit_logs_list_excludes_other_tenant_but_includes_system(self):
        resp = self.client.get('/api/v1/system/audit-logs/', **self.tenant_headers)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        results = self._get_results(resp)
        ids = {row.get('id') for row in results}

        self.assertIn(str(self.system_log.id), ids)
        self.assertNotIn(str(self.tenant_b_log.id), ids)

    def test_choice_viewsets_module_permissions_do_not_reference_is_staff(self):
        self.assertFalse(
            hasattr(choice_viewsets, 'IsAdminOrReadOnly'),
            'choice_viewsets must not expose a permission class that grants writes based only on is_staff',
        )

        for name, obj in inspect.getmembers(choice_viewsets, inspect.isclass):
            if obj.__module__ != choice_viewsets.__name__:
                continue
            if not issubclass(obj, viewsets.ViewSetMixin):
                continue

            for permission in getattr(obj, 'permission_classes', []):
                try:
                    permission_source = inspect.getsource(permission.has_permission)
                except (AttributeError, OSError, TypeError) as exc:
                    self.fail(
                        f'{name} uses {permission.__name__}, but the regression guard could not inspect '
                        f'its has_permission() implementation: {exc}'
                    )
                self.assertNotIn(
                    'is_staff',
                    permission_source,
                    f'{name} must not use {permission.__name__} because it references is_staff',
                )

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.customers.models import Customer
from tenant_apps.locations.models import Location


class SoftDeleteReliabilityTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='softdelete-user', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Soft Delete Tenant',
            slug='soft-delete-tenant',
            contact_email='softdelete@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

    def test_primary_customer_delete_is_soft_delete(self):
        customer = Customer.objects.create(tenant=self.tenant, name='Acme Beef')

        customer.delete()

        self.assertFalse(Customer.objects.filter(id=customer.id).exists())
        restored = Customer.all_objects.get(id=customer.id)
        self.assertTrue(restored.is_deleted)
        self.assertIsNotNone(restored.deleted_at)

    def test_location_code_can_be_reused_after_soft_delete(self):
        first = Location.objects.create(tenant=self.tenant, name='Dock 1', code='DOCK-A')

        first.delete()

        replacement = Location.objects.create(tenant=self.tenant, name='Dock 1 Replacement', code='DOCK-A')
        self.assertNotEqual(first.id, replacement.id)
        self.assertTrue(Location.objects.filter(id=replacement.id, code='DOCK-A').exists())


class MutationSignalTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='mutation-user', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Mutation Tenant',
            slug='mutation-tenant',
            contact_email='mutations@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

    @patch('apps.core.signals_realtime.broadcast_tenant_mutation')
    def test_soft_delete_emits_delete_action(self, broadcast_mock):
        customer = Customer.objects.create(tenant=self.tenant, name='Realtime Customer')
        customer.name = 'Realtime Customer Updated'
        customer.save(update_fields=['name'])
        customer.delete()

        actions = [kwargs['action'] for _, kwargs in broadcast_mock.call_args_list]
        self.assertEqual(actions, ['CREATE', 'UPDATE', 'DELETE'])

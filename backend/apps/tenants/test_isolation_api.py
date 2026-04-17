"""API-level tenant isolation tests (shared-schema).

These tests ensure list endpoints never return cross-tenant data when a request
is scoped via `X-Tenant-ID`.

They intentionally assert by unique record names (not tenant_id fields), since
many serializers omit the tenant field.
"""

from __future__ import annotations

from datetime import date

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.activity_models import ActivityLog
from apps.tenants.models import Tenant, TenantConfiguration, TenantUser
from tenant_apps.carriers.models import Carrier
from tenant_apps.contacts.models import Contact
from tenant_apps.customers.models import Customer
from tenant_apps.invoices.models import Invoice
from tenant_apps.locations.models import Location
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.suppliers.models import Supplier


def _unwrap_results(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get('results'), list):
        return data['results']
    return []


class TenantIsolationApiTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username='user_a', password='pass')
        self.user_b = User.objects.create_user(username='user_b', password='pass')

        self.tenant_a = Tenant.objects.create(
            name='Tenant A',
            slug='tenant-a',
            contact_email='a@example.com',
            created_by=self.user_a,
        )
        self.tenant_b = Tenant.objects.create(
            name='Tenant B',
            slug='tenant-b',
            contact_email='b@example.com',
            created_by=self.user_b,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user_a, role='owner', is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_b, role='owner', is_active=True)
        # Cross-tenant regression guard: user_a is admin in both tenants, but API responses
        # must still be scoped to the current request tenant context.
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_a, role='admin', is_active=True)

        self.client.force_authenticate(user=self.user_a)
        self.tenant_header = {'HTTP_X_TENANT_ID': str(self.tenant_a.id)}

    def _assert_only_a(self, resp, a_marker: str, b_marker: str):
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = _unwrap_results(resp.data)
        self.assertTrue(len(results) >= 1)

        joined = str(resp.data)
        self.assertIn(a_marker, joined)
        self.assertNotIn(b_marker, joined)

    def test_suppliers_list_is_tenant_scoped(self):
        Supplier.objects.create(tenant=self.tenant_a, name='Supplier A ONLY')
        Supplier.objects.create(tenant=self.tenant_b, name='Supplier B ONLY')

        resp = self.client.get('/api/v1/suppliers/', **self.tenant_header)
        self._assert_only_a(resp, 'Supplier A ONLY', 'Supplier B ONLY')

    def test_customers_list_is_tenant_scoped(self):
        Customer.objects.create(tenant=self.tenant_a, name='Customer A ONLY')
        Customer.objects.create(tenant=self.tenant_b, name='Customer B ONLY')

        resp = self.client.get('/api/v1/customers/', **self.tenant_header)
        self._assert_only_a(resp, 'Customer A ONLY', 'Customer B ONLY')

    def test_contacts_list_is_tenant_scoped(self):
        Contact.objects.create(tenant=self.tenant_a, first_name='AONLY', last_name='User')
        Contact.objects.create(tenant=self.tenant_b, first_name='BONLY', last_name='User')

        resp = self.client.get('/api/v1/contacts/', **self.tenant_header)
        self._assert_only_a(resp, 'AONLY', 'BONLY')

    def test_carriers_list_is_tenant_scoped(self):
        Carrier.objects.create(tenant=self.tenant_a, name='Carrier A ONLY', code='AONLY')
        Carrier.objects.create(tenant=self.tenant_b, name='Carrier B ONLY', code='BONLY')

        resp = self.client.get('/api/v1/carriers/', **self.tenant_header)
        self._assert_only_a(resp, 'Carrier A ONLY', 'Carrier B ONLY')

    def test_locations_list_is_tenant_scoped(self):
        Location.objects.create(tenant=self.tenant_a, name='Location A ONLY')
        Location.objects.create(tenant=self.tenant_b, name='Location B ONLY')

        resp = self.client.get('/api/v1/locations/', **self.tenant_header)
        self._assert_only_a(resp, 'Location A ONLY', 'Location B ONLY')

    def test_purchase_orders_list_is_tenant_scoped(self):
        supplier_a = Supplier.objects.create(tenant=self.tenant_a, name='PO Supplier A')
        supplier_b = Supplier.objects.create(tenant=self.tenant_b, name='PO Supplier B')

        PurchaseOrder.objects.create(
            tenant=self.tenant_a,
            supplier=supplier_a,
            order_number='PO-A-ONLY',
            order_date=date.today(),
        )
        PurchaseOrder.objects.create(
            tenant=self.tenant_b,
            supplier=supplier_b,
            order_number='PO-B-ONLY',
            order_date=date.today(),
        )

        resp = self.client.get('/api/v1/purchase-orders/', **self.tenant_header)
        self._assert_only_a(resp, 'PO-A-ONLY', 'PO-B-ONLY')

    def test_invoices_list_is_tenant_scoped(self):
        customer_a = Customer.objects.create(tenant=self.tenant_a, name='Invoice Customer A')
        customer_b = Customer.objects.create(tenant=self.tenant_b, name='Invoice Customer B')

        Invoice.objects.create(tenant=self.tenant_a, customer=customer_a, invoice_number='INV-A-ONLY')
        Invoice.objects.create(tenant=self.tenant_b, customer=customer_b, invoice_number='INV-B-ONLY')

        resp = self.client.get('/api/v1/invoices/', **self.tenant_header)
        self._assert_only_a(resp, 'INV-A-ONLY', 'INV-B-ONLY')

    def test_workflows_list_is_tenant_scoped(self):
        # Minimal smoke for workflows endpoint filtering behavior (no fixtures required).
        resp = self.client.get('/api/v1/workflows/workflows/', **self.tenant_header)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_tenant_users_list_is_tenant_scoped(self):
        resp = self.client.get('/api/v1/tenant-users/', **self.tenant_header)
        self._assert_only_a(resp, 'user_a', 'user_b')

    def test_activity_logs_list_is_tenant_scoped(self):
        ActivityLog.log_activity(
            tenant=self.tenant_a,
            user=self.user_a,
            action='test.log',
            description='LOG-A-ONLY',
            entity_type='Test',
            entity_id=None,
            metadata={},
            ip_address='127.0.0.1',
        )
        ActivityLog.log_activity(
            tenant=self.tenant_b,
            user=self.user_b,
            action='test.log',
            description='LOG-B-ONLY',
            entity_type='Test',
            entity_id=None,
            metadata={},
            ip_address='127.0.0.1',
        )

        resp = self.client.get('/api/v1/activity-logs/', **self.tenant_header)
        self._assert_only_a(resp, 'LOG-A-ONLY', 'LOG-B-ONLY')

    def test_configurations_list_is_tenant_scoped(self):
        TenantConfiguration.objects.create(
            tenant=self.tenant_a,
            category='general',
            key='cfg_a',
            display_name='CFG-A-ONLY',
            description='cfg',
            value='1',
            data_type='string',
            updated_by=self.user_a,
        )
        TenantConfiguration.objects.create(
            tenant=self.tenant_b,
            category='general',
            key='cfg_b',
            display_name='CFG-B-ONLY',
            description='cfg',
            value='1',
            data_type='string',
            updated_by=self.user_b,
        )

        resp = self.client.get('/api/v1/configurations/', **self.tenant_header)
        self._assert_only_a(resp, 'CFG-A-ONLY', 'CFG-B-ONLY')

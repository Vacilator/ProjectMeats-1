from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.tenants.models import Tenant
from tenant_apps.deals.views import DealViewSet
from tenant_apps.customers.views import CustomerViewSet
from tenant_apps.invoices.views import ClaimViewSet, InvoiceViewSet, PaymentTransactionViewSet
from tenant_apps.locations.views import LocationViewSet
from tenant_apps.plants.views import PlantViewSet
from tenant_apps.products.views import MasterProductViewSet
from tenant_apps.purchase_orders.views import PurchaseOrderViewSet
from tenant_apps.sales_orders.views import SalesOrderViewSet


User = get_user_model()


class CreateRequiresTenantContextTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', password='pw')
        self.admin_user = User.objects.create_user(username='admin', password='pw', is_staff=True)
        self.tenant = Tenant.objects.create(name='T', slug='t', contact_email='t@example.com', is_active=True)

    def _mock_serializer(self):
        serializer = Mock()
        serializer.save = Mock()
        serializer.data = {}
        return serializer

    def _assert_requires_tenant(self, view_cls):
        view = view_cls()
        view.request = SimpleNamespace(user=self.user, tenant=None)
        with self.assertRaises(DRFValidationError):
            view.perform_create(self._mock_serializer())

    def test_purchase_orders_create_requires_tenant(self):
        self._assert_requires_tenant(PurchaseOrderViewSet)

    def test_sales_orders_create_requires_tenant(self):
        self._assert_requires_tenant(SalesOrderViewSet)

    def test_customers_create_requires_tenant(self):
        self._assert_requires_tenant(CustomerViewSet)

    def test_plants_create_requires_tenant(self):
        self._assert_requires_tenant(PlantViewSet)

    def test_locations_create_requires_tenant(self):
        self._assert_requires_tenant(LocationViewSet)

    def test_products_create_requires_tenant(self):
        self._assert_requires_tenant(MasterProductViewSet)

    def test_deals_create_requires_tenant(self):
        self._assert_requires_tenant(DealViewSet)

    def test_invoices_create_requires_tenant(self):
        self._assert_requires_tenant(InvoiceViewSet)

    def test_claims_create_requires_tenant(self):
        self._assert_requires_tenant(ClaimViewSet)

    def test_payment_transactions_create_requires_tenant(self):
        self._assert_requires_tenant(PaymentTransactionViewSet)

    def test_locations_queryset_without_tenant_is_empty(self):
        view = LocationViewSet()
        view.request = SimpleNamespace(tenant=None, query_params={})
        self.assertFalse(view.get_queryset().exists())

    def test_products_queryset_without_tenant_is_empty(self):
        view = MasterProductViewSet()
        view.request = SimpleNamespace(tenant=None)
        self.assertFalse(view.get_queryset().exists())

    def test_payment_transactions_queryset_without_tenant_is_empty(self):
        view = PaymentTransactionViewSet()
        view.request = SimpleNamespace(tenant=None)
        self.assertFalse(view.get_queryset().exists())

    def test_deals_restore_requires_tenant_context(self):
        view = DealViewSet()
        request = SimpleNamespace(user=self.admin_user, tenant=None)
        response = view.restore(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error'), 'Tenant not found')

    def test_invoices_restore_requires_tenant_context(self):
        view = InvoiceViewSet()
        request = SimpleNamespace(user=self.admin_user, tenant=None)
        response = view.restore(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error'), 'Tenant not found')

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.tenants.models import Tenant
from tenant_apps.customers.views import CustomerViewSet
from tenant_apps.plants.views import PlantViewSet
from tenant_apps.purchase_orders.views import PurchaseOrderViewSet
from tenant_apps.sales_orders.views import SalesOrderViewSet


User = get_user_model()


class CreateRequiresTenantContextTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', password='pw')
        self.tenant = Tenant.objects.create(name='T', slug='t', contact_email='t@example.com', is_active=True)

    def _mock_serializer(self):
        serializer = Mock()
        serializer.save = Mock()
        serializer.data = {}
        return serializer

    def test_purchase_orders_create_requires_tenant(self):
        view = PurchaseOrderViewSet()
        view.request = SimpleNamespace(user=self.user, tenant=None)
        with self.assertRaises(DRFValidationError):
            view.perform_create(self._mock_serializer())

    def test_sales_orders_create_requires_tenant(self):
        view = SalesOrderViewSet()
        view.request = SimpleNamespace(user=self.user, tenant=None)
        with self.assertRaises(DRFValidationError):
            view.perform_create(self._mock_serializer())

    def test_customers_create_requires_tenant(self):
        view = CustomerViewSet()
        view.request = SimpleNamespace(user=self.user, tenant=None)
        with self.assertRaises(DRFValidationError):
            view.perform_create(self._mock_serializer())

    def test_plants_create_requires_tenant(self):
        view = PlantViewSet()
        view.request = SimpleNamespace(user=self.user, tenant=None)
        with self.assertRaises(DRFValidationError):
            view.perform_create(self._mock_serializer())

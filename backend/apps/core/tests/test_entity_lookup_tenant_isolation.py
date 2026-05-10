"""Cross-tenant entity_lookup isolation tests.

Verifies that:
- entity_lookup returns only records for the authenticated tenant
- entity_lookup with a cross-tenant context returns 0 records for the other tenant's data
- entity_lookup without tenant context returns 400 (fail-closed)
- Multi-tenant users without explicit tenant header get 400
"""

from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase, RequestFactory

from apps.tenants.models import Tenant, TenantUser
from apps.core.entity_views import entity_lookup
from tenant_apps.customers.models import Customer
from tenant_apps.suppliers.models import Supplier


def _authed_get(factory: RequestFactory, path: str, user, tenant=None, headers=None):
    """Build a GET request with forced auth and optional tenant."""
    request = factory.get(path, **({"headers": headers} if headers else {}))
    request.user = user
    request.tenant = tenant
    return request


class EntityLookupTenantIsolationTests(TestCase):
    """entity_lookup must never leak records across tenants."""

    def setUp(self):
        tag = uuid.uuid4().hex[:8]
        self.factory = RequestFactory()

        self.user_a = User.objects.create_user(username=f"lookup-a-{tag}", password="pw")
        self.user_b = User.objects.create_user(username=f"lookup-b-{tag}", password="pw")
        self.user_multi = User.objects.create_user(username=f"lookup-multi-{tag}", password="pw")

        self.tenant_a = Tenant.objects.create(
            name=f"LookupA {tag}", slug=f"lookup-a-{tag}",
            contact_email=f"la-{tag}@example.com", is_active=True, created_by=self.user_a,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"LookupB {tag}", slug=f"lookup-b-{tag}",
            contact_email=f"lb-{tag}@example.com", is_active=True, created_by=self.user_b,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user_a, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_b, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user_multi, role="member", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_multi, role="member", is_active=True)

        # Customer in each tenant
        self.cust_a = Customer.objects.create(tenant=self.tenant_a, name=f"CustomerA-{tag}")
        self.cust_b = Customer.objects.create(tenant=self.tenant_b, name=f"CustomerB-{tag}")

        # Supplier in each tenant
        self.sup_a = Supplier.objects.create(tenant=self.tenant_a, name=f"SupplierA-{tag}")
        self.sup_b = Supplier.objects.create(tenant=self.tenant_b, name=f"SupplierB-{tag}")

    def _results(self, response):
        return response.data.get("results", [])

    # --- Customer lookup ---

    def test_customer_lookup_returns_own_tenant_only(self):
        req = _authed_get(self.factory, "/api/v1/entities/customer/lookup/", self.user_a, self.tenant_a)
        resp = entity_lookup(req, "customer")
        self.assertEqual(resp.status_code, 200)
        labels = {r["label"] for r in self._results(resp)}
        self.assertIn(self.cust_a.name, labels)
        self.assertNotIn(self.cust_b.name, labels)

    def test_customer_lookup_cross_tenant_hides_foreign_data(self):
        req = _authed_get(self.factory, "/api/v1/entities/customer/lookup/", self.user_a, self.tenant_b)
        resp = entity_lookup(req, "customer")
        self.assertEqual(resp.status_code, 200)
        labels = {r["label"] for r in self._results(resp)}
        self.assertNotIn(self.cust_a.name, labels)

    def test_customer_lookup_no_tenant_single_membership_auto_resolves(self):
        """Single-tenant user without explicit tenant auto-resolves to their sole tenant."""
        req = _authed_get(self.factory, "/api/v1/entities/customer/lookup/", self.user_a, None)
        resp = entity_lookup(req, "customer")
        self.assertEqual(resp.status_code, 200)
        labels = {r["label"] for r in self._results(resp)}
        self.assertIn(self.cust_a.name, labels)
        self.assertNotIn(self.cust_b.name, labels)

    # --- Supplier lookup ---

    def test_supplier_lookup_returns_own_tenant_only(self):
        req = _authed_get(self.factory, "/api/v1/entities/supplier/lookup/", self.user_b, self.tenant_b)
        resp = entity_lookup(req, "supplier")
        self.assertEqual(resp.status_code, 200)
        labels = {r["label"] for r in self._results(resp)}
        self.assertIn(self.sup_b.name, labels)
        self.assertNotIn(self.sup_a.name, labels)

    def test_supplier_lookup_cross_tenant_hides_foreign_data(self):
        req = _authed_get(self.factory, "/api/v1/entities/supplier/lookup/", self.user_b, self.tenant_a)
        resp = entity_lookup(req, "supplier")
        self.assertEqual(resp.status_code, 200)
        labels = {r["label"] for r in self._results(resp)}
        self.assertNotIn(self.sup_b.name, labels)

    def test_supplier_lookup_no_tenant_single_membership_auto_resolves(self):
        """Single-tenant user without explicit tenant auto-resolves safely."""
        req = _authed_get(self.factory, "/api/v1/entities/supplier/lookup/", self.user_b, None)
        resp = entity_lookup(req, "supplier")
        self.assertEqual(resp.status_code, 200)
        labels = {r["label"] for r in self._results(resp)}
        self.assertIn(self.sup_b.name, labels)
        self.assertNotIn(self.sup_a.name, labels)

    # --- Multi-tenant user without explicit tenant ---

    def test_multi_tenant_user_without_header_returns_400(self):
        """Multi-tenant user must provide explicit X-Tenant-ID; ambiguous context = 400."""
        req = _authed_get(self.factory, "/api/v1/entities/customer/lookup/", self.user_multi, None)
        resp = entity_lookup(req, "customer")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("tenant", resp.data.get("error", "").lower())

    # --- Invalid entity type ---

    def test_invalid_entity_type_returns_404(self):
        req = _authed_get(self.factory, "/api/v1/entities/bogus/lookup/", self.user_a, self.tenant_a)
        resp = entity_lookup(req, "bogus")
        self.assertEqual(resp.status_code, 404)

    # --- User lookup only shows self ---

    def test_user_lookup_only_shows_current_user(self):
        req = _authed_get(self.factory, "/api/v1/entities/user/lookup/", self.user_a, self.tenant_a)
        resp = entity_lookup(req, "user")
        self.assertEqual(resp.status_code, 200)
        values = {r["value"] for r in self._results(resp)}
        self.assertEqual(values, {str(self.user_a.pk)})

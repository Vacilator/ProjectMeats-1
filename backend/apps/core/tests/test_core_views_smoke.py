"""Smoke tests for backend/apps/core/views.py APIViews.

These tests protect against regressions where core views reference legacy import paths
(e.g., apps.sales.* / apps.tenant_apps.*) which can cause runtime 500s.

Scope:
- GET /api/v1/search/ranked/
- GET /api/v1/workspace/stats/quick/

These are intentionally shallow (status + minimal shape assertions) to keep them stable.
"""

from __future__ import annotations

import uuid
from datetime import date

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.customers.models import Customer
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier

from apps.tenants.models import Tenant, TenantUser


class CoreViewsSmokeTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"t-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)

        # Use session auth so TenantMiddleware honors X-Tenant-ID.
        self.client.force_login(self.user)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_ranked_search_returns_200_with_tenant(self):
        Customer.objects.create(tenant=self.tenant, name="Smoke Customer")
        Supplier.objects.create(tenant=self.tenant, name="Smoke Supplier")

        resp = self.client.get(
            "/api/v1/search/ranked/",
            {"q": "Smoke", "entity_types": "customer,supplier", "limit": 10},
            **self.tenant_header,
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("results", resp.data)
        self.assertIsInstance(resp.data.get("results"), list)

        joined = str(resp.data)
        self.assertIn("Smoke Customer", joined)
        self.assertIn("Smoke Supplier", joined)

    def test_workspace_stats_returns_stats_with_tenant(self):
        supplier = Supplier.objects.create(tenant=self.tenant, name="Stats Supplier")
        customer = Customer.objects.create(tenant=self.tenant, name="Stats Customer")

        PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            order_number="PO-SMOKE",
            order_date=date.today(),
        )

        SalesOrder.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            customer=customer,
            our_sales_order_num="SO-SMOKE",
        )

        resp = self.client.get("/api/v1/workspace/stats/quick/", **self.tenant_header)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("stats", resp.data)
        self.assertIsInstance(resp.data.get("stats"), list)
        self.assertGreaterEqual(len(resp.data.get("stats")), 1)

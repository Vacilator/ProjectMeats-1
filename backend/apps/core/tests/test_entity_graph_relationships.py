"""Regression tests for Cockpit relationship discovery.

These tests protect against the "zero related entities" regression reported by the
Cockpit continuous browsing UX.

Scope:
- EntityGraphService computed relationships:
  - supplier.contacts (M2M + legacy FK)
  - supplier.recent_orders (PurchaseOrder)
  - supplier.related_products (Supplier.products M2M + PurchaseOrder.product)
  - customer.contacts (M2M + legacy FK)
  - customer.recent_orders (SalesOrder)
  - customer.related_products (Customer.products M2M + SalesOrder.product)
- Tenant isolation:
  - Cross-tenant rows must never appear in relationship results.

Note: The database may enforce RLS policies referencing session variables
(app.current_tenant/app.current_tenant_id). We set these explicitly in tests.
"""

from __future__ import annotations

import uuid
from datetime import date

from django.db import connection
from django.test import TestCase

from tenant_apps.contacts.models import Contact
from tenant_apps.customers.models import Customer
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier

from apps.core.services.entity_graph import EntityGraphService
from apps.system.models.product import Product
from apps.tenants.models import Tenant


class EntityGraphRelationshipsTestCase(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.tenant = Tenant.objects.create(
            name=f"EntityGraph Tenant {unique}",
            slug=f"entity-graph-{unique}",
            contact_email=f"t-{unique}@example.com",
            is_active=True,
        )

        self.other_tenant = Tenant.objects.create(
            name=f"Other Tenant {unique}",
            slug=f"other-entity-graph-{unique}",
            contact_email=f"other-{unique}@example.com",
            is_active=True,
        )

        # Ensure RLS session variables are set for deterministic visibility.
        self._set_db_tenant(self.tenant)

        self.supplier = Supplier.objects.create(tenant=self.tenant, name=f"Supplier {unique}")
        self.customer = Customer.objects.create(tenant=self.tenant, name=f"Customer {unique}")

        self.product = Product.objects.create(product_code=f"TEST-{unique}", name=f"Product {unique}")

        # Supplier: contact + recent order + related product via PO.product
        self.supplier_contact = Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            first_name="Sally",
            last_name=f"Supplier-{unique}",
            email=f"sally-{unique}@example.com",
        )
        self.supplier.contacts.add(self.supplier_contact)

        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number=f"PO-{unique}",
            our_purchase_order_num=f"INT-{unique}",
            supplier=self.supplier,
            status="pending",
            order_date=date(2024, 1, 1),
            total_amount="100.00",
            product=self.product,
        )

        # Customer: contact + recent order + related product via SO.product
        self.customer_contact = Contact.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            first_name="Cory",
            last_name=f"Customer-{unique}",
            email=f"cory-{unique}@example.com",
        )
        self.customer.contacts.add(self.customer_contact)

        self.sales_order = SalesOrder.objects.create(
            tenant=self.tenant,
            our_sales_order_num=f"SO-{unique}",
            supplier=self.supplier,
            customer=self.customer,
            product=self.product,
        )

        # Cross-tenant "poison pill" contact attached via M2M to ensure final tenant
        # filter in computed relationships prevents leakage.
        self.other_supplier = Supplier.objects.create(tenant=self.other_tenant, name=f"Other Supplier {unique}")
        self.other_contact = Contact.objects.create(
            tenant=self.other_tenant,
            supplier=self.other_supplier,
            first_name="Mallory",
            last_name=f"Other-{unique}",
        )

        # If the M2M join table doesn't enforce tenant consistency, this could be
        # added accidentally in production. Our computed relationship must still
        # filter it out by tenant.
        try:
            self.supplier.contacts.add(self.other_contact)
        except Exception:
            # If DB constraints prevent cross-tenant M2M, that's great; just skip.
            pass

    def tearDown(self):
        self._reset_db_tenant()

    def _set_db_tenant(self, tenant: Tenant) -> None:
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_tenant_id = %s", [str(tenant.id)])
            cursor.execute("SET app.current_tenant = %s", [str(tenant.id)])

    def _reset_db_tenant(self) -> None:
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant_id")
            cursor.execute("RESET app.current_tenant")

    def _rel_by_name(self, relationships, name: str):
        return next((r for r in relationships if r.get("name") == name), None)

    def test_supplier_relationships_are_non_empty_and_tenant_scoped(self):
        service = EntityGraphService(tenant=self.tenant)
        relationships = service.get_relationships("supplier", self.supplier.id)

        contacts = self._rel_by_name(relationships, "contacts")
        self.assertIsNotNone(contacts)
        self.assertGreaterEqual(contacts.get("count") or 0, 1)

        recent_orders = self._rel_by_name(relationships, "recent_orders")
        self.assertIsNotNone(recent_orders)
        self.assertGreaterEqual(recent_orders.get("count") or 0, 1)

        related_products = self._rel_by_name(relationships, "related_products")
        self.assertIsNotNone(related_products)
        self.assertGreaterEqual(related_products.get("count") or 0, 1)

        # Detail endpoint should not leak cross-tenant contacts.
        details = service.get_related_entities("supplier", self.supplier.id, "contacts", limit=50)
        ids = {item["id"] for item in details["items"]}
        self.assertIn(self.supplier_contact.id, ids)
        self.assertNotIn(self.other_contact.id, ids)

    def test_customer_relationships_are_non_empty_and_tenant_scoped(self):
        service = EntityGraphService(tenant=self.tenant)
        relationships = service.get_relationships("customer", self.customer.id)

        contacts = self._rel_by_name(relationships, "contacts")
        self.assertIsNotNone(contacts)
        self.assertGreaterEqual(contacts.get("count") or 0, 1)

        recent_orders = self._rel_by_name(relationships, "recent_orders")
        self.assertIsNotNone(recent_orders)
        self.assertGreaterEqual(recent_orders.get("count") or 0, 1)

        related_products = self._rel_by_name(relationships, "related_products")
        self.assertIsNotNone(related_products)
        self.assertGreaterEqual(related_products.get("count") or 0, 1)

        details = service.get_related_entities("customer", self.customer.id, "contacts", limit=50)
        ids = {item["id"] for item in details["items"]}
        self.assertIn(self.customer_contact.id, ids)
        self.assertNotIn(self.other_contact.id, ids)

    def test_entity_graph_includes_product_node(self):
        service = EntityGraphService(tenant=self.tenant)
        graph = service.get_entity_graph("supplier", self.supplier.id, depth=1)

        node_ids = {n["id"] for n in graph.get("nodes", [])}
        self.assertIn(f"supplier:{self.supplier.id}", node_ids)
        self.assertIn(f"product:{self.product.id}", node_ids)

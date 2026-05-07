"""Tests for INFRA-01.1: Verify test factories produce valid records."""

from django.test import TestCase

from apps.core.tests.factories import (
    CarrierFactory,
    CarrierPurchaseOrderFactory,
    ContactFactory,
    CustomerFactory,
    InquiryFactory,
    PlantFactory,
    PurchaseOrderFactory,
    SalesOrderFactory,
    SupplierFactory,
    TenantFactory,
    TradeEventLogFactory,
    TradeExceptionQueueFactory,
    TradeSessionFactory,
    UserFactory,
)


class FactorySmokeTesta(TestCase):
    """Verify every factory produces a valid, persisted record."""

    def test_tenant_factory(self):
        t = TenantFactory()
        self.assertIsNotNone(t.pk)
        self.assertIn("Test Tenant", t.name)

    def test_user_factory(self):
        u = UserFactory()
        self.assertIsNotNone(u.pk)
        self.assertTrue(u.is_active)

    def test_supplier_factory(self):
        s = SupplierFactory()
        self.assertIsNotNone(s.pk)
        self.assertIsNotNone(s.tenant_id)

    def test_customer_factory(self):
        c = CustomerFactory()
        self.assertIsNotNone(c.pk)
        self.assertIsNotNone(c.tenant_id)

    def test_plant_factory(self):
        p = PlantFactory()
        self.assertIsNotNone(p.pk)
        self.assertIsNotNone(p.tenant_id)

    def test_contact_factory(self):
        c = ContactFactory()
        self.assertIsNotNone(c.pk)
        self.assertTrue(c.first_name)
        self.assertTrue(c.last_name)

    def test_inquiry_factory(self):
        i = InquiryFactory()
        self.assertIsNotNone(i.pk)
        self.assertEqual(i.entity_type, "supplier")

    def test_purchase_order_factory(self):
        po = PurchaseOrderFactory()
        self.assertIsNotNone(po.pk)
        self.assertIsNotNone(po.supplier_id)
        self.assertEqual(po.supplier.tenant_id, po.tenant_id)

    def test_sales_order_factory(self):
        so = SalesOrderFactory()
        self.assertIsNotNone(so.pk)
        self.assertIsNotNone(so.supplier_id)
        self.assertIsNotNone(so.customer_id)
        self.assertEqual(so.supplier.tenant_id, so.tenant_id)
        self.assertEqual(so.customer.tenant_id, so.tenant_id)

    def test_carrier_purchase_order_factory(self):
        cpo = CarrierPurchaseOrderFactory()
        self.assertIsNotNone(cpo.pk)
        self.assertIsNotNone(cpo.carrier_id)
        self.assertEqual(cpo.carrier.tenant_id, cpo.tenant_id)

    def test_trade_session_factory(self):
        ts = TradeSessionFactory()
        self.assertIsNotNone(ts.pk)
        self.assertIsNotNone(ts.inquiry_id)
        self.assertEqual(ts.inquiry.tenant_id, ts.tenant_id)

    def test_trade_exception_queue_factory(self):
        exc = TradeExceptionQueueFactory()
        self.assertIsNotNone(exc.pk)
        self.assertEqual(exc.status, "open")

    def test_trade_event_log_factory(self):
        ev = TradeEventLogFactory()
        self.assertIsNotNone(ev.pk)
        self.assertTrue(ev.event_id)

    def test_shared_tenant(self):
        """Verify factories share tenant when explicitly passed."""
        tenant = TenantFactory()
        s = SupplierFactory(tenant=tenant)
        c = CustomerFactory(tenant=tenant)
        po = PurchaseOrderFactory(tenant=tenant, supplier=s)
        so = SalesOrderFactory(tenant=tenant, supplier=s, customer=c)
        self.assertEqual(s.tenant_id, tenant.pk)
        self.assertEqual(c.tenant_id, tenant.pk)
        self.assertEqual(po.tenant_id, tenant.pk)
        self.assertEqual(so.tenant_id, tenant.pk)

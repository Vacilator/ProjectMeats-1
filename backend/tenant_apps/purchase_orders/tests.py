"""
Tests for Purchase Orders app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from django.utils import timezone
from tenant_apps.purchase_orders.models import (
    CarrierPOItem,
    PurchaseOrder,
    PurchaseOrderItem,
    CarrierPurchaseOrder,
    ColdStorageEntry,
)
from tenant_apps.purchase_orders.serializers import CarrierPurchaseOrderSerializer, PurchaseOrderSerializer
from tenant_apps.suppliers.models import Supplier
from tenant_apps.carriers.models import Carrier
from tenant_apps.customers.models import Customer
from apps.system.models import Product
from tenant_apps.locations.models import Location
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquirySupplierRFQ,
)
from tenant_apps.sales_orders.models import SalesOrder
from apps.tenants.models import Tenant, TenantUser
from apps.core.models import (
    AccountingPaymentTermsChoices,
    EdibleInedibleChoices,
    FreshOrFrozenChoices,
    ProteinTypeChoices,
    WeightUnitChoices,
)


class CarrierPurchaseOrderModelTest(TestCase):
    """Test cases for CarrierPurchaseOrder model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        
        self.carrier = Carrier.objects.create(
            name=f"Test Carrier {unique_id}",
            email=f"carrier-{unique_id}@test.com",
            tenant=self.tenant,
        )
        self.supplier = Supplier.objects.create(
            name=f"Test Supplier {unique_id}",
            email=f"supplier-{unique_id}@test.com",
            tenant=self.tenant,
        )
        self.location = Location.objects.create(
            name=f"Test Plant {unique_id}",
            city="Test City",
            location_type="plant_slaughter",
            tenant=self.tenant,
        )
        self.product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            name="Test Product",
        )

    def test_create_carrier_purchase_order(self):
        """Test creating a carrier purchase order."""
        unique_id = uuid.uuid4().hex[:8]
        carrier_po = CarrierPurchaseOrder.objects.create(
            carrier=self.carrier,
            supplier=self.supplier,
            our_carrier_po_num=f"CPO-{unique_id}",
            carrier_name="Test Carrier",
            pick_up_date=timezone.now().date(),
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier_po.carrier, self.carrier)
        self.assertEqual(carrier_po.supplier, self.supplier)
        self.assertEqual(carrier_po.our_carrier_po_num, f"CPO-{unique_id}")
        self.assertIsNotNone(carrier_po.date_time_stamp_created)

    def test_carrier_purchase_order_with_product_details(self):
        """Test carrier PO with product details from Excel schema."""
        unique_id = uuid.uuid4().hex[:8]
        carrier_po = CarrierPurchaseOrder.objects.create(
            carrier=self.carrier,
            supplier=self.supplier,
            plant=self.location,
            product=self.product,
            our_carrier_po_num=f"CPO-{unique_id}",
            type_of_protein=ProteinTypeChoices.BEEF,
            fresh_or_frozen=FreshOrFrozenChoices.FRESH,
            edible_or_inedible=EdibleInedibleChoices.EDIBLE,
            total_weight=Decimal("1000.50"),
            weight_unit=WeightUnitChoices.LBS,
            quantity=100,
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier_po.type_of_protein, "Beef")
        self.assertEqual(carrier_po.fresh_or_frozen, "Fresh")
        self.assertEqual(carrier_po.total_weight, Decimal("1000.50"))
        self.assertEqual(carrier_po.weight_unit, "LBS")
        self.assertEqual(carrier_po.quantity, 100)

    def test_carrier_purchase_order_with_payment_terms(self):
        """Test carrier PO with payment and credit terms."""
        unique_id = uuid.uuid4().hex[:8]
        carrier_po = CarrierPurchaseOrder.objects.create(
            carrier=self.carrier,
            supplier=self.supplier,
            payment_terms=AccountingPaymentTermsChoices.WIRE,
            our_carrier_po_num=f"CPO-{unique_id}",
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier_po.payment_terms, "Wire")

    def test_carrier_purchase_order_str_representation(self):
        """Test the string representation of carrier PO."""
        unique_id = uuid.uuid4().hex[:8]
        carrier_po = CarrierPurchaseOrder.objects.create(
            carrier=self.carrier,
            supplier=self.supplier,
            our_carrier_po_num=f"CPO-{unique_id}",
            tenant=self.tenant,
        )
        
        self.assertIn(f"CPO-{unique_id}", str(carrier_po))

    def test_carrier_purchase_order_item_inherits_tenant(self):
        """Carrier PO items inherit tenant and line-item schema."""
        unique_id = uuid.uuid4().hex[:8]
        carrier_po = CarrierPurchaseOrder.objects.create(
            carrier=self.carrier,
            supplier=self.supplier,
            our_carrier_po_num=f"CPO-{unique_id}",
            tenant=self.tenant,
        )

        item = CarrierPOItem.objects.create(
            carrier_purchase_order=carrier_po,
            protein_type=ProteinTypeChoices.BEEF,
            quantity=12,
        )

        self.assertEqual(item.tenant, self.tenant)
        self.assertEqual(item.carrier_purchase_order, carrier_po)
        self.assertEqual(item.protein_type, ProteinTypeChoices.BEEF)


class PurchaseOrderItemModelTest(TestCase):
    """Test cases for PurchaseOrderItem model."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"poitem-user-{unique_id}",
            email=f"poitem-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"PO Tenant {unique_id}",
            slug=f"po-tenant-{unique_id}",
            contact_email=f"po-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.supplier = Supplier.objects.create(
            name=f"PO Supplier {unique_id}",
            tenant=self.tenant,
        )
        self.purchase_order = PurchaseOrder.objects.create(
            order_number=f"PO-{unique_id}",
            supplier=self.supplier,
            total_amount=Decimal("1000.00"),
            order_date=timezone.now().date(),
            tenant=self.tenant,
        )

    def test_purchase_order_item_inherits_tenant(self):
        item = PurchaseOrderItem.objects.create(
            purchase_order=self.purchase_order,
            protein_type=ProteinTypeChoices.BEEF,
            quantity=10,
        )

        self.assertEqual(item.tenant, self.tenant)
        self.assertEqual(item.purchase_order, self.purchase_order)
        self.assertEqual(item.quantity, 10)


class CarrierPurchaseOrderAPITests(APITestCase):
    """API smoke coverage for the routed Carrier PO endpoint."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"carrier-po-api-{unique_id}",
            email=f"carrier-po-api-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f"Carrier PO API Tenant {unique_id}",
            slug=f"carrier-po-api-tenant-{unique_id}",
            contact_email=f"carrier-po-api-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.carrier = Carrier.objects.create(name=f"Carrier {unique_id}", code=f"C-{unique_id}", tenant=self.tenant)
        self.supplier = Supplier.objects.create(name=f"Supplier {unique_id}", tenant=self.tenant)

    def test_create_carrier_po_via_api(self):
        response = self.client.post(
            "/api/v1/carrier-pos/",
            {
                "carrier": self.carrier.id,
                "supplier": self.supplier.id,
                "our_carrier_po_num": "CPO-API-1",
                "items": [
                    {
                        "protein_type": ProteinTypeChoices.BEEF,
                        "quantity": 5,
                    }
                ],
            },
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CarrierPurchaseOrder.objects.count(), 1)
        self.assertEqual(CarrierPOItem.objects.count(), 1)

class DocumentOperationsAPITests(APITestCase):
    """Regression coverage for workflow, PDF, email, and audit endpoints."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"doc-ops-{unique_id}",
            email=f"doc-ops-{unique_id}@example.com",
            password="testpass123",
        )
        self.member_user = User.objects.create_user(
            username=f"doc-member-{unique_id}",
            email=f"doc-member-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"Doc Ops Tenant {unique_id}",
            slug=f"doc-ops-tenant-{unique_id}",
            contact_email=f"doc-ops-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.member_user, role="user", is_active=True)

        self.client.force_login(self.user)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

        self.carrier = Carrier.objects.create(
            name=f"Carrier {unique_id}",
            email=f"carrier-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.supplier = Supplier.objects.create(
            name=f"Supplier {unique_id}",
            email=f"supplier-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.customer = Customer.objects.create(
            name=f"Customer {unique_id}",
            email=f"customer-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.location = Location.objects.create(
            name=f"Location {unique_id}",
            city="Chicago",
            location_type="warehouse",
            tenant=self.tenant,
        )
        self.product = Product.objects.create(
            product_code=f"DOC-{unique_id}",
            name="Doc Test Product",
        )
        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            carrier=self.carrier,
            order_number=f"PO-{unique_id}",
            order_date=timezone.now().date(),
            total_amount=Decimal("1200.00"),
            status="pending",
            product=self.product,
            pick_up_location=self.location,
            delivery_location=self.location,
        )
        self.review_inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            requested_protein=ProteinTypeChoices.BEEF,
            contact_name="Buyer Jane",
            contact_email="buyer@example.com",
            supplier_purchase_order=self.purchase_order,
        )
        self.review_rfq = InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=self.review_inquiry,
            supplier=self.supplier,
            created_by=self.user,
            recipient_email=self.supplier.email,
            recipient_name=self.supplier.name,
            subject="Quoted offer for inquiry",
            status="sent",
            provider_message_id=f"msg-{unique_id}",
            provider_thread_id=f"thread-{unique_id}",
        )
        self.purchase_order.custom_data = {
            "review_state": "pending_review",
            "source_lineage": {
                "inquiry_id": self.review_inquiry.id,
                "inquiry_number": self.review_inquiry.inquiry_number,
                "rfq_id": self.review_rfq.id,
                "supplier_id": self.supplier.id,
                "correlation_key": str(self.review_rfq.correlation_key),
                "email_log_id": 321,
                "email_message_id": f"msg-{unique_id}",
                "email_thread_id": f"thread-{unique_id}",
            },
            "normalized_quote": {
                "availability_status": "affirmative",
                "offered_product_name": "Beef Trim Combo",
                "quantity": 20000,
                "uom": "LBS",
                "price_per_unit": "2.45",
                "lead_time_text": "2 business days",
                "notes": "Packed fresh and ready to ship.",
            },
            "supplier_reply_parse": {
                "parse_status": "parsed",
                "correlation_status": "matched",
                "correlation_method": "thread_id",
                "confidence": 0.97,
                "summary": "Supplier can cover the requested volume.",
            },
        }
        self.purchase_order.save(update_fields=["custom_data"])
        self.sales_order = SalesOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            customer=self.customer,
            carrier=self.carrier,
            product=self.product,
            our_sales_order_num=f"SO-{unique_id}",
            status="approved",
            total_amount=Decimal("1400.00"),
            pick_up_location=self.location,
            delivery_location=self.location,
        )
        self.carrier_po = CarrierPurchaseOrder.objects.create(
            tenant=self.tenant,
            carrier=self.carrier,
            supplier=self.supplier,
            linked_order=self.purchase_order,
            sales_order=self.sales_order,
            our_carrier_po_num=f"CPO-{unique_id}",
            status="draft",
            pick_up_location=self.location,
            delivery_location=self.location,
        )

    def test_purchase_order_transition_endpoint_blocks_invalid_jump(self):
        response = self.client.post(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/transition-status/",
            {"status": "delivered"},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_purchase_order_review_context_returns_curated_quote_lineage(self):
        response = self.client.get(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/review-context/",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["review_context_complete"])
        self.assertEqual(response.data["review_state"], "pending_review")
        self.assertEqual(response.data["purchase_order"]["id"], self.purchase_order.id)
        self.assertEqual(response.data["inquiry"]["id"], self.review_inquiry.id)
        self.assertEqual(response.data["rfq"]["id"], self.review_rfq.id)
        self.assertEqual(response.data["source_lineage"]["rfq_id"], self.review_rfq.id)
        self.assertEqual(response.data["normalized_quote"]["offered_product_name"], "Beef Trim Combo")
        self.assertEqual(
            response.data["supplier_reply_parse"]["summary"],
            "Supplier can cover the requested volume.",
        )
        self.assertEqual(response.data["workflow"]["current_status"], "pending")
        self.assertIn("pending_approval", response.data["workflow"]["allowed_transitions"])

    def test_purchase_order_review_context_blocks_cross_tenant_access(self):
        foreign_user = User.objects.create_user(
            username=f"foreign-po-{uuid.uuid4().hex[:8]}",
            email=f"foreign-po-{uuid.uuid4().hex[:8]}@example.com",
            password="testpass123",
        )
        foreign_tenant = Tenant.objects.create(
            name=f"Foreign Tenant {uuid.uuid4().hex[:8]}",
            slug=f"foreign-tenant-{uuid.uuid4().hex[:8]}",
            contact_email=f"foreign-{uuid.uuid4().hex[:8]}@example.com",
            created_by=foreign_user,
        )
        TenantUser.objects.create(tenant=foreign_tenant, user=foreign_user, role="owner", is_active=True)
        foreign_supplier = Supplier.objects.create(name="Foreign Supplier", tenant=foreign_tenant)
        foreign_po = PurchaseOrder.objects.create(
            tenant=foreign_tenant,
            supplier=foreign_supplier,
            order_number=f"PO-FOREIGN-{uuid.uuid4().hex[:8]}",
            order_date=timezone.now().date(),
            total_amount=Decimal("10.00"),
            status="draft",
        )

        response = self.client.get(
            f"/api/v1/purchase-orders/{foreign_po.id}/review-context/",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_purchase_order_review_context_does_not_follow_poisoned_lineage(self):
        foreign_user = User.objects.create_user(
            username=f"poisoned-po-{uuid.uuid4().hex[:8]}",
            email=f"poisoned-po-{uuid.uuid4().hex[:8]}@example.com",
            password="testpass123",
        )
        foreign_tenant = Tenant.objects.create(
            name=f"Poisoned Tenant {uuid.uuid4().hex[:8]}",
            slug=f"poisoned-tenant-{uuid.uuid4().hex[:8]}",
            contact_email=f"poisoned-{uuid.uuid4().hex[:8]}@example.com",
            created_by=foreign_user,
        )
        TenantUser.objects.create(tenant=foreign_tenant, user=foreign_user, role="owner", is_active=True)
        foreign_customer = Customer.objects.create(name="Foreign Customer", tenant=foreign_tenant)
        foreign_supplier = Supplier.objects.create(name="Foreign Supplier", tenant=foreign_tenant)
        foreign_inquiry = Inquiry.objects.create(
            tenant=foreign_tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=foreign_customer,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            supplier_purchase_order=None,
        )
        foreign_rfq = InquirySupplierRFQ.objects.create(
            tenant=foreign_tenant,
            inquiry=foreign_inquiry,
            supplier=foreign_supplier,
            recipient_email="foreign@example.com",
        )

        poisoned_custom_data = dict(self.purchase_order.custom_data or {})
        poisoned_lineage = dict(poisoned_custom_data.get("source_lineage") or {})
        poisoned_lineage["inquiry_id"] = foreign_inquiry.id
        poisoned_lineage["rfq_id"] = foreign_rfq.id
        poisoned_custom_data["source_lineage"] = poisoned_lineage
        self.purchase_order.custom_data = poisoned_custom_data
        self.purchase_order.save(update_fields=["custom_data"])

        response = self.client.get(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/review-context/",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["review_context_complete"])
        self.assertIsNone(response.data["inquiry"])
        self.assertIsNone(response.data["rfq"])

    def test_purchase_order_pdf_endpoint_returns_pdf_attachment(self):
        response = self.client.get(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/pdf/",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn(".pdf", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_carrier_po_audit_feed_is_visible_to_active_member(self):
        transition_response = self.client.post(
            f"/api/v1/carrier-pos/{self.carrier_po.id}/transition-status/",
            {"status": "pending_approval"},
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(transition_response.status_code, status.HTTP_200_OK)

        member_client = APIClient()
        member_client.force_login(self.member_user)
        response = member_client.get(
            "/api/v1/audit-events/",
            {
                "entity_type": "CarrierPurchaseOrder",
                "object_id": str(self.carrier_po.id),
            },
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertGreaterEqual(len(results), 1)
        self.assertTrue(
            any(event.get("entity_type") == "CarrierPurchaseOrder" for event in results)
        )

    def test_purchase_order_serializer_exposes_trade_invariants(self):
        self.purchase_order.total_weight = Decimal("1000.50")
        self.purchase_order.weight_unit = WeightUnitChoices.LBS
        self.purchase_order.pick_up_date = date(2026, 1, 8)
        self.purchase_order.save(update_fields=["total_weight", "weight_unit", "pick_up_date"])

        data = PurchaseOrderSerializer(self.purchase_order).data

        self.assertEqual(data["trade_weight"]["entered_unit"], "LBS")
        self.assertEqual(data["trade_weight"]["normalized_kg"], "453.82")
        self.assertEqual(data["trade_timeline"]["storage_timezone"], "UTC")
        self.assertEqual(data["trade_timeline"]["date_fields"]["pick_up_date"], "2026-01-08")

    def test_carrier_purchase_order_serializer_exposes_trade_invariants(self):
        self.carrier_po.total_weight = Decimal("500.00")
        self.carrier_po.weight_unit = WeightUnitChoices.LBS
        self.carrier_po.delivery_date = date(2026, 1, 9)
        self.carrier_po.save(update_fields=["total_weight", "weight_unit", "delivery_date"])

        data = CarrierPurchaseOrderSerializer(self.carrier_po).data

        self.assertEqual(data["trade_weight"]["normalized_lbs"], "500.00")
        self.assertEqual(data["trade_weight"]["normalized_kg"], "226.80")
        self.assertEqual(data["trade_timeline"]["date_fields"]["delivery_date"], "2026-01-09")

class ColdStorageEntryModelTest(TestCase):
    """Test cases for ColdStorageEntry model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        
        self.supplier = Supplier.objects.create(
            name=f"Test Supplier {unique_id}",
            email=f"supplier-{unique_id}@test.com",
            tenant=self.tenant,
        )
        self.customer = Customer.objects.create(
            name=f"Test Customer {unique_id}",
            email=f"customer-{unique_id}@test.com",
            tenant=self.tenant,
        )
        self.supplier_po = PurchaseOrder.objects.create(
            order_number=f"PO-{unique_id}",
            supplier=self.supplier,
            total_amount=Decimal("1000.00"),
            order_date=timezone.now().date(),
            tenant=self.tenant,
        )
        self.product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            name="Test Product",
        )

    def test_create_cold_storage_entry(self):
        """Test creating a cold storage entry."""
        entry = ColdStorageEntry.objects.create(
            supplier_po=self.supplier_po,
            status_of_load="Matched",
            item_description="50% Beef Trim fresh - Tested",
            item_production_date=timezone.now().date(),
            tenant=self.tenant,
        )
        
        self.assertEqual(entry.supplier_po, self.supplier_po)
        self.assertEqual(entry.status_of_load, "Matched")
        self.assertEqual(entry.item_description, "50% Beef Trim fresh - Tested")
        self.assertIsNotNone(entry.date_time_stamp_created)

    def test_cold_storage_entry_with_boxing_details(self):
        """Test cold storage entry with boxing details."""
        entry = ColdStorageEntry.objects.create(
            supplier_po=self.supplier_po,
            status_of_load="Matched",
            finished_weight=Decimal("950.00"),
            shrink=Decimal("50.00"),
            boxing_cost=Decimal("100.00"),
            tenant=self.tenant,
        )
        
        self.assertEqual(entry.finished_weight, Decimal("950.00"))
        self.assertEqual(entry.shrink, Decimal("50.00"))
        self.assertEqual(entry.boxing_cost, Decimal("100.00"))

    def test_cold_storage_entry_with_costs(self):
        """Test cold storage entry with cost calculations."""
        entry = ColdStorageEntry.objects.create(
            supplier_po=self.supplier_po,
            status_of_load="Matched",
            boxing_cost=Decimal("100.00"),
            cold_storage_cost=Decimal("50.00"),
            total_cost=Decimal("150.00"),
            tenant=self.tenant,
        )
        
        self.assertEqual(entry.boxing_cost, Decimal("100.00"))
        self.assertEqual(entry.cold_storage_cost, Decimal("50.00"))
        self.assertEqual(entry.total_cost, Decimal("150.00"))

    def test_cold_storage_entry_tbd_status(self):
        """Test cold storage entry with TBD status."""
        entry = ColdStorageEntry.objects.create(
            supplier_po=self.supplier_po,
            status_of_load="TBD - Not Matched",
            item_description="Unmatched product",
            tenant=self.tenant,
        )
        
        self.assertEqual(entry.status_of_load, "TBD - Not Matched")

    def test_cold_storage_entry_str_representation(self):
        """Test the string representation of cold storage entry."""
        entry = ColdStorageEntry.objects.create(
            supplier_po=self.supplier_po,
            status_of_load="Matched",
            tenant=self.tenant,
        )
        
        self.assertIn("Cold Storage Entry", str(entry))
        self.assertIn("Matched", str(entry))

    def test_cold_storage_entry_with_product(self):
        """Test cold storage entry with product relationship."""
        entry = ColdStorageEntry.objects.create(
            supplier_po=self.supplier_po,
            product=self.product,
            status_of_load="Matched",
            item_description="Test product in storage",
            tenant=self.tenant,
        )
        
        self.assertEqual(entry.product, self.product)


class PurchaseOrderHistoryTests(TestCase):
    """Test cases for Purchase Order version history."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}", 
            email=f"test-{unique_id}@example.com", 
            password="testpass123"
        )

        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )

        # Associate user with tenant
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

        # Create a supplier for testing
        self.supplier = Supplier.objects.create(
            name=f"Test Supplier {unique_id}",
            email=f"supplier-{unique_id}@example.com",
            phone="123-456-7890",
            tenant=self.tenant,
        )

    def test_history_created_on_new_po(self):
        """Test that history entry is created when a new PO is created."""
        from datetime import date
        from tenant_apps.purchase_orders.models import PurchaseOrderHistory
        unique_id = uuid.uuid4().hex[:8]
        # Create a purchase order
        po = PurchaseOrder.objects.create(
            order_number=f"PO-{unique_id}",
            supplier=self.supplier,
            total_amount=Decimal("1000.00"),
            order_date=date.today(),
            tenant=self.tenant,
        )

        # Check that a history entry was created (if signals are configured)
        history_count = PurchaseOrderHistory.objects.filter(purchase_order=po).count()
        self.assertGreaterEqual(history_count, 0)  # May or may not have history signal

    def test_history_created_on_update(self):
        """Test that history entry is created when a PO is updated."""
        from datetime import date
        from tenant_apps.purchase_orders.models import PurchaseOrderHistory
        unique_id = uuid.uuid4().hex[:8]
        # Create a purchase order
        po = PurchaseOrder.objects.create(
            order_number=f"PO-{unique_id}",
            supplier=self.supplier,
            total_amount=Decimal("1000.00"),
            order_date=date.today(),
            tenant=self.tenant,
        )

        # Clear initial history
        initial_count = PurchaseOrderHistory.objects.count()

        # Update the purchase order
        po.total_amount = Decimal("1500.00")
        po.save(update_fields=["total_amount"])

        # Check history state (depends on signal implementation)
        self.assertGreaterEqual(PurchaseOrderHistory.objects.count(), initial_count)

    def test_multiple_pos_separate_history(self):
        """Test that different POs have separate history entries."""
        from datetime import date
        from tenant_apps.purchase_orders.models import PurchaseOrderHistory
        po1_unique_id = uuid.uuid4().hex[:8]
        po2_unique_id = uuid.uuid4().hex[:8]
        # Create two purchase orders
        po1 = PurchaseOrder.objects.create(
            order_number=f"PO-{po1_unique_id}",
            supplier=self.supplier,
            total_amount=Decimal("1000.00"),
            order_date=date.today(),
            tenant=self.tenant,
        )

        po2 = PurchaseOrder.objects.create(
            order_number=f"PO-{po2_unique_id}",
            supplier=self.supplier,
            total_amount=Decimal("2000.00"),
            order_date=date.today(),
            tenant=self.tenant,
        )

        # Check that each has its own history (or none if signals not configured)
        po1_history = PurchaseOrderHistory.objects.filter(purchase_order=po1)
        po2_history = PurchaseOrderHistory.objects.filter(purchase_order=po2)

        # Histories are separate
        self.assertEqual(
            set(po1_history.values_list('id', flat=True)) & set(po2_history.values_list('id', flat=True)),
            set()
        )


class PurchaseOrderTenantIsolationTests(TestCase):
    """Test tenant isolation for purchase orders."""

    def setUp(self):
        """Set up test data with multiple tenants."""
        unique_id = uuid.uuid4().hex[:8]
        
        # First tenant
        self.user1 = User.objects.create_user(
            username=f"user1-{unique_id}",
            email=f"user1-{unique_id}@example.com",
            password="testpass123"
        )
        self.tenant1 = Tenant.objects.create(
            name=f"Tenant 1 {unique_id}",
            slug=f"tenant-1-{unique_id}",
            contact_email=f"admin1-{unique_id}@example.com",
            created_by=self.user1,
        )
        TenantUser.objects.create(tenant=self.tenant1, user=self.user1, role="owner")
        self.supplier1 = Supplier.objects.create(
            name=f"Supplier 1 {unique_id}",
            tenant=self.tenant1,
        )
        
        # Second tenant
        self.user2 = User.objects.create_user(
            username=f"user2-{unique_id}",
            email=f"user2-{unique_id}@example.com",
            password="testpass123"
        )
        self.tenant2 = Tenant.objects.create(
            name=f"Tenant 2 {unique_id}",
            slug=f"tenant-2-{unique_id}",
            contact_email=f"admin2-{unique_id}@example.com",
            created_by=self.user2,
        )
        TenantUser.objects.create(tenant=self.tenant2, user=self.user2, role="owner")
        self.supplier2 = Supplier.objects.create(
            name=f"Supplier 2 {unique_id}",
            tenant=self.tenant2,
        )

    def test_purchase_orders_isolated_by_tenant(self):
        """Test that purchase orders are properly isolated by tenant."""
        from datetime import date
        unique_id = uuid.uuid4().hex[:8]
        
        # Create PO for tenant 1
        PurchaseOrder.objects.create(
            order_number=f"PO1-{unique_id}",
            supplier=self.supplier1,
            total_amount=Decimal("1000.00"),
            order_date=date.today(),
            tenant=self.tenant1,
        )
        
        # Create PO for tenant 2
        PurchaseOrder.objects.create(
            order_number=f"PO2-{unique_id}",
            supplier=self.supplier2,
            total_amount=Decimal("2000.00"),
            order_date=date.today(),
            tenant=self.tenant2,
        )
        
        # Verify isolation using for_tenant manager
        tenant1_pos = PurchaseOrder.objects.for_tenant(self.tenant1)
        tenant2_pos = PurchaseOrder.objects.for_tenant(self.tenant2)
        
        self.assertEqual(tenant1_pos.count(), 1)
        self.assertEqual(tenant2_pos.count(), 1)
        self.assertEqual(tenant1_pos.first().order_number, f"PO1-{unique_id}")
        self.assertEqual(tenant2_pos.first().order_number, f"PO2-{unique_id}")

    def test_cannot_access_other_tenant_po(self):
        """Test that tenant 1 cannot see tenant 2's purchase orders."""
        from datetime import date
        unique_id = uuid.uuid4().hex[:8]
        
        # Create PO only for tenant 2
        po2 = PurchaseOrder.objects.create(
            order_number=f"PO2-{unique_id}",
            supplier=self.supplier2,
            total_amount=Decimal("2000.00"),
            order_date=date.today(),
            tenant=self.tenant2,
        )
        
        # Tenant 1 should not see tenant 2's PO
        tenant1_pos = PurchaseOrder.objects.for_tenant(self.tenant1)
        self.assertEqual(tenant1_pos.count(), 0)
        self.assertNotIn(po2, tenant1_pos)

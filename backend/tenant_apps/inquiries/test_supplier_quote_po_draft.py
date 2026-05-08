import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.contacts.models import Contact, ContactDepartmentChoices
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquiryShippingTypeChoices,
    InquirySourceChoices,
    InquirySupplierRFQ,
    InquirySupplierRFQStatusChoices,
)
from tenant_apps.inquiries.services import create_supplier_quote_purchase_order_draft
from tenant_apps.inquiries.services.supplier_quote_po_draft import SupplierQuotePODraftError
from tenant_apps.plants.models import Plant
from tenant_apps.products.models import MasterProduct
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.suppliers.models import Supplier

from apps.core.models import ProteinTypeChoices
from apps.integrations.models import EmailLog, ExternalAuthProvider
from apps.system.models import Product
from apps.tenants.models import Tenant, TenantUser


class SupplierQuotePODraftServiceTests(TestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"rfq-po-user-{unique_id}",
            email=f"rfq-po-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"RFQ PO Tenant {unique_id}",
            slug=f"rfq-po-tenant-{unique_id}",
            contact_email=f"rfq-po-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.customer = Customer.objects.create(name=f"Buyer {unique_id}", tenant=self.tenant)
        self.provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type="microsoft",
            access_token="placeholder",
            token_expiry=timezone.now() + timedelta(hours=1),
            is_active=True,
            connected_email="planner@example.com",
            connected_name="Planner",
        )
        self.provider.set_encrypted_token("access", "access-token")
        self.provider.set_encrypted_token("refresh", "refresh-token")
        self.provider.save()
        self.system_product = Product.objects.create(
            product_code=f"RFQ-PO-{unique_id}",
            name="Ribeye",
            protein_type=ProteinTypeChoices.BEEF,
            category="BEEF",
            is_active=True,
        )
        self.master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name="Ribeye",
            type="flat",
            trim="trimmed",
            system_product=self.system_product,
        )
        self.inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            requested_master_product=self.master_product,
            requested_protein=ProteinTypeChoices.BEEF,
            notes="Need supplier quote.",
            created_by=self.user,
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Quoted Supplier",
            email="supplier@example.com",
            phone="800-555-7000",
            contact_person="Legacy Supplier Rep",
            preferred_protein_types=[ProteinTypeChoices.BEEF],
        )
        self.plant = Plant.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            name="Quoted Supplier Plant",
            plant_est_num="EST-Q1",
            address="300 Plant Way",
            city="Chicago",
            state="IL",
            zip_code="60601",
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            first_name="Price",
            last_name="Desk",
            email="sales@quoted.example.com",
            office_phone="800-555-7100",
            department=ContactDepartmentChoices.SALES,
            title="Account Manager",
            protein_types_responsible=[ProteinTypeChoices.BEEF],
            items_responsible=["Ribeye"],
            documents_responsible_for=["Spec Sheets", "COAs"],
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            first_name="Ship",
            last_name="Ops",
            email="shipping@quoted.example.com",
            office_phone="800-555-7200",
            department=ContactDepartmentChoices.SHIPPING,
            title="Shipping Supervisor",
            documents_responsible_for=["BOLs", "Loading Instructions"],
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            first_name="Ava",
            last_name="Payable",
            email="ap@quoted.example.com",
            office_phone="800-555-7300",
            department=ContactDepartmentChoices.ACCOUNTING,
            title="Accounts Payable",
            documents_responsible_for=["Statements", "Bills"],
        )
        self.email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id="graph-reply-po-1",
            thread_id="graph-thread-po-1",
            subject="Re: RFQ for ribeye",
            sender_email="supplier@example.com",
            sender_name="Supplier Rep",
            received_at=timezone.now(),
            body_text="We can offer 20,000 lbs at $2.45/lb next week.",
            body_html="",
            has_attachments=False,
            attachment_count=0,
            status="action_required",
            extracted_data={"category": "supplier_quote_reply"},
        )
        self.rfq = InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=self.inquiry,
            supplier=self.supplier,
            created_by=self.user,
            sender_provider=self.provider,
            sender_email="planner@example.com",
            recipient_email="supplier@example.com",
            recipient_name="Quoted Supplier",
            subject="RFQ for Ribeye",
            body="Please quote ribeye.",
            status=InquirySupplierRFQStatusChoices.SENT,
            attempt_count=1,
            sent_at=timezone.now(),
            provider_thread_id="graph-thread-po-1",
            correlation_key=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            custom_data={
                "recipient_routing": {
                    "recipient_email": "sales@quoted.example.com",
                    "recipient_name": "Price Desk",
                    "phone": "800-555-7100",
                    "department": ContactDepartmentChoices.SALES,
                    "title": "Account Manager",
                    "plant_id": self.plant.id,
                    "plant_name": self.plant.name,
                    "source": "department",
                    "focus": "pricing",
                    "responsible_documents": ["Spec Sheets", "COAs"],
                    "responsible_proteins": [ProteinTypeChoices.BEEF],
                    "responsible_items": ["Ribeye"],
                },
                "latest_reply_parse": {
                    "parse_status": "parsed",
                    "correlation_status": "matched",
                    "correlation_method": "thread_id",
                    "confidence": 0.89,
                    "summary": "Supplier quoted 20,000 LBS at 2.45 USD/lb.",
                    "rationale": "Reply explicitly confirmed price and quantity.",
                    "errors": [],
                    "normalized_quote": {
                        "availability_status": "affirmative",
                        "offered_product_name": "Ribeye",
                        "price_per_unit": 2.45,
                        "currency": "USD",
                        "quantity": 20000,
                        "uom": "LBS",
                        "lead_time_text": "7 days",
                        "lead_time_days_min": 7,
                        "lead_time_days_max": 7,
                        "notes": "Fresh production.",
                    },
                    "lineage": {
                        "email_log_id": self.email_log.id,
                        "email_message_id": self.email_log.message_id,
                        "email_thread_id": self.email_log.thread_id,
                        "rfq_id": 1,
                        "inquiry_id": self.inquiry.id,
                        "supplier_id": self.supplier.id,
                        "correlation_key": "11111111-1111-1111-1111-111111111111",
                        "candidate_rfqs": [],
                    },
                },
            },
        )
        self.feedback_document_id = uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"apps.integrations.EmailLog:{self.email_log.message_id}",
        )
        AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=self.feedback_document_id,
            document_type="supplier_quote_reply",
            original_extracted_data={"review_target_url": "/my-tasks?tab=ai-review&draft=placeholder"},
            confidence_score=0.89,
        )
        self.client = APIClient()
        self.client.force_login(self.user)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_create_supplier_quote_po_draft_creates_single_draft_po_with_lineage(self):
        result = create_supplier_quote_purchase_order_draft(
            tenant=self.tenant,
            inquiry=self.inquiry,
            rfq_id=self.rfq.id,
        )

        self.inquiry.refresh_from_db()
        self.rfq.refresh_from_db()
        self.email_log.refresh_from_db()
        feedback = AIFeedbackLog.objects.get(tenant=self.tenant, document_id=self.feedback_document_id)
        purchase_order = result.purchase_order

        self.assertTrue(result.created)
        self.assertEqual(purchase_order.status, "draft")
        self.assertEqual(purchase_order.supplier, self.supplier)
        self.assertEqual(purchase_order.product, self.system_product)
        self.assertEqual(purchase_order.total_weight, Decimal("20000"))
        self.assertEqual(purchase_order.weight_unit, "LBS")
        self.assertEqual(purchase_order.price_per_unit, Decimal("2.45"))
        self.assertEqual(purchase_order.total_amount, Decimal("49000.00"))
        self.assertEqual(self.inquiry.supplier_purchase_order_id, purchase_order.id)
        self.assertEqual(self.rfq.custom_data["draft_purchase_order_id"], purchase_order.id)
        self.assertEqual(
            purchase_order.custom_data["source_lineage"]["rfq_id"],
            self.rfq.id,
        )
        self.assertEqual(purchase_order.supplier_contact_email, "sales@quoted.example.com")
        self.assertEqual(
            purchase_order.custom_data["contact_routing"]["billing_contact"]["recipient_email"],
            "ap@quoted.example.com",
        )
        self.assertEqual(
            purchase_order.custom_data["selected_bid"]["contact_routing"]["supplier_contact"]["title"],
            "Account Manager",
        )
        self.assertEqual(self.email_log.related_order_id, purchase_order.id)
        self.assertEqual(self.email_log.status, "order_created")
        self.assertEqual(feedback.document_type, "purchase_order")
        self.assertEqual(
            feedback.original_extracted_data["review_target_url"],
            f"/purchase-orders/{purchase_order.id}/review",
        )

    def test_create_supplier_quote_po_draft_is_idempotent_for_same_rfq(self):
        first = create_supplier_quote_purchase_order_draft(
            tenant=self.tenant,
            inquiry=self.inquiry,
            rfq_id=self.rfq.id,
        )
        second = create_supplier_quote_purchase_order_draft(
            tenant=self.tenant,
            inquiry=self.inquiry,
            rfq_id=self.rfq.id,
        )

        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.purchase_order.id, second.purchase_order.id)
        self.assertEqual(PurchaseOrder.objects.filter(tenant=self.tenant).count(), 1)

    def test_create_supplier_quote_po_draft_does_not_reopen_resolved_review_on_retry(self):
        first = create_supplier_quote_purchase_order_draft(
            tenant=self.tenant,
            inquiry=self.inquiry,
            rfq_id=self.rfq.id,
        )
        feedback = AIFeedbackLog.objects.get(tenant=self.tenant, document_id=self.feedback_document_id)
        feedback.resolved_by = self.user
        feedback.save(update_fields=["resolved_by"])

        second = create_supplier_quote_purchase_order_draft(
            tenant=self.tenant,
            inquiry=self.inquiry,
            rfq_id=self.rfq.id,
        )

        feedback.refresh_from_db()
        self.assertFalse(second.created)
        self.assertEqual(second.purchase_order.id, first.purchase_order.id)
        self.assertEqual(feedback.resolved_by_id, self.user.id)

    def test_create_supplier_quote_po_draft_rejects_unqualified_reply_states(self):
        base_latest_reply_parse = dict(self.rfq.custom_data["latest_reply_parse"])
        base_normalized_quote = dict(base_latest_reply_parse["normalized_quote"])
        invalid_variants = (
            {"parse_status": "ambiguous"},
            {"parse_status": "error"},
            {"correlation_status": "unmatched"},
            {"normalized_quote": {"availability_status": "negative"}},
            {
                "normalized_quote": {
                    "availability_status": "affirmative",
                    "offered_product_name": "",
                    "price_per_unit": None,
                    "currency": "",
                    "quantity": None,
                    "uom": "",
                    "lead_time_text": "",
                    "lead_time_days_min": None,
                    "lead_time_days_max": None,
                    "notes": "",
                }
            },
        )

        for overrides in invalid_variants:
            with self.subTest(overrides=overrides):
                custom_data = dict(self.rfq.custom_data or {})
                latest_reply_parse = dict(base_latest_reply_parse)
                normalized_quote = dict(base_normalized_quote)
                normalized_quote.update(overrides.get("normalized_quote") or {})
                latest_reply_parse.update({k: v for k, v in overrides.items() if k != "normalized_quote"})
                latest_reply_parse["normalized_quote"] = normalized_quote
                custom_data["latest_reply_parse"] = latest_reply_parse
                self.rfq.custom_data = custom_data
                self.rfq.save(update_fields=["custom_data"])

                with self.assertRaises(SupplierQuotePODraftError):
                    create_supplier_quote_purchase_order_draft(
                        tenant=self.tenant,
                        inquiry=self.inquiry,
                        rfq_id=self.rfq.id,
                    )

                self.assertEqual(PurchaseOrder.objects.filter(tenant=self.tenant).count(), 0)

    def test_create_supplier_quote_po_draft_fails_closed_for_cross_tenant_rfq(self):
        other_user = User.objects.create_user(
            username="other-tenant-po-user",
            email="other-tenant-po@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Other PO Tenant",
            slug="other-po-tenant",
            contact_email="other-po@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner")
        other_customer = Customer.objects.create(name="Other Buyer", tenant=other_tenant)
        other_inquiry = Inquiry.objects.create(
            tenant=other_tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=other_customer,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            requested_protein=ProteinTypeChoices.BEEF,
            created_by=other_user,
        )
        other_supplier = Supplier.objects.create(
            tenant=other_tenant,
            name="Other Supplier",
            email="other-supplier@example.com",
        )
        other_rfq = InquirySupplierRFQ.objects.create(
            tenant=other_tenant,
            inquiry=other_inquiry,
            supplier=other_supplier,
            recipient_email="other-supplier@example.com",
            status=InquirySupplierRFQStatusChoices.SENT,
            custom_data={
                "latest_reply_parse": {
                    "parse_status": "parsed",
                    "correlation_status": "matched",
                    "normalized_quote": {
                        "availability_status": "affirmative",
                        "offered_product_name": "Ribeye",
                        "price_per_unit": 2.10,
                        "currency": "USD",
                        "quantity": 10000,
                        "uom": "LBS",
                        "lead_time_text": "5 days",
                        "lead_time_days_min": 5,
                        "lead_time_days_max": 5,
                        "notes": "",
                    },
                    "lineage": {},
                }
            },
        )

        with self.assertRaises(SupplierQuotePODraftError):
            create_supplier_quote_purchase_order_draft(
                tenant=self.tenant,
                inquiry=self.inquiry,
                rfq_id=other_rfq.id,
            )

        self.assertFalse(PurchaseOrder.objects.filter(tenant=self.tenant).exists())

    def test_create_supplier_po_draft_action_returns_purchase_order_payload(self):
        response = self.client.post(
            f"/api/v1/inquiries/{self.inquiry.id}/create-supplier-po-draft/",
            {"rfq_id": self.rfq.id},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["created"])
        self.assertEqual(response.data["purchase_order"]["status"], "draft")
        self.assertEqual(response.data["purchase_order"]["supplier"], self.supplier.id)

        second_response = self.client.post(
            f"/api/v1/inquiries/{self.inquiry.id}/create-supplier-po-draft/",
            {"rfq_id": self.rfq.id},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertFalse(second_response.data["created"])

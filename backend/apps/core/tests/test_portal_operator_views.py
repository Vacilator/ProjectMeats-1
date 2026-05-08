"""API coverage for authenticated operator portal grant controls."""

import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.carriers.models import Carrier
from tenant_apps.customers.models import Customer
from tenant_apps.invoices.models import Invoice, InvoiceStatus
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, PurchaseOrder
from tenant_apps.suppliers.models import Supplier

from apps.core.models import PortalDocumentReference, PortalGrant, PortalGrantDocumentAccess, TenantAuditEvent
from apps.tenants.models import Tenant, TenantUser


@override_settings(ROOT_URLCONF="projectmeats.urls")
class PortalOperatorAPITests(APITestCase):
    """Keep operator portal controls tenant-scoped and auditable."""

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"portal-operator-{unique}",
            email=f"portal-operator-{unique}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"Portal Ops Tenant {unique}",
            slug=f"portal-ops-{unique}",
            contact_email=f"portal-ops-{unique}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

        self.other_tenant = Tenant.objects.create(
            name=f"Other Portal Ops Tenant {unique}",
            slug=f"other-portal-ops-{unique}",
            contact_email=f"other-portal-ops-{unique}@example.com",
            created_by=self.user,
        )

        self.client.force_login(self.user)

        self.customer = Customer.objects.create(
            name=f"Customer {unique}",
            email=f"customer-{unique}@example.com",
            tenant=self.tenant,
        )
        self.other_customer = Customer.objects.create(
            name=f"Other Customer {unique}",
            email=f"other-customer-{unique}@example.com",
            tenant=self.other_tenant,
        )
        self.supplier = Supplier.objects.create(name=f"Supplier {unique}", tenant=self.tenant)
        self.carrier = Carrier.objects.create(
            name=f"Carrier {unique}",
            code=f"C-{unique[:4]}",
            tenant=self.tenant,
        )

        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-{unique}",
            total_amount=Decimal("1500.00"),
            total_weight=Decimal("900.00"),
            weight_unit="LBS",
            status=InvoiceStatus.SENT,
            payment_status="unpaid",
        )
        self.other_invoice = Invoice.objects.create(
            tenant=self.other_tenant,
            customer=self.other_customer,
            invoice_number=f"INV-OTHER-{unique}",
            total_amount=Decimal("999.00"),
            status=InvoiceStatus.SENT,
            payment_status="unpaid",
        )

        self.invoice_pdf = PortalDocumentReference.objects.create(
            tenant=self.tenant,
            source_kind=PortalDocumentReference.SourceKind.INVOICE_PDF,
            source_record_type="invoice",
            source_record_id=str(self.invoice.id),
            display_name="Invoice PDF",
            original_filename="invoice.pdf",
            mime_type="application/pdf",
            byte_size=2048,
            storage_key=f"tenants/{self.tenant.slug}/invoices/invoice.pdf",
            metadata={"invoice_number": self.invoice.invoice_number},
            created_by=self.user,
        )

        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number=f"PO-{unique}",
            supplier=self.supplier,
            order_date=timezone.now().date(),
        )
        self.freight_order = CarrierPurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            carrier=self.carrier,
            linked_order=self.purchase_order,
            our_carrier_po_num=f"CPO-{unique}",
            carrier_name=self.carrier.name,
        )
        self.purchase_order_status_doc = PortalDocumentReference.objects.create(
            tenant=self.tenant,
            source_kind=PortalDocumentReference.SourceKind.PURCHASE_ORDER_STATUS,
            source_record_type="purchase_order",
            source_record_id=str(self.purchase_order.id),
            display_name="Purchase Order Status",
            original_filename="po-status.pdf",
            mime_type="application/pdf",
            byte_size=1024,
            storage_key=f"tenants/{self.tenant.slug}/purchase-orders/status.pdf",
            metadata={"order_number": self.purchase_order.order_number},
            created_by=self.user,
        )

    def tenant_headers(self, tenant=None):
        return {"HTTP_X_TENANT_ID": str((tenant or self.tenant).id)}

    def create_invoice_grant(self, *, raw_token="existing-token") -> PortalGrant:
        grant = PortalGrant(
            tenant=self.tenant,
            subject_email="counterparty@example.com",
            resource_scope={"invoice": [str(self.invoice.id)]},
            document_sources=["invoice_summary", "invoice_pdf"],
            expires_at=timezone.now() + timedelta(days=2),
            created_by=self.user,
            max_uses=3,
        )
        grant.issue_token(raw_token)
        grant.save()
        PortalGrantDocumentAccess.objects.create(
            tenant=self.tenant,
            grant=grant,
            document_reference=self.invoice_pdf,
            linked_by=self.user,
        )
        return grant

    def test_issue_invoice_grant_returns_share_path_and_grant_summary(self):
        response = self.client.post(
            f"/api/v1/portal/targets/invoice/{self.invoice.id}/grants/",
            {
                "subject_email": "buyer@example.com",
                "expires_at": (timezone.now() + timedelta(days=3)).isoformat(),
                "max_uses": 2,
            },
            format="json",
            **self.tenant_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["grant"]["subject_email"], "buyer@example.com")
        self.assertEqual(response.data["grant"]["resource_scope"], {"invoice": [str(self.invoice.id)]})
        self.assertEqual(
            response.data["grant"]["document_sources"],
            ["invoice_summary", "invoice_pdf"],
        )
        self.assertEqual(response.data["grant"]["documents"][0]["display_name"], "Invoice PDF")
        self.assertIn(f"/portal/tenants/{self.tenant.id}/grants/", response.data["share_path"])
        self.assertTrue(response.data["raw_token"])

        audit_event = TenantAuditEvent.objects.get(
            tenant=self.tenant,
            entity_type="PortalGrant",
            action=TenantAuditEvent.Action.CREATE,
        )
        self.assertEqual(audit_event.snapshot_after["portal_event"], "issued")

        list_response = self.client.get(
            f"/api/v1/portal/targets/invoice/{self.invoice.id}/grants/",
            **self.tenant_headers(),
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["target"]["issue_blocker"], None)
        self.assertEqual(len(list_response.data["grants"]), 1)

    def test_issue_grant_cannot_cross_tenant_boundary(self):
        response = self.client.post(
            f"/api/v1/portal/targets/invoice/{self.other_invoice.id}/grants/",
            {
                "subject_email": "buyer@example.com",
                "expires_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "max_uses": 1,
            },
            format="json",
            **self.tenant_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(PortalGrant.objects.filter(tenant=self.tenant).count(), 0)

    def test_resend_rotates_token_and_records_audit_event(self):
        grant = self.create_invoice_grant(raw_token="original-token")

        response = self.client.post(
            f"/api/v1/portal/grants/{grant.id}/resend/",
            {},
            format="json",
            **self.tenant_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data["raw_token"], "original-token")
        self.assertEqual(response.data["grant"]["id"], str(grant.id))

        resend_event = TenantAuditEvent.objects.get(
            tenant=self.tenant,
            entity_type="PortalGrant",
            action=TenantAuditEvent.Action.UPDATE,
            snapshot_after__portal_event="resent",
        )
        self.assertEqual(resend_event.object_id, str(grant.id))

    def test_revoke_and_history_include_lifecycle_and_access_events(self):
        raw_token = "history-token"
        grant = self.create_invoice_grant(raw_token=raw_token)

        snapshot_response = self.client.get(
            f"/api/v1/tenants/{self.tenant.id}/portal/grants/{grant.id}/snapshot/",
            {"token": raw_token},
        )
        self.assertEqual(snapshot_response.status_code, status.HTTP_200_OK)

        revoke_response = self.client.post(
            f"/api/v1/portal/grants/{grant.id}/revoke/",
            {"reason": "Counterparty access no longer required"},
            format="json",
            **self.tenant_headers(),
        )
        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)
        self.assertEqual(revoke_response.data["status"], PortalGrant.Status.REVOKED)

        history_response = self.client.get(
            f"/api/v1/portal/grants/{grant.id}/history/",
            **self.tenant_headers(),
        )
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        portal_events = [
            event.get("snapshot_after", {}).get("portal_event")
            for event in history_response.data["events"]
            if isinstance(event.get("snapshot_after"), dict)
        ]
        endpoints = [
            event.get("snapshot_after", {}).get("endpoint")
            for event in history_response.data["events"]
            if isinstance(event.get("snapshot_after"), dict)
        ]
        self.assertIn("revoked", portal_events)
        self.assertIn("portal.snapshot", endpoints)

    def test_issue_freight_order_grant_resolves_purchase_order_scope(self):
        response = self.client.post(
            f"/api/v1/portal/targets/freight-orders/{self.freight_order.id}/grants/",
            {
                "subject_email": "dispatcher@example.com",
                "expires_at": (timezone.now() + timedelta(days=2)).isoformat(),
                "max_uses": 4,
            },
            format="json",
            **self.tenant_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["grant"]["resource_scope"],
            {"purchase_order": [str(self.purchase_order.id)]},
        )
        self.assertEqual(
            response.data["grant"]["document_sources"],
            ["purchase_order_status"],
        )
        self.assertEqual(
            response.data["grant"]["documents"][0]["display_name"],
            "Purchase Order Status",
        )

"""API coverage for signed-grant public portal read endpoints."""

import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.carriers.models import Carrier
from tenant_apps.customers.models import Customer
from tenant_apps.fulfillments.models import Fulfillment
from tenant_apps.inquiries.models import Inquiry, InquiryEntityTypeChoices, InquiryStatusChoices
from tenant_apps.invoices.models import Invoice, InvoiceStatus
from tenant_apps.suppliers.models import Supplier

from apps.core.models import PortalDocumentReference, PortalGrant, PortalGrantDocumentAccess, TenantAuditEvent
from apps.tenants.models import Tenant


@override_settings(ROOT_URLCONF="projectmeats.urls")
class PortalReadAPITests(APITestCase):
    """Keep public portal reads tenant-explicit and fail closed."""

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"portal-reader-{unique}",
            email=f"portal-reader-{unique}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"Portal Tenant {unique}",
            slug=f"portal-tenant-{unique}",
            contact_email=f"portal-{unique}@example.com",
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name=f"Other Tenant {unique}",
            slug=f"other-tenant-{unique}",
            contact_email=f"other-{unique}@example.com",
            created_by=self.user,
        )

        self.customer = Customer.objects.create(
            name=f"Portal Customer {unique}",
            email=f"customer-{unique}@example.com",
            tenant=self.tenant,
        )
        other_customer = Customer.objects.create(
            name=f"Other Customer {unique}",
            email=f"other-customer-{unique}@example.com",
            tenant=self.other_tenant,
        )
        self.supplier = Supplier.objects.create(name=f"Portal Supplier {unique}", tenant=self.tenant)
        self.carrier = Carrier.objects.create(
            name=f"Portal Carrier {unique}",
            code=f"PC-{unique[:4]}",
            tenant=self.tenant,
        )

        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-{unique}",
            total_amount=Decimal("1250.00"),
            total_weight=Decimal("800.00"),
            weight_unit="LBS",
            status=InvoiceStatus.SENT,
            payment_status="unpaid",
        )
        Invoice.objects.create(
            tenant=self.other_tenant,
            customer=other_customer,
            invoice_number=f"INV-OTHER-{unique}",
            total_amount=Decimal("999.00"),
            status=InvoiceStatus.SENT,
        )

        self.inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            status=InquiryStatusChoices.ACCEPTED,
            tenant=self.tenant,
        )
        self.fulfillment = Fulfillment.objects.create(
            inquiry=self.inquiry,
            supplier=self.supplier,
            customer=self.customer,
            carrier=self.carrier,
            status="shipped",
            tracking_numbers=["TRACK-001"],
            tenant=self.tenant,
        )

        self.raw_token = "portal-read-token"
        self.grant = PortalGrant(
            tenant=self.tenant,
            subject_email="counterparty@example.com",
            resource_scope={
                "invoice": [str(self.invoice.id)],
                "fulfillment": [str(self.fulfillment.id)],
            },
            document_sources=[
                "invoice_summary",
                "invoice_pdf",
                "fulfillment_tracking",
                "fulfillment_bol",
            ],
            expires_at=timezone.now() + timedelta(days=1),
            created_by=self.user,
            max_uses=5,
        )
        self.grant.issue_token(self.raw_token)
        self.grant.save()

        self.document_reference = PortalDocumentReference.objects.create(
            tenant=self.tenant,
            source_kind=PortalDocumentReference.SourceKind.INVOICE_PDF,
            source_record_type="invoice",
            source_record_id=str(self.invoice.id),
            display_name="Invoice PDF",
            original_filename="invoice.pdf",
            mime_type="application/pdf",
            byte_size=2048,
            storage_key="tenants/portal-tenant/invoices/invoice.pdf",
            metadata={
                "document_number": self.invoice.invoice_number,
                "note": "tenants/portal-tenant/invoices/invoice.pdf",
            },
            created_by=self.user,
        )
        PortalGrantDocumentAccess.objects.create(
            tenant=self.tenant,
            grant=self.grant,
            document_reference=self.document_reference,
            linked_by=self.user,
        )

        base = f"/api/v1/tenants/{self.tenant.id}/portal/grants/{self.grant.id}"
        self.invoice_url = f"{base}/invoice-summary/"
        self.snapshot_url = f"{base}/snapshot/"
        self.documents_url = f"{base}/documents/"
        self.fulfillment_url = f"{base}/fulfillment-tracking/"

    def test_invoice_summary_ignores_stale_anonymous_tenant_header(self):
        response = self.client.get(
            self.invoice_url,
            {"token": self.raw_token},
            HTTP_X_TENANT_ID=str(self.other_tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["subject_email"], self.grant.subject_email)
        self.assertEqual(len(response.data["invoices"]), 1)
        self.assertEqual(response.data["invoices"][0]["invoice_number"], self.invoice.invoice_number)
        self.assertNotIn("id", response.data["invoices"][0])

    def test_documents_endpoint_returns_curated_metadata_without_storage_fields(self):
        response = self.client.get(self.documents_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["documents"]), 1)
        document = response.data["documents"][0]
        self.assertNotIn("id", document)
        self.assertNotIn("storage_key", document)
        self.assertNotIn("storage_backend", document)
        self.assertEqual(
            document["metadata"],
            {"document_number": self.invoice.invoice_number},
        )
        audit_event = TenantAuditEvent.objects.get(
            tenant=self.tenant,
            action=TenantAuditEvent.Action.ACCESS,
            object_id=str(self.document_reference.id),
            entity_type="PortalDocumentReference",
        )
        self.assertEqual(audit_event.snapshot_after["endpoint"], "portal.documents")

    def test_fulfillment_tracking_records_access_audit_event(self):
        response = self.client.get(self.fulfillment_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["fulfillments"]), 1)
        self.assertNotIn("id", response.data["fulfillments"][0])
        audit_event = TenantAuditEvent.objects.get(
            tenant=self.tenant,
            action=TenantAuditEvent.Action.ACCESS,
            object_id=str(self.fulfillment.id),
            entity_type="Fulfillment",
        )
        self.assertEqual(audit_event.actor_email, self.grant.subject_email)
        self.assertEqual(audit_event.snapshot_after["grant_id"], str(self.grant.id))
        self.assertEqual(audit_event.snapshot_after["endpoint"], "portal.fulfillment-tracking")

    def test_invoice_summary_records_access_audit_event(self):
        response = self.client.get(self.invoice_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit_event = TenantAuditEvent.objects.get(
            tenant=self.tenant,
            action=TenantAuditEvent.Action.ACCESS,
            object_id=str(self.invoice.id),
            entity_type="Invoice",
        )
        self.assertEqual(audit_event.snapshot_after["endpoint"], "portal.invoice-summary")

    def test_snapshot_endpoint_returns_guest_safe_bundle(self):
        response = self.client.get(self.snapshot_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["grant_id"], str(self.grant.id))
        self.assertEqual(len(response.data["invoices"]), 1)
        self.assertEqual(len(response.data["documents"]), 1)
        self.assertEqual(len(response.data["fulfillments"]), 1)
        self.assertNotIn("id", response.data["invoices"][0])
        self.assertNotIn("id", response.data["documents"][0])
        self.assertNotIn("id", response.data["fulfillments"][0])
        self.assertEqual(
            TenantAuditEvent.objects.filter(
                tenant=self.tenant,
                action=TenantAuditEvent.Action.ACCESS,
                snapshot_after__endpoint="portal.snapshot",
            ).count(),
            3,
        )

    def test_snapshot_endpoint_allows_partial_scope_without_failing_closed(self):
        invoice_only_grant = PortalGrant(
            tenant=self.tenant,
            subject_email="invoice-only@example.com",
            resource_scope={"invoice": [str(self.invoice.id)]},
            document_sources=["invoice_summary"],
            expires_at=timezone.now() + timedelta(days=1),
            created_by=self.user,
            max_uses=3,
        )
        invoice_only_token = "invoice-only-token"
        invoice_only_grant.issue_token(invoice_only_token)
        invoice_only_grant.save()
        snapshot_url = f"/api/v1/tenants/{self.tenant.id}/portal/grants/{invoice_only_grant.id}/snapshot/"

        response = self.client.get(snapshot_url, {"token": invoice_only_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["invoices"]), 1)
        self.assertEqual(response.data["documents"], [])
        self.assertEqual(response.data["fulfillments"], [])

    def test_invoice_summary_rejects_wrong_token(self):
        response = self.client.get(self.invoice_url, {"token": "bad-token"})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invoice_summary_rejects_expired_grant(self):
        self.grant.expires_at = timezone.now() - timedelta(minutes=1)
        self.grant.save()

        response = self.client.get(self.invoice_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_fulfillment_tracking_rejects_revoked_grant(self):
        self.grant.revoke(user=self.user, reason="operator cancelled")
        self.grant.save()

        response = self.client.get(self.fulfillment_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invoice_summary_rejects_inactive_tenant(self):
        self.tenant.is_active = False
        self.tenant.save(update_fields=["is_active", "updated_at"])

        response = self.client.get(self.invoice_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invoice_summary_rejects_tenant_path_mismatch(self):
        mismatched_url = f"/api/v1/tenants/{self.other_tenant.id}/portal/grants/{self.grant.id}/invoice-summary/"

        response = self.client.get(mismatched_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("apps.core.portal_views.tenant_rls")
    def test_invoice_summary_binds_path_tenant_into_rls_context(self, tenant_rls_mock):
        tenant_rls_mock.return_value.__enter__.return_value = None
        tenant_rls_mock.return_value.__exit__.return_value = False

        response = self.client.get(self.invoice_url, {"token": self.raw_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tenant_rls_mock.assert_called_once_with(str(self.tenant.id), strict=True)

    def test_bounded_use_grant_denies_second_read(self):
        one_time_grant = PortalGrant(
            tenant=self.tenant,
            subject_email="one-time@example.com",
            resource_scope={"invoice": [str(self.invoice.id)]},
            document_sources=["invoice_summary", "invoice_pdf", "fulfillment_tracking"],
            expires_at=timezone.now() + timedelta(days=1),
            created_by=self.user,
            max_uses=1,
        )
        one_time_token = "one-time-portal-token"
        one_time_grant.issue_token(one_time_token)
        one_time_grant.save()
        one_time_url = f"/api/v1/tenants/{self.tenant.id}/portal/grants/{one_time_grant.id}/snapshot/"

        first_response = self.client.get(one_time_url, {"token": one_time_token})
        second_response = self.client.get(one_time_url, {"token": one_time_token})

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_404_NOT_FOUND)

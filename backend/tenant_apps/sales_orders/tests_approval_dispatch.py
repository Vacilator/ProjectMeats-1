"""Tests for the SalesOrderApprovalDispatch service (CTE-04.2)."""

import uuid
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tenant_apps.sales_orders.models import (
    SalesOrder,
    SalesOrderApprovalDispatch,
    SalesOrderApprovalDispatchStatus,
    SalesOrderStatus,
)
from tenant_apps.sales_orders.services.approval_dispatch import (
    SalesOrderApprovalDispatchResult,
    approve_sales_order_and_send_to_customer,
)

from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


def _uid():
    return uuid.uuid4().hex[:8]


class SalesOrderApprovalDispatchServiceTests(TestCase):
    """Unit tests for approve_sales_order_and_send_to_customer."""

    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(name=f"Test Tenant {_uid()}", slug=f"test-{_uid()}")
        cls.user = User.objects.create_user(username=f"tester_{_uid()}", password="password123")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="admin")

        # Import models needed for FK
        from tenant_apps.customers.models import Customer
        from tenant_apps.suppliers.models import Supplier

        cls.supplier = Supplier.objects.create(
            tenant=cls.tenant,
            name=f"Supplier {_uid()}",
        )
        cls.customer = Customer.objects.create(
            tenant=cls.tenant,
            name=f"Customer {_uid()}",
            email="customer@example.com",
        )
        cls.sales_order = SalesOrder.objects.create(
            tenant=cls.tenant,
            supplier=cls.supplier,
            customer=cls.customer,
            our_sales_order_num=f"SO-{_uid()}",
            status=SalesOrderStatus.PENDING_APPROVAL,
        )

    def test_missing_tenant_returns_error(self):
        result = approve_sales_order_and_send_to_customer(tenant=None, sales_order=self.sales_order, user=self.user)
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "missing_tenant")

    def test_wrong_tenant_returns_error(self):
        other_tenant = Tenant.objects.create(name=f"Other {_uid()}", slug=f"other-{_uid()}")
        result = approve_sales_order_and_send_to_customer(
            tenant=other_tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "invalid_sales_order")

    @patch("tenant_apps.sales_orders.services.approval_dispatch.set_current_tenant")
    def test_rls_failure_returns_error(self, mock_rls):
        mock_rls.return_value = MagicMock(ok=False, error="RLS failed")
        result = approve_sales_order_and_send_to_customer(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "tenant_rls_error")

    @patch("tenant_apps.sales_orders.services.approval_dispatch.set_current_tenant")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_sender_provider")
    def test_no_provider_returns_error(self, mock_provider, mock_rls):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.side_effect = ValueError("Outlook is not connected for this tenant.")
        result = approve_sales_order_and_send_to_customer(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "provider_error")
        self.assertIn("Outlook", result.error_message)

    @patch("tenant_apps.sales_orders.services.approval_dispatch.set_current_tenant")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_sender_provider")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_access_token")
    @patch("tenant_apps.sales_orders.services.approval_dispatch.generate_document_pdf_for_instance")
    @patch("tenant_apps.sales_orders.services.approval_dispatch.MicrosoftGraphProvider")
    def test_happy_path_sends_email_and_marks_approved(
        self, mock_graph_cls, mock_pdf, mock_token, mock_provider, mock_rls
    ):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="sender@company.com", pk=None)
        mock_token.return_value = "fake-access-token"
        mock_pdf.return_value = MagicMock(filename="SO-12345.pdf", content=b"%PDF-1.4 fake content")
        mock_graph_instance = MagicMock()
        mock_graph_instance.send_email.return_value = MagicMock(
            message_id="msg-123", thread_id="thread-456", internet_message_id="internet-789"
        )
        mock_graph_cls.return_value = mock_graph_instance

        result = approve_sales_order_and_send_to_customer(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )

        self.assertTrue(result.success)
        self.sales_order.refresh_from_db()
        self.assertEqual(self.sales_order.status, SalesOrderStatus.APPROVED)

        dispatch = SalesOrderApprovalDispatch.objects.get(tenant=self.tenant, sales_order=self.sales_order)
        self.assertEqual(dispatch.status, SalesOrderApprovalDispatchStatus.SENT)
        self.assertEqual(dispatch.recipient_email, "customer@example.com")
        self.assertEqual(dispatch.provider_message_id, "msg-123")
        self.assertIn("approved", self.sales_order.custom_data.get("review_state", ""))

    @patch("tenant_apps.sales_orders.services.approval_dispatch.set_current_tenant")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_sender_provider")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_access_token")
    @patch("tenant_apps.sales_orders.services.approval_dispatch.generate_document_pdf_for_instance")
    @patch("tenant_apps.sales_orders.services.approval_dispatch.MicrosoftGraphProvider")
    def test_idempotent_when_already_sent(self, mock_graph_cls, mock_pdf, mock_token, mock_provider, mock_rls):
        """If dispatch is already SENT, calling again returns success without re-sending."""
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="sender@company.com", pk=None)
        mock_token.return_value = "fake-access-token"
        mock_pdf.return_value = MagicMock(filename="SO-12345.pdf", content=b"%PDF-1.4 fake")
        mock_graph_instance = MagicMock()
        mock_graph_instance.send_email.return_value = MagicMock(
            message_id="msg-1", thread_id="t-1", internet_message_id="i-1"
        )
        mock_graph_cls.return_value = mock_graph_instance

        # First call
        result1 = approve_sales_order_and_send_to_customer(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertTrue(result1.success)
        self.assertEqual(mock_graph_instance.send_email.call_count, 1)

        # Second call — idempotent
        result2 = approve_sales_order_and_send_to_customer(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertTrue(result2.success)
        # send_email not called a second time
        self.assertEqual(mock_graph_instance.send_email.call_count, 1)

    @patch("tenant_apps.sales_orders.services.approval_dispatch.set_current_tenant")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_sender_provider")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_access_token")
    @patch("tenant_apps.sales_orders.services.approval_dispatch.generate_document_pdf_for_instance")
    @patch("tenant_apps.sales_orders.services.approval_dispatch.MicrosoftGraphProvider")
    def test_email_failure_marks_dispatch_failed(self, mock_graph_cls, mock_pdf, mock_token, mock_provider, mock_rls):
        from apps.integrations.providers.base import EmailProviderError

        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="sender@company.com", pk=None)
        mock_token.return_value = "fake-access-token"
        mock_pdf.return_value = MagicMock(filename="SO-12345.pdf", content=b"%PDF-1.4 fake")
        mock_graph_instance = MagicMock()
        mock_graph_instance.send_email.side_effect = EmailProviderError("SMTP timeout")
        mock_graph_cls.return_value = mock_graph_instance

        result = approve_sales_order_and_send_to_customer(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )

        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "email_send_error")

        dispatch = SalesOrderApprovalDispatch.objects.get(tenant=self.tenant, sales_order=self.sales_order)
        self.assertEqual(dispatch.status, SalesOrderApprovalDispatchStatus.FAILED)

    @patch("tenant_apps.sales_orders.services.approval_dispatch.set_current_tenant")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_sender_provider")
    @patch("tenant_apps.sales_orders.services.approval_dispatch._get_access_token")
    def test_no_recipient_email_returns_error(self, mock_token, mock_provider, mock_rls):
        """If customer has no email, return appropriate error."""
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="sender@company.com")
        mock_token.return_value = "fake-access-token"

        # Remove customer email
        self.customer.email = ""
        self.customer.save()

        # Create SO with no contact
        so = SalesOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            customer=self.customer,
            our_sales_order_num=f"SO-NR-{_uid()}",
            status=SalesOrderStatus.PENDING_APPROVAL,
        )

        result = approve_sales_order_and_send_to_customer(tenant=self.tenant, sales_order=so, user=self.user)
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "no_recipient")

        # Restore for other tests
        self.customer.email = "customer@example.com"
        self.customer.save()


class SalesOrderApprovalDispatchAPITests(TestCase):
    """Test the transition-status endpoint triggers approval dispatch."""

    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(name=f"API Tenant {_uid()}", slug=f"api-{_uid()}")
        cls.user = User.objects.create_user(username=f"api_user_{_uid()}", password="password123")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="admin")

        from tenant_apps.customers.models import Customer
        from tenant_apps.suppliers.models import Supplier

        cls.supplier = Supplier.objects.create(tenant=cls.tenant, name=f"Supplier {_uid()}")
        cls.customer = Customer.objects.create(
            tenant=cls.tenant, name=f"Customer {_uid()}", email="api-cust@example.com"
        )
        cls.sales_order = SalesOrder.objects.create(
            tenant=cls.tenant,
            supplier=cls.supplier,
            customer=cls.customer,
            our_sales_order_num=f"SO-API-{_uid()}",
            status=SalesOrderStatus.PENDING_APPROVAL,
        )

    @patch("tenant_apps.sales_orders.views.approve_sales_order_and_send_to_customer")
    def test_transition_to_approved_triggers_dispatch(self, mock_approve):
        mock_approve.return_value = SalesOrderApprovalDispatchResult(success=True)
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/api/v1/sales-orders/{self.sales_order.pk}/transition-status/",
            {"status": "approved"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertIn(response.status_code, [200, 201])
        mock_approve.assert_called_once()

    @patch("tenant_apps.sales_orders.views.approve_sales_order_and_send_to_customer")
    def test_transition_to_approved_failure_returns_error(self, mock_approve):
        mock_approve.return_value = SalesOrderApprovalDispatchResult(
            success=False,
            error_message="Outlook is not connected.",
            error_code="provider_error",
            http_status=502,
        )
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/api/v1/sales-orders/{self.sales_order.pk}/transition-status/",
            {"status": "approved"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(response.status_code, 502)
        self.assertIn("Outlook", response.data["error"])

    def test_transition_to_non_approved_uses_default_behavior(self):
        """Non-approval transitions still use the standard mixin behavior."""
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/api/v1/sales-orders/{self.sales_order.pk}/transition-status/",
            {"status": "cancelled"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        # Should succeed using the standard mixin (cancelled is valid from pending_approval)
        self.assertIn(response.status_code, [200, 201])

"""Tests for the CarrierFreightInquiry service (CTE-04.3)."""

import uuid
from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser
from django.contrib.auth import get_user_model
from tenant_apps.carriers.models import (
    Carrier,
    CarrierFreightInquiry,
    CarrierFreightInquiryStatus,
)
from tenant_apps.carriers.services.freight_inquiry import (
    CarrierFreightInquiryResult,
    send_carrier_freight_inquiries,
)
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

User = get_user_model()


def _uid():
    return uuid.uuid4().hex[:8]


class CarrierFreightInquiryServiceTests(TestCase):
    """Unit tests for send_carrier_freight_inquiries."""

    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(name=f"Test Tenant {_uid()}", slug=f"test-{_uid()}")
        cls.user = User.objects.create_user(username=f"tester_{_uid()}", password="password123")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="admin")

        from tenant_apps.suppliers.models import Supplier
        from tenant_apps.customers.models import Customer

        cls.supplier = Supplier.objects.create(tenant=cls.tenant, name=f"Supplier {_uid()}")
        cls.customer = Customer.objects.create(
            tenant=cls.tenant, name=f"Customer {_uid()}", email="cust@example.com"
        )
        cls.carrier1 = Carrier.objects.create(
            tenant=cls.tenant,
            name=f"FastFreight {_uid()}",
            code=f"FF-{_uid()[:4]}",
            email="dispatch@fastfreight.com",
            is_active=True,
        )
        cls.carrier2 = Carrier.objects.create(
            tenant=cls.tenant,
            name=f"QuickShip {_uid()}",
            code=f"QS-{_uid()[:4]}",
            sales_contact_email="sales@quickship.com",
            sales_contact_name="Bob",
            is_active=True,
        )
        cls.carrier_no_email = Carrier.objects.create(
            tenant=cls.tenant,
            name=f"NoEmail {_uid()}",
            code=f"NE-{_uid()[:4]}",
            email="",
            is_active=True,
        )
        cls.sales_order = SalesOrder.objects.create(
            tenant=cls.tenant,
            supplier=cls.supplier,
            customer=cls.customer,
            our_sales_order_num=f"SO-{_uid()}",
            status=SalesOrderStatus.APPROVED,
        )

    def test_missing_tenant_returns_error(self):
        result = send_carrier_freight_inquiries(
            tenant=None, sales_order=self.sales_order, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "missing_tenant")

    def test_wrong_tenant_returns_error(self):
        other_tenant = Tenant.objects.create(name=f"Other {_uid()}", slug=f"other-{_uid()}")
        result = send_carrier_freight_inquiries(
            tenant=other_tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "invalid_sales_order")

    def test_draft_status_rejected(self):
        so = SalesOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            customer=self.customer,
            our_sales_order_num=f"SO-D-{_uid()}",
            status=SalesOrderStatus.DRAFT,
        )
        result = send_carrier_freight_inquiries(
            tenant=self.tenant, sales_order=so, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "invalid_status")

    @patch("tenant_apps.carriers.services.freight_inquiry.set_current_tenant")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_sender_provider")
    def test_no_provider_returns_error(self, mock_provider, mock_rls):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.side_effect = ValueError("Outlook is not connected for this tenant.")
        result = send_carrier_freight_inquiries(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "provider_error")

    @patch("tenant_apps.carriers.services.freight_inquiry.set_current_tenant")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_sender_provider")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_access_token")
    @patch("tenant_apps.carriers.services.freight_inquiry.MicrosoftGraphProvider")
    def test_happy_path_sends_to_multiple_carriers(
        self, mock_graph_cls, mock_token, mock_provider, mock_rls
    ):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="logistics@co.com", pk=None)
        mock_token.return_value = "fake-token"
        mock_graph_instance = MagicMock()
        mock_graph_instance.send_email.return_value = MagicMock(
            message_id="msg-1", thread_id="t-1", internet_message_id="i-1"
        )
        mock_graph_cls.return_value = mock_graph_instance

        result = send_carrier_freight_inquiries(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )

        self.assertTrue(result.success)
        # Should have sent to carrier1 and carrier2 (carrier_no_email excluded)
        self.assertEqual(result.inquiries_sent, 2)
        self.assertEqual(result.inquiries_failed, 0)
        self.assertEqual(mock_graph_instance.send_email.call_count, 2)

        # Verify inquiry rows created
        inquiries = CarrierFreightInquiry.objects.filter(
            tenant=self.tenant, sales_order=self.sales_order
        )
        self.assertEqual(inquiries.count(), 2)
        self.assertTrue(all(i.status == CarrierFreightInquiryStatus.SENT for i in inquiries))

    @patch("tenant_apps.carriers.services.freight_inquiry.set_current_tenant")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_sender_provider")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_access_token")
    @patch("tenant_apps.carriers.services.freight_inquiry.MicrosoftGraphProvider")
    def test_explicit_carrier_ids_filter(
        self, mock_graph_cls, mock_token, mock_provider, mock_rls
    ):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="logistics@co.com", pk=None)
        mock_token.return_value = "fake-token"
        mock_graph_instance = MagicMock()
        mock_graph_instance.send_email.return_value = MagicMock(
            message_id="msg-1", thread_id="t-1", internet_message_id="i-1"
        )
        mock_graph_cls.return_value = mock_graph_instance

        result = send_carrier_freight_inquiries(
            tenant=self.tenant,
            sales_order=self.sales_order,
            user=self.user,
            carrier_ids=[self.carrier1.id],
        )

        self.assertTrue(result.success)
        self.assertEqual(result.inquiries_sent, 1)
        self.assertEqual(mock_graph_instance.send_email.call_count, 1)

    @patch("tenant_apps.carriers.services.freight_inquiry.set_current_tenant")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_sender_provider")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_access_token")
    @patch("tenant_apps.carriers.services.freight_inquiry.MicrosoftGraphProvider")
    def test_idempotent_skips_already_sent(
        self, mock_graph_cls, mock_token, mock_provider, mock_rls
    ):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="logistics@co.com", pk=None)
        mock_token.return_value = "fake-token"
        mock_graph_instance = MagicMock()
        mock_graph_instance.send_email.return_value = MagicMock(
            message_id="msg-1", thread_id="t-1", internet_message_id="i-1"
        )
        mock_graph_cls.return_value = mock_graph_instance

        # First call
        result1 = send_carrier_freight_inquiries(
            tenant=self.tenant,
            sales_order=self.sales_order,
            user=self.user,
            carrier_ids=[self.carrier1.id],
        )
        self.assertTrue(result1.success)
        self.assertEqual(result1.inquiries_sent, 1)

        # Second call — should be idempotent
        result2 = send_carrier_freight_inquiries(
            tenant=self.tenant,
            sales_order=self.sales_order,
            user=self.user,
            carrier_ids=[self.carrier1.id],
        )
        self.assertTrue(result2.success)
        # already_sent counts as success (no new email sent)
        self.assertEqual(mock_graph_instance.send_email.call_count, 1)

    @patch("tenant_apps.carriers.services.freight_inquiry.set_current_tenant")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_sender_provider")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_access_token")
    @patch("tenant_apps.carriers.services.freight_inquiry.MicrosoftGraphProvider")
    def test_partial_failure_reports_mixed_results(
        self, mock_graph_cls, mock_token, mock_provider, mock_rls
    ):
        from apps.integrations.providers.base import EmailProviderError

        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="logistics@co.com", pk=None)
        mock_token.return_value = "fake-token"
        mock_graph_instance = MagicMock()
        # First call succeeds, second fails
        mock_graph_instance.send_email.side_effect = [
            MagicMock(message_id="msg-1", thread_id="t-1", internet_message_id="i-1"),
            EmailProviderError("Timeout"),
        ]
        mock_graph_cls.return_value = mock_graph_instance

        result = send_carrier_freight_inquiries(
            tenant=self.tenant, sales_order=self.sales_order, user=self.user
        )

        # Partial success (at least one sent)
        self.assertTrue(result.success)
        self.assertEqual(result.inquiries_sent, 1)
        self.assertEqual(result.inquiries_failed, 1)

    @patch("tenant_apps.carriers.services.freight_inquiry.set_current_tenant")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_sender_provider")
    @patch("tenant_apps.carriers.services.freight_inquiry._get_access_token")
    def test_no_eligible_carriers_returns_error(self, mock_token, mock_provider, mock_rls):
        mock_rls.return_value = MagicMock(ok=True)
        mock_provider.return_value = MagicMock(connected_email="logistics@co.com", pk=None)
        mock_token.return_value = "fake-token"

        # Only request the carrier with no email
        result = send_carrier_freight_inquiries(
            tenant=self.tenant,
            sales_order=self.sales_order,
            user=self.user,
            carrier_ids=[self.carrier_no_email.id],
        )
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "no_carriers")


class CarrierFreightInquiryAPITests(TestCase):
    """Test the send-carrier-freight-inquiries endpoint."""

    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(name=f"API Tenant {_uid()}", slug=f"api-{_uid()}")
        cls.user = User.objects.create_user(username=f"api_user_{_uid()}", password="password123")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="admin")

        from tenant_apps.suppliers.models import Supplier
        from tenant_apps.customers.models import Customer

        cls.supplier = Supplier.objects.create(tenant=cls.tenant, name=f"Supplier {_uid()}")
        cls.customer = Customer.objects.create(
            tenant=cls.tenant, name=f"Customer {_uid()}", email="cust@example.com"
        )
        cls.sales_order = SalesOrder.objects.create(
            tenant=cls.tenant,
            supplier=cls.supplier,
            customer=cls.customer,
            our_sales_order_num=f"SO-API-{_uid()}",
            status=SalesOrderStatus.APPROVED,
        )

    @patch("tenant_apps.sales_orders.views.send_carrier_freight_inquiries")
    def test_endpoint_calls_service(self, mock_service):
        mock_service.return_value = CarrierFreightInquiryResult(
            success=True, inquiries_sent=3, details=[]
        )
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/api/v1/sales-orders/{self.sales_order.pk}/send-carrier-freight-inquiries/",
            {},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["inquiries_sent"], 3)
        mock_service.assert_called_once()

    @patch("tenant_apps.sales_orders.views.send_carrier_freight_inquiries")
    def test_endpoint_passes_carrier_ids(self, mock_service):
        mock_service.return_value = CarrierFreightInquiryResult(
            success=True, inquiries_sent=1, details=[]
        )
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/api/v1/sales-orders/{self.sales_order.pk}/send-carrier-freight-inquiries/",
            {"carrier_ids": [123, 456]},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(response.status_code, 200)
        call_kwargs = mock_service.call_args[1]
        self.assertEqual(call_kwargs["carrier_ids"], [123, 456])

    @patch("tenant_apps.sales_orders.views.send_carrier_freight_inquiries")
    def test_endpoint_failure_returns_error(self, mock_service):
        mock_service.return_value = CarrierFreightInquiryResult(
            success=False,
            error_message="No eligible carriers found.",
            error_code="no_carriers",
            http_status=422,
        )
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/api/v1/sales-orders/{self.sales_order.pk}/send-carrier-freight-inquiries/",
            {},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("No eligible carriers", response.data["error"])

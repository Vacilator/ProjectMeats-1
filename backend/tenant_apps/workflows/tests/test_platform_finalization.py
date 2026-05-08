"""Platform Finalization Tests (Sprint Capstone).

Tests for:
- Master data integration (RFQ send, bid selection with contacts, PO prefill)
- Cockpit routing service
- Contact resolution enhanced config
- Action executor new registrations
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase


class ResolveRFQContactsForSendTests(SimpleTestCase):
    """Test resolve_rfq_contacts_for_send executor."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.E2EProcessExecutors = E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {
            "current_supplier": {"id": "sup-1"},
            "product_name": "Ground Beef",
        }

    @patch("tenant_apps.workflows.services.e2e_executors.apps.get_model")
    @patch("tenant_apps.workflows.services.contact_resolution.resolve_rfq_recipient")
    def test_resolve_rfq_contacts_success(self, mock_resolve, mock_get_model):
        """Resolves RFQ contact with certifications and shipping preferences."""
        from tenant_apps.workflows.services.contact_resolution import ResolvedContact

        mock_supplier = MagicMock(company_name="Acme Meats")
        mock_supplier_model = MagicMock()
        mock_supplier_model.objects.filter.return_value.first.return_value = mock_supplier
        mock_get_model.return_value = mock_supplier_model

        mock_resolve.return_value = ResolvedContact(
            contact_id="c-1",
            name="John Smith",
            email="john@acme.com",
            phone="555-1234",
            contact_type="Sales",
            title="VP Sales",
            department="Sales",
            responsibilities=["Ground Beef", "Pork"],
            resolution_method="type_match",
        )

        executors = self.E2EProcessExecutors(self.tenant, self.context)
        config = {
            "contactResolution": {
                "plantContactType": "Sales",
                "certifications": ["USDA", "HACCP"],
                "shippingPreferences": ["Refrigerated"],
                "documentAttachments": ["RFQ Document", "Spec Sheet"],
            }
        }
        result = executors.resolve_rfq_contacts_for_send(config)

        self.assertTrue(result.success)
        self.assertEqual(result.data["rfq_recipient"]["name"], "John Smith")
        self.assertEqual(result.data["rfq_recipient"]["certifications_filter"], ["USDA", "HACCP"])
        self.assertEqual(result.data["rfq_recipient"]["shipping_preferences"], ["Refrigerated"])
        self.assertTrue(result.data["has_contact"])

    def test_resolve_rfq_no_supplier(self):
        """Returns error when no supplier in context."""
        self.context = {}
        executors = self.E2EProcessExecutors(self.tenant, self.context)
        result = executors.resolve_rfq_contacts_for_send({})
        self.assertFalse(result.success)
        self.assertIn("No supplier", result.error)


class BidSelectionWithContactsTests(SimpleTestCase):
    """Test bid selection with supplier contact enrichment."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.E2EProcessExecutors = E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {
            "received_bids": [
                {
                    "id": "bid-1",
                    "supplier_name": "Supplier A",
                    "supplier_id": "sup-a",
                    "price": 100,
                    "margin_percent": 8.0,
                    "reliability": 90,
                    "lead_time": 5,
                    "quality_score": 85,
                },
            ],
        }

    def test_bid_selection_enriches_with_contacts(self):
        """Bid selection result includes base fields; contact enrichment is best-effort."""
        executors = self.E2EProcessExecutors(self.tenant, self.context)

        # The enrichment is best-effort — if supplier not found it just skips
        with patch(
            "tenant_apps.workflows.services.e2e_executors.apps.get_model",
        ) as mock_get_model:
            mock_model = MagicMock()
            mock_model.objects.filter.return_value.first.return_value = None
            mock_get_model.return_value = mock_model

            result = executors.bid_selection_with_contacts({})

        self.assertTrue(result.success)
        self.assertEqual(result.data["selected_bid_id"], "bid-1")
        self.assertEqual(result.data["supplier_name"], "Supplier A")
        self.assertIn("weighted_score", result.data)


class PrefillPOContactsTests(SimpleTestCase):
    """Test PO form pre-fill with resolved contacts."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.E2EProcessExecutors = E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {"supplier_id": "sup-1"}

    @patch("tenant_apps.workflows.services.e2e_executors.apps.get_model")
    def test_prefill_no_supplier_found(self, mock_get_model):
        """Returns not prefilled when supplier not found."""
        mock_model = MagicMock()
        mock_model.objects.filter.return_value.first.return_value = None
        mock_get_model.return_value = mock_model

        executors = self.E2EProcessExecutors(self.tenant, self.context)
        result = executors.prefill_po_contacts({})

        self.assertTrue(result.success)
        self.assertFalse(result.data["prefilled"])
        self.assertEqual(result.data["reason"], "supplier_not_found")

    def test_prefill_no_supplier_in_context(self):
        """Returns not prefilled when no supplier_id in context."""
        self.context = {}
        executors = self.E2EProcessExecutors(self.tenant, self.context)
        result = executors.prefill_po_contacts({})
        self.assertTrue(result.success)
        self.assertFalse(result.data["prefilled"])


class CockpitRoutingServiceTests(SimpleTestCase):
    """Test cockpit routing service functions."""

    def test_infer_form_type_po(self):
        """Infers purchase_order when PO numbers present."""
        from tenant_apps.ai_assistant.services.cockpit_routing import infer_form_type
        result = infer_form_type({"po_numbers": ["226052"]})
        self.assertEqual(result, "purchase_order")

    def test_infer_form_type_bid(self):
        """Infers bid when line items with prices present."""
        from tenant_apps.ai_assistant.services.cockpit_routing import infer_form_type
        result = infer_form_type({
            "line_items": [{"protein": "Beef", "unit_price": 3.50}]
        })
        self.assertEqual(result, "bid")

    def test_infer_form_type_inquiry(self):
        """Infers inquiry when line items without prices present."""
        from tenant_apps.ai_assistant.services.cockpit_routing import infer_form_type
        result = infer_form_type({
            "line_items": [{"protein": "Pork"}]
        })
        self.assertEqual(result, "inquiry")

    def test_infer_form_type_unknown(self):
        """Returns unknown when no clear signals."""
        from tenant_apps.ai_assistant.services.cockpit_routing import infer_form_type
        result = infer_form_type({})
        self.assertEqual(result, "unknown")


class ActionExecutorRegistrationTests(SimpleTestCase):
    """Test that new action types are properly registered."""

    def test_new_handlers_registered(self):
        """All master-data integration handlers are in the action map."""
        from tenant_apps.workflows.services.action_executor import ActionExecutor
        executor = ActionExecutor.__new__(ActionExecutor)
        executor.tenant = MagicMock()
        executor.context = {}
        executor.execution = MagicMock()

        # Call execute to trigger handler map creation
        # (We test the handler map keys exist)
        with patch.object(ActionExecutor, '__init__', return_value=None):
            executor2 = ActionExecutor.__new__(ActionExecutor)
            executor2.tenant = MagicMock()
            executor2.context = {}
            executor2.execution = MagicMock()

        # Check by importing and inspecting source
        import inspect
        source = inspect.getsource(ActionExecutor.execute)
        self.assertIn("resolve_rfq_contacts_for_send", source)
        self.assertIn("bid_selection_with_contacts", source)
        self.assertIn("prefill_po_contacts", source)


class ContactResolutionMultiSelectTests(SimpleTestCase):
    """Test contact resolution with enhanced multi-select configs."""

    def test_resolve_rfq_returns_none_when_no_contacts(self):
        """resolve_rfq_recipient returns None when supplier has no contacts."""
        from tenant_apps.workflows.services.contact_resolution import (
            resolve_rfq_recipient,
        )
        tenant = MagicMock(pk="t-1")
        supplier = MagicMock(pk="s-1")

        with patch(
            "tenant_apps.contacts.models.Contact.objects"
        ) as mock_objects:
            mock_qs = MagicMock()
            mock_qs.exists.return_value = False
            mock_qs.order_by.return_value = mock_qs
            mock_objects.filter.return_value = mock_qs

            result = resolve_rfq_recipient(
                tenant=tenant,
                supplier=supplier,
                preferred_contact_type="Quality",
                product_context="Ground Beef",
            )

        self.assertIsNone(result)


class InboxParserIntegrationTests(SimpleTestCase):
    """Integration tests for the enhanced inbox parser with PO 226052."""

    def test_parse_rowena_tx_po_226052(self):
        """Full parsing of the Rowena/TX PO 226052 test email."""
        from tenant_apps.ai_assistant.services.inbox_parser import InboxParser

        parser = InboxParser()
        result = parser.parse(
            subject="PO#226052 - 5000 lbs Ground Beef - Rowena TX",
            body="""Hi,

Please find attached our purchase order #226052 for 5000 lbs of Ground Beef 80/20.
Ship date: 03/15/2026.
Price: $3.45/lb FOB Rowena, TX.

Best regards,
Sarah Johnson
Rowena Meat Company
""",
            sender_email="sarah@rowanameats.com",
            sender_name="Sarah Johnson",
        )

        self.assertIn("226052", result.po_numbers)
        self.assertTrue(len(result.weights) > 0)
        self.assertEqual(result.weights[0]["amount"], 5000.0)
        self.assertEqual(result.weights[0]["unit"], "LBS")
        self.assertTrue(any("ground beef" in p.lower() for p in result.proteins))
        self.assertTrue(result.is_actionable)
        self.assertTrue(result.has_po)

        # Test form payload generation
        payload = result.to_form_payload()
        self.assertEqual(payload["po_number"], "226052")
        self.assertEqual(payload["total_weight"], 5000.0)
        self.assertEqual(payload["weight_unit"], "LBS")
        self.assertTrue("beef" in payload.get("protein_type", "").lower())

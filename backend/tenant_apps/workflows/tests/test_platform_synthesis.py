"""Tests for Platform Synthesis — E2E Executors, Inbox Parser, Feedback Tasks.

Covers:
- E2E runtime executors (generate_sales_order, bid_selection, check_bids, etc.)
- AI Inbox enhanced parser (PO extraction, protein/weight/price/date)
- Dependency auto-creator
- Feedback stats aggregation
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase


# ═══════════════════════════════════════════════════════════════════════════
# InboxParser Tests
# ═══════════════════════════════════════════════════════════════════════════


class ExtractPONumbersTests(SimpleTestCase):
    """Test PO number extraction from various formats."""

    def setUp(self):
        from tenant_apps.ai_assistant.services.inbox_parser import extract_po_numbers
        self.extract = extract_po_numbers

    def test_standard_po_format(self):
        self.assertEqual(self.extract("Please reference PO#226052"), ["226052"])

    def test_po_dash_format(self):
        self.assertEqual(self.extract("PO-12345 attached"), ["12345"])

    def test_po_space_format(self):
        self.assertEqual(self.extract("Send to PO 98765"), ["98765"])

    def test_period_format(self):
        self.assertEqual(self.extract("P.O. 55555 confirmed"), ["55555"])

    def test_purchase_order_format(self):
        self.assertEqual(self.extract("Purchase Order 226052 from Rowena"), ["226052"])

    def test_order_hash_format(self):
        self.assertEqual(self.extract("Order #99999 shipped"), ["99999"])

    def test_requisition_format(self):
        self.assertEqual(self.extract("REQ-44444 approved"), ["44444"])

    def test_multiple_pos(self):
        text = "PO#11111 and PO-22222 are ready"
        result = self.extract(text)
        self.assertIn("11111", result)
        self.assertIn("22222", result)

    def test_no_match(self):
        self.assertEqual(self.extract("No orders here"), [])

    def test_alphanumeric_po(self):
        result = self.extract("PO-TX-226052 from Texas")
        self.assertTrue(len(result) > 0)


class InboxParserTests(SimpleTestCase):
    """Test full parsing engine."""

    def setUp(self):
        from tenant_apps.ai_assistant.services.inbox_parser import InboxParser
        self.parser = InboxParser()

    def test_parse_full_trade_email(self):
        result = self.parser.parse(
            subject="PO#226052 - 5000 lbs Ground Beef",
            body="Ship by 05/20/2026. Price: $4.50/lb. From Rowena TX plant.",
            sender_email="orders@rowena.com",
            sender_name="Rowena Meats",
        )
        self.assertEqual(result.po_numbers, ["226052"])
        self.assertIn("ground beef", result.proteins)
        self.assertEqual(result.weights[0]["amount"], 5000.0)
        self.assertEqual(result.weights[0]["unit"], "LBS")
        self.assertEqual(result.prices[0]["amount"], 4.50)
        self.assertEqual(result.prices[0]["per_unit"], "lb")
        self.assertTrue(len(result.dates) > 0)
        self.assertEqual(result.supplier_name, "Rowena Meats")
        self.assertGreater(result.confidence, 0.8)

    def test_parse_minimal_email(self):
        result = self.parser.parse(
            subject="Hello",
            body="Just checking in about the order.",
            sender_email="test@example.com",
            sender_name="Test User",
        )
        self.assertFalse(result.has_po)
        self.assertLess(result.confidence, 0.3)

    def test_parse_weight_kg(self):
        result = self.parser.parse(
            subject="",
            body="Shipping 2,500 KG of chicken breast",
        )
        self.assertIn("chicken", result.proteins)
        self.assertEqual(result.weights[0]["amount"], 2500.0)
        self.assertEqual(result.weights[0]["unit"], "KG")

    def test_parse_price_usd(self):
        result = self.parser.parse(body="Total cost USD 15,000.00")
        self.assertEqual(result.prices[0]["amount"], 15000.0)
        self.assertEqual(result.prices[0]["per_unit"], "total")

    def test_to_form_payload(self):
        result = self.parser.parse(
            subject="PO#226052",
            body="5000 lbs beef at $4.50/lb ship 05/20/2026",
            sender_name="Rowena",
        )
        payload = result.to_form_payload()
        self.assertEqual(payload["po_number"], "226052")
        self.assertEqual(payload["total_weight"], 5000.0)
        self.assertEqual(payload["weight_unit"], "LBS")
        self.assertEqual(payload["unit_price"], 4.50)
        self.assertEqual(payload["supplier_name"], "Rowena")

    def test_is_actionable_with_po(self):
        result = self.parser.parse(subject="PO#12345")
        self.assertTrue(result.is_actionable)

    def test_is_actionable_with_product_and_weight(self):
        result = self.parser.parse(body="5000 lbs of beef needed")
        self.assertTrue(result.is_actionable)


# ═══════════════════════════════════════════════════════════════════════════
# E2E Executors Tests
# ═══════════════════════════════════════════════════════════════════════════


class BidSelectionExecutorTests(SimpleTestCase):
    """Test bid selection with weighted scoring."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.E2EProcessExecutors = E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {
            "received_bids": [
                {
                    "id": "bid-1",
                    "supplier_name": "Supplier A",
                    "price": 100,
                    "margin_percent": 8.0,
                    "reliability": 90,
                    "lead_time": 5,
                    "quality_score": 85,
                },
                {
                    "id": "bid-2",
                    "supplier_name": "Supplier B",
                    "price": 120,
                    "margin_percent": 12.0,
                    "reliability": 95,
                    "lead_time": 3,
                    "quality_score": 92,
                },
                {
                    "id": "bid-3",
                    "supplier_name": "Supplier C",
                    "price": 80,
                    "margin_percent": 3.0,  # Below threshold
                    "reliability": 70,
                    "lead_time": 10,
                    "quality_score": 60,
                },
            ],
        }
        self.executors = E2EProcessExecutors(self.tenant, self.context)

    def test_bid_selection_returns_winner(self):
        config = {
            "selectionCriteria": {
                "minimumMarginPercent": 5.0,
                "factorsWeighted": [
                    {"factor": "price", "weight": 0.4},
                    {"factor": "reliability", "weight": 0.25},
                    {"factor": "lead_time", "weight": 0.2},
                    {"factor": "quality_score", "weight": 0.15},
                ],
            }
        }
        result = self.executors.bid_selection(config)
        self.assertTrue(result.success)
        self.assertIn(result.data["selected_bid_id"], ["bid-1", "bid-2"])
        self.assertEqual(result.data["total_bids_evaluated"], 3)
        self.assertEqual(result.data["eligible_bids"], 2)

    def test_bid_selection_no_bids(self):
        self.context["received_bids"] = []
        executors = self.E2EProcessExecutors(self.tenant, self.context)
        result = executors.bid_selection({})
        self.assertFalse(result.success)
        self.assertIn("No bids", result.error)

    def test_bid_selection_all_below_threshold_uses_all(self):
        self.context["received_bids"] = [
            {"id": "bid-x", "supplier_name": "X", "price": 100, "margin_percent": 2.0,
             "reliability": 80, "lead_time": 5, "quality_score": 70},
        ]
        executors = self.E2EProcessExecutors(self.tenant, self.context)
        config = {"selectionCriteria": {"minimumMarginPercent": 10.0}}
        result = executors.bid_selection(config)
        self.assertTrue(result.success)
        self.assertEqual(result.data["selected_bid_id"], "bid-x")
        self.assertFalse(result.data["meets_threshold"])


class CheckBidsExecutorTests(SimpleTestCase):
    """Test bid checking logic."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {"trade_session_id": None, "inquiry_id": None, "known_bid_ids": []}
        self.executors = E2EProcessExecutors(self.tenant, self.context)

    def test_check_bids_no_session(self):
        result = self.executors.check_bids({})
        self.assertTrue(result.success)
        self.assertEqual(result.data["new_bids"], 0)


class ResolveContactsExecutorTests(SimpleTestCase):
    """Test contact resolution executor."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {}
        self.executors = E2EProcessExecutors(self.tenant, self.context)

    def test_resolve_contacts_no_supplier(self):
        result = self.executors.resolve_contacts({})
        self.assertFalse(result.success)
        self.assertIn("No supplier", result.error)


class GenerateSalesOrderExecutorTests(SimpleTestCase):
    """Test SO generation executor."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {}
        self.executors = E2EProcessExecutors(self.tenant, self.context)

    def test_generate_so_no_bid(self):
        result = self.executors.generate_sales_order({})
        self.assertFalse(result.success)
        self.assertIn("No selected bid", result.error)


class CreatePurchaseOrderExecutorTests(SimpleTestCase):
    """Test PO creation executor."""

    def setUp(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors
        self.tenant = MagicMock(pk="tenant-1")
        self.context = {}
        self.executors = E2EProcessExecutors(self.tenant, self.context)

    def test_create_po_no_supplier(self):
        result = self.executors.create_purchase_order({})
        self.assertFalse(result.success)
        self.assertIn("No supplier_id", result.error)


# ═══════════════════════════════════════════════════════════════════════════
# ActionExecutor Registration Tests
# ═══════════════════════════════════════════════════════════════════════════


class ActionExecutorE2ERegistrationTests(SimpleTestCase):
    """Verify E2E action types are registered."""

    def test_e2e_action_types_registered(self):
        from tenant_apps.workflows.services.action_executor import ActionExecutor
        tenant = MagicMock()
        context = {}
        executor = ActionExecutor(tenant, context)

        # Execute with an unknown type to verify handler lookup
        result = executor.execute('generate_sales_order', {})
        # Should not return 'Unknown action type' error — it delegates to E2E
        self.assertNotEqual(result.get('error'), 'Unknown action type: generate_sales_order')

    def test_bid_selection_registered(self):
        from tenant_apps.workflows.services.action_executor import ActionExecutor
        tenant = MagicMock()
        context = {"received_bids": []}
        executor = ActionExecutor(tenant, context)
        result = executor.execute('bid_selection', {})
        self.assertIn('error', result)
        self.assertNotEqual(result['error'], 'Unknown action type: bid_selection')

    def test_check_bids_registered(self):
        from tenant_apps.workflows.services.action_executor import ActionExecutor
        tenant = MagicMock()
        context = {}
        executor = ActionExecutor(tenant, context)
        result = executor.execute('check_bids', {})
        self.assertTrue(result.get('success', False))

    def test_create_purchase_order_registered(self):
        from tenant_apps.workflows.services.action_executor import ActionExecutor
        tenant = MagicMock()
        context = {}
        executor = ActionExecutor(tenant, context)
        result = executor.execute('create_purchase_order', {})
        self.assertFalse(result.get('success'))

    def test_resolve_contacts_registered(self):
        from tenant_apps.workflows.services.action_executor import ActionExecutor
        tenant = MagicMock()
        context = {}
        executor = ActionExecutor(tenant, context)
        result = executor.execute('resolve_contacts', {})
        self.assertFalse(result.get('success'))

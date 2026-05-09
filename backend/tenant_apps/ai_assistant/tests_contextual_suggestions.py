"""Tests for contextual suggestions service."""

from unittest import TestCase

from tenant_apps.ai_assistant.services.contextual_suggestions import (
    SuggestionRequest,
    get_contextual_suggestions,
)


class TestInquirySuggestions(TestCase):
    """Test inquiry-specific heuristic rules."""

    def test_open_inquiry_no_rfqs(self):
        req = SuggestionRequest(
            entity_type="inquiry",
            entity_id="inq-001",
            current_state={
                "status": "open",
                "rfq_count": 0,
                "matched_suppliers": ["s1", "s2"],
            },
        )
        result = get_contextual_suggestions(req)
        self.assertGreater(len(result.suggestions), 0)
        rfq_sugg = next(s for s in result.suggestions if s.action_type == "send_rfq")
        self.assertEqual(rfq_sugg.confidence, 0.9)
        self.assertEqual(rfq_sugg.action_payload["supplier_ids"], ["s1", "s2"])

    def test_bids_received_no_selection(self):
        req = SuggestionRequest(
            entity_type="inquiry",
            entity_id="inq-002",
            current_state={
                "status": "open",
                "rfq_count": 3,
                "bids_received": 2,
                "bid_selected": False,
            },
        )
        result = get_contextual_suggestions(req)
        bid_sugg = next(s for s in result.suggestions if s.action_type == "select_bid")
        self.assertFalse(bid_sugg.is_safe_action)

    def test_approaching_due_date(self):
        req = SuggestionRequest(
            entity_type="inquiry",
            entity_id="inq-003",
            current_state={
                "status": "open",
                "rfq_count": 3,
                "days_until_due": 1,
            },
        )
        result = get_contextual_suggestions(req)
        follow_up = next(s for s in result.suggestions if s.action_type == "follow_up")
        self.assertIn("1 day", follow_up.description)

    def test_no_suggestions_when_complete(self):
        req = SuggestionRequest(
            entity_type="inquiry",
            entity_id="inq-004",
            current_state={
                "status": "completed",
                "rfq_count": 5,
                "bid_selected": True,
            },
        )
        result = get_contextual_suggestions(req)
        self.assertEqual(len(result.suggestions), 0)


class TestSalesOrderSuggestions(TestCase):
    """Test sales order heuristic rules."""

    def test_draft_with_pdf(self):
        req = SuggestionRequest(
            entity_type="sales_order",
            entity_id="so-001",
            current_state={
                "status": "draft",
                "pdf_generated": True,
            },
        )
        result = get_contextual_suggestions(req)
        send_sugg = next(s for s in result.suggestions if s.action_type == "send_email")
        self.assertEqual(send_sugg.confidence, 0.95)
        self.assertTrue(send_sugg.is_safe_action)

    def test_sent_no_po_after_3_days(self):
        req = SuggestionRequest(
            entity_type="sales_order",
            entity_id="so-002",
            current_state={
                "status": "sent",
                "days_since_sent": 5,
            },
        )
        result = get_contextual_suggestions(req)
        follow = next(s for s in result.suggestions if s.action_type == "follow_up")
        self.assertIn("5 days", follow.description)


class TestPurchaseOrderSuggestions(TestCase):
    """Test purchase order heuristic rules."""

    def test_approved_not_sent(self):
        req = SuggestionRequest(
            entity_type="purchase_order",
            entity_id="po-001",
            current_state={
                "status": "approved",
                "sent_to_supplier": False,
            },
        )
        result = get_contextual_suggestions(req)
        send_sugg = next(s for s in result.suggestions if s.action_type == "send_email")
        self.assertEqual(send_sugg.confidence, 0.95)

    def test_payment_due_soon(self):
        req = SuggestionRequest(
            entity_type="purchase_order",
            entity_id="po-002",
            current_state={
                "status": "active",
                "payment_status": "unpaid",
                "days_until_due": 3,
            },
        )
        result = get_contextual_suggestions(req)
        payment = next(s for s in result.suggestions if s.action_type == "create_task")
        self.assertIn("3 day", payment.description)


class TestSupplierSuggestions(TestCase):
    """Test supplier heuristic rules."""

    def test_no_contacts(self):
        req = SuggestionRequest(
            entity_type="supplier",
            entity_id="sup-001",
            current_state={"contact_count": 0},
        )
        result = get_contextual_suggestions(req)
        contact_sugg = next(s for s in result.suggestions if s.action_type == "create_contact")
        self.assertIn("contacts", contact_sugg.title)

    def test_has_contacts_no_suggestion(self):
        req = SuggestionRequest(
            entity_type="supplier",
            entity_id="sup-002",
            current_state={"contact_count": 3},
        )
        result = get_contextual_suggestions(req)
        self.assertEqual(len(result.suggestions), 0)


class TestUnknownEntityType(TestCase):
    """Test behavior for unsupported entity types."""

    def test_unknown_type_returns_empty(self):
        req = SuggestionRequest(
            entity_type="unknown_entity",
            entity_id="x-001",
            current_state={},
        )
        result = get_contextual_suggestions(req)
        self.assertEqual(len(result.suggestions), 0)
        self.assertEqual(result.entity_type, "unknown_entity")


class TestSuggestionSorting(TestCase):
    """Test that suggestions are properly sorted."""

    def test_sorted_by_priority_then_confidence(self):
        req = SuggestionRequest(
            entity_type="inquiry",
            entity_id="inq-100",
            current_state={
                "status": "open",
                "rfq_count": 0,
                "bids_received": 2,
                "bid_selected": False,
                "days_until_due": 1,
                "matched_suppliers": ["s1"],
            },
        )
        result = get_contextual_suggestions(req)
        # Should have 3 suggestions: send_rfq (p10), select_bid (p9), follow_up (p8)
        self.assertEqual(len(result.suggestions), 3)
        priorities = [s.priority for s in result.suggestions]
        self.assertEqual(priorities, sorted(priorities, reverse=True))

    def test_overall_confidence_is_max(self):
        req = SuggestionRequest(
            entity_type="inquiry",
            entity_id="inq-101",
            current_state={
                "status": "open",
                "rfq_count": 0,
                "matched_suppliers": [],
            },
        )
        result = get_contextual_suggestions(req)
        self.assertEqual(result.confidence, 0.9)

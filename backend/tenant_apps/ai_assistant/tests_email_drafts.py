"""Tests for contextual email draft service."""

from unittest import TestCase

from tenant_apps.ai_assistant.services.contextual_email_drafts import (
    BalanceSummary,
    DelaySummary,
    EmailDraftContext,
    OrderSummary,
    generate_email_draft,
    select_draft_purpose,
)


class TestSelectDraftPurpose(TestCase):
    """Test automatic purpose selection."""

    def _ctx(self, **kwargs):
        defaults = {
            "entity_type": "customer",
            "entity_id": "c1",
            "entity_name": "Acme Corp",
            "contact_name": "John",
            "contact_email": "john@acme.com",
        }
        defaults.update(kwargs)
        return EmailDraftContext(**defaults)

    def test_explicit_purpose_preserved(self):
        ctx = self._ctx(draft_purpose="introduction")
        self.assertEqual(select_draft_purpose(ctx), "introduction")

    def test_overdue_balance_triggers_payment_reminder(self):
        ctx = self._ctx(balance=BalanceSummary(total_outstanding=5000, overdue_count=2, days_overdue_max=30))
        self.assertEqual(select_draft_purpose(ctx), "payment_reminder")

    def test_many_delays_triggers_order_update(self):
        ctx = self._ctx(delays=DelaySummary(total_delays=3, avg_delay_days=5))
        self.assertEqual(select_draft_purpose(ctx), "order_update")

    def test_no_orders_triggers_introduction(self):
        ctx = self._ctx(recent_orders=[])
        self.assertEqual(select_draft_purpose(ctx), "introduction")

    def test_default_follow_up(self):
        ctx = self._ctx(recent_orders=[OrderSummary("o1", "ORD-001", "2025-01-01", 1000.0)])
        self.assertEqual(select_draft_purpose(ctx), "follow_up")


class TestGenerateEmailDraft(TestCase):
    """Test draft generation."""

    def _ctx(self, **kwargs):
        defaults = {
            "entity_type": "supplier",
            "entity_id": "s1",
            "entity_name": "Steel Co",
            "contact_name": "Jane Smith",
            "contact_email": "jane@steelco.com",
            "tenant_company_name": "Meats Central",
            "sender_name": "Mike Trader",
        }
        defaults.update(kwargs)
        return EmailDraftContext(**defaults)

    def test_missing_email_returns_unavailable(self):
        ctx = self._ctx(contact_email="")
        result = generate_email_draft(ctx)
        self.assertFalse(result.available)
        self.assertIsNone(result.draft)
        self.assertIn("email", result.reason)

    def test_missing_name_returns_unavailable(self):
        ctx = self._ctx(contact_name="")
        result = generate_email_draft(ctx)
        self.assertFalse(result.available)
        self.assertIn("name", result.reason)

    def test_follow_up_with_orders(self):
        ctx = self._ctx(
            recent_orders=[
                OrderSummary("o1", "PO-001", "2025-01-15", 5000.0, product_description="Beef cuts"),
                OrderSummary("o2", "PO-002", "2025-01-20", 3000.0),
            ]
        )
        result = generate_email_draft(ctx)
        self.assertTrue(result.available)
        self.assertIsNotNone(result.draft)
        self.assertEqual(result.draft.to, "jane@steelco.com")
        self.assertIn("Steel Co", result.draft.subject)
        self.assertIn("Jane Smith", result.draft.body)
        self.assertIn("PO-001", result.draft.body)
        self.assertIn("Meats Central", result.draft.body)
        self.assertTrue(result.draft.is_viable)

    def test_payment_reminder_draft(self):
        ctx = self._ctx(
            balance=BalanceSummary(
                total_outstanding=15000.0,
                overdue_count=3,
                days_overdue_max=45,
            ),
        )
        result = generate_email_draft(ctx)
        self.assertTrue(result.available)
        self.assertEqual(result.draft.draft_purpose, "payment_reminder")
        self.assertIn("outstanding", result.draft.body.lower())
        self.assertIn("15,000.00", result.draft.body)

    def test_introduction_draft(self):
        ctx = self._ctx(draft_purpose="introduction")
        result = generate_email_draft(ctx)
        self.assertTrue(result.available)
        self.assertEqual(result.draft.draft_purpose, "introduction")
        self.assertIn("introduce", result.draft.body.lower())

    def test_order_update_with_delays(self):
        ctx = self._ctx(
            recent_orders=[OrderSummary("o1", "SO-100", "2025-02-01", 8000.0)],
            delays=DelaySummary(total_delays=3, avg_delay_days=7, delay_reason="port congestion"),
            draft_purpose="order_update",
        )
        result = generate_email_draft(ctx)
        self.assertTrue(result.available)
        self.assertIn("SO-100", result.draft.subject)
        self.assertIn("port congestion", result.draft.body)

    def test_confidence_increases_with_context(self):
        # Minimal context
        ctx_min = self._ctx()
        result_min = generate_email_draft(ctx_min)

        # Rich context
        ctx_rich = self._ctx(
            recent_orders=[
                OrderSummary("o1", "PO-001", "2025-01-15", 5000.0),
                OrderSummary("o2", "PO-002", "2025-01-20", 3000.0),
                OrderSummary("o3", "PO-003", "2025-01-25", 4000.0),
            ],
            balance=BalanceSummary(total_outstanding=2000.0, overdue_count=0),
            delays=DelaySummary(total_delays=1, avg_delay_days=2),
        )
        result_rich = generate_email_draft(ctx_rich)

        self.assertGreater(result_rich.draft.confidence, result_min.draft.confidence)

    def test_context_summary_populated(self):
        ctx = self._ctx(
            recent_orders=[OrderSummary("o1", "PO-001", "2025-01-15", 5000.0)],
            balance=BalanceSummary(total_outstanding=1000.0),
        )
        result = generate_email_draft(ctx)
        self.assertIn("1 recent orders", result.draft.context_summary)
        self.assertIn("outstanding balance", result.draft.context_summary)

    def test_metadata_includes_entity_info(self):
        ctx = self._ctx()
        result = generate_email_draft(ctx)
        self.assertEqual(result.draft.metadata["entity_type"], "supplier")
        self.assertEqual(result.draft.metadata["entity_id"], "s1")

    def test_single_order_uses_singular(self):
        ctx = self._ctx(recent_orders=[OrderSummary("o1", "PO-001", "2025-01-15", 5000.0)])
        result = generate_email_draft(ctx)
        # Subject should not have trailing "s"
        self.assertIn("recent order ", result.draft.subject)


class TestEmailDraftViability(TestCase):
    """Test the is_viable property."""

    def test_viable_draft(self):
        ctx = EmailDraftContext(
            entity_type="customer",
            entity_id="c1",
            entity_name="Test Co",
            contact_name="Bob",
            contact_email="bob@test.com",
            recent_orders=[OrderSummary("o1", "ORD-1", "2025-01-01", 500.0)],
        )
        result = generate_email_draft(ctx)
        self.assertTrue(result.draft.is_viable)

    def test_introduction_viable_with_minimal_context(self):
        ctx = EmailDraftContext(
            entity_type="customer",
            entity_id="c1",
            entity_name="New Corp",
            contact_name="Alice",
            contact_email="alice@new.com",
            sender_name="Team",
            draft_purpose="introduction",
        )
        result = generate_email_draft(ctx)
        self.assertTrue(result.draft.is_viable)

"""Tests for RT-07.1: ApprovalGate node service."""

from decimal import Decimal

from django.test import SimpleTestCase

from tenant_apps.workflows.services.approval_gate import (
    ApprovalGateConfig,
    ApprovalRule,
    ApprovalRuleType,
    ApprovalStatus,
    approve_gate,
    config_from_dict,
    config_to_dict,
    evaluate_approval_gate,
    reject_gate,
)


class ApprovalGateEvaluationTest(SimpleTestCase):
    """Test rule evaluation engine."""

    def test_no_rules_auto_approves(self):
        """Empty rules list = auto-approve."""
        config = ApprovalGateConfig(rules=[])
        result = evaluate_approval_gate(
            gate_id="gate-001",
            config=config,
            context={"margin_percent": "25"},
        )
        self.assertEqual(result.status, ApprovalStatus.AUTO_APPROVED)
        self.assertTrue(result.auto_approved)

    def test_margin_threshold_pass(self):
        """Margin above threshold triggers auto-approve."""
        config = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.MARGIN_THRESHOLD,
                    threshold=Decimal("15"),
                    operator="gte",
                    context_field="margin_percent",
                    auto_approve_on_pass=True,
                    description="Margin >= 15%",
                ),
            ]
        )
        result = evaluate_approval_gate(
            gate_id="gate-002",
            config=config,
            context={"margin_percent": "20"},
        )
        self.assertEqual(result.status, ApprovalStatus.AUTO_APPROVED)
        self.assertTrue(result.auto_approved)
        self.assertEqual(len(result.rules_passed), 1)

    def test_margin_threshold_fail(self):
        """Margin below threshold requires manual approval."""
        config = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.MARGIN_THRESHOLD,
                    threshold=Decimal("15"),
                    operator="gte",
                    context_field="margin_percent",
                    auto_approve_on_pass=True,
                    description="Margin >= 15%",
                ),
            ]
        )
        result = evaluate_approval_gate(
            gate_id="gate-003",
            config=config,
            context={"margin_percent": "10"},
        )
        self.assertEqual(result.status, ApprovalStatus.PENDING)
        self.assertFalse(result.auto_approved)
        self.assertEqual(len(result.rules_failed), 1)

    def test_credit_limit_check(self):
        """Order above credit limit requires approval."""
        config = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.CREDIT_LIMIT,
                    threshold=Decimal("50000"),
                    operator="lt",
                    context_field="order_total",
                    auto_approve_on_pass=True,
                    description="Order < $50k credit limit",
                ),
            ]
        )
        # Under limit - auto-approve
        result = evaluate_approval_gate(
            gate_id="gate-004",
            config=config,
            context={"order_total": "30000"},
        )
        self.assertEqual(result.status, ApprovalStatus.AUTO_APPROVED)

        # Over limit - pending
        result = evaluate_approval_gate(
            gate_id="gate-005",
            config=config,
            context={"order_total": "75000"},
        )
        self.assertEqual(result.status, ApprovalStatus.PENDING)

    def test_missing_context_field_fails_safe(self):
        """If context field is missing, rule fails (requires approval)."""
        config = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.ORDER_AMOUNT,
                    threshold=Decimal("100000"),
                    operator="lt",
                    context_field="order_total",
                    auto_approve_on_pass=True,
                ),
            ]
        )
        result = evaluate_approval_gate(
            gate_id="gate-006",
            config=config,
            context={},  # No order_total!
        )
        self.assertEqual(result.status, ApprovalStatus.PENDING)

    def test_multiple_rules_all_must_pass(self):
        """All auto-approve rules must pass for auto-approval."""
        config = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.MARGIN_THRESHOLD,
                    threshold=Decimal("10"),
                    operator="gte",
                    context_field="margin_percent",
                    auto_approve_on_pass=True,
                ),
                ApprovalRule(
                    rule_type=ApprovalRuleType.ORDER_AMOUNT,
                    threshold=Decimal("100000"),
                    operator="lt",
                    context_field="order_total",
                    auto_approve_on_pass=True,
                ),
            ]
        )
        # Both pass
        result = evaluate_approval_gate(
            gate_id="gate-007",
            config=config,
            context={"margin_percent": "20", "order_total": "50000"},
        )
        self.assertEqual(result.status, ApprovalStatus.AUTO_APPROVED)
        self.assertEqual(len(result.rules_passed), 2)

        # One fails
        result = evaluate_approval_gate(
            gate_id="gate-008",
            config=config,
            context={"margin_percent": "5", "order_total": "50000"},
        )
        self.assertEqual(result.status, ApprovalStatus.PENDING)

    def test_custom_rule_always_requires_manual(self):
        """Custom rules always require manual approval."""
        config = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.CUSTOM,
                    auto_approve_on_pass=True,
                    description="Management sign-off required",
                ),
            ]
        )
        result = evaluate_approval_gate(
            gate_id="gate-009",
            config=config,
            context={"anything": "value"},
        )
        self.assertEqual(result.status, ApprovalStatus.PENDING)


class ApprovalDecisionTest(SimpleTestCase):
    """Test approve/reject decision recording."""

    def test_approve_gate(self):
        decision = approve_gate(
            gate_id="gate-010",
            user_id="user-123",
            user_name="John Manager",
            comment="Looks good, proceed.",
        )
        self.assertEqual(decision.status, ApprovalStatus.APPROVED)
        self.assertEqual(decision.decided_by, "John Manager")
        self.assertEqual(decision.comment, "Looks good, proceed.")
        self.assertIn("user_id", decision.metadata)

    def test_reject_gate(self):
        decision = reject_gate(
            gate_id="gate-011",
            user_id="user-456",
            user_name="Jane Finance",
            comment="Margin too low, renegotiate with supplier.",
            reason="low_margin",
        )
        self.assertEqual(decision.status, ApprovalStatus.REJECTED)
        self.assertEqual(decision.decided_by, "Jane Finance")
        self.assertEqual(decision.metadata["reason_code"], "low_margin")


class ApprovalConfigSerializationTest(SimpleTestCase):
    """Test config serialization for template storage."""

    def test_roundtrip_serialization(self):
        """Config → dict → config should preserve all values."""
        original = ApprovalGateConfig(
            rules=[
                ApprovalRule(
                    rule_type=ApprovalRuleType.MARGIN_THRESHOLD,
                    threshold=Decimal("15"),
                    operator="gte",
                    context_field="margin_percent",
                    auto_approve_on_pass=True,
                    description="Margin >= 15%",
                ),
                ApprovalRule(
                    rule_type=ApprovalRuleType.CREDIT_LIMIT,
                    threshold=Decimal("50000"),
                    operator="lt",
                    context_field="order_total",
                    auto_approve_on_pass=True,
                    description="Under credit limit",
                ),
            ],
            target_department="accounting",
            target_contact_type="Accounting",
            timeout_hours=24,
            escalation_enabled=True,
            escalation_department="management",
        )

        serialized = config_to_dict(original)
        restored = config_from_dict(serialized)

        self.assertEqual(len(restored.rules), 2)
        self.assertEqual(restored.rules[0].rule_type, ApprovalRuleType.MARGIN_THRESHOLD)
        self.assertEqual(restored.rules[0].threshold, Decimal("15"))
        self.assertEqual(restored.target_department, "accounting")
        self.assertEqual(restored.timeout_hours, 24)
        self.assertTrue(restored.escalation_enabled)

    def test_empty_config_from_dict(self):
        """Empty dict produces valid default config."""
        config = config_from_dict({})
        self.assertEqual(len(config.rules), 0)
        self.assertEqual(config.target_department, "sales")

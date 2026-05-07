"""ApprovalGate node service (RT-07.1).

Implements configurable approval steps that can be inserted into
any FormProcess group. Supports rule-based auto-approval or
manual approve/reject workflows.

Approval Rules:
- Margin threshold (auto-approve if margin > X%)
- Credit limit (require approval if order > $Y)
- Supplier risk (require approval for new/high-risk suppliers)
- Custom rules (extensible JSON-based rule engine)

Usage:
    from tenant_apps.workflows.services.approval_gate import (
        evaluate_approval_gate,
        approve_gate,
        reject_gate,
        ApprovalGateConfig,
    )

    config = ApprovalGateConfig(rules=[...])
    result = evaluate_approval_gate(gate_id=node.id, config=config, context=ctx)
    if result.auto_approved:
        # Continue to next node
    else:
        # Wait for manual approval
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from django.utils import timezone

logger = logging.getLogger("workflows.approval_gate")


# ---------------------------------------------------------------------------
# Enums & Config
# ---------------------------------------------------------------------------


class ApprovalStatus(str, Enum):
    """Status of an approval gate."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_APPROVED = "auto_approved"
    EXPIRED = "expired"


class ApprovalRuleType(str, Enum):
    """Types of approval rules."""

    MARGIN_THRESHOLD = "margin_threshold"
    CREDIT_LIMIT = "credit_limit"
    SUPPLIER_RISK = "supplier_risk"
    ORDER_AMOUNT = "order_amount"
    CUSTOM = "custom"


@dataclass
class ApprovalRule:
    """A single approval rule definition."""

    rule_type: ApprovalRuleType
    # Threshold value (e.g., 15 for 15% margin, 50000 for $50k credit limit)
    threshold: Decimal | None = None
    # Operator: "gt", "lt", "gte", "lte", "eq"
    operator: str = "gte"
    # Context field to evaluate (e.g., "margin_percent", "order_total")
    context_field: str = ""
    # If True, passing this rule means auto-approve (skip manual)
    auto_approve_on_pass: bool = False
    # Human-readable description
    description: str = ""


@dataclass
class ApprovalGateConfig:
    """Configuration for an ApprovalGate node."""

    # Rules to evaluate (all must pass for auto-approve)
    rules: list[ApprovalRule] = field(default_factory=list)
    # Department to notify for manual approval
    target_department: str = "sales"
    # Contact type to route approval to
    target_contact_type: str = "Sales"
    # Timeout in hours (0 = no timeout)
    timeout_hours: int = 0
    # Allow escalation after timeout
    escalation_enabled: bool = False
    # Escalation target department
    escalation_department: str = "management"


@dataclass
class ApprovalEvaluation:
    """Result of evaluating an approval gate."""

    gate_id: str
    status: ApprovalStatus
    auto_approved: bool = False
    rules_passed: list[str] = field(default_factory=list)
    rules_failed: list[str] = field(default_factory=list)
    reason: str = ""
    evaluated_at: str = ""
    context_snapshot: dict[str, Any] = field(default_factory=dict)


@dataclass
class ApprovalDecision:
    """Record of a manual approval/rejection decision."""

    gate_id: str
    status: ApprovalStatus
    decided_by: str = ""
    decided_at: str = ""
    comment: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def evaluate_approval_gate(
    *,
    gate_id: str,
    config: ApprovalGateConfig,
    context: dict[str, Any],
) -> ApprovalEvaluation:
    """Evaluate approval gate rules against execution context.

    If all rules with `auto_approve_on_pass=True` pass, the gate is
    auto-approved. Otherwise it enters PENDING state awaiting manual decision.

    Args:
        gate_id: Unique identifier for this gate instance.
        config: Gate configuration with rules and routing.
        context: Execution context (margin, amounts, supplier info, etc.).

    Returns:
        ApprovalEvaluation with status and rule results.
    """
    evaluation = ApprovalEvaluation(
        gate_id=gate_id,
        status=ApprovalStatus.PENDING,
        evaluated_at=timezone.now().isoformat(),
        context_snapshot={k: str(v) for k, v in context.items()},
    )

    if not config.rules:
        # No rules = auto-approve
        evaluation.status = ApprovalStatus.AUTO_APPROVED
        evaluation.auto_approved = True
        evaluation.reason = "No approval rules configured — auto-approved."
        logger.info("ApprovalGate %s: auto-approved (no rules)", gate_id)
        return evaluation

    all_auto_approve_rules_pass = True

    for rule in config.rules:
        passed = _evaluate_rule(rule, context)

        if passed:
            evaluation.rules_passed.append(
                f"{rule.rule_type.value}: {rule.description or rule.context_field}"
            )
        else:
            evaluation.rules_failed.append(
                f"{rule.rule_type.value}: {rule.description or rule.context_field}"
            )
            if rule.auto_approve_on_pass:
                all_auto_approve_rules_pass = False

    # Auto-approve only if ALL auto_approve rules passed
    auto_approve_rules = [r for r in config.rules if r.auto_approve_on_pass]
    if auto_approve_rules and all_auto_approve_rules_pass:
        evaluation.status = ApprovalStatus.AUTO_APPROVED
        evaluation.auto_approved = True
        evaluation.reason = (
            f"All {len(auto_approve_rules)} auto-approve rules passed."
        )
        logger.info("ApprovalGate %s: auto-approved (%d rules passed)", gate_id, len(auto_approve_rules))
    else:
        evaluation.status = ApprovalStatus.PENDING
        evaluation.reason = (
            f"{len(evaluation.rules_failed)} rule(s) require manual approval."
        )
        logger.info(
            "ApprovalGate %s: pending manual approval (%d passed, %d failed)",
            gate_id,
            len(evaluation.rules_passed),
            len(evaluation.rules_failed),
        )

    return evaluation


def approve_gate(
    *,
    gate_id: str,
    user_id: str,
    user_name: str = "",
    comment: str = "",
) -> ApprovalDecision:
    """Record a manual approval decision.

    Args:
        gate_id: The gate instance to approve.
        user_id: ID of the user approving.
        user_name: Display name for audit trail.
        comment: Optional approval comment.

    Returns:
        ApprovalDecision record.
    """
    decision = ApprovalDecision(
        gate_id=gate_id,
        status=ApprovalStatus.APPROVED,
        decided_by=user_name or user_id,
        decided_at=timezone.now().isoformat(),
        comment=comment,
        metadata={"user_id": user_id},
    )

    logger.info(
        "ApprovalGate %s: APPROVED by %s. Comment: %s",
        gate_id,
        decision.decided_by,
        comment or "(none)",
    )

    return decision


def reject_gate(
    *,
    gate_id: str,
    user_id: str,
    user_name: str = "",
    comment: str = "",
    reason: str = "",
) -> ApprovalDecision:
    """Record a manual rejection decision.

    Args:
        gate_id: The gate instance to reject.
        user_id: ID of the user rejecting.
        user_name: Display name for audit trail.
        comment: Required rejection comment.
        reason: Structured reason code (optional).

    Returns:
        ApprovalDecision record.
    """
    decision = ApprovalDecision(
        gate_id=gate_id,
        status=ApprovalStatus.REJECTED,
        decided_by=user_name or user_id,
        decided_at=timezone.now().isoformat(),
        comment=comment,
        metadata={"user_id": user_id, "reason_code": reason},
    )

    logger.info(
        "ApprovalGate %s: REJECTED by %s. Reason: %s",
        gate_id,
        decision.decided_by,
        comment or reason or "(none)",
    )

    return decision


# ---------------------------------------------------------------------------
# Rule Evaluation Engine
# ---------------------------------------------------------------------------


def _evaluate_rule(rule: ApprovalRule, context: dict[str, Any]) -> bool:
    """Evaluate a single rule against the context.

    Returns True if the rule passes (condition met).
    """
    if rule.rule_type == ApprovalRuleType.CUSTOM:
        # Custom rules pass by default (manual gate)
        return False

    value = context.get(rule.context_field)
    if value is None:
        # Missing context field = rule cannot be evaluated = fail safe (require approval)
        logger.debug(
            "Rule %s: context field '%s' not found — failing safe",
            rule.rule_type.value,
            rule.context_field,
        )
        return False

    try:
        numeric_value = Decimal(str(value))
    except Exception:
        return False

    threshold = rule.threshold
    if threshold is None:
        return True  # No threshold = always pass

    return _compare(numeric_value, rule.operator, threshold)


def _compare(value: Decimal, operator: str, threshold: Decimal) -> bool:
    """Compare value against threshold using operator."""
    ops = {
        "gt": value > threshold,
        "gte": value >= threshold,
        "lt": value < threshold,
        "lte": value <= threshold,
        "eq": value == threshold,
    }
    return ops.get(operator, False)


# ---------------------------------------------------------------------------
# Serialization Helpers (for API/template use)
# ---------------------------------------------------------------------------


def config_from_dict(data: dict[str, Any]) -> ApprovalGateConfig:
    """Parse ApprovalGateConfig from a JSON-serializable dict (template node data)."""
    rules = []
    for rule_data in data.get("rules", []):
        rules.append(ApprovalRule(
            rule_type=ApprovalRuleType(rule_data.get("rule_type", "custom")),
            threshold=Decimal(str(rule_data["threshold"])) if rule_data.get("threshold") is not None else None,
            operator=rule_data.get("operator", "gte"),
            context_field=rule_data.get("context_field", ""),
            auto_approve_on_pass=rule_data.get("auto_approve_on_pass", False),
            description=rule_data.get("description", ""),
        ))

    return ApprovalGateConfig(
        rules=rules,
        target_department=data.get("target_department", "sales"),
        target_contact_type=data.get("target_contact_type", "Sales"),
        timeout_hours=data.get("timeout_hours", 0),
        escalation_enabled=data.get("escalation_enabled", False),
        escalation_department=data.get("escalation_department", "management"),
    )


def config_to_dict(config: ApprovalGateConfig) -> dict[str, Any]:
    """Serialize ApprovalGateConfig to JSON-safe dict."""
    return {
        "rules": [
            {
                "rule_type": rule.rule_type.value,
                "threshold": str(rule.threshold) if rule.threshold is not None else None,
                "operator": rule.operator,
                "context_field": rule.context_field,
                "auto_approve_on_pass": rule.auto_approve_on_pass,
                "description": rule.description,
            }
            for rule in config.rules
        ],
        "target_department": config.target_department,
        "target_contact_type": config.target_contact_type,
        "timeout_hours": config.timeout_hours,
        "escalation_enabled": config.escalation_enabled,
        "escalation_department": config.escalation_department,
    }

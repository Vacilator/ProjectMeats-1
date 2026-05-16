"""Centralized unsupervised AI execution policy enforcement.

Provides:
- UnsupervisedPolicy: Evaluates whether an AI action can auto-execute
- execution_guard(): Decorator ensuring confidence checks before auto-action
- AuditableAutoExecution: Context manager for audit-trailed auto-executions

This module is the single gatekeeper for ALL unsupervised AI actions.
No AI action should auto-execute without passing through this policy.

Usage:
    from apps.core.utils.unsupervised import UnsupervisedPolicy, execution_guard

    policy = UnsupervisedPolicy(tenant_id=tenant.id)

    # Check if auto-execution is allowed
    decision = policy.evaluate(
        action_type='create_purchase_order',
        confidence_score=0.92,
        context={'trade_value': 50000, 'customer_id': str(customer.id)},
    )

    if decision.approved:
        # Execute with full audit trail
        with policy.audit_execution(decision) as audit:
            result = create_po(...)
            audit.record_outcome(success=True, result_id=str(result.id))
    else:
        # Route to human review queue
        queue_for_review(decision.reason)
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Default confidence thresholds (overridable per tenant via settings)
DEFAULT_AUTO_EXECUTE_THRESHOLD = 0.85
DEFAULT_REVIEW_THRESHOLD = 0.50  # Below this → auto-reject

# Cache key for tenant-specific policy overrides
_POLICY_KEY_PREFIX = 'pm:ai_policy:'


@dataclass
class ExecutionDecision:
    """Result of an unsupervised execution policy evaluation."""

    approved: bool
    action_type: str
    confidence_score: float
    threshold_used: float
    reason: str
    decision_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    tenant_id: str = ''
    context: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            'decision_id': self.decision_id,
            'approved': self.approved,
            'action_type': self.action_type,
            'confidence_score': self.confidence_score,
            'threshold_used': self.threshold_used,
            'reason': self.reason,
            'tenant_id': self.tenant_id,
            'timestamp': self.timestamp,
        }


@dataclass
class ExecutionAuditRecord:
    """Audit record for an auto-executed action."""

    decision: ExecutionDecision
    started_at: float = field(default_factory=time.time)
    completed_at: float | None = None
    success: bool | None = None
    result_id: str = ''
    error: str = ''
    rolled_back: bool = False

    def record_outcome(self, success: bool, result_id: str = '', error: str = '') -> None:
        self.completed_at = time.time()
        self.success = success
        self.result_id = result_id
        self.error = error[:500]

    def to_dict(self) -> dict[str, Any]:
        return {
            **self.decision.to_dict(),
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'success': self.success,
            'result_id': self.result_id,
            'error': self.error,
            'rolled_back': self.rolled_back,
            'duration_ms': (
                (self.completed_at - self.started_at) * 1000
                if self.completed_at
                else None
            ),
        }


class UnsupervisedPolicy:
    """Centralized policy engine for AI auto-execution decisions.

    Enforces:
    - Confidence threshold checks (per-tenant configurable)
    - Action-type allowlists
    - Rate limiting on auto-executions
    - Full audit trail
    """

    # Actions that are NEVER auto-executable regardless of confidence
    BLOCKED_ACTIONS: set[str] = frozenset({
        'delete_tenant',
        'delete_customer',
        'delete_supplier',
        'modify_rls_policy',
        'change_billing',
    })

    # Maximum auto-executions per tenant per hour (safety valve)
    MAX_AUTO_EXECUTIONS_PER_HOUR = 50

    def __init__(self, tenant_id: str):
        self.tenant_id = str(tenant_id)
        self._rate_key = f'{_POLICY_KEY_PREFIX}{self.tenant_id}:rate'

    def evaluate(
        self,
        action_type: str,
        confidence_score: float,
        context: dict[str, Any] | None = None,
    ) -> ExecutionDecision:
        """Evaluate whether an action can be auto-executed.

        Args:
            action_type: The type of action being proposed.
            confidence_score: AI model's confidence (0.0 to 1.0).
            context: Additional context for logging/auditing.

        Returns:
            ExecutionDecision with approved/rejected status and reason.
        """
        context = context or {}
        threshold = self._get_threshold(action_type)

        # Check blocked actions
        if action_type in self.BLOCKED_ACTIONS:
            return ExecutionDecision(
                approved=False,
                action_type=action_type,
                confidence_score=confidence_score,
                threshold_used=threshold,
                reason=f'Action "{action_type}" is never auto-executable',
                tenant_id=self.tenant_id,
                context=context,
            )

        # Check confidence threshold
        if confidence_score < threshold:
            reason = (
                f'Confidence {confidence_score:.2f} below threshold {threshold:.2f}'
                if confidence_score >= DEFAULT_REVIEW_THRESHOLD
                else f'Confidence {confidence_score:.2f} below minimum review threshold'
            )
            return ExecutionDecision(
                approved=False,
                action_type=action_type,
                confidence_score=confidence_score,
                threshold_used=threshold,
                reason=reason,
                tenant_id=self.tenant_id,
                context=context,
            )

        # Check rate limit
        if not self._check_rate_limit():
            return ExecutionDecision(
                approved=False,
                action_type=action_type,
                confidence_score=confidence_score,
                threshold_used=threshold,
                reason=f'Rate limit exceeded ({self.MAX_AUTO_EXECUTIONS_PER_HOUR}/hour)',
                tenant_id=self.tenant_id,
                context=context,
            )

        # Approved
        decision = ExecutionDecision(
            approved=True,
            action_type=action_type,
            confidence_score=confidence_score,
            threshold_used=threshold,
            reason='Confidence meets threshold; auto-execution approved',
            tenant_id=self.tenant_id,
            context=context,
        )

        logger.info(
            '[UnsupervisedPolicy] APPROVED action=%s confidence=%.2f threshold=%.2f tenant=%s decision=%s',
            action_type,
            confidence_score,
            threshold,
            self.tenant_id,
            decision.decision_id,
        )

        return decision

    def audit_execution(self, decision: ExecutionDecision) -> _AuditContext:
        """Context manager for audited auto-execution.

        Usage:
            with policy.audit_execution(decision) as audit:
                result = do_something()
                audit.record_outcome(success=True, result_id=str(result.id))
        """
        return _AuditContext(self, decision)

    def get_tenant_stats(self) -> dict[str, Any]:
        """Get auto-execution stats for this tenant (for monitoring)."""
        rate_count = cache.get(self._rate_key) or 0
        return {
            'tenant_id': self.tenant_id,
            'auto_executions_this_hour': rate_count,
            'max_per_hour': self.MAX_AUTO_EXECUTIONS_PER_HOUR,
            'threshold': self._get_threshold('default'),
        }

    def _get_threshold(self, action_type: str) -> float:
        """Get the confidence threshold for an action type.

        Checks for tenant-specific overrides in cache, falls back to defaults.
        """
        # Check tenant-specific override
        override_key = f'{_POLICY_KEY_PREFIX}{self.tenant_id}:threshold:{action_type}'
        override = cache.get(override_key)
        if override is not None:
            return float(override)

        # Check tenant-level default override
        tenant_default_key = f'{_POLICY_KEY_PREFIX}{self.tenant_id}:threshold:default'
        tenant_default = cache.get(tenant_default_key)
        if tenant_default is not None:
            return float(tenant_default)

        return DEFAULT_AUTO_EXECUTE_THRESHOLD

    def _check_rate_limit(self) -> bool:
        """Check if tenant is within auto-execution rate limit."""
        try:
            count = cache.get(self._rate_key) or 0
            return count < self.MAX_AUTO_EXECUTIONS_PER_HOUR
        except Exception:
            return True  # Fail open on cache errors

    def _increment_rate(self) -> None:
        """Increment the auto-execution counter for this tenant."""
        try:
            count = cache.get(self._rate_key)
            if count is None:
                cache.set(self._rate_key, 1, 3600)  # 1 hour TTL
            else:
                cache.incr(self._rate_key, 1)
        except Exception:
            logger.debug("Non-critical exception suppressed", exc_info=True)


class _AuditContext:
    """Context manager for audited auto-execution."""

    def __init__(self, policy: UnsupervisedPolicy, decision: ExecutionDecision):
        self._policy = policy
        self._record = ExecutionAuditRecord(decision=decision)

    def __enter__(self) -> ExecutionAuditRecord:
        self._policy._increment_rate()
        return self._record

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self._record.record_outcome(
                success=False,
                error=f'{exc_type.__name__}: {exc_val}',
            )
            logger.warning(
                '[UnsupervisedPolicy] FAILED decision=%s action=%s error=%s',
                self._record.decision.decision_id,
                self._record.decision.action_type,
                self._record.error,
            )
        elif self._record.success is None:
            # Completed without explicit record_outcome call
            self._record.record_outcome(success=True)

        # Store audit record in cache for monitoring (short retention)
        audit_key = f'{_POLICY_KEY_PREFIX}audit:{self._record.decision.decision_id}'
        try:
            cache.set(audit_key, self._record.to_dict(), 86400)  # 24h retention
        except Exception:
            logger.debug("Non-critical exception suppressed", exc_info=True)

        # Don't suppress exceptions
        return False


def execution_guard(
    action_type: str,
    confidence_kwarg: str = 'confidence_score',
    tenant_kwarg: str = 'tenant_id',
) -> callable:
    """Decorator that enforces unsupervised execution policy on a function.

    The decorated function will only execute if the confidence score
    passes the policy check. Otherwise, raises PermissionError.

    Usage:
        @execution_guard('create_purchase_order')
        def auto_create_po(tenant_id: str, confidence_score: float, po_data: dict):
            ...
    """

    def decorator(func):
        from functools import wraps

        @wraps(func)
        def wrapper(*args, **kwargs):
            tenant_id = kwargs.get(tenant_kwarg, '')
            confidence = kwargs.get(confidence_kwarg, 0.0)

            if not tenant_id:
                raise ValueError(f'{tenant_kwarg} is required for unsupervised execution')

            policy = UnsupervisedPolicy(tenant_id)
            decision = policy.evaluate(
                action_type=action_type,
                confidence_score=confidence,
                context={'function': func.__qualname__},
            )

            if not decision.approved:
                raise PermissionError(
                    f'Unsupervised execution denied: {decision.reason} '
                    f'(decision_id={decision.decision_id})'
                )

            with policy.audit_execution(decision) as audit:
                result = func(*args, **kwargs)
                audit.record_outcome(success=True)
                return result

        return wrapper

    return decorator

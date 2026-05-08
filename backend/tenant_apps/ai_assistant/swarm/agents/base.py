"""Base agent primitives for PM-AS.

CRITICAL RULE:
- All memory/context reads and writes MUST be tenant-scoped.

This scaffold is intentionally minimal and side-effect free.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class AgentContext:
    """Tenant-scoped invocation context."""

    tenant_id: str
    event_type: str
    payload: Dict[str, Any]
    correlation_id: Optional[str] = None


class BaseAgent(abc.ABC):
    """Base class for all swarm agents.

    Enforces tenant_id presence for any retrieval or recording.
    """

    name: str = "base"

    def __init__(self, *, tenant_id: str):
        if not tenant_id:
            raise ValueError("tenant_id is required")
        self.tenant_id = tenant_id

    @abc.abstractmethod
    def get_system_prompt(self) -> str:
        """Return the system prompt / role definition for this agent."""

    @abc.abstractmethod
    def invoke(self, ctx: AgentContext) -> Dict[str, Any]:
        """Execute the agent on the given tenant-scoped context."""

    def record_feedback(
        self, *, document_id: str, original: Dict[str, Any], corrected: Dict[str, Any], confidence: float
    ) -> None:
        """Record HITL feedback into the reinforcement flywheel.

        Scaffold-only: this method is safe to call even if the database model isn't wired.
        """

        if not self.tenant_id:
            raise ValueError("tenant_id is required")

        try:
            from tenant_apps.ai_assistant.models import AIFeedbackLog

            AIFeedbackLog.objects.create(
                tenant_id=self.tenant_id,
                document_id=document_id,
                document_type=str(
                    (original or {}).get("document_type") or (corrected or {}).get("document_type") or ""
                ),
                original_extracted_data=original or {},
                user_corrected_data=corrected or {},
                confidence_score=float(confidence or 0.0),
            )
        except Exception:
            # Swallow errors: feedback is best-effort and should never crash workers.
            return

"""PM-AS Swarm Orchestrator (semantic router).

This module routes inbound events (Email, User Chat, Webhook) to specialized worker agents.

Planned worker chain (Phase 8.0):
- Extractor  -> parse/structure inputs
- Enricher   -> add domain context, normalize entities
- Executor   -> perform side effects (create records, trigger workflows)
- MeatSME    -> domain validation and safety gate (meat industry specific)

This is scaffold-only (no runtime integration yet).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

from tenant_apps.ai_assistant.swarm.agents.base import AgentContext


EventType = Literal["email", "user_chat", "webhook"]


@dataclass(frozen=True)
class SwarmDecision:
    event_type: EventType
    intent: str
    urgency: str
    agent_chain: List[str]
    notes: str = ""


class SwarmOrchestrator:
    """Semantic router for PM-AS."""

    def __init__(self, *, tenant_id: str):
        if not tenant_id:
            raise ValueError("tenant_id is required")
        self.tenant_id = tenant_id

    def _estimate_urgency(self, text: str) -> str:
        t = (text or "").lower()
        if any(k in t for k in ["urgent", "asap", "immediately", "today", "failed", "down"]):
            return "high"
        if any(k in t for k in ["soon", "tomorrow", "this week"]):
            return "medium"
        return "low"

    def _estimate_intent(self, event_type: EventType, payload: Dict[str, Any]) -> str:
        # Scaffold heuristic; IntentEngine can be plugged in later.
        text = "\n".join([
            str(payload.get("subject") or ""),
            str(payload.get("message") or payload.get("body") or ""),
        ]).lower()

        if event_type == "email":
            if any(k in text for k in ["invoice", "inv#", "inv #"]):
                return "document_invoice"
            if any(k in text for k in ["purchase order", "po#", "po #", "p.o."]):
                return "document_purchase_order"
            if any(k in text for k in ["bill of lading", "bol", "b/l"]):
                return "document_bill_of_lading"

        if any(k in text for k in ["create", "new", "place order"]):
            return "action_create"
        if any(k in text for k in ["status", "where is", "tracking"]):
            return "action_status"

        return "unknown"

    def route(self, *, event_type: EventType, payload: Dict[str, Any], correlation_id: Optional[str] = None) -> SwarmDecision:
        text = "\n".join([str(payload.get("subject") or ""), str(payload.get("message") or payload.get("body") or "")])
        urgency = self._estimate_urgency(text)
        intent = self._estimate_intent(event_type, payload)

        # Default agent chain is always safety-first.
        chain: List[str] = ["Extractor", "Enricher", "MeatSME", "Executor"]

        notes = "heuristic-router"
        if urgency == "high":
            notes += ";high-urgency"

        return SwarmDecision(event_type=event_type, intent=intent, urgency=urgency, agent_chain=chain, notes=notes)

    def build_context(self, *, event_type: EventType, payload: Dict[str, Any], correlation_id: Optional[str] = None) -> AgentContext:
        return AgentContext(tenant_id=self.tenant_id, event_type=event_type, payload=payload, correlation_id=correlation_id)

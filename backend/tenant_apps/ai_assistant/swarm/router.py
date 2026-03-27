"""PM-AS Swarm Orchestrator.

Phase 8.0:
- Semantic router (email/user_chat/webhook) -> recommended agent chain.

Phase 8.1:
- Agentic tool execution loop (LLM -> ToolExecutor -> LLM).

Reliability mandate:
- Tool execution is best-effort and must not crash requests.
- LLM tool loop is bounded to prevent infinite recursion.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

from django.conf import settings

from tenant_apps.ai_assistant.swarm.agents.base import AgentContext
from tenant_apps.ai_assistant.swarm.executor import DEFAULT_OPENAI_TOOLS, ToolExecutor

logger = logging.getLogger(__name__)


EventType = Literal["email", "user_chat", "webhook"]

def build_swarm_system_prompt(*, outlook_connected: bool, outlook_email: str | None, outlook_expired: bool) -> str:
    base = (
        "You are the ProjectMeats Autonomous Swarm Orchestrator. "
        "You are an expert in wholesale meat logistics, purchase orders, cold storage, and supplier management. "
        "Be highly analytical, concise, and proactive. "
        "\n\nDatabase schema (high level): "
        "Entities include Supplier, Customer, Product (system-wide catalog), Contact, PurchaseOrder, SalesOrder, Invoice, Plant, Carrier. "
        "Most business entities are tenant-scoped via a tenant_id (shared-schema multi-tenancy); Products are system-wide with tenant visibility rules. "
        "\n\nYou have access to real-time error logs. If a user complains about a failure, check Sentry before asking for clarification. "
        "\n\nAvailable tools (use when it reduces user effort): "
        "- search_entities(query[, entity_types, limit]) to find records via Universal Search. "
        "- get_entity_details(type, id) to load a full record profile payload for a specific entity. "
        "- create_task(title, message[, entity_type, entity_id]) to create an in-app task notification for the current user. "
    )

    if outlook_connected:
        return base + f"Outlook: CONNECTED ({outlook_email or 'unknown'}). You may use email tools when relevant."

    if outlook_expired:
        return base + "Outlook: CONNECTED but EXPIRED. Do not claim you can read email; instruct user to reconnect."

    return base + "Outlook: NOT CONNECTED. Do not claim you can read email; instruct user to connect Outlook."


@dataclass(frozen=True)
class SwarmDecision:
    event_type: EventType
    intent: str
    urgency: str
    agent_chain: List[str]
    notes: str = ""


class SwarmOrchestrator:
    """Router + tool-loop orchestrator for PM-AS.

    Args:
        tenant_id: Active tenant UUID (string). Used for tenant-scoped tool execution and RAG isolation.

    Primary responsibilities:
        - Route inbound events (email/user_chat/webhook) to an agent chain (best-effort heuristic).
        - Build an AgentContext for downstream agents.
        - Execute a **bounded** OpenAI tool loop (LLM ↔ tools) and return a stable response payload.

    Side effects:
        - May call external services (OpenAI, Microsoft Graph tools) depending on tenant integrations.
        - May read tenant-scoped models (e.g., ExternalAuthProvider) to determine tool availability.

    Safety:
        - Tool loop is bounded via `SWARM_TOOL_MAX_ROUNDS` to prevent infinite recursion.
        - RAG/tool failures must degrade gracefully (fall back to plain chat response).
    """

    def __init__(self, *, tenant_id: str):
        if not tenant_id:
            raise ValueError("tenant_id is required")
        self.tenant_id = tenant_id

    def _requires_meat_sme(self, text: str) -> bool:
        """Heuristic intent classification for deep meat/logistics questions.

        This is intentionally conservative: if we detect likely yield/trim/shelf-life
        or historical PO specifics, we route to the tenant-isolated Vector RAG agent.
        """

        t = (text or '').lower()
        keywords = [
            'yield',
            'trim',
            'shrink',
            'net lb',
            'shelf life',
            'shelf-life',
            'code date',
            'use by',
            'fresh',
            'frozen',
            'box beef',
            'boxed beef',
            'primal',
            'subprimal',
            'edible',
            'inedible',
            'combo',
            'load',
            'reefer',
            'temp',
            'pallet',
            'po#',
            'po #',
            'purchase order',
            'historical po',
            'previous po',
        ]
        return any(k in t for k in keywords)

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

        requires_sme = self._requires_meat_sme(text) if event_type == 'user_chat' else False

        chain: List[str] = ["Extractor", "Enricher"]
        if requires_sme:
            chain.append("MeatSME")
        chain.append("Executor")

        notes = "heuristic-router"
        if urgency == "high":
            notes += ";high-urgency"

        return SwarmDecision(event_type=event_type, intent=intent, urgency=urgency, agent_chain=chain, notes=notes)

    def build_context(self, *, event_type: EventType, payload: Dict[str, Any], correlation_id: Optional[str] = None) -> AgentContext:
        return AgentContext(tenant_id=self.tenant_id, event_type=event_type, payload=payload, correlation_id=correlation_id)

    def run_tool_loop(
        self,
        *,
        user_message: str,
        tenant: Any,
        user: Any = None,
        history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Run bounded tool loop and return final assistant response + trace.

        Returns:
            {"response": <final text>, "messages": <final history>}
        """
        import os

        openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            raise ValueError('OpenAI not configured (missing OPENAI_API_KEY)')

        # Phase 8.2: intent classification → delegate deep meat/logistics questions to MeatSME RAG.
        # Reliability mandate: if RAG fails for any reason, fall back to the standard tool loop.
        if self._requires_meat_sme(user_message):
            try:
                from tenant_apps.ai_assistant.swarm.agents.meat_sme import MeatSMEAgent

                answer = MeatSMEAgent().analyze(
                    query=user_message,
                    tenant_id=str(getattr(tenant, 'id', '') or self.tenant_id),
                )
                return {
                    'response': answer,
                    'messages': (history or []) + [{'role': 'user', 'content': user_message}],
                    'notes': 'meat_sme_rag',
                }
            except Exception as e:
                logger.warning('[SwarmOrchestrator] MeatSME RAG failed; falling back to tool loop: %s', str(e))

        try:
            from openai import OpenAI
        except Exception as e:
            raise RuntimeError('OpenAI client not available on server') from e

        client = OpenAI(
            api_key=openai_api_key,
            organization=(getattr(settings, 'OPENAI_ORG_ID', None) or os.environ.get('OPENAI_ORG_ID') or None),
        )

        from apps.integrations.models import ExternalAuthProvider

        provider = (
            ExternalAuthProvider.objects.filter(
                tenant=tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        outlook_email = getattr(provider, 'connected_email', None) if provider else None
        outlook_expired = bool(provider.is_token_expired()) if provider else False
        outlook_connected = bool(provider and not outlook_expired)

        # Always allow safe internal search tools; only advertise Outlook tools when connected.
        if outlook_connected:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            tools = [
                t for t in DEFAULT_OPENAI_TOOLS
                if t.get('function', {}).get('name') == 'search_cockpit_records'
            ]

        messages: List[Dict[str, Any]] = [
            {
                'role': 'system',
                'content': build_swarm_system_prompt(
                    outlook_connected=outlook_connected,
                    outlook_email=outlook_email,
                    outlook_expired=outlook_expired,
                ),
            }
        ]
        if history:
            messages.extend(history)
        messages.append({'role': 'user', 'content': user_message})

        executor = ToolExecutor()

        from apps.system.services.ai_model_resolver import get_active_openai_model_id

        model_name = get_active_openai_model_id(fallback='gpt-4o-mini')
        temperature = float(getattr(settings, 'OPENAI_TEMPERATURE', 0.7) or 0.7)
        max_tokens = int(getattr(settings, 'OPENAI_MAX_TOKENS', 2000) or 2000)

        max_rounds = int(getattr(settings, 'SWARM_TOOL_MAX_ROUNDS', 3) or 3)
        rounds = 0

        while True:
            rounds += 1
            if rounds > max_rounds:
                break

            create_kwargs: Dict[str, Any] = {
                'model': model_name,
                'messages': messages,
                'temperature': temperature,
                'max_tokens': max_tokens,
            }
            if tools:
                create_kwargs['tools'] = tools
                create_kwargs['tool_choice'] = 'auto'

            completion = client.chat.completions.create(**create_kwargs)

            msg = completion.choices[0].message
            tool_calls = getattr(msg, 'tool_calls', None)

            if not tool_calls:
                final_text = (msg.content or '').strip()
                return {'response': final_text, 'messages': messages}

            # a) Append assistant's tool call message to history
            assistant_payload: Dict[str, Any] = {'role': 'assistant', 'content': msg.content or ''}
            assistant_payload['tool_calls'] = []
            for tc in tool_calls:
                assistant_payload['tool_calls'].append(
                    {
                        'id': tc.id,
                        'type': tc.type,
                        'function': {
                            'name': tc.function.name,
                            'arguments': tc.function.arguments,
                        },
                    }
                )
            messages.append(assistant_payload)

            # b/c) Execute each tool call, append tool results
            for tc in tool_calls:
                tool_name = tc.function.name
                raw_args = tc.function.arguments or '{}'
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
                except Exception:
                    args = {}

                result = executor.execute(tool_name, args, tenant, user)
                messages.append(
                    {
                        'role': 'tool',
                        'tool_call_id': tc.id,
                        'content': result,
                    }
                )

            # d) Loop continues; next LLM call interprets tool results (and may call more tools)

        return {
            'response': 'Tool loop exceeded max rounds; please refine your request.',
            'messages': messages,
        }

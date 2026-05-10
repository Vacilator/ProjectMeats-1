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
from django.utils import timezone

from tenant_apps.ai_assistant.swarm.agents.base import AgentContext
from tenant_apps.ai_assistant.swarm.executor import DEFAULT_OPENAI_TOOLS, ToolExecutor

logger = logging.getLogger(__name__)


EventType = Literal["email", "user_chat", "webhook"]


def _build_non_retryable_tool_message(tool_name: str, error: Dict[str, Any]) -> str:
    message = str(error.get('message') or 'The tool failed.')
    hint = str(error.get('hint') or '').strip()
    hint_suffix = f' Hint: {hint}' if hint else ''
    return (
        f'System: Tool "{tool_name}" failed with a non-retryable error: "{message}". '
        'Do not retry this tool. Ask the human user for the missing information or a clarifying choice.'
        f'{hint_suffix}'
    )

def build_swarm_system_prompt(
    *,
    outlook_connected: bool,
    outlook_email: str | None,
    outlook_expired: bool,
    lessons_block: str = '',
    memory_block: str = '',
    session_memory_block: str = '',
    document_context_block: str = '',
) -> str:
    base = (
        "You are the ProjectMeats Intelligent Architect. "
        "You have access to tenant data via RLS-safe tools and can learn from user feedback provided via the feedback tool. "
        "You are an expert in wholesale meat logistics, purchase orders, cold storage, and supplier management. "
        "Be highly analytical, concise, and proactive. "
        "\n\nDatabase schema (high level): "
        "Entities include Supplier, Customer, Product (system-wide catalog), Contact, PurchaseOrder, SalesOrder, Invoice, Plant, Carrier. "
        "Most business entities are tenant-scoped via a tenant_id (shared-schema multi-tenancy); Products are system-wide with tenant visibility rules. "
        "\n\nYou are an AI SRE. If a user reports a failure, call get_recent_errors() to diagnose the root cause using Sentry telemetry before asking for clarification. "
        "\n\nAvailable tools (use when it reduces user effort): "
        "- search_entities(query[, entity_types, limit]) to find records via Universal Search. "
        "- get_entity_details(type, id) to load a full record profile payload for a specific entity. "
        "- get_entity_analytics(entity_type, metric[, days, limit]) for annotated aggregations (e.g., most purchased, highest revenue). "
        "- ingest_feedback(user_correction, lesson_text[, ...]) to save a lesson learned from user feedback. "
        "- save_memory(key, memory_text[, memory_json, tags]) to store a durable tenant rule/preference (upsert by key). "
        "- retrieve_memory(query[, limit]) to fetch relevant durable tenant memory to apply. "
        "- get_entity_schema(entity_type) to discover required fields for record creation (same engine as the UI). "
        "- create_entity(entity_type, payload) to create tenant-scoped records. NEVER ask the user for tenant_id. "
        "- parse_document(file_id_or_url) to extract text from an uploaded AIDocument UUID (URL fetch disabled). "
        "- ingest_email_attachment(message_id, attachment_id, file_name) to download a specific Outlook attachment into AIDocument storage before parsing it. "
        "- trigger_workform(workflow_id[, initial_data]) to run a TenantWorkForm end-to-end (creates an execution record). "
        "- draft_vendor_email(vendor_id, context[, vendor_type]) to stage an outbound email draft (human-in-the-loop send). "
        "- create_task(title, message[, entity_type, entity_id]) to create an in-app task notification for the current user. "
        "- create_in_app_notification(title, message[, ...]) to notify other users (owners/admins only). "
        "- get_recent_errors() to fetch the most recent Sentry issues for the active tenant. "
        "- fetch_emails([folder, is_read, has_attachments, search_query, limit]) to search Inbox, Sent Items, or Archive mail. "
        "\n\nTENANT MEMORY PROTOCOL (MANDATORY): "
        "If the user provides a standing rule or preference (e.g., 'Always route Acme through Chicago'), call save_memory(key, memory_text[, memory_json, tags]). "
        "When answering, apply the injected Tenant Memory block when relevant. "
        "\n\nRECORD CREATION PROTOCOL (MANDATORY): "
        "If the user asks you to create a record (Purchase Order, Supplier, Customer, Plant, Location, Contact, Invoice, etc): "
        "(1) Call get_entity_schema(entity_type) first. "
        "(2) If any REQUIRED fields are missing, ask the user for ONLY those missing fields. "
        "(3) Once all required fields are known, call create_entity(entity_type, payload). "
        "Do NOT say you lack context as the first response for create requests. "
        "\n\nDOCUMENT-DRIVEN CREATION (Autonomous PO Ingestion): "
        "If the user uploads a Purchase Order PDF and asks you to create a PO from it: "
        "(1) Call ingest_purchase_order_document(document_id). "
        "    - This performs: parse_document → extract_purchase_order_fields → search/create supplier → create_purchase_order. "
        "(2) Return the tool result message verbatim (it should say what was created and what was drafted). "
        "(3) If the tool returns an error, explain it concisely and ask the user for only the missing fields. "
        "\nGeneral document flows (non-PO) should still use: Read → Map → Confirm → Create. "
        "\n\nWORKFORM ORCHESTRATION (PREFERRED FOR MULTI-STEP FLOWS): "
        "If the user asks to run a multi-step business process (e.g., supplier onboarding), prefer trigger_workform(workflow_id, initial_data) over creating records one-by-one. "
        "\n\nEXTERNAL COMMS BROKER (DRAFT-ONLY): "
        "If the user wants to contact a supplier/customer (invoice mismatch, PO discrepancy, booking change), propose drafting an email. "
        "Use draft_vendor_email(vendor_id, context[, vendor_type]) to store a Draft and return the subject/body for human approval. "
        "If a tool result says approval_required, stop calling tools, explain that approval is pending, and do not retry the tool automatically. "
        "\n\nOUTLOOK EMAIL SEARCH PROTOCOL (MANDATORY): "
        "You have full access to search the user's Inbox, Sent Items, and Archive. "
        "You can search both read and unread emails. "
        "When calling fetch_emails, you MUST map the user's request to the correct folder/is_read/has_attachments/search_query parameters. "
        "If the user asks for sent emails, set folder to 'sentitems'. "
        "When the user asks you to parse or extract data from an email attachment, you MUST follow this order: "
        "(1) call fetch_emails to find the target message and stage the returned attachment refs in the current chat session, "
        "(2) read the returned attachments array and pick the correct message_id + attachment_id + file_name, "
        "(3) call ingest_email_attachment(message_id, attachment_id, file_name) using one of those staged attachments, "
        "(4) if ingest_email_attachment returns status='skipped', ignore that file and continue immediately to the next attachment; if it returns status='failed', continue with the remaining attachments unless the user asks you to stop, "
        "(5) only pass the returned document_id into parse_document when ingest_email_attachment returns status='success' or status='already_ingested', "
        "(6) continue with extraction or record creation from the parsed document. "
        "If a tool returns a structured error or loop warning, do NOT repeat the exact same tool call. "
        "Instead, simplify the query or ask the user for clarification."
    )

    if lessons_block:
        base = base + str(lessons_block)

    if memory_block:
        base = base + str(memory_block)

    if session_memory_block:
        base = base + str(session_memory_block)

    if document_context_block:
        base = base + str(document_context_block)


    if outlook_connected:
        return base + f"Outlook: CONNECTED ({outlook_email or 'unknown'}). You may use email tools when relevant."

    if outlook_expired:
        return base + "Outlook: CONNECTED but EXPIRED. Do not claim you can read email; instruct user to reconnect."

    return base + "Outlook: NOT CONNECTED. Do not claim you can read email; instruct user to connect Outlook."


def _tool_call_signature(tool_name: str, raw_args: Any) -> str:
    def _normalize(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: _normalize(item)
                for key, item in value.items()
                if item is not None
            }
        if isinstance(value, list):
            return [_normalize(item) for item in value]
        return value

    if isinstance(raw_args, str):
        try:
            parsed = json.loads(raw_args)
        except Exception:
            parsed = raw_args
    else:
        parsed = raw_args or {}

    parsed = _normalize(parsed)

    try:
        normalized_args = json.dumps(parsed, sort_keys=True, separators=(',', ':'), default=str)
    except Exception:
        normalized_args = str(parsed)

    return f'{tool_name}:{normalized_args}'


def _sanitize_history_for_openai(history: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Strip unresolved tool-call state before replaying history to OpenAI."""
    if not history:
        return []

    sanitized: List[Dict[str, Any]] = []
    index = 0

    while index < len(history):
        message = history[index]
        if not isinstance(message, dict):
            index += 1
            continue

        role = message.get('role')
        if role == 'tool':
            logger.warning('[SwarmOrchestrator] Dropping orphaned tool message from replay history')
            index += 1
            continue

        if role != 'assistant':
            sanitized.append(dict(message))
            index += 1
            continue

        tool_calls = message.get('tool_calls')
        if not isinstance(tool_calls, list) or not tool_calls:
            sanitized.append(dict(message))
            index += 1
            continue

        expected_tool_ids = [
            str(tool_call.get('id'))
            for tool_call in tool_calls
            if isinstance(tool_call, dict) and tool_call.get('id')
        ]

        if not expected_tool_ids:
            repaired_message = dict(message)
            repaired_message.pop('tool_calls', None)
            if (repaired_message.get('content') or '').strip():
                sanitized.append(repaired_message)
            index += 1
            continue

        answered_ids: set[str] = set()
        tool_messages: List[Dict[str, Any]] = []
        cursor = index + 1

        while cursor < len(history):
            follower = history[cursor]
            if not isinstance(follower, dict) or follower.get('role') != 'tool':
                break

            tool_call_id = str(follower.get('tool_call_id') or '')
            if tool_call_id in expected_tool_ids and tool_call_id not in answered_ids:
                tool_messages.append(dict(follower))
                answered_ids.add(tool_call_id)
            else:
                logger.warning(
                    '[SwarmOrchestrator] Dropping orphaned or duplicate tool reply for tool_call_id=%s',
                    tool_call_id or '<missing>',
                )
            cursor += 1

        if len(answered_ids) == len(expected_tool_ids):
            sanitized.append(dict(message))
            sanitized.extend(tool_messages)
            index = cursor
            continue

        logger.warning(
            '[SwarmOrchestrator] Stripping unanswered tool_calls from replay history: %s',
            expected_tool_ids,
        )
        repaired_message = dict(message)
        repaired_message.pop('tool_calls', None)
        if (repaired_message.get('content') or '').strip():
            sanitized.append(repaired_message)
        index += 1

    return sanitized


def _coerce_tool_message_content(result: Any) -> str:
    if isinstance(result, str):
        return result

    try:
        return json.dumps(result, default=str)
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning('[SwarmOrchestrator] Failed to serialize tool result: %s', str(exc), exc_info=True)
        return (
            f'TOOL EXECUTION FAILED: Unable to serialize tool result ({str(exc)}). '
            'Instruct the user about this failure.'
        )


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
            'reefer',
            'temp',
            'pallet',
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

        requires_sme = False
        if event_type == 'user_chat' and intent not in {'action_create', 'document_invoice', 'document_purchase_order', 'document_bill_of_lading'}:
            requires_sme = self._requires_meat_sme(text)

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
        session_id: str | None = None,
    ) -> Dict[str, Any]:
        """Run bounded tool loop and return final assistant response + trace.

        Returns:
            {"response": <final text>, "messages": <final history>}
        """
        import os

        openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            logger.warning('[SwarmOrchestrator] OpenAI not configured — returning unavailable response')
            return {
                'response': 'AI assistant is currently unavailable. Please contact your administrator to configure the OpenAI API key.',
                'messages': (history or []) + [{'role': 'user', 'content': user_message}],
                'notes': 'ai_unavailable',
            }

        lessons_block = ''
        try:
            from tenant_apps.ai_assistant.services.memory_service import format_lessons_block, get_relevant_lessons

            lessons = get_relevant_lessons(tenant=tenant, query=user_message, limit=8)
            lessons_block = format_lessons_block(lessons)
        except Exception as e:
            logger.warning('[SwarmOrchestrator] Lessons lookup failed; continuing without lessons: %s', str(e))

        memory_block = ''
        try:
            from tenant_apps.ai_assistant.services.tenant_memory_service import format_memory_block, get_relevant_memories

            memories = get_relevant_memories(tenant=tenant, query=user_message, limit=8)
            memory_block = format_memory_block(memories)
        except Exception as e:
            logger.warning('[SwarmOrchestrator] Tenant memory lookup failed; continuing without memory: %s', str(e))

        session_memory_block = ''
        if session_id:
            try:
                from tenant_apps.ai_assistant.services.tenant_memory_service import (
                    format_session_memory_block,
                    get_session_compaction_memory,
                )

                session_memory = get_session_compaction_memory(tenant=tenant, session_id=session_id)
                session_memory_block = format_session_memory_block(session_memory)
            except Exception as e:
                logger.warning('[SwarmOrchestrator] Session memory lookup failed; continuing without session memory: %s', str(e))

        document_context_block = ''
        try:
            from tenant_apps.ai_assistant.services.semantic_indexing import (
                find_relevant_document_context,
                format_document_context_block,
            )

            semantic_matches = find_relevant_document_context(tenant=tenant, query=user_message, limit=4)
            document_context_block = format_document_context_block(semantic_matches)
        except Exception as e:
            logger.warning('[SwarmOrchestrator] Semantic document lookup failed; continuing without document context: %s', str(e))

        # Phase 8.2: intent classification → delegate deep meat/logistics questions to MeatSME RAG.
        # IMPORTANT: never route record creation or document-driven flows to RAG; those must use the tool loop.
        # Reliability mandate: if RAG fails for any reason, fall back to the standard tool loop.
        intent = self._estimate_intent('user_chat', {'message': user_message})
        if intent == 'unknown' and self._requires_meat_sme(user_message):
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
            logger.warning('[SwarmOrchestrator] OpenAI package not available: %s', str(e))
            return {
                'response': 'AI assistant is temporarily unavailable. The OpenAI package could not be loaded.',
                'messages': (history or []) + [{'role': 'user', 'content': user_message}],
                'notes': 'openai_import_failed',
            }

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

        # Always allow safe internal tools; only advertise Outlook tools when connected.
        email_tools = {'fetch_emails', 'ingest_email_attachment', 'check_unread_emails', 'draft_outlook_email'}
        if outlook_connected:
            tools = DEFAULT_OPENAI_TOOLS
        else:
            tools = [
                t
                for t in DEFAULT_OPENAI_TOOLS
                if t.get('function', {}).get('name') not in email_tools
            ]

        messages: List[Dict[str, Any]] = [
            {
                'role': 'system',
                'content': build_swarm_system_prompt(
                    outlook_connected=outlook_connected,
                    outlook_email=outlook_email,
                    outlook_expired=outlook_expired,
                    lessons_block=lessons_block,
                    memory_block=memory_block,
                    session_memory_block=session_memory_block,
                    document_context_block=document_context_block,
                ),
            }
        ]
        if history:
            messages.extend(_sanitize_history_for_openai(history))
        messages.append({'role': 'user', 'content': user_message})

        executor = ToolExecutor()

        from apps.system.services.ai_model_resolver import get_active_openai_model_id

        model_name = get_active_openai_model_id(fallback='gpt-4o-mini')
        temperature = float(getattr(settings, 'OPENAI_TEMPERATURE', 0.7) or 0.7)
        max_tokens = int(getattr(settings, 'OPENAI_MAX_TOKENS', 2000) or 2000)

        max_rounds = int(getattr(settings, 'SWARM_TOOL_MAX_ROUNDS', 3) or 3)
        rounds = 0
        tool_signatures: List[str] = []
        blocked_tools: set[str] = set()
        loop_warning_injected = False
        run = None
        validated_session_id = session_id
        if session_id:
            from tenant_apps.ai_assistant.models import ChatSession

            if not ChatSession.objects.filter(id=session_id, tenant=tenant).exists():
                validated_session_id = None

        while True:
            rounds += 1
            if rounds > max_rounds:
                break

            create_kwargs: Dict[str, Any] = {
                'model': model_name,
                'messages': _sanitize_history_for_openai(messages),
                'temperature': temperature,
                'max_tokens': max_tokens,
            }
            messages = create_kwargs['messages']
            if tools:
                create_kwargs['tools'] = tools
                create_kwargs['tool_choice'] = 'auto'

            completion = client.chat.completions.create(**create_kwargs)

            msg = completion.choices[0].message
            tool_calls = getattr(msg, 'tool_calls', None)

            if not tool_calls:
                final_text = (msg.content or '').strip()
                if run is not None:
                    run.status = 'completed'
                    run.completed_at = timezone.now()
                    run.response_text = final_text
                    run.response_payload = {
                        'final_response': final_text,
                        'tools_used': tool_signatures,
                    }
                    run.error_message = ''
                    run.save(
                        update_fields=[
                            'status',
                            'completed_at',
                            'response_text',
                            'response_payload',
                            'error_message',
                            'modified_on',
                        ]
                    )
                return {
                    'response': final_text,
                    'messages': messages,
                    'control_plane': {'run_id': str(run.id)} if run is not None else {},
                }

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
            deferred_system_messages: List[str] = []
            for tc in tool_calls:
                tool_name = tc.function.name
                raw_args = tc.function.arguments or '{}'
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
                except Exception:
                    args = {}

                signature = _tool_call_signature(tool_name, raw_args)
                repeated_signature = (
                    len(tool_signatures) >= 2
                    and tool_signatures[-1] == signature
                    and tool_signatures[-2] == signature
                )

                if tool_name in blocked_tools:
                    result = json.dumps(
                        {
                            'ok': False,
                            'tool': tool_name,
                            'tenant_id': str(getattr(tenant, 'id', '') or ''),
                            'error': {
                                'code': 'TOOL_RETRY_BLOCKED',
                                'message': 'This tool already failed with a non-retryable error in this run.',
                                'hint': 'Do not retry this tool. Ask the user for the missing information instead.',
                                'retryable': False,
                            },
                        }
                    )
                    deferred_system_messages.append(
                        f'System: Tool "{tool_name}" is blocked for the rest of this run because '
                        'it already failed with a non-retryable error. Ask the user for clarification.'
                    )
                    if not loop_warning_injected:
                        max_rounds += 1
                        loop_warning_injected = True
                elif repeated_signature:
                    result = json.dumps(
                        {
                            'ok': False,
                            'tool': tool_name,
                            'tenant_id': str(getattr(tenant, 'id', '') or ''),
                            'error': {
                                'code': 'TOOL_LOOP_DETECTED',
                                'message': 'You are stuck calling the same tool with the same parameters.',
                                'hint': 'Stop retrying this tool and ask the user for clarification or adjust the query.',
                                'retryable': False,
                            },
                        }
                    )
                    deferred_system_messages.append(
                        'System: You are stuck in a loop. Stop calling this tool and ask the user for clarification.'
                    )
                    if not loop_warning_injected:
                        max_rounds += 1
                        loop_warning_injected = True
                else:
                    if run is None:
                        import uuid

                        from tenant_apps.ai_assistant.models import AIRun

                        run = AIRun.objects.create(
                            tenant=tenant,
                            session_id=validated_session_id,
                            requested_by=user,
                            source='chat',
                            event_type='user_chat',
                            status='running',
                            intent=intent,
                            correlation_id=str(validated_session_id or uuid.uuid4()),
                            user_message=user_message,
                            request_payload={
                                'session_id': validated_session_id,
                                'history_length': len(history or []),
                                'user_message': user_message,
                            },
                        )
                    try:
                        result = executor.execute(
                            tool_name,
                            args,
                            tenant,
                            user,
                            session_id=validated_session_id,
                            run=run,
                        )
                    except Exception as exc:
                        logger.warning(
                            '[SwarmOrchestrator] Tool %s raised before returning a contract-safe tool message: %s',
                            tool_name,
                            str(exc),
                            exc_info=True,
                        )
                        result = (
                            f'TOOL EXECUTION FAILED: {str(exc)}. '
                            'Instruct the user about this failure.'
                        )
                    tool_signatures.append(signature)

                tool_content = _coerce_tool_message_content(result)
                messages.append(
                    {
                        'role': 'tool',
                        'tool_call_id': tc.id,
                        'content': tool_content,
                    }
                )

                try:
                    parsed_result = json.loads(tool_content)
                except Exception:
                    parsed_result = {}
                tool_data = parsed_result.get('data') if isinstance(parsed_result, dict) else {}
                tool_error = parsed_result.get('error') if isinstance(parsed_result, dict) else None
                if isinstance(tool_error, dict) and tool_error.get('retryable') is False:
                    blocked_tools.add(tool_name)
                    deferred_system_messages.append(_build_non_retryable_tool_message(tool_name, tool_error))
                    if not loop_warning_injected:
                        max_rounds += 1
                        loop_warning_injected = True
                if isinstance(tool_data, dict) and tool_data.get('approval_required'):
                    response_text = str(tool_data.get('message') or 'Approval is required before this AI task can execute.').strip()
                    if run is not None:
                        run.status = 'approval_required'
                        run.approval_required_at = timezone.now()
                        run.response_text = response_text
                        run.response_payload = tool_data
                        run.save(
                            update_fields=[
                                'status',
                                'approval_required_at',
                                'response_text',
                                'response_payload',
                                'modified_on',
                            ]
                        )
                    return {
                        'response': response_text,
                        'messages': messages,
                        'control_plane': {
                            'run_id': str(run.id) if run is not None else '',
                            'task_id': str(tool_data.get('task_id') or ''),
                            'approval_id': str(tool_data.get('approval_id') or ''),
                            'approval_required': True,
                            'tool_name': tool_name,
                            },
                        }

            for deferred_message in deferred_system_messages:
                messages.append({'role': 'system', 'content': deferred_message})

            # d) Loop continues; next LLM call interprets tool results (and may call more tools)

        if run is not None:
            run.status = 'failed'
            run.completed_at = timezone.now()
            run.error_message = 'Tool loop exceeded max rounds'
            run.response_text = 'Tool loop exceeded max rounds; please refine your request.'
            run.response_payload = {'tools_used': tool_signatures}
            run.save(
                update_fields=[
                    'status',
                    'completed_at',
                    'error_message',
                    'response_text',
                    'response_payload',
                    'modified_on',
                ]
            )
        return {
            'response': 'Tool loop exceeded max rounds; please refine your request.',
            'messages': messages,
            'control_plane': {'run_id': str(run.id)} if run is not None else {},
        }

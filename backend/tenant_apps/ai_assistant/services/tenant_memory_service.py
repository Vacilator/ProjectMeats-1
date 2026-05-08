"""Tenant long-term memory service for PM-AS.

This is distinct from AIFeedback lessons:
- AIFeedback: conversational corrections ("lessons learned")
- TenantAIMemory: durable rules/preferences keyed for upserts

Design goals:
- Tenant isolation (always filter by tenant)
- Small prompt footprint
- Safe defaults (never crash chat if memory fails)
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Iterable, List

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet

from tenant_apps.ai_assistant.models import ChatMessage, MessageTypeChoices, TenantAIMemory
from tenant_apps.ai_assistant.session_utils import bind_session_compaction_state, get_session_compaction_watermark

_WORD_RE = re.compile(r"[a-zA-Z0-9_\-]{3,}")
_WHITESPACE_RE = re.compile(r"\s+")
_SESSION_MEMORY_KEY_PREFIX = "chat_session:"
_SESSION_MEMORY_SNIPPET_LIMIT = 180
_SESSION_MEMORY_LINE_LIMIT = 10


def _normalize_line(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", str(text or "")).strip()


def _tokenize(text: str) -> set[str]:
    tokens: set[str] = set()
    for m in _WORD_RE.finditer((text or "").lower()):
        w = m.group(0)
        if len(w) >= 3:
            tokens.add(w)
    return tokens


def _candidate_qs(*, tenant: Any) -> QuerySet[TenantAIMemory]:
    return (
        TenantAIMemory.objects.filter(tenant=tenant, is_active=True)
        .exclude(key__startswith=_SESSION_MEMORY_KEY_PREFIX)
        .only("id", "key", "memory_text", "memory_json", "tags", "created_on")
        .order_by("-created_on")
    )


def get_relevant_memories(*, tenant: Any, query: str, limit: int = 8, lookback: int = 200) -> List[TenantAIMemory]:
    limit = max(0, min(20, int(limit or 0)))
    lookback = max(1, min(1000, int(lookback or 0)))
    if limit <= 0:
        return []

    q_tokens = _tokenize(query)
    if not q_tokens:
        return []

    rows = list(_candidate_qs(tenant=tenant)[:lookback])
    scored: list[tuple[int, TenantAIMemory]] = []

    for r in rows:
        blob = " ".join(
            [
                str(r.key or ""),
                str(r.memory_text or ""),
                str(r.memory_json or ""),
            ]
        ).lower()
        tokens = _tokenize(blob)
        score = len(q_tokens & tokens)
        if score <= 0:
            continue
        scored.append((score, r))

    scored.sort(key=lambda x: (-x[0], str(x[1].key)))
    return [row for _, row in scored[:limit]]


def format_memory_block(memories: Iterable[TenantAIMemory]) -> str:
    memories_list = [m for m in memories if (m.memory_text or "").strip()]
    if not memories_list:
        return ""

    bullets = "\n".join([f"- {m.memory_text.strip()}" for m in memories_list])
    return (
        "\n\nTenant Memory (durable tenant rules/preferences):\n"
        f"{bullets}\n"
        "Apply these memories when relevant. If a memory conflicts with current tenant data, prefer the data."
    )


def session_memory_key(session_id: Any) -> str:
    return f'{_SESSION_MEMORY_KEY_PREFIX}{str(session_id or "").strip()}:summary'


def get_session_compaction_memory(*, tenant: Any, session_id: Any) -> TenantAIMemory | None:
    if not session_id:
        return None
    return (
        TenantAIMemory.objects.filter(
            tenant=tenant,
            is_active=True,
            key=session_memory_key(session_id),
        )
        .only("id", "key", "memory_text", "memory_json", "tags", "created_on", "modified_on")
        .first()
    )


def format_session_memory_block(memory: TenantAIMemory | None) -> str:
    if memory is None:
        return ""

    memory_text = _normalize_line(memory.memory_text)
    if not memory_text:
        return ""

    return (
        "\n\nSession Memory (durable summary of older messages in this chat):\n"
        f"- {memory_text}\n"
        "Use this summary as context for earlier parts of the same chat while relying on the recent raw messages for the latest details."
    )


def _compaction_enabled() -> bool:
    return bool(getattr(settings, "AI_CHAT_COMPACTION_ENABLED", True))


def _compaction_min_messages() -> int:
    return max(1, int(getattr(settings, "AI_CHAT_COMPACTION_MIN_MESSAGES", 18) or 18))


def _compaction_tail_messages() -> int:
    return max(1, int(getattr(settings, "AI_CHAT_COMPACTION_TAIL_MESSAGES", 12) or 12))


def _compaction_max_summary_chars() -> int:
    return max(400, int(getattr(settings, "AI_CHAT_COMPACTION_MAX_SUMMARY_CHARS", 2400) or 2400))


def _message_role_label(message_type: str) -> str:
    if message_type == MessageTypeChoices.USER:
        return "User"
    if message_type == MessageTypeChoices.ASSISTANT:
        return "Assistant"
    if message_type == MessageTypeChoices.DOCUMENT:
        return "Document"
    return "System"


def _message_summary_text(message: ChatMessage) -> str:
    metadata = message.metadata if isinstance(message.metadata, dict) else {}
    if message.message_type == MessageTypeChoices.DOCUMENT:
        filename = str(metadata.get("original_filename") or message.content or "document").strip()
        content = f"[Document] {filename}"
        document_id = str(metadata.get("document_id") or "").strip()
        if document_id:
            content = f"{content} ({document_id})"
        return content[:_SESSION_MEMORY_SNIPPET_LIMIT]

    content = _normalize_line(message.content)
    return content[:_SESSION_MEMORY_SNIPPET_LIMIT]


def _format_compaction_window(value: Any) -> str:
    if not isinstance(value, datetime):
        return ""
    return value.astimezone().strftime("%Y-%m-%d %H:%M")


def _build_session_summary(
    *,
    previous_summary: str,
    messages: list[ChatMessage],
    max_chars: int,
) -> str:
    if not messages:
        return ""

    lines: list[str] = []
    compacted_count = len(messages)
    start_label = _format_compaction_window(messages[0].created_on)
    end_label = _format_compaction_window(messages[-1].created_on)
    window_label = f"{start_label} to {end_label}" if start_label and end_label else "earlier in this chat"
    lines.append(f"Compacted {compacted_count} older messages from {window_label}.")

    previous_summary = _normalize_line(previous_summary)
    if previous_summary:
        previous_summary = previous_summary[: max(200, max_chars // 2)]
        lines.append(f"Earlier compacted context: {previous_summary}")

    for message in messages[-_SESSION_MEMORY_LINE_LIMIT:]:
        snippet = _message_summary_text(message)
        if not snippet:
            continue
        lines.append(f"{_message_role_label(message.message_type)}: {snippet}")

    summary = " ".join(line for line in lines if line).strip()
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rstrip() + "…"
    return summary


def compact_session_messages(*, tenant: Any, session: Any) -> TenantAIMemory | None:
    """Compact older raw chat messages into one durable session memory block."""
    if not _compaction_enabled() or tenant is None or session is None:
        return None

    tail_messages = _compaction_tail_messages()
    min_messages = max(_compaction_min_messages(), tail_messages + 1)
    watermark = get_session_compaction_watermark(getattr(session, "context_data", None))

    uncompacted_qs = (
        ChatMessage.objects.filter(session=session, tenant=tenant)
        .only("id", "message_type", "content", "metadata", "created_on")
        .order_by("created_on", "id")
    )
    if watermark is not None:
        uncompacted_qs = uncompacted_qs.filter(created_on__gt=watermark)

    uncompacted_messages = list(uncompacted_qs)
    if len(uncompacted_messages) < min_messages:
        return None

    messages_to_compact = uncompacted_messages[:-tail_messages]
    if not messages_to_compact:
        return None

    memory_key = session_memory_key(getattr(session, "id", None))
    existing_memory = get_session_compaction_memory(tenant=tenant, session_id=getattr(session, "id", None))
    summary_text = _build_session_summary(
        previous_summary=getattr(existing_memory, "memory_text", ""),
        messages=messages_to_compact,
        max_chars=_compaction_max_summary_chars(),
    )
    if not summary_text:
        return None

    source_message_ids = [str(message.id) for message in messages_to_compact]
    first_message = messages_to_compact[0]
    last_message = messages_to_compact[-1]

    with transaction.atomic():
        memory, _ = TenantAIMemory.objects.update_or_create(
            tenant=tenant,
            key=memory_key,
            defaults={
                "memory_text": summary_text,
                "memory_json": {
                    "kind": "session_compaction",
                    "session_id": str(getattr(session, "id", "") or ""),
                    "source_message_ids": source_message_ids,
                    "source_start_created_on": first_message.created_on.isoformat(),
                    "source_end_created_on": last_message.created_on.isoformat(),
                    "source_count": len(messages_to_compact),
                },
                "tags": {
                    "kind": "session_compaction",
                    "session_id": str(getattr(session, "id", "") or ""),
                },
                "is_active": True,
            },
        )

        session.context_data = bind_session_compaction_state(
            getattr(session, "context_data", None),
            tenant,
            memory_key=memory_key,
            last_compacted_created_on=last_message.created_on,
            last_compacted_message_id=last_message.id,
            compacted_count=len(messages_to_compact),
        )
        session.save(update_fields=["context_data"])

    return memory

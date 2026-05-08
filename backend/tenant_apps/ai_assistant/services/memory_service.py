"""Memory service for PM-AS.

This is intentionally simple (non-vector) memory:
- Persist user feedback as durable lessons (tenant-scoped via RLS).
- Retrieve a small set of relevant lessons to inject into the system prompt.

Design goals:
- Safe defaults (never crash chat if memory fails)
- Tenant isolation (always filter by tenant)
- Small prompt footprint
"""

from __future__ import annotations

import re
from typing import Any, Iterable, List

from django.db.models import QuerySet

from tenant_apps.ai_assistant.models import AIFeedback

_WORD_RE = re.compile(r"[a-zA-Z0-9_\-]{3,}")


def ingest_feedback(
    *,
    tenant: Any,
    user: Any | None,
    user_message: str,
    assistant_message: str,
    user_correction: str,
    lesson_text: str,
    entity_type: str = "",
    entity_id: str = "",
    tags: dict | None = None,
) -> AIFeedback:
    """Persist a tenant-scoped lesson learned from user feedback."""

    user_correction = (user_correction or "").strip()
    lesson_text = (lesson_text or "").strip()

    if not user_correction:
        raise ValueError("user_correction is required")
    if not lesson_text:
        raise ValueError("lesson_text is required")

    return AIFeedback.objects.create(
        tenant=tenant,
        user=user if getattr(user, "is_authenticated", False) else None,
        user_message=(user_message or "").strip(),
        assistant_message=(assistant_message or "").strip(),
        user_correction=user_correction,
        lesson_text=lesson_text,
        entity_type=(entity_type or "").strip().lower(),
        entity_id=(entity_id or "").strip(),
        tags=tags or {},
        is_active=True,
    )


def _tokenize(text: str) -> set[str]:
    tokens = set()
    for m in _WORD_RE.finditer((text or "").lower()):
        w = m.group(0)
        if len(w) >= 3:
            tokens.add(w)
    return tokens


def _candidate_qs(*, tenant: Any) -> QuerySet[AIFeedback]:
    return (
        AIFeedback.objects.filter(tenant=tenant, is_active=True)
        .only(
            "id",
            "lesson_text",
            "user_correction",
            "user_message",
            "assistant_message",
            "entity_type",
            "entity_id",
            "created_on",
        )
        .order_by("-created_on")
    )


def get_relevant_lessons(*, tenant: Any, query: str, limit: int = 8, lookback: int = 200) -> List[str]:
    """Return up to `limit` lesson_text strings relevant to the given query.

    Relevance is a lightweight keyword overlap score over the most recent `lookback` feedback items.
    """

    limit = max(0, min(20, int(limit or 0)))
    lookback = max(1, min(1000, int(lookback or 0)))
    if limit <= 0:
        return []

    q_tokens = _tokenize(query)
    if not q_tokens:
        return []

    rows = list(_candidate_qs(tenant=tenant)[:lookback])
    scored: list[tuple[int, str]] = []
    seen = set()

    for r in rows:
        blob = " ".join(
            [
                str(r.entity_type or ""),
                str(r.entity_id or ""),
                str(r.user_message or ""),
                str(r.user_correction or ""),
                str(r.lesson_text or ""),
            ]
        ).lower()
        tokens = _tokenize(blob)
        score = len(q_tokens & tokens)
        if score <= 0:
            continue

        lesson = (r.lesson_text or "").strip()
        if not lesson or lesson in seen:
            continue

        scored.append((score, lesson))
        seen.add(lesson)

    scored.sort(key=lambda x: (-x[0], x[1]))
    return [lesson for _, lesson in scored[:limit]]


def format_lessons_block(lessons: Iterable[str]) -> str:
    lessons_list = [str(x).strip() for x in lessons if str(x).strip()]
    if not lessons_list:
        return ""

    bullets = "\n".join([f"- {l}" for l in lessons_list])
    return (
        "\n\nLessons Learned (from user feedback; tenant-scoped):\n"
        f"{bullets}\n"
        "Apply these lessons when relevant. If a lesson conflicts with current tenant data, prefer the data."
    )

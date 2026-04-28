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
from typing import Any, Iterable, List

from django.db.models import QuerySet
from pgvector.django import CosineDistance

from tenant_apps.ai_assistant.models import TenantAIMemory
from tenant_apps.ai_assistant.services.semantic_indexing import generate_embedding


_WORD_RE = re.compile(r"[a-zA-Z0-9_\-]{3,}")


def _tokenize(text: str) -> set[str]:
    tokens: set[str] = set()
    for m in _WORD_RE.finditer((text or '').lower()):
        w = m.group(0)
        if len(w) >= 3:
            tokens.add(w)
    return tokens


def _candidate_qs(*, tenant: Any) -> QuerySet[TenantAIMemory]:
    return (
        TenantAIMemory.objects.filter(tenant=tenant, is_active=True)
        .only('id', 'key', 'memory_text', 'memory_json', 'tags', 'created_on', 'embedding_vector')
        .order_by('-created_on')
    )


def find_semantic_context(*, tenant: Any, query_string: str, limit: int = 5) -> List[TenantAIMemory]:
    limit = max(0, min(20, int(limit or 0)))
    if limit <= 0:
        return []

    query_vector = generate_embedding(query_string)
    if not query_vector:
        return []

    return list(
        TenantAIMemory.objects.filter(
            tenant=tenant,
            is_active=True,
            embedding_vector__isnull=False,
        )
        .annotate(distance=CosineDistance('embedding_vector', query_vector))
        .order_by('distance', 'key')[:limit]
    )


def get_relevant_memories(*, tenant: Any, query: str, limit: int = 8, lookback: int = 200) -> List[TenantAIMemory]:
    limit = max(0, min(20, int(limit or 0)))
    lookback = max(1, min(1000, int(lookback or 0)))
    if limit <= 0:
        return []

    semantic_matches = find_semantic_context(tenant=tenant, query_string=query, limit=limit)
    if semantic_matches:
        return semantic_matches

    q_tokens = _tokenize(query)
    if not q_tokens:
        return []

    rows = list(_candidate_qs(tenant=tenant)[:lookback])
    scored: list[tuple[int, TenantAIMemory]] = []

    for r in rows:
        blob = ' '.join([
            str(r.key or ''),
            str(r.memory_text or ''),
            str(r.memory_json or ''),
        ]).lower()
        tokens = _tokenize(blob)
        score = len(q_tokens & tokens)
        if score <= 0:
            continue
        scored.append((score, r))

    scored.sort(key=lambda x: (-x[0], str(x[1].key)))
    return [row for _, row in scored[:limit]]


def format_memory_block(memories: Iterable[TenantAIMemory]) -> str:
    memories_list = [m for m in memories if (m.memory_text or '').strip()]
    if not memories_list:
        return ''

    bullets = "\n".join([f"- {m.memory_text.strip()}" for m in memories_list])
    return (
        "\n\nTenant Memory (durable tenant rules/preferences):\n"
        f"{bullets}\n"
        "Apply these memories when relevant. If a memory conflicts with current tenant data, prefer the data."
    )

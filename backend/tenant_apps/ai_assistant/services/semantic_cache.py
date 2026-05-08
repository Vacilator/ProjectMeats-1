from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Sequence

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .semantic_indexing import _cosine_similarity, _embed_texts, _normalize_text

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SemanticCacheHit:
    entry_id: str
    response_text: str
    similarity: float
    model_name: str
    created_at: str


def semantic_cache_enabled() -> bool:
    return bool(getattr(settings, "AI_SEMANTIC_CACHE_ENABLED", True))


def _ttl_seconds() -> int:
    return int(getattr(settings, "AI_SEMANTIC_CACHE_TTL_SECONDS", 3600))


def _similarity_threshold() -> float:
    return float(getattr(settings, "AI_SEMANTIC_CACHE_SIMILARITY_THRESHOLD", 0.95))


def _max_entries() -> int:
    return int(getattr(settings, "AI_SEMANTIC_CACHE_MAX_ENTRIES", 50))


def _cache_key(tenant_id: str) -> str:
    return f"ai_assistant:semantic_cache:{tenant_id}"


def build_context_signature(*, history: Sequence[dict[str, Any]], context: dict[str, Any] | None = None) -> str:
    payload = {
        "history": [
            {
                "role": str(item.get("role") or ""),
                "content": _normalize_text(str(item.get("content") or "")),
            }
            for item in history
            if isinstance(item, dict)
        ],
        "context": context if isinstance(context, dict) else {},
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return str(uuid.uuid5(uuid.NAMESPACE_URL, serialized))


def _read_entries(tenant_id: str) -> list[dict[str, Any]]:
    try:
        cached = cache.get(_cache_key(tenant_id)) or []
    except Exception:
        logger.warning("Semantic cache read failed for tenant=%s", tenant_id, exc_info=True)
        return []

    if not isinstance(cached, list):
        return []
    return [entry for entry in cached if isinstance(entry, dict)]


def _write_entries(tenant_id: str, entries: list[dict[str, Any]]) -> None:
    try:
        cache.set(_cache_key(tenant_id), entries, timeout=_ttl_seconds())
    except Exception:
        logger.warning("Semantic cache write failed for tenant=%s", tenant_id, exc_info=True)


def lookup_cached_response(
    *,
    tenant_id: str,
    user_message: str,
    context_signature: str,
) -> SemanticCacheHit | None:
    if not semantic_cache_enabled() or not tenant_id:
        return None

    normalized_message = _normalize_text(user_message)
    if not normalized_message:
        return None

    embedded = _embed_texts([normalized_message])
    if not embedded:
        return None
    query_embedding = embedded[0]

    now = timezone.now()
    best_match: SemanticCacheHit | None = None

    for entry in _read_entries(tenant_id):
        if entry.get("context_signature") != context_signature:
            continue

        expires_at_raw = str(entry.get("expires_at") or "")
        if not expires_at_raw:
            continue
        expires_at = timezone.datetime.fromisoformat(expires_at_raw)
        if timezone.is_naive(expires_at):
            expires_at = timezone.make_aware(expires_at)
        if expires_at <= now:
            continue

        embedding = entry.get("embedding")
        if not isinstance(embedding, list) or not embedding:
            continue

        similarity = _cosine_similarity(query_embedding, embedding)
        if similarity < _similarity_threshold():
            continue

        if best_match is None or similarity > best_match.similarity:
            best_match = SemanticCacheHit(
                entry_id=str(entry.get("entry_id") or ""),
                response_text=str(entry.get("response_text") or ""),
                similarity=float(similarity),
                model_name=str(entry.get("model_name") or ""),
                created_at=str(entry.get("created_at") or ""),
            )

    return best_match


def store_cached_response(
    *,
    tenant_id: str,
    user_message: str,
    response_text: str,
    context_signature: str,
    model_name: str,
) -> dict[str, Any] | None:
    if not semantic_cache_enabled() or not tenant_id:
        return None

    normalized_message = _normalize_text(user_message)
    normalized_response = str(response_text or "").strip()
    if not normalized_message or not normalized_response:
        return None

    embedded = _embed_texts([normalized_message])
    if not embedded:
        return None

    now = timezone.now()
    expires_at = now + timedelta(seconds=_ttl_seconds())
    entry = {
        "entry_id": str(uuid.uuid4()),
        "prompt": normalized_message,
        "response_text": normalized_response,
        "context_signature": context_signature,
        "embedding": embedded[0],
        "model_name": model_name,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    existing = [
        item
        for item in _read_entries(tenant_id)
        if item.get("context_signature") != context_signature or item.get("prompt") != normalized_message
    ]
    existing.insert(0, entry)
    _write_entries(tenant_id, existing[: _max_entries()])
    return entry

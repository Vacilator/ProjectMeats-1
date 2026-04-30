from __future__ import annotations

import hashlib
import logging
import math
import os
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = 'text-embedding-3-small'
DEFAULT_CHUNK_CHARS = 1200
DEFAULT_CHUNK_OVERLAP = 150
MAX_SEARCH_CHUNKS = 200


@dataclass(frozen=True)
class SemanticSearchMatch:
    document_id: str
    chunk_id: str
    content: str
    score: float
    parser: str
    semantic_status: str


def semantic_index_readiness_required() -> bool:
    return bool(getattr(settings, 'REQUIRE_SEMANTIC_INDEX_READINESS', False))


def semantic_indexing_available() -> bool:
    api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
    return bool(api_key)


def _client():
    from openai import OpenAI

    return OpenAI(
        api_key=getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY'),
        organization=getattr(settings, 'OPENAI_ORG_ID', None) or os.environ.get('OPENAI_ORG_ID') or None,
    )


def _normalize_text(text: str) -> str:
    return ' '.join((text or '').split()).strip()


def chunk_text(text: str, *, chunk_chars: int = DEFAULT_CHUNK_CHARS, overlap: int = DEFAULT_CHUNK_OVERLAP) -> list[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []

    if len(normalized) <= chunk_chars:
        return [normalized]

    chunks: list[str] = []
    start = 0
    text_length = len(normalized)
    while start < text_length:
        end = min(text_length, start + chunk_chars)
        if end < text_length:
            boundary = normalized.rfind(' ', start, end)
            if boundary > start + 100:
                end = boundary
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_length:
            break
        start = max(end - overlap, start + 1)
    return chunks


def _embed_texts(texts: Sequence[str]) -> list[list[float]] | None:
    if not texts or not semantic_indexing_available():
        return None

    try:
        response = _client().embeddings.create(model=EMBEDDING_MODEL, input=list(texts))
        embeddings: list[list[float]] = []
        for row in response.data:
            embeddings.append([float(value) for value in row.embedding])
        return embeddings
    except Exception as exc:
        logger.warning('Semantic embedding generation failed: %s', str(exc), exc_info=True)
        return None


def _cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def _lexical_score(query: str, content: str) -> float:
    query_terms = {term for term in _normalize_text(query).lower().split(' ') if term}
    content_terms = {term for term in _normalize_text(content).lower().split(' ') if term}
    if not query_terms or not content_terms:
        return 0.0
    overlap = len(query_terms & content_terms)
    return overlap / max(len(query_terms), 1)


def _semantic_metadata(*, parser: str, chunk_count: int, status: str, mode: str, detail: str = '') -> dict[str, Any]:
    payload: dict[str, Any] = {
        'status': status,
        'mode': mode,
        'chunk_count': int(chunk_count),
        'parser': parser,
        'indexed_at': timezone.now().isoformat(),
    }
    if detail:
        payload['detail'] = detail
    if mode == 'semantic':
        payload['model'] = EMBEDDING_MODEL
    return payload


def index_document_for_semantic_search(*, document: Any, text: str, parser: str) -> dict[str, Any]:
    from tenant_apps.ai_assistant.models import AIDocumentSemanticChunk

    normalized = _normalize_text(text)
    if not normalized:
        with transaction.atomic():
            type(document).objects.select_for_update().filter(pk=document.pk).values_list('pk', flat=True).first()
            metadata = dict(getattr(document, 'custom_data', {}) or {})
            semantic_metadata = _semantic_metadata(
                parser=parser,
                chunk_count=0,
                status='skipped',
                mode='empty',
                detail='No extractable text was available for indexing.',
            )
            metadata['semantic_indexing'] = semantic_metadata
            document.custom_data = metadata
            document.save(update_fields=['custom_data', 'modified_on'])
            AIDocumentSemanticChunk.objects.filter(document=document).delete()
            return semantic_metadata

    chunks = chunk_text(normalized)
    embeddings = _embed_texts(chunks)
    mode = 'semantic' if embeddings else 'lexical_fallback'
    status = 'indexed' if embeddings else 'degraded'

    with transaction.atomic():
        type(document).objects.select_for_update().filter(pk=document.pk).values_list('pk', flat=True).first()
        AIDocumentSemanticChunk.objects.filter(document=document).delete()
        records = []
        for index, chunk in enumerate(chunks):
            records.append(
                AIDocumentSemanticChunk(
                    tenant=document.tenant,
                    document=document,
                    chunk_index=index,
                    content=chunk,
                    content_hash=hashlib.sha256(chunk.encode('utf-8')).hexdigest(),
                    embedding=embeddings[index] if embeddings else [],
                    metadata={'parser': parser, 'mode': mode},
                )
            )
        if records:
            AIDocumentSemanticChunk.objects.bulk_create(records)

        metadata = dict(getattr(document, 'custom_data', {}) or {})
        semantic_metadata = _semantic_metadata(
            parser=parser,
            chunk_count=len(chunks),
            status=status,
            mode=mode,
            detail='Embeddings unavailable; lexical fallback retained.' if not embeddings else '',
        )
        metadata['semantic_indexing'] = semantic_metadata
        document.custom_data = metadata
        document.save(update_fields=['custom_data', 'modified_on'])
        return semantic_metadata


def find_relevant_document_context(*, tenant: Any, query: str, limit: int = 4) -> list[SemanticSearchMatch]:
    from tenant_apps.ai_assistant.models import AIDocumentSemanticChunk

    query = _normalize_text(query)
    if not query:
        return []

    qs = (
        AIDocumentSemanticChunk.objects.filter(tenant=tenant)
        .select_related('document')
        .order_by('-created_on')[:MAX_SEARCH_CHUNKS]
    )
    rows = list(qs)
    if not rows:
        return []

    query_embedding = None
    if semantic_indexing_available():
        embedded = _embed_texts([query])
        if embedded:
            query_embedding = embedded[0]

    scored: list[SemanticSearchMatch] = []
    for row in rows:
        semantic_metadata = dict(getattr(row.document, 'custom_data', {}) or {}).get('semantic_indexing') or {}
        parser = str(semantic_metadata.get('parser') or getattr(row.document, 'custom_data', {}).get('parser') or '')
        if query_embedding and row.embedding:
            score = _cosine_similarity(query_embedding, row.embedding)
        else:
            score = _lexical_score(query, row.content)
        if score <= 0:
            continue
        scored.append(
            SemanticSearchMatch(
                document_id=str(row.document_id),
                chunk_id=str(row.id),
                content=row.content,
                score=float(score),
                parser=parser,
                semantic_status=str(semantic_metadata.get('status') or ''),
            )
        )

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:limit]


def format_document_context_block(matches: Iterable[SemanticSearchMatch]) -> str:
    rows = list(matches)
    if not rows:
        return ''

    lines = ['Relevant parsed document context:']
    for index, match in enumerate(rows, start=1):
        excerpt = match.content[:400].strip()
        lines.append(
            f"{index}. document_id={match.document_id} parser={match.parser or 'unknown'} "
            f"score={match.score:.3f} semantic_status={match.semantic_status or 'unknown'}\n{excerpt}"
        )
    return '\n'.join(lines)

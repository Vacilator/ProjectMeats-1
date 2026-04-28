from __future__ import annotations

import logging
from typing import Iterable

from django.conf import settings

from tenant_apps.ai_assistant.models import AIDocument, AIDocumentChunk, TenantAIMemory, TenantKnowledgeFact
from tenant_apps.ai_assistant.services.document_parser import get_document_extension, is_tabular_document, parse_tabular_document

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMENSIONS = 1536
MAX_EMBEDDING_CHARS = 8000
DOCUMENT_CHUNK_CHARS = 2000
MAX_DOCUMENT_CHUNKS = 20


def _normalize_text(text: str) -> str:
    return ' '.join(str(text or '').split()).strip()


def _truncate_for_embedding(text: str) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= MAX_EMBEDDING_CHARS:
        return normalized
    return normalized[:MAX_EMBEDDING_CHARS].rsplit(' ', 1)[0].strip() or normalized[:MAX_EMBEDDING_CHARS]


def generate_embedding(text: str) -> list[float] | None:
    text = _truncate_for_embedding(text)
    if not text or not getattr(settings, 'OPENAI_API_KEY', None):
        return None

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            organization=getattr(settings, 'OPENAI_ORG_ID', None) or None,
        )
        response = client.embeddings.create(input=text, model=EMBEDDING_MODEL)
        return response.data[0].embedding
    except Exception as exc:
        logger.warning('Failed to generate semantic embedding: %s', str(exc), exc_info=True)
        return None


def sync_memory_embedding(memory: TenantAIMemory) -> None:
    text = memory.memory_text or ''
    vector = generate_embedding(text)
    update_fields = ['embedding', 'embedding_vector']
    memory.embedding = vector or []
    memory.embedding_vector = vector
    memory.save(update_fields=update_fields)


def sync_knowledge_fact_embedding(fact: TenantKnowledgeFact) -> None:
    text = fact.fact_text or ''
    vector = generate_embedding(text)
    fact.embedding = vector
    fact.embedding_vector = vector
    fact.save(update_fields=['embedding', 'embedding_vector'])


def _read_text_document(document: AIDocument) -> str:
    with document.file.open('rb') as file_obj:
        raw = file_obj.read()
    try:
        return raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        return raw.decode('latin-1', errors='ignore')


def extract_document_text(document: AIDocument) -> str:
    filename = document.original_filename or getattr(document.file, 'name', '')
    content_type = document.content_type or ''

    if is_tabular_document(filename=filename, content_type=content_type):
        with document.file.open('rb') as file_obj:
            parsed = parse_tabular_document(file_obj, filename=filename, content_type=content_type)
        return parsed.text

    extension = get_document_extension(filename)
    if content_type == 'text/plain' or extension == 'txt':
        return _read_text_document(document)

    return ''


def chunk_text(text: str, *, chunk_chars: int = DOCUMENT_CHUNK_CHARS, max_chunks: int = MAX_DOCUMENT_CHUNKS) -> list[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []

    chunks: list[str] = []
    remainder = normalized
    while remainder and len(chunks) < max_chunks:
        if len(remainder) <= chunk_chars:
            chunks.append(remainder)
            break

        cut = remainder[:chunk_chars]
        split_at = cut.rfind(' ')
        if split_at > int(chunk_chars * 0.6):
            cut = cut[:split_at]
        chunks.append(cut.strip())
        remainder = remainder[len(cut):].strip()

    return [chunk for chunk in chunks if chunk]


def index_document_for_semantic_search(document: AIDocument) -> int:
    text = extract_document_text(document)
    chunks = chunk_text(text)

    AIDocumentChunk.objects.filter(tenant=document.tenant, document=document).delete()
    if not chunks:
        return 0

    rows: list[AIDocumentChunk] = []
    for chunk_index, chunk in enumerate(chunks):
        vector = generate_embedding(chunk)
        rows.append(
            AIDocumentChunk(
                tenant=document.tenant,
                document=document,
                chunk_index=chunk_index,
                content=chunk,
                metadata={'source': 'semantic_indexing'},
                embedding=vector or [],
                embedding_vector=vector,
            )
        )

    AIDocumentChunk.objects.bulk_create(rows)
    return len(rows)


def generate_embeddings_for_texts(texts: Iterable[str]) -> list[list[float] | None]:
    return [generate_embedding(text) for text in texts]

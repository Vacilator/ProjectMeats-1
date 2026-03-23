"""Meat Subject Matter Expert (SME) agent.

Phase 8.2: Tenant-isolated Vector RAG pipeline.

CRITICAL RULE:
- Retrieval MUST be tenant-scoped.
"""

from __future__ import annotations

import logging
from typing import Any, List

from django.conf import settings
from pgvector.django import CosineDistance

from tenant_apps.ai_assistant.models import VectorMemory

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are the ProjectMeats Subject Matter Expert. Use the provided tenant history and industry context to answer the query accurately. "
    "Do not hallucinate outside the provided context."
)


class MeatSMEAgent:
    """Domain expert agent backed by strict tenant-scoped vector retrieval."""

    def analyze(self, query: str, tenant_id: str) -> str:
        if not tenant_id:
            raise ValueError('tenant_id is required')
        if not query:
            return ''

        if not getattr(settings, 'OPENAI_API_KEY', None):
            raise ValueError('OpenAI not configured (missing OPENAI_API_KEY)')

        try:
            from openai import OpenAI
        except Exception as e:
            raise RuntimeError('OpenAI client not available on server') from e

        openai = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            organization=getattr(settings, 'OPENAI_ORG_ID', None) or None,
        )

        # Step 1: Embed the query
        embedding_resp = openai.embeddings.create(
            model="text-embedding-3-small",
            input=query,
        )
        query_embedding: List[float] = embedding_resp.data[0].embedding  # 1536 dims

        # Step 2: Retrieve tenant-scoped memory ordered by cosine distance
        memories = list(
            VectorMemory.objects.filter(tenant_id=tenant_id)
            .annotate(distance=CosineDistance('embedding', query_embedding))
            .order_by('distance')[:5]
        )

        context_blocks: List[str] = []
        for m in memories:
            meta = m.metadata or {}
            header_bits = [str(m.source_type or 'context')]
            if m.document_id:
                header_bits.append(str(m.document_id))
            header = " ".join(header_bits)
            snippet = (m.content or '').strip()
            if not snippet:
                continue
            # Keep context compact but useful
            context_blocks.append(f"[{header}]\n{snippet}\nMetadata: {meta}")

        context_text = "\n\n".join(context_blocks) if context_blocks else "(no tenant vector memory matches found)"

        # Step 3: Answer with gpt-4o using ONLY the provided context
        user_payload = (
            "Tenant history + industry context (authoritative):\n"
            f"{context_text}\n\n"
            "User query:\n"
            f"{query}\n\n"
            "Instructions: Answer using ONLY the tenant history + context above. "
            "If the context is insufficient, say what is missing and what to ingest into VectorMemory."
        )

        completion = openai.chat.completions.create(
            model='gpt-4o',
            messages=[
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': user_payload},
            ],
            temperature=0.2,
            max_tokens=1200,
        )

        return (completion.choices[0].message.content or '').strip()

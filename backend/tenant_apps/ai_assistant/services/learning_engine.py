"""Tenant knowledge learning engine.

Phase 8.x: Capture short, durable tenant facts and store them as vector embeddings
for semantic retrieval (RAG).

This module is safe to import even when OpenAI is not configured.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from django.conf import settings

from tenant_apps.ai_assistant.models import TenantKnowledgeFact
from tenant_apps.ai_assistant.services.semantic_indexing import generate_embedding

logger = logging.getLogger(__name__)


def evaluate_and_extract(
    *,
    tenant: Any,
    domain: str,
    extracted_fact: str,
) -> Optional[TenantKnowledgeFact]:
    """Persist a new tenant knowledge fact with an embedding.

    Assumes `extracted_fact` has already passed any LLM gatekeeper/validation.

    Returns:
        The created TenantKnowledgeFact, or None if inputs are empty.
    """

    extracted_fact = (extracted_fact or '').strip()
    domain = (domain or '').strip()

    if not extracted_fact:
        return None

    try:
        vector = generate_embedding(extracted_fact)
        return TenantKnowledgeFact.objects.create(
            tenant=tenant,
            domain_category=domain,
            fact_text=extracted_fact,
            embedding=vector,
            embedding_vector=vector,
        )

    except Exception as e:
        logger.warning('Failed to generate embedding for extracted fact: %s', str(e), exc_info=True)
        return TenantKnowledgeFact.objects.create(
            tenant=tenant,
            domain_category=domain,
            fact_text=extracted_fact,
            embedding=None,
            embedding_vector=None,
        )

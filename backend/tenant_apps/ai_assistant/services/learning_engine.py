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

    extracted_fact = (extracted_fact or "").strip()
    domain = (domain or "").strip()

    if not extracted_fact:
        return None

    if not getattr(settings, "OPENAI_API_KEY", None):
        # Store the fact anyway; embedding can be backfilled later.
        return TenantKnowledgeFact.objects.create(
            tenant=tenant,
            domain_category=domain,
            fact_text=extracted_fact,
            embedding=None,
        )

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            organization=getattr(settings, "OPENAI_ORG_ID", None) or None,
        )

        # Generate mathematical embedding for the new fact
        response = client.embeddings.create(
            input=extracted_fact,
            model="text-embedding-3-small",
        )
        vector = response.data[0].embedding

        # Save fact with vector
        return TenantKnowledgeFact.objects.create(
            tenant=tenant,
            domain_category=domain,
            fact_text=extracted_fact,
            embedding=vector,
        )

    except Exception as e:
        logger.warning("Failed to generate embedding for extracted fact: %s", str(e), exc_info=True)
        return TenantKnowledgeFact.objects.create(
            tenant=tenant,
            domain_category=domain,
            fact_text=extracted_fact,
            embedding=None,
        )

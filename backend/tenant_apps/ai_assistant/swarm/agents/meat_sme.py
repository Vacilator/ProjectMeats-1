"""Meat Subject Matter Expert (SME) agent.

VectorMemory has been decommissioned.

We now use UniversalSearchService (keyword + operator search) to retrieve
lightweight tenant context to ground responses.

CRITICAL RULE:
- Retrieval MUST be tenant-scoped.
"""

from __future__ import annotations

import logging
from typing import List

from django.conf import settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are the ProjectMeats Subject Matter Expert for deep meat/logistics domain questions (yields, trim, shelf-life, cold chain). "
    "Use the provided tenant context to answer accurately, and do not hallucinate outside the provided context. "
    "If the user requests a transactional action (especially ingesting a Purchase Order from a document), do NOT invent an answer. "
    "Instead, respond with the exact intended tool plan: "
    "search for the supplier and items extracted from the PO; if supplier is missing, create it; "
    "if items/products are missing, align to the Tier-1 catalog (create only if allowed); "
    "then draft/create the Purchase Order using the standard create_purchase_order flow."
)


class MeatSMEAgent:
    """Domain expert agent backed by tenant-scoped Universal Search retrieval."""

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

        from apps.tenants.models import Tenant
        from apps.core.services.universal_search import UniversalSearchService

        tenant = Tenant.objects.filter(id=tenant_id).first()
        if not tenant:
            raise ValueError('Tenant not found')

        # Retrieve lightweight context via UniversalSearchService.
        service = UniversalSearchService(tenant=tenant)
        search_payload = service.search(query, limit_per_type=3)
        results = (search_payload or {}).get('results') or []

        context_blocks: List[str] = []
        for r in results[:12]:
            title = str(r.get('title') or '')
            subtitle = str(r.get('subtitle') or '') if r.get('subtitle') else ''
            route = str(r.get('route') or '')
            etype = str(r.get('type') or '')
            rid = str(r.get('id') or '')
            bits = [f"{etype}:{rid}", title]
            if subtitle:
                bits.append(f"({subtitle})")
            if route:
                bits.append(f"route={route}")
            context_blocks.append(" ".join(bits).strip())

        context_text = "\n".join(context_blocks) if context_blocks else "(no universal search context found)"

        openai = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            organization=getattr(settings, 'OPENAI_ORG_ID', None) or None,
        )

        user_payload = (
            "Tenant context (authoritative):\n"
            f"{context_text}\n\n"
            "User query:\n"
            f"{query}\n\n"
            "Instructions: Answer using ONLY the tenant context above. "
            "If the context is insufficient, say what is missing."
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

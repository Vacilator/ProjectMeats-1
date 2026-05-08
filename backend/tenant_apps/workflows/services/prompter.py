"""
AI Prompt Engineering Service

Loads golden prompt templates from /manifests/ai_standards and injects
runtime context for OpenAI API calls.

Usage:
    from workflows.services.prompter import AIPrompter

    prompter = AIPrompter()
    final_prompt = prompter.build_suggestion_prompt(
        tenant=tenant_obj,
        current_flow=flow_data,
        user_request="Add payment processing"
    )
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings

from pgvector.django import L2Distance

logger = logging.getLogger(__name__)


class AIPrompter:
    """
    Service for loading AI prompt templates and injecting dynamic context.

    Templates are stored in /manifests/ai_standards/ and contain:
    - System role definitions
    - Response format specifications
    - Constraint rules
    - Node type schemas
    """

    MANIFEST_DIR = Path(settings.BASE_DIR).parent / "manifests" / "ai_standards"
    DEFAULT_TEMPLATE = "suggestion_engine_v1.prompt"

    def __init__(self, template_name: Optional[str] = None):
        """
        Initialize prompter with specified template.

        Args:
            template_name: Name of prompt template file (defaults to suggestion_engine_v1.prompt)
        """
        self.template_name = template_name or self.DEFAULT_TEMPLATE
        self.template_path = self.MANIFEST_DIR / self.template_name
        self._template_cache = None

    def load_template(self) -> str:
        """
        Load prompt template from manifests directory.

        Returns:
            str: Raw template content

        Raises:
            FileNotFoundError: If template doesn't exist
        """
        if self._template_cache is None:
            if not self.template_path.exists():
                raise FileNotFoundError(
                    f"AI prompt template not found: {self.template_path}. "
                    f"Ensure /manifests/ai_standards/{self.template_name} exists."
                )

            with open(self.template_path, "r", encoding="utf-8") as f:
                self._template_cache = f.read()

        return self._template_cache

    def build_suggestion_prompt(
        self,
        tenant: Any,
        current_flow: Dict[str, Any],
        user_request: str = "",
        additional_context: Optional[Dict[str, Any]] = None,
        available_entities: Optional[List[str]] = None,
    ) -> str:
        """Build complete prompt by combining template with runtime context.

        Notes:
            This accepts both a direct ``user_request`` string and an optional
            ``additional_context`` dict. Some callers (e.g. Workflows views)
            provide only ``additional_context``.
        """
        template = self.load_template()

        additional_context = additional_context or {}
        effective_user_request = (user_request or additional_context.get("user_request") or "").strip()

        context = self._build_context(
            tenant=tenant,
            current_flow=current_flow,
            user_request=effective_user_request,
            additional_context=additional_context,
            available_entities=available_entities,
        )

        return f"{template}\n\n---\n\n## CURRENT REQUEST\n\n{json.dumps(context, indent=2)}"

    def _build_context(
        self,
        tenant: Any,
        current_flow: Dict[str, Any],
        user_request: str,
        additional_context: Optional[Dict[str, Any]] = None,
        available_entities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build context dictionary to inject into prompt."""
        # Extract existing nodes
        existing_nodes = current_flow.get("nodes", [])
        last_node = existing_nodes[-1] if existing_nodes else None

        # Determine tenant industry type from custom_data or default
        tenant_data = getattr(tenant, "custom_data", {}) or {}
        industry_type = tenant_data.get("industry_type", "wholesale")

        # Determine primary entities (default to common meat industry entities)
        if available_entities is None:
            available_entities = [
                "Supplier",
                "Customer",
                "Invoice",
                "Product",
                "Carrier",
                "PurchaseOrder",
                "ColdStorageEntry",
            ]

        additional_context = additional_context or {}

        context = {
            "tenant": {
                "name": tenant.name,
                "industry_type": industry_type,
                "primary_entities": available_entities[:3],
            },
            "current_flow": {
                "existing_nodes": [
                    {
                        "id": node.get("id"),
                        "type": node.get("type"),
                        "label": node.get("data", {}).get("label", "Untitled"),
                    }
                    for node in existing_nodes
                ],
                "last_node_type": last_node.get("type") if last_node else None,
            },
            "available_entities": available_entities,
            "user_request": user_request,
            "additional_context": additional_context,
            "tenant_knowledge_facts": self._retrieve_relevant_facts(
                tenant=tenant,
                current_flow=current_flow,
                additional_context=additional_context,
            ),
        }

        return context

    def _retrieve_relevant_facts(
        self,
        *,
        tenant: Any,
        current_flow: Dict[str, Any],
        additional_context: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Retrieve top-k tenant knowledge facts via semantic similarity.

        Safe-by-default: if OpenAI or pgvector are unavailable/misconfigured, this returns [].
        """

        if not getattr(settings, "OPENAI_API_KEY", None):
            return []

        try:
            from openai import OpenAI
            from tenant_apps.ai_assistant.models import TenantKnowledgeFact
        except Exception:
            return []

        try:
            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                organization=getattr(settings, "OPENAI_ORG_ID", None) or None,
            )

            # Convert user's context/question to vector
            query_input = f"{str(current_flow)} {str(additional_context)}"
            query_response = client.embeddings.create(
                input=query_input,
                model="text-embedding-3-small",
            )
            query_vector = query_response.data[0].embedding

            # Retrieve top 5 most semantically relevant facts
            facts = list(
                TenantKnowledgeFact.objects.filter(
                    tenant=tenant,
                    is_active=True,
                    embedding__isnull=False,
                )
                .annotate(distance=L2Distance("embedding", query_vector))
                .order_by("distance")[:5]
            )

            return [
                {
                    "domain_category": f.domain_category,
                    "fact_text": f.fact_text,
                }
                for f in facts
            ]
        except Exception as e:
            logger.warning("Failed to retrieve tenant knowledge facts: %s", str(e), exc_info=True)
            return []

    def parse_ai_response(self, raw_response: str) -> Dict[str, Any]:
        """
        Parse OpenAI response and validate structure.

        Args:
            raw_response: Raw text response from OpenAI

        Returns:
            dict: Parsed suggestions with validation

        Raises:
            ValueError: If response is not valid JSON or missing required fields
        """
        try:
            data = json.loads(raw_response)
        except json.JSONDecodeError as e:
            raise ValueError(f"AI response is not valid JSON: {e}")

        # Validate required fields
        if "suggestions" not in data:
            raise ValueError("AI response missing 'suggestions' field")

        if not isinstance(data["suggestions"], list):
            raise ValueError("'suggestions' must be a list")

        # Validate each suggestion
        required_fields = {"type", "label", "description", "reasoning", "priority"}
        for idx, suggestion in enumerate(data["suggestions"]):
            missing = required_fields - set(suggestion.keys())
            if missing:
                raise ValueError(f"Suggestion {idx} missing required fields: {missing}")

        # Enforce max 3 suggestions constraint
        if len(data["suggestions"]) > 3:
            data["suggestions"] = data["suggestions"][:3]
            data["_warning"] = "Trimmed to 3 suggestions (max allowed)"

        return data

    def build_supply_chain_template_prompt(
        self,
        tenant: Any,
        template_domain: str,
        current_flow: Dict[str, Any],
    ) -> str:
        """
        Build a prompt specifically for supply-chain template suggestions.

        Uses the dedicated ``supply_chain_templates_v1.prompt`` golden template
        so that OpenAI can return domain-appropriate node suggestions for
        cold-storage monitoring, quality inspection, or carrier compliance.

        Args:
            tenant: Tenant model instance
            template_domain: One of ``cold_storage_monitoring``,
                ``quality_inspection``, or ``carrier_compliance``
            current_flow: Current workflow state (nodes/edges)

        Returns:
            str: Complete prompt ready for OpenAI API
        """
        supply_chain_prompter = AIPrompter(template_name="supply_chain_templates_v1.prompt")
        template = supply_chain_prompter.load_template()

        context = self._build_context(
            tenant=tenant,
            current_flow=current_flow,
            user_request=f"Suggest next steps for a {template_domain.replace('_', ' ')} workflow",
        )
        context["template_domain"] = template_domain

        full_prompt = f"{template}\n\n---\n\n" f"## CURRENT REQUEST\n\n{json.dumps(context, indent=2)}"
        return full_prompt

    def get_fallback_suggestions(
        self,
        tenant: Any,
        current_flow: Dict[str, Any],
        template_domain: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate static fallback suggestions when AI is unavailable.

        Used for graceful degradation when:
        - OpenAI API key is missing
        - API is down or rate-limited
        - Connection errors occur

        Supports the three supply-chain template domains introduced in the
        Phase-7 template library expansion (cold_storage_monitoring,
        quality_inspection, carrier_compliance) in addition to the original
        industry-type fallbacks.

        Args:
            tenant: Tenant model instance
            current_flow: Current workflow state
            template_domain: Optional supply-chain template domain override.
                When supplied this takes precedence over ``industry_type``.

        Returns:
            dict: Static suggestions based on tenant type / template domain
        """
        # Supply-chain domain-specific fallbacks (new templates)
        if template_domain == "cold_storage_monitoring":
            suggestions = [
                {
                    "type": "actionHTTP",
                    "label": "Pull Sensor Readings",
                    "description": "Fetch temperature/humidity from IoT gateway",
                    "reasoning": "Live sensor data required for HACCP CCP log",
                    "priority": 1,
                },
                {
                    "type": "conditionIf",
                    "label": "Temperature Breach?",
                    "description": "Branch if reading exceeds 40°F or drops below 28°F",
                    "reasoning": "USDA cold-chain safe harbour thresholds",
                    "priority": 2,
                },
                {
                    "type": "actionEmail",
                    "label": "Alert QA Manager",
                    "description": "Notify cold-chain supervisor of breach",
                    "reasoning": "Immediate escalation required by FSMA",
                    "priority": 3,
                },
            ]
            return {
                "suggestions": suggestions,
                "confidence": 0.0,
                "mode": "static",
                "template_domain": template_domain,
                "alternative_approach": "Enable AI suggestions by configuring OpenAI API key",
            }

        if template_domain == "quality_inspection":
            suggestions = [
                {
                    "type": "FormStepSingle",
                    "label": "Enter Lot Details",
                    "description": "Capture lot number, weight, temp, and organoleptic scores",
                    "reasoning": "HACCP CCP data collection step",
                    "priority": 1,
                },
                {
                    "type": "conditionIf",
                    "label": "Passes Initial Check?",
                    "description": "Branch on temperature, appearance, and odor scores",
                    "reasoning": "Non-conforming lots require NCR and disposition workflow",
                    "priority": 2,
                },
                {
                    "type": "actionCreateRecord",
                    "label": "Raise NCR",
                    "description": "Create Non-Conformance Report with defect details",
                    "reasoning": "SQF/BRC audit trail requirement",
                    "priority": 3,
                },
            ]
            return {
                "suggestions": suggestions,
                "confidence": 0.0,
                "mode": "static",
                "template_domain": template_domain,
                "alternative_approach": "Enable AI suggestions by configuring OpenAI API key",
            }

        if template_domain == "carrier_compliance":
            suggestions = [
                {
                    "type": "actionHTTP",
                    "label": "Fetch Carrier Compliance Data",
                    "description": "Query FMCSA SAFER and Carrier411 for authority and score",
                    "reasoning": "DOT/FMCSA compliance check required before load assignment",
                    "priority": 1,
                },
                {
                    "type": "FormStepSingle",
                    "label": "Pre-Trip Inspection Checklist",
                    "description": "Reefer unit, seals, cleanliness, temperature recorder",
                    "reasoning": "Required before loading perishable freight",
                    "priority": 2,
                },
                {
                    "type": "actionCreateRecord",
                    "label": "Generate Bill of Lading",
                    "description": "Create BOL with load details, seal number, temp setpoints",
                    "reasoning": "Legal shipping document required for every load",
                    "priority": 3,
                },
            ]
            return {
                "suggestions": suggestions,
                "confidence": 0.0,
                "mode": "static",
                "template_domain": template_domain,
                "alternative_approach": "Enable AI suggestions by configuring OpenAI API key",
            }

        # Legacy industry-type fallbacks
        tenant_data = getattr(tenant, "custom_data", {}) or {}
        industry_type = tenant_data.get("industry_type", "wholesale")

        if industry_type == "processor":
            suggestions = [
                {
                    "type": "form",
                    "label": "Log Temperature",
                    "description": "Capture batch/lot temperature and time",
                    "reasoning": "USDA/HACCP data collection step",
                    "priority": 1,
                },
                {
                    "type": "conditionIf",
                    "label": "Temperature Breach?",
                    "description": "Branch if > 40°F (or tenant threshold)",
                    "reasoning": "Critical Control Point validation",
                    "priority": 2,
                },
                {
                    "type": "actionEmail",
                    "label": "Notify QA Manager",
                    "description": "Alert QA on breach",
                    "reasoning": "Immediate escalation required for compliance",
                    "priority": 3,
                },
            ]
        elif industry_type == "distributor":
            suggestions = [
                {
                    "type": "actionUpdateRecord",
                    "label": "Update Inventory",
                    "description": "Sync stock levels for the shipment",
                    "reasoning": "Maintain accurate counts",
                    "priority": 1,
                },
                {
                    "type": "actionEmail",
                    "label": "Notify Warehouse",
                    "description": "Send dispatch/ready-to-pick notification",
                    "reasoning": "Coordinate logistics",
                    "priority": 2,
                },
                {
                    "type": "endSuccess",
                    "label": "Complete",
                    "description": "Mark workflow complete",
                    "reasoning": "Close out the flow cleanly",
                    "priority": 3,
                },
            ]
        else:  # wholesale (default)
            suggestions = [
                {
                    "type": "form",
                    "label": "Enter Invoice Details",
                    "description": "Capture line items and totals",
                    "reasoning": "Required for payment / reconciliation",
                    "priority": 1,
                },
                {
                    "type": "dataTransform",
                    "label": "Calculate Total",
                    "description": "Compute totals (tax/fees) from line items",
                    "reasoning": "Normalize and validate amount fields",
                    "priority": 2,
                },
                {
                    "type": "pendingApproval",
                    "label": "Finance Review",
                    "description": "Wait for finance approval",
                    "reasoning": "Policy/compliance checkpoint",
                    "priority": 3,
                },
            ]

        return {
            "suggestions": suggestions,
            "confidence": 0.0,  # Static suggestions have no confidence score
            "mode": "static",  # Indicates fallback mode
            "alternative_approach": "Enable AI suggestions by configuring OpenAI API key",
        }

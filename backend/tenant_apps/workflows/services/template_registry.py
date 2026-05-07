"""Runtime registration for the EndToEndInquiryToPOProcess template (RT-01.1).

Loads the JSON template from disk and registers it as a system TenantForm
for a given tenant, including flow_data validation and telemetry setup.

Usage:
    from tenant_apps.workflows.services.template_registry import (
        register_e2e_template,
        get_e2e_template_data,
        validate_template_schema,
    )

    # Register for a specific tenant
    form = register_e2e_template(tenant)

    # Get raw template data
    data = get_e2e_template_data()
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from django.db import transaction

logger = logging.getLogger("trade")

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "process"
E2E_TEMPLATE_FILE = TEMPLATE_DIR / "end_to_end_inquiry_to_po.json"
E2E_TEMPLATE_NAME = "End-to-End Inquiry to PO Process"


def get_e2e_template_data() -> dict[str, Any]:
    """Load and return the raw JSON template data."""
    with open(E2E_TEMPLATE_FILE, "r") as f:
        return json.load(f)


def validate_template_schema(template_data: dict) -> list[str]:
    """Validate the template JSON structure.

    Returns a list of validation errors (empty = valid).
    """
    errors: list[str] = []

    if not template_data.get("templateId"):
        errors.append("Missing required field: templateId")
    if not template_data.get("name"):
        errors.append("Missing required field: name")
    if not template_data.get("triggers"):
        errors.append("Missing required field: triggers (at least 1 trigger required)")

    triggers = template_data.get("triggers", [])
    nodes = template_data.get("nodes", [])
    edges = template_data.get("edges", [])

    # Validate all triggers have precondition check
    for trigger in triggers:
        data = trigger.get("data", {})
        if not data.get("preconditionCheck"):
            errors.append(
                f"Trigger '{data.get('label', trigger.get('id'))}' missing preconditionCheck"
            )
        if not data.get("telemetryEvent"):
            errors.append(
                f"Trigger '{data.get('label', trigger.get('id'))}' missing telemetryEvent"
            )

    # Validate all nodes have telemetry events
    for node in nodes:
        data = node.get("data", {})
        if not data.get("telemetryEvent"):
            errors.append(
                f"Node '{data.get('label', node.get('id'))}' missing telemetryEvent"
            )

    # Validate edges reference existing nodes
    all_ids = {t["id"] for t in triggers} | {n["id"] for n in nodes}
    for edge in edges:
        if edge["source"] not in all_ids:
            errors.append(f"Edge '{edge['id']}' references unknown source: {edge['source']}")
        if edge["target"] not in all_ids:
            errors.append(f"Edge '{edge['id']}' references unknown target: {edge['target']}")

    # Validate required node types exist
    node_types = {n.get("type") for n in nodes}
    required_types = {"loop", "action", "condition", "end", "group"}
    missing_types = required_types - node_types
    if missing_types:
        errors.append(f"Missing required node types: {missing_types}")

    return errors


def register_e2e_template(tenant, *, force: bool = False) -> Any:
    """Register the EndToEndInquiryToPOProcess template for a tenant.

    Args:
        tenant: Tenant model instance.
        force: If True, update existing template. If False, skip if exists.

    Returns:
        The created/updated TenantForm instance.
    """
    from tenant_apps.workflows.models import TenantForm, WorkflowStatus

    template_data = get_e2e_template_data()

    # Validate before registration
    errors = validate_template_schema(template_data)
    if errors:
        raise ValueError(f"Template validation failed: {errors}")

    # Build flow_data from template (combine triggers + nodes for React Flow)
    flow_data = {
        "nodes": template_data["triggers"] + template_data["nodes"],
        "edges": template_data["edges"],
        "metadata": template_data["metadata"],
    }

    with transaction.atomic():
        existing = TenantForm.objects.filter(
            tenant=tenant,
            name=E2E_TEMPLATE_NAME,
            is_system_template=True,
        ).first()

        if existing and not force:
            logger.info(
                f"E2E template already registered for tenant {tenant.slug}",
                extra={"tenant_id": str(tenant.pk)},
            )
            return existing

        if existing and force:
            existing.flow_data = flow_data
            existing.description = template_data["description"]
            existing.save(update_fields=["flow_data", "description", "updated_at"])
            logger.info(
                f"E2E template updated for tenant {tenant.slug}",
                extra={"tenant_id": str(tenant.pk)},
            )
            return existing

        form = TenantForm.objects.create(
            tenant=tenant,
            name=E2E_TEMPLATE_NAME,
            description=template_data["description"],
            status=WorkflowStatus.ACTIVE,
            is_system_template=True,
            is_default=False,
            is_quick_action_enabled=True,
            icon="git-merge",
            flow_data=flow_data,
        )

        logger.info(
            f"E2E template registered for tenant {tenant.slug}",
            extra={"tenant_id": str(tenant.pk), "form_id": str(form.pk)},
        )
        return form

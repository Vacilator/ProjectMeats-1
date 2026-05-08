from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import UUID

from apps.system.services.node_registry import get_registry

WORKFORM_SCHEMA_VERSION = "workform-node-registry-v1"

EXPLICIT_NODE_TYPE_ALIASES: dict[str, str] = {
    "actionHttp": "actionHTTP",
    "formStep": "form",
    "formStepSingle": "form",
    "formStepSingleNode": "form",
    "formMultiStepContainer": "formProcess",
    "formProcessGroup": "formProcess",
    "formBook": "formProcess",
}


def _is_uuid_like(value: Any) -> bool:
    if value in (None, ""):
        return False
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _canonical_node_type(raw_type: Any) -> str:
    value = str(raw_type or "").strip()
    if not value:
        return ""

    registry_aliases = get_registry()["aliases"]
    if value in EXPLICIT_NODE_TYPE_ALIASES:
        return EXPLICIT_NODE_TYPE_ALIASES[value]
    return str(registry_aliases.get(value, value))


def upgrade_workform_definition(definition: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """Upgrade a WorkForm workflow_definition to the current additive schema."""

    if not isinstance(definition, dict):
        return {"nodes": [], "edges": [], "schemaVersion": WORKFORM_SCHEMA_VERSION}, {
            "changed": True,
            "changed_nodes": 0,
            "type_changes": [],
            "aliased_form_refs": 0,
            "schema_version_set": True,
        }

    upgraded = deepcopy(definition)
    nodes = upgraded.get("nodes")
    if not isinstance(nodes, list):
        nodes = []
        upgraded["nodes"] = nodes

    changed = False
    changed_nodes = 0
    type_changes: list[dict[str, str]] = []
    aliased_form_refs = 0

    for node in nodes:
        if not isinstance(node, dict):
            continue

        raw_type = node.get("type")
        canonical_type = _canonical_node_type(raw_type)
        if canonical_type and canonical_type != raw_type:
            node["type"] = canonical_type
            changed = True
            changed_nodes += 1
            type_changes.append(
                {
                    "node_id": str(node.get("id") or ""),
                    "from": str(raw_type or ""),
                    "to": canonical_type,
                }
            )

        data = node.get("data")
        if not isinstance(data, dict):
            data = {}
            node["data"] = data

        if canonical_type and data.get("nodeType") != canonical_type:
            data["nodeType"] = canonical_type
            changed = True

        if (
            canonical_type in {"form", "formProcess"}
            and _is_uuid_like(data.get("formId"))
            and not _is_uuid_like(data.get("tenantFormId"))
        ):
            data["tenantFormId"] = str(data["formId"])
            aliased_form_refs += 1
            changed = True

    schema_version_set = upgraded.get("schemaVersion") != WORKFORM_SCHEMA_VERSION
    if schema_version_set:
        upgraded["schemaVersion"] = WORKFORM_SCHEMA_VERSION
        changed = True

    return upgraded, {
        "changed": changed,
        "changed_nodes": changed_nodes,
        "type_changes": type_changes,
        "aliased_form_refs": aliased_form_refs,
        "schema_version_set": schema_version_set,
    }

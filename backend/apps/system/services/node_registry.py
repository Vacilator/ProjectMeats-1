"""apps.system.services.node_registry

WorkForms "single source of truth" (SSOT) for node type metadata.

This registry is intentionally additive and versioned.

Goals:
- Provide a canonical list of supported node types + execution handler mapping.
- Serve metadata to the frontend so the editor can hydrate config UIs dynamically.

NOTE: v1 focuses on runtime capability metadata (not full UI schemas).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Literal, Optional

NodeCategory = Literal["trigger", "control", "action", "form", "terminal"]


@dataclass(frozen=True)
class NodeDefinition:
    node_type: str
    category: NodeCategory
    label: str
    description: str = ""
    # Execution mapping (WorkForms runtime)
    action_type: Optional[str] = None
    # Backward-compatible aliases that should be treated as this node type.
    aliases: tuple[str, ...] = ()


def get_registry(*, version: str = "v1") -> Dict[str, Any]:
    """Return the WorkForms node registry payload.

    Versioning approach:
    - Additive-only changes within a version.
    - If a breaking shape change is needed, introduce v2 and keep v1 available.
    """

    if version != "v1":
        raise ValueError(f"Unsupported registry version: {version}")

    nodes = [
        NodeDefinition(
            node_type="triggerManual",
            category="trigger",
            label="Manual Trigger",
            description="Start execution manually from Quick Actions or Catalog.",
        ),
        NodeDefinition(
            node_type="triggerEvent",
            category="trigger",
            label="Entity Event Trigger",
            description="Start execution on an entity lifecycle event (create/update/etc).",
        ),
        NodeDefinition(
            node_type="formStep",
            category="form",
            label="Form Step",
            description="Collect user input via a tenant form during execution.",
        ),
        NodeDefinition(
            node_type="conditionIf",
            category="control",
            label="Condition",
            description="Branch based on an evaluated expression.",
            aliases=("ConditionIfNode",),
        ),
        NodeDefinition(
            node_type="parallelPath",
            category="control",
            label="Parallel Path",
            description="Execute multiple outgoing branches concurrently.",
            aliases=("ParallelPathNode",),
        ),
        NodeDefinition(
            node_type="actionNotify",
            category="action",
            label="Notify",
            description="Send an in-app notification.",
            action_type="send_notification",
            aliases=("actionNotification", "notify"),
        ),
        NodeDefinition(
            node_type="actionCreateRecord",
            category="action",
            label="Create Record",
            description="Create an entity record (schema-driven).",
            action_type="create_record",
        ),
        NodeDefinition(
            node_type="actionUpdateRecord",
            category="action",
            label="Update Record",
            description="Update an entity record (schema-driven).",
            action_type="update_record",
        ),
        NodeDefinition(
            node_type="actionHTTP",
            category="action",
            label="HTTP Request",
            description="Call an external HTTP endpoint (supports retry/DLQ).",
            action_type="http_request",
        ),
        NodeDefinition(
            node_type="end",
            category="terminal",
            label="End",
            description="Terminate execution.",
            aliases=("terminal", "terminalEnd", "endNode"),
        ),
    ]

    node_map: Dict[str, Any] = {n.node_type: asdict(n) for n in nodes}

    # Flatten aliases into a lookup for normalization.
    aliases: Dict[str, str] = {}
    for n in nodes:
        for a in n.aliases:
            aliases[str(a)] = n.node_type

    return {
        "version": version,
        "nodes": node_map,
        "aliases": aliases,
    }

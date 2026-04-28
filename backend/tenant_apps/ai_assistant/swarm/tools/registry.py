"""Tool registry for PM-AS Executor.

Phase 8.0 scaffolding:
- Register internal Python callables as "tools" with JSON schemas.
- Export an OpenAPI-like document for agent consumption.

This intentionally avoids new dependencies (pydantic, drf-spectacular, etc.).
"""

from __future__ import annotations

import inspect
import types
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Union, get_args, get_origin


def _json_schema_for_type(tp: Any) -> Dict[str, Any]:
    origin = get_origin(tp)
    args = get_args(tp)

    if tp in (str,):
        return {"type": "string"}
    if tp in (int,):
        return {"type": "integer"}
    if tp in (float,):
        return {"type": "number"}
    if tp in (bool,):
        return {"type": "boolean"}
    if tp is None:
        return {"type": "null"}

    if origin in (list, List):
        return {"type": "array", "items": _json_schema_for_type(args[0] if args else Any)}

    if origin in (dict, Dict):
        return {"type": "object"}

    # Optional[T] / Union[T, None] / T | None
    union_type = getattr(types, 'UnionType', None)
    if origin in {Union, union_type}:
        non_null = [a for a in args if a is not type(None)]  # noqa: E721
        if non_null:
            return _json_schema_for_type(non_null[0])
        return {"type": "object"}

    return {"type": "object"}


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters_schema: Dict[str, Any]


class ToolRegistry:
    """Registry for callable tools."""

    def __init__(self):
        self._tools: Dict[str, ToolSpec] = {}
        self._callables: Dict[str, Callable[..., Any]] = {}

    def register(self, fn: Callable[..., Any], *, name: Optional[str] = None, description: str = "") -> Callable[..., Any]:
        tool_name = name or fn.__name__
        sig = inspect.signature(fn)

        props: Dict[str, Any] = {}
        required: List[str] = []

        for param_name, p in sig.parameters.items():
            if p.kind in (p.VAR_POSITIONAL, p.VAR_KEYWORD):
                continue

            ann = p.annotation if p.annotation is not inspect._empty else Any
            props[param_name] = _json_schema_for_type(ann)

            if p.default is inspect._empty:
                required.append(param_name)

        schema = {
            "type": "object",
            "properties": props,
            "required": required,
            "additionalProperties": False,
        }

        spec = ToolSpec(name=tool_name, description=description or (fn.__doc__ or "").strip(), parameters_schema=schema)
        self._tools[tool_name] = spec
        self._callables[tool_name] = fn
        return fn

    def get(self, name: str) -> ToolSpec:
        return self._tools[name]

    def list(self) -> List[ToolSpec]:
        return list(self._tools.values())

    def to_openapi(self) -> Dict[str, Any]:
        """Export a small OpenAPI-ish schema document."""

        paths: Dict[str, Any] = {}
        for spec in self._tools.values():
            paths[f"/tools/{spec.name}"] = {
                "post": {
                    "operationId": spec.name,
                    "summary": spec.description[:80] if spec.description else spec.name,
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": spec.parameters_schema}},
                    },
                    "responses": {
                        "200": {
                            "description": "Tool execution result",
                            "content": {"application/json": {"schema": {"type": "object"}}},
                        }
                    },
                }
            }

        return {
            "openapi": "3.0.0",
            "info": {"title": "ProjectMeats Swarm Tools", "version": "0.1.0"},
            "paths": paths,
        }


registry = ToolRegistry()


# Example scaffolds (internal functions would be registered here)
@registry.register
def create_purchase_order(customer_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Create a purchase order (scaffold)."""

    return {"status": "not_implemented", "customer_id": customer_id, "items": items}


@registry.register
def update_claim_status(claim_id: str, status: str) -> Dict[str, Any]:
    """Update claim status (scaffold)."""

    return {"status": "not_implemented", "claim_id": claim_id, "new_status": status}


@registry.register
def get_record_detail(entity_type: str, entity_id: str) -> Dict[str, Any]:
    """Fetch a lightweight record detail payload.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "entity_type": entity_type, "entity_id": entity_id}


@registry.register
def get_entity_details(type: str, id: str) -> Dict[str, Any]:
    """Fetch full entity details payload (maps to EntityViewSet.retrieve)."""

    return {"status": "available_via_chat", "type": type, "id": id}


@registry.register
def create_task(title: str, message: str, entity_type: str | None = None, entity_id: str | None = None) -> Dict[str, Any]:
    """Create a user-visible task (implemented as an in-app notification).

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "title": title}


@registry.register
def create_in_app_notification(
    title: str,
    message: str,
    notification_type: str | None = None,
    priority: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    action_url: str | None = None,
    metadata: Dict[str, Any] | None = None,
    to_tenant_admins: bool | None = None,
    user_id: str | None = None,
    user_ids: List[str] | None = None,
    username: str | None = None,
    usernames: List[str] | None = None,
) -> Dict[str, Any]:
    """Create an in-app notification for one or more users in the current tenant.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "title": title}


@registry.register
def get_recent_errors() -> Dict[str, Any]:
    """Fetch recent Sentry issues for the active tenant (last 5).

    Tenant scoping is injected server-side from the authenticated session.
    """

    return {"status": "available_via_chat"}


@registry.register
def get_entity_schema(entity_type: str) -> Dict[str, Any]:
    """Get the UI-friendly schema for an entity type.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "entity_type": entity_type}


@registry.register
def save_memory(key: str, memory_text: str, memory_json: Dict[str, Any] | None = None, tags: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Upsert a durable tenant memory rule/preference (tenant-scoped)."""

    return {"status": "available_via_chat", "key": key}


@registry.register
def retrieve_memory(query: str, limit: int | None = None) -> Dict[str, Any]:
    """Retrieve relevant durable tenant memory entries for a query."""

    return {"status": "available_via_chat", "query": query, "limit": limit}


@registry.register
def create_entity(entity_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a tenant-scoped entity via internal DRF viewsets (allowlisted).

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "entity_type": entity_type}


@registry.register
def parse_document(file_id_or_url: str) -> Dict[str, Any]:
    """Parse an uploaded document into text + structured elements.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "file_id_or_url": file_id_or_url}


@registry.register
def ingest_email_attachment(message_id: str, attachment_id: str, file_name: str) -> Dict[str, Any]:
    """Download an Outlook attachment into AIDocument storage for parsing."""

    return {
        "status": "available_via_chat",
        "message_id": message_id,
        "attachment_id": attachment_id,
        "file_name": file_name,
    }


@registry.register
def trigger_workform(workflow_id: str, initial_data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Trigger a TenantWorkForm execution.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "workflow_id": workflow_id}


@registry.register
def draft_vendor_email(vendor_id: str, context: str, vendor_type: str | None = None) -> Dict[str, Any]:
    """Draft and store an outbound vendor email as a Draft (human-in-the-loop send)."""

    return {"status": "available_via_chat", "vendor_id": vendor_id}


@registry.register
def create_record(entity: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a tenant-scoped record.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "entity": entity}


@registry.register
def search_entities(query: str, entity_types: List[str] | None = None, limit: int = 5) -> Dict[str, Any]:
    """Search tenant entities via Universal Search (unified search standard)."""

    return {"status": "available_via_chat", "query": query, "entity_types": entity_types, "limit": limit}


@registry.register
def get_entity_analytics(entity_type: str, metric: str, days: int | None = None, limit: int | None = None) -> Dict[str, Any]:
    """Run a tenant-scoped analytics aggregation (see get_entity_analytics tool in chat)."""

    return {"status": "available_via_chat", "entity_type": entity_type, "metric": metric, "days": days, "limit": limit}


@registry.register
def get_recent_activity(entity_type: str, entity_id: str, limit: int = 10) -> Dict[str, Any]:
    """Fetch recent ActivityLog entries for an entity.

    Executed via the Swarm tool loop in /api/v1/ai-assistant/chat/.
    """

    return {"status": "available_via_chat", "entity_type": entity_type, "entity_id": entity_id, "limit": limit}

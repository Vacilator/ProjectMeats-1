"""Tool registry for PM-AS Executor.

Phase 8.0 scaffolding:
- Register internal Python callables as "tools" with JSON schemas.
- Export an OpenAPI-like document for agent consumption.

This intentionally avoids new dependencies (pydantic, drf-spectacular, etc.).
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, get_args, get_origin


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

    # Optional[T] / Union[T, None]
    if origin is Optional or (origin is Union := getattr(__import__('typing'), 'Union', None)):
        # best-effort
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

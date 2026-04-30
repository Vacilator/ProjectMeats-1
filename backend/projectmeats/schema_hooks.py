"""drf-spectacular schema hooks for OpenAPI compatibility."""

from __future__ import annotations

from copy import deepcopy


def add_openapi_compat_aliases(result, generator, request, public):
    """Restore legacy schema component aliases required by the baseline."""
    schemas = result.get("components", {}).get("schemas", {})

    if "TypeOfProteinEnum" in schemas and "ProteinEnum" not in schemas:
        schemas["ProteinEnum"] = deepcopy(schemas["TypeOfProteinEnum"])

    return result

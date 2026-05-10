#!/usr/bin/env python3
"""OpenAPI back-compat checker.

This is a lightweight, dependency-free guardrail intended for CI.
It compares a committed baseline spec against a generated candidate spec and
fails on common *breaking* changes:
- removed paths or HTTP methods
- removed component schemas
- removed schema properties
- newly-required fields (required set expanded)
- removed enum values

Additive changes (new endpoints, new optional fields) are allowed.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

HTTP_METHODS: Set[str] = {
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "options",
    "head",
    "trace",
}
PATH_PARAMETER_PATTERN = re.compile(r"\{[^}/]+\}")


def _load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _ref_to_schema_name(ref: str) -> Optional[str]:
    prefix = "#/components/schemas/"
    if not ref.startswith(prefix):
        return None
    return ref[len(prefix) :]


def _normalize_openapi_path(path: str) -> str:
    """Treat path-template parameter renames as non-breaking."""

    return PATH_PARAMETER_PATTERN.sub("{}", path)


def _resolve_ref(spec: Dict[str, Any], schema: Any, *, seen: Set[str]) -> Any:
    if not isinstance(schema, dict):
        return schema

    ref = schema.get("$ref")
    if not isinstance(ref, str):
        return schema

    name = _ref_to_schema_name(ref)
    if not name:
        return schema

    if name in seen:
        return schema

    comps = spec.get("components") or {}
    schemas = comps.get("schemas") or {}
    target = schemas.get(name)
    if not isinstance(target, dict):
        return schema

    seen.add(name)
    return _resolve_ref(spec, target, seen=seen)


def _iter_baseline_operations(paths_obj: Dict[str, Any]) -> Iterable[Tuple[str, str]]:
    for path, item in (paths_obj or {}).items():
        if not isinstance(item, dict):
            continue
        for method in item.keys():
            m = method.lower()
            if m in HTTP_METHODS:
                yield path, m


def _compare_paths(baseline: Dict[str, Any], candidate: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    b_paths = baseline.get("paths") or {}
    c_paths = candidate.get("paths") or {}

    if not isinstance(b_paths, dict) or not isinstance(c_paths, dict):
        return ["Invalid OpenAPI structure: missing or non-object 'paths'"]

    normalized_candidate_paths = {
        _normalize_openapi_path(path): item
        for path, item in c_paths.items()
        if isinstance(path, str) and isinstance(item, dict)
    }

    for path, method in _iter_baseline_operations(b_paths):
        c_item = c_paths.get(path)
        if not isinstance(c_item, dict):
            c_item = normalized_candidate_paths.get(_normalize_openapi_path(path))
        if not isinstance(c_item, dict):
            errors.append(f"Missing path: {path}")
            continue
        if method not in {k.lower(): k for k in c_item.keys() if isinstance(k, str)}:
            errors.append(f"Missing operation: {method.upper()} {path}")

    return errors


def _compare_schema_objects(
    baseline_spec: Dict[str, Any],
    candidate_spec: Dict[str, Any],
    baseline_schema: Any,
    candidate_schema: Any,
    *,
    pointer: str,
) -> List[str]:
    """Recursive compatibility checks for JSON-schema-ish objects."""

    errors: List[str] = []

    b = _resolve_ref(baseline_spec, baseline_schema, seen=set())
    c = _resolve_ref(candidate_spec, candidate_schema, seen=set())

    if not isinstance(b, dict) or not isinstance(c, dict):
        return errors

    # Enum: removing enum values is breaking.
    b_enum = b.get("enum")
    if isinstance(b_enum, list):
        c_enum = c.get("enum")
        if not isinstance(c_enum, list):
            errors.append(f"{pointer}: enum removed")
        else:
            missing = [v for v in b_enum if v not in c_enum]
            if missing:
                errors.append(f"{pointer}: enum values removed: {missing}")

    # Object properties: removing properties is breaking.
    b_props = b.get("properties")
    if isinstance(b_props, dict):
        c_props = c.get("properties")
        if not isinstance(c_props, dict):
            errors.append(f"{pointer}: properties removed")
            return errors

        for prop_name, b_prop_schema in b_props.items():
            if prop_name not in c_props:
                errors.append(f"{pointer}: property removed: {prop_name}")
                continue
            errors.extend(
                _compare_schema_objects(
                    baseline_spec,
                    candidate_spec,
                    b_prop_schema,
                    c_props[prop_name],
                    pointer=f"{pointer}.properties.{prop_name}",
                )
            )

        # Required set expansion is breaking.
        b_required = b.get("required")
        c_required = c.get("required")
        b_req = set(b_required) if isinstance(b_required, list) else set()
        c_req = set(c_required) if isinstance(c_required, list) else set()

        newly_required = sorted(c_req - b_req)
        if newly_required:
            errors.append(f"{pointer}: newly required fields: {newly_required}")

    # Arrays: compare items.
    if b.get("type") == "array" and isinstance(b.get("items"), (dict, list)):
        if c.get("type") == "array" and isinstance(c.get("items"), (dict, list)):
            errors.extend(
                _compare_schema_objects(
                    baseline_spec,
                    candidate_spec,
                    b.get("items"),
                    c.get("items"),
                    pointer=f"{pointer}.items",
                )
            )

    # NOTE: We intentionally do not deeply compare oneOf/anyOf/allOf because
    # spectacular may reshape compositions. Path/method presence + components
    # presence + property/required/enum checks catch the highest-signal breaks.

    return errors


def _compare_components(baseline: Dict[str, Any], candidate: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    b_components = baseline.get("components") or {}
    c_components = candidate.get("components") or {}

    b_schemas = (b_components.get("schemas") or {}) if isinstance(b_components, dict) else {}
    c_schemas = (c_components.get("schemas") or {}) if isinstance(c_components, dict) else {}

    if not isinstance(b_schemas, dict) or not isinstance(c_schemas, dict):
        return errors

    for schema_name, b_schema in b_schemas.items():
        if schema_name not in c_schemas:
            errors.append(f"Missing component schema: {schema_name}")
            continue
        errors.extend(
            _compare_schema_objects(
                baseline,
                candidate,
                b_schema,
                c_schemas[schema_name],
                pointer=f"components.schemas.{schema_name}",
            )
        )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Check OpenAPI candidate for breaking changes vs baseline")
    parser.add_argument("--baseline", required=True, help="Path to baseline OpenAPI JSON")
    parser.add_argument("--candidate", required=True, help="Path to candidate OpenAPI JSON")
    args = parser.parse_args()

    baseline_path = Path(args.baseline)
    candidate_path = Path(args.candidate)

    baseline = _load_json(baseline_path)
    candidate = _load_json(candidate_path)

    errors: List[str] = []
    errors.extend(_compare_paths(baseline, candidate))
    errors.extend(_compare_components(baseline, candidate))

    if errors:
        print("OpenAPI back-compat check failed (breaking changes detected):")
        for e in errors[:200]:
            print(f"- {e}")
        if len(errors) > 200:
            print(f"... and {len(errors) - 200} more")
        return 1

    print("OpenAPI back-compat check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

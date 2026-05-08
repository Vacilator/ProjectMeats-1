"""Serializer-backed document extraction for AI document drafts."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import models
from rest_framework import serializers

from tenant_apps.ai_assistant.models import AIDocument
from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
from tenant_apps.carriers.serializers import CarrierSerializer
from tenant_apps.customers.serializers import CustomerSerializer
from tenant_apps.invoices.serializers import InvoiceSerializer
from tenant_apps.purchase_orders.serializers import CarrierPurchaseOrderSerializer, PurchaseOrderSerializer
from tenant_apps.sales_orders.serializers import SalesOrderSerializer
from tenant_apps.suppliers.serializers import SupplierSerializer

from apps.system.services.ai_model_resolver import get_active_openai_model_id

EXTRACT_TO_SCHEMA_ENTITY_ALIASES: dict[str, str] = {
    "carrier": "carrier",
    "carriers": "carrier",
    "customer": "customer",
    "customers": "customer",
    "supplier": "supplier",
    "suppliers": "supplier",
    "purchase_order": "purchase_order",
    "purchase_orders": "purchase_order",
    "purchase-order": "purchase_order",
    "purchase-orders": "purchase_order",
    "sales_order": "sales_order",
    "sales_orders": "sales_order",
    "sales-order": "sales_order",
    "sales-orders": "sales_order",
    "invoice": "invoice",
    "invoices": "invoice",
    "carrier_po": "carrier_po",
    "carrier-pos": "carrier_po",
    "carrier_pos": "carrier_po",
    "carrier_purchase_order": "carrier_po",
    "carrier_purchase_orders": "carrier_po",
}

EXTRACT_TO_SCHEMA_SERIALIZERS: dict[str, type[serializers.Serializer]] = {
    "carrier": CarrierSerializer,
    "customer": CustomerSerializer,
    "supplier": SupplierSerializer,
    "purchase_order": PurchaseOrderSerializer,
    "sales_order": SalesOrderSerializer,
    "invoice": InvoiceSerializer,
    "carrier_po": CarrierPurchaseOrderSerializer,
}

EXTRACT_TO_SCHEMA_CHOICES: tuple[tuple[str, str], ...] = tuple(
    (key, key.replace("_", " ").title()) for key in EXTRACT_TO_SCHEMA_SERIALIZERS
)


class ExtractToSchemaError(ValueError):
    """Stable extraction error for operator-facing API responses."""

    def __init__(self, message: str, *, code: str = "EXTRACT_TO_SCHEMA_FAILED"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ExtractedSchemaDraft:
    """Validated extraction payload returned to the API layer."""

    document: AIDocument
    entity_type: str
    serializer_name: str
    parser: str
    model_name: str
    warnings: list[str]
    data: dict[str, Any]


def normalize_extract_entity_type(entity_type: str) -> str:
    normalized = str(entity_type or "").strip().lower()
    if not normalized:
        raise ExtractToSchemaError("entity_type is required", code="ENTITY_TYPE_REQUIRED")

    canonical = EXTRACT_TO_SCHEMA_ENTITY_ALIASES.get(normalized)
    if not canonical:
        raise ExtractToSchemaError(
            f'Unsupported entity_type "{entity_type}"',
            code="UNSUPPORTED_ENTITY_TYPE",
        )
    return canonical


def get_extract_serializer_class(entity_type: str) -> type[serializers.Serializer]:
    return EXTRACT_TO_SCHEMA_SERIALIZERS[normalize_extract_entity_type(entity_type)]


def get_extract_document(*, document_id: Any, tenant: Any, user: Any) -> AIDocument:
    document = (
        AIDocument.objects.select_related("tenant", "owner").filter(id=document_id, tenant=tenant, owner=user).first()
    )
    if not document:
        raise LookupError("Document not found")
    return document


def extract_document_to_schema(
    *, document: AIDocument, entity_type: str, tenant: Any, user: Any
) -> ExtractedSchemaDraft:
    """Parse a tenant-safe document and extract a serializer-valid draft payload."""

    serializer_class = get_extract_serializer_class(entity_type)
    openai_api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        raise ExtractToSchemaError("OpenAI is not configured on the server.", code="AI_NOT_CONFIGURED")

    parser_result = ToolExecutor()._parse_document(
        {"file_id_or_url": str(document.id)},
        tenant=tenant,
        user=user,
    )
    extracted_text = str(parser_result.get("text") or "").strip()
    if not extracted_text:
        raise ExtractToSchemaError(
            "The document parser did not return readable text.",
            code="DOCUMENT_PARSE_EMPTY",
        )

    serializer = serializer_class()
    response_schema = {
        "type": "json_schema",
        "json_schema": {
            "name": f"{normalize_extract_entity_type(entity_type)}_draft",
            "strict": True,
            "schema": build_json_schema_from_serializer(serializer),
        },
    }
    prompt = (
        "Extract a draft payload for the requested business entity.\n"
        "Rules:\n"
        "1. Output JSON only.\n"
        "2. Follow the provided JSON schema exactly.\n"
        "3. Do not invent enum values.\n"
        "4. Omit or use null for unknown values.\n"
        "5. For foreign-key ids you cannot know from the document, use null.\n"
        "6. Preserve line-item ordering from the document when possible.\n"
        f"Entity type: {normalize_extract_entity_type(entity_type)}\n\n"
        f"Document text:\n{extracted_text}"
    )

    from openai import OpenAI

    client = OpenAI(
        api_key=openai_api_key,
        organization=getattr(settings, "OPENAI_ORG_ID", None) or None,
    )
    completion = client.chat.completions.create(
        model=get_active_openai_model_id(fallback="gpt-4o-mini"),
        messages=[
            {
                "role": "system",
                "content": "You extract business document data into strict, schema-safe JSON drafts.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        response_format=response_schema,
    )
    message = completion.choices[0].message if completion.choices else None
    content = str(getattr(message, "content", "") or "").strip()
    if not content:
        raise ExtractToSchemaError(
            "The AI extraction service returned an empty response.",
            code="AI_EXTRACTION_EMPTY",
        )

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ExtractToSchemaError(
            "The AI extraction service returned invalid JSON.",
            code="AI_EXTRACTION_INVALID_JSON",
        ) from exc

    if not isinstance(parsed, dict):
        raise ExtractToSchemaError(
            "The AI extraction service returned an unexpected response shape.",
            code="AI_EXTRACTION_INVALID_SHAPE",
        )

    validator = serializer_class(data=parsed)
    validator.is_valid(raise_exception=True)

    return ExtractedSchemaDraft(
        document=document,
        entity_type=normalize_extract_entity_type(entity_type),
        serializer_name=serializer_class.__name__,
        parser=str(parser_result.get("parser") or ""),
        model_name=get_active_openai_model_id(fallback="gpt-4o-mini"),
        warnings=[str(item) for item in parser_result.get("warnings") or [] if str(item).strip()],
        data=to_json_compatible(dict(validator.validated_data)),
    )


def build_json_schema_from_serializer(serializer: serializers.Serializer) -> dict[str, Any]:
    """Create a strict JSON schema from writable DRF serializer fields."""

    properties: dict[str, Any] = {}
    required: list[str] = []

    for name, field in serializer.fields.items():
        if field.read_only:
            continue

        properties[name] = _build_field_schema(field)
        if field.required:
            required.append(name)

    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


def _build_field_schema(field: serializers.Field) -> dict[str, Any]:
    if isinstance(field, serializers.ListSerializer):
        schema = {
            "type": "array",
            "items": _build_field_schema(field.child),
        }
        return _apply_nullability(schema, field)

    if isinstance(field, serializers.Serializer):
        schema = build_json_schema_from_serializer(field)
        return _apply_nullability(schema, field)

    if isinstance(field, serializers.ChoiceField):
        values = [choice for choice in field.choices.keys() if choice not in ("", None)]
        schema = {"type": "string", "enum": [str(value) for value in values]}
        return _apply_nullability(schema, field)

    if isinstance(field, serializers.BooleanField):
        return _apply_nullability({"type": "boolean"}, field)

    if isinstance(
        field,
        (
            serializers.IntegerField,
            serializers.PrimaryKeyRelatedField,
            serializers.SlugRelatedField,
            serializers.UUIDField,
        ),
    ):
        return _apply_nullability({"type": "string"}, field)

    if isinstance(field, (serializers.DecimalField, serializers.FloatField)):
        return _apply_nullability({"type": "number"}, field)

    if isinstance(field, serializers.DateTimeField):
        return _apply_nullability({"type": "string", "format": "date-time"}, field)

    if isinstance(field, serializers.DateField):
        return _apply_nullability({"type": "string", "format": "date"}, field)

    if isinstance(field, serializers.EmailField):
        return _apply_nullability({"type": "string", "format": "email"}, field)

    if isinstance(field, serializers.URLField):
        return _apply_nullability({"type": "string", "format": "uri"}, field)

    if isinstance(field, serializers.JSONField):
        return _apply_nullability({"type": "object"}, field)

    schema: dict[str, Any] = {"type": "string"}
    max_length = getattr(field, "max_length", None)
    if isinstance(max_length, int) and max_length > 0:
        schema["maxLength"] = max_length
    if not getattr(field, "allow_blank", False) and getattr(field, "required", False):
        schema["minLength"] = 1

    return _apply_nullability(schema, field)


def _apply_nullability(schema: dict[str, Any], field: serializers.Field) -> dict[str, Any]:
    if getattr(field, "allow_null", False):
        return {"anyOf": [schema, {"type": "null"}]}
    return schema


def to_json_compatible(value: Any) -> Any:
    """Convert serializer validated data into a JSON-safe response payload."""

    if isinstance(value, dict):
        return {str(key): to_json_compatible(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_json_compatible(item) for item in value]
    if isinstance(value, tuple):
        return [to_json_compatible(item) for item in value]
    if isinstance(value, models.Model):
        return str(value.pk)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value

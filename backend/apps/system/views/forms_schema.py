"""Form schema endpoints for metadata-driven UI.

This is the first step of the V3.0 Final Push (Code Consolidation & DRY Purge).

The goal is to provide a stable, authenticated endpoint that returns a UI-friendly
schema for create/edit forms. Initial implementation is intentionally conservative:
- Best-effort mapping from Django model introspection
- Avoids leaking tenant data (schema only)
- Leaves advanced FK/m2m widgets for a follow-up PR

Endpoint:
  GET /api/v1/system/forms/schema/?entity_type=<entityIdOrAlias>

Examples:
  /api/v1/system/forms/schema/?entity_type=inquiries.inquiry
  /api/v1/system/forms/schema/?entity_type=customer

"""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from apps.system.services.entity_introspection import get_entity_fields


_SKIP_FIELDS = {
    'tenant',
    'custom_data',
    'created_at',
    'updated_at',
    'created_on',
    'updated_on',
}


def _map_field_type(introspected_type: str) -> str:
    """Map Schema Bridge field types to DynamicFormEngine-compatible field types."""

    t = (introspected_type or '').lower()
    mapping = {
        'text': 'text',
        'textarea': 'textarea',
        'email': 'email',
        'url': 'url',
        'number': 'number',
        'decimal': 'number',
        'date': 'date',
        'datetime': 'datetime',
        'boolean': 'checkbox',
        'file': 'file',
        # Conservative fallbacks for V3.0 Phase 1:
        'foreign_key': 'text',
        'many_to_many': 'text',
        'json': 'textarea',
        'image': 'file',
        'time': 'text',
    }
    return mapping.get(t, 'text')


class SystemFormSchemaView(APIView):
    """Return a UI-friendly schema for UniversalEntityForm / DynamicFormEngine."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args: Any, **kwargs: Any):
        entity_type = (request.query_params.get('entity_type') or '').strip()
        if not entity_type:
            return Response({'error': 'entity_type is required'}, status=status.HTTP_400_BAD_REQUEST)

        # get_entity_fields already supports aliases like 'customer', 'supplier', etc.
        fields = get_entity_fields(entity_type)
        if not fields:
            return Response({'error': f'Entity not found: {entity_type}'}, status=status.HTTP_404_NOT_FOUND)

        mapped_fields = []
        for f in fields:
            name = str(f.get('name') or '').strip()
            if not name or name in _SKIP_FIELDS:
                continue

            mapped_fields.append(
                {
                    'key': name,
                    'label': f.get('label') or name.replace('_', ' ').title(),
                    'type': _map_field_type(str(f.get('field_type') or 'text')),
                    'required': bool(f.get('is_required')),
                    'placeholder': None,
                    'help_text': f.get('help_text') or '',
                    # Future: relationship metadata / options injection
                    'related_entity': f.get('related_entity'),
                    'choices': f.get('choices') or None,
                }
            )

        schema = {
            'name': f'Universal Form: {entity_type}',
            'description': 'Auto-generated schema (V3.0 Phase 1).',
            'fields': mapped_fields,
        }

        return Response(schema, status=status.HTTP_200_OK)

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

from apps.system.services.entity_introspection import get_entity_display_fields, get_entity_fields


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

        canonical = entity_type.lower()
        if canonical in {
            'supplier',
            'suppliers',
            'suppliers.supplier',
            'tenant_apps.suppliers.supplier',
        }:
            return Response(
                {
                    'name': 'Supplier (Simplified)',
                    'description': 'Simplified create/edit schema (HQ details only).',
                    'fields': [
                        {'key': 'name', 'label': 'Supplier Name', 'type': 'text', 'required': True, 'order': 0, 'ui': {}},
                        {
                            'key': 'address',
                            'label': 'Headquarters Address',
                            'type': 'textarea',
                            'required': False,
                            'order': 1,
                            'ui': {'widget': 'textarea'},
                        },
                        {'key': 'city', 'label': 'Headquarters City', 'type': 'text', 'required': False, 'order': 2, 'ui': {}},
                        {'key': 'state', 'label': 'Headquarters State', 'type': 'text', 'required': False, 'order': 3, 'ui': {}},
                        {'key': 'zip_code', 'label': 'Headquarters ZIP Code', 'type': 'text', 'required': False, 'order': 4, 'ui': {}},
                        {'key': 'country', 'label': 'Country', 'type': 'text', 'required': False, 'order': 5, 'ui': {}},
                    ],
                    'key_fields': ['name', 'address', 'city', 'state', 'zip_code', 'country'],
                },
                status=status.HTTP_200_OK,
            )

        if canonical in {
            'customer',
            'customers',
            'customers.customer',
            'tenant_apps.customers.customer',
        }:
            return Response(
                {
                    'name': 'Customer (Simplified)',
                    'description': 'Simplified create/edit schema (HQ details only).',
                    'fields': [
                        {'key': 'name', 'label': 'Customer Name', 'type': 'text', 'required': True, 'order': 0, 'ui': {}},
                        {
                            'key': 'address',
                            'label': 'Headquarters Address',
                            'type': 'textarea',
                            'required': False,
                            'order': 1,
                            'ui': {'widget': 'textarea'},
                        },
                        {'key': 'city', 'label': 'Headquarters City', 'type': 'text', 'required': False, 'order': 2, 'ui': {}},
                        {'key': 'state', 'label': 'Headquarters State', 'type': 'text', 'required': False, 'order': 3, 'ui': {}},
                        {'key': 'zip_code', 'label': 'Headquarters ZIP Code', 'type': 'text', 'required': False, 'order': 4, 'ui': {}},
                        {'key': 'country', 'label': 'Country', 'type': 'text', 'required': False, 'order': 5, 'ui': {}},
                    ],
                    'key_fields': ['name', 'address', 'city', 'state', 'zip_code', 'country'],
                },
                status=status.HTTP_200_OK,
            )

        # get_entity_fields already supports aliases like 'customer', 'supplier', etc.
        fields = get_entity_fields(entity_type)
        if not fields:
            return Response({'error': f'Entity not found: {entity_type}'}, status=status.HTTP_404_NOT_FOUND)

        mapped_fields = []
        for idx, f in enumerate(fields):
            name = str(f.get('name') or '').strip()
            if not name or name in _SKIP_FIELDS:
                continue

            introspected_type = str(f.get('field_type') or 'text')
            mapped_type = _map_field_type(introspected_type)

            relationship = None
            ui: dict[str, Any] = {'read_only': bool(f.get('read_only', False))}

            field_type_raw = introspected_type.lower()
            related_entity = f.get('related_entity')

            if field_type_raw in {'foreign_key', 'many_to_many'}:
                kind = 'fk' if field_type_raw == 'foreign_key' else 'm2m'
                display_field = None
                if related_entity:
                    try:
                        display_fields = get_entity_display_fields(str(related_entity))
                        display_field = display_fields[0] if display_fields else None
                    except Exception:
                        display_field = None

                relationship = {
                    'kind': kind,
                    'entity_type': str(related_entity or ''),
                    'display_field': display_field,
                }
                ui['widget'] = 'searchable_select'

            elif f.get('choices'):
                relationship = {
                    'kind': 'choice',
                    'entity_type': 'choice',
                    'display_field': None,
                }
                ui['widget'] = 'select'

            if mapped_type in {'textarea', 'date', 'datetime', 'email'}:
                ui.setdefault('widget', mapped_type)

            mapped_fields.append(
                {
                    'key': name,
                    'label': f.get('label') or name.replace('_', ' ').title(),
                    'type': mapped_type,
                    'required': bool(f.get('is_required')),
                    'placeholder': f.get('placeholder'),
                    'help_text': f.get('help_text') or '',
                    'relationship': relationship,
                    'ui': ui,
                    # Backward-compat for existing clients
                    'related_entity': related_entity,
                    'choices': f.get('choices') or None,
                    'order': idx,
                }
            )

        # Key fields: best-effort "most likely needed" subset for create/edit.
        # This keeps the API additive-only: clients can ignore it.
        key_field_candidates = [
            'name',
            'title',
            'status',
            'email',
            'phone',
            'contact_person',
            'full_name',
            'customer',
            'supplier',
            'entity_type',
            'order_date',
            'delivery_date',
            'invoice_date',
            'valid_until',
        ]

        # Always include required fields.
        required_keys = [f['key'] for f in mapped_fields if f.get('required')]

        # Then include common candidates if present.
        present = {f['key'] for f in mapped_fields}
        key_fields = []
        for k in required_keys + key_field_candidates:
            if k in present and k not in key_fields:
                key_fields.append(k)

        schema = {
            'name': f'Universal Form: {entity_type}',
            'description': 'Auto-generated schema (V3.0 Phase 1).',
            'fields': mapped_fields,
            'key_fields': key_fields,
        }

        return Response(schema, status=status.HTTP_200_OK)

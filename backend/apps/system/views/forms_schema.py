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


def _inline_contact_item_fields(include_responsibilities: bool) -> list[dict[str, Any]]:
    fields: list[dict[str, Any]] = [
        {
            'key': 'first_name',
            'label': 'First Name',
            'type': 'text',
            'required': True,
            'help_text': '',
            'placeholder': 'First name',
            'relationship': None,
            'ui': {'widget': 'text'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'last_name',
            'label': 'Last Name',
            'type': 'text',
            'required': True,
            'help_text': '',
            'placeholder': 'Last name',
            'relationship': None,
            'ui': {'widget': 'text'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'mobile_phone',
            'label': 'Mobile Phone',
            'type': 'text',
            'required': False,
            'help_text': '',
            'placeholder': 'Mobile phone',
            'relationship': None,
            'ui': {'widget': 'phone'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'office_phone',
            'label': 'Office Phone',
            'type': 'text',
            'required': False,
            'help_text': '',
            'placeholder': 'Office phone',
            'relationship': None,
            'ui': {'widget': 'phone'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'office_phone_ext',
            'label': 'Office Ext',
            'type': 'text',
            'required': False,
            'help_text': '',
            'placeholder': 'Ext',
            'relationship': None,
            'ui': {'widget': 'text'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'email',
            'label': 'Email',
            'type': 'email',
            'required': False,
            'help_text': '',
            'placeholder': 'Email',
            'relationship': None,
            'ui': {'widget': 'email'},
            'related_entity': None,
            'choices': None,
        },
    ]

    if include_responsibilities:
        fields.extend(
            [
                {
                    'key': 'protein_types_responsible',
                    'label': 'Protein Types Responsible For',
                    'type': 'text',
                    'required': False,
                    'help_text': '',
                    'placeholder': 'e.g. Beef, Pork',
                    'relationship': None,
                    'ui': {'widget': 'tags'},
                    'related_entity': None,
                    'choices': None,
                },
                {
                    'key': 'items_responsible',
                    'label': 'Items Responsible For',
                    'type': 'text',
                    'required': False,
                    'help_text': '',
                    'placeholder': 'e.g. Ribs, Tenderloin',
                    'relationship': None,
                    'ui': {'widget': 'tags'},
                    'related_entity': None,
                    'choices': None,
                },
            ]
        )

    return fields


def _inline_department_fields() -> list[dict[str, Any]]:
    return [
        {
            'key': 'sales_contacts',
            'label': 'Sales Department',
            'type': 'inline_form_array',
            'required': False,
            'help_text': '',
            'placeholder': None,
            'relationship': None,
            'ui': {
                'widget': 'inline_form_array',
                'add_button_label': 'Add Sales Contact',
                'item_label': 'Sales Contact',
                'item_fields': _inline_contact_item_fields(include_responsibilities=True),
            },
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'qa_contacts',
            'label': 'Quality Assurance',
            'type': 'inline_form_array',
            'required': False,
            'help_text': '',
            'placeholder': None,
            'relationship': None,
            'ui': {
                'widget': 'inline_form_array',
                'add_button_label': 'Add QA Contact',
                'item_label': 'QA Contact',
                'item_fields': _inline_contact_item_fields(include_responsibilities=False),
            },
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'booking_contacts',
            'label': 'Booking',
            'type': 'inline_form_array',
            'required': False,
            'help_text': '',
            'placeholder': None,
            'relationship': None,
            'ui': {
                'widget': 'inline_form_array',
                'add_button_label': 'Add Booking Contact',
                'item_label': 'Booking Contact',
                'item_fields': _inline_contact_item_fields(include_responsibilities=False),
            },
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'accounting_contacts',
            'label': 'Accounting',
            'type': 'inline_form_array',
            'required': False,
            'help_text': '',
            'placeholder': None,
            'relationship': None,
            'ui': {
                'widget': 'inline_form_array',
                'add_button_label': 'Add Accounting Contact',
                'item_label': 'Accounting Contact',
                'item_fields': _inline_contact_item_fields(include_responsibilities=False),
            },
            'related_entity': None,
            'choices': None,
        },
    ]


def _inline_inquiry_product_item_fields() -> list[dict[str, Any]]:
    # NOTE: Inline arrays currently support scalar fields + static choices.
    # For the enhanced product picker UX, EntityFormSurface routes inquiry creation
    # through InquiryCreateModal by default.
    uom_choices = [
        {'value': 'LBS', 'label': 'Pounds (LBS)'},
        {'value': 'KG', 'label': 'Kilograms (KG)'},
        {'value': 'CS', 'label': 'Cases (CS)'},
        {'value': 'EA', 'label': 'Each (EA)'},
        {'value': 'PLT', 'label': 'Pallets (PLT)'},
        {'value': 'BOX', 'label': 'Boxes (BOX)'},
    ]

    return [
        {
            'key': 'product',
            'label': 'Product',
            'type': 'text',
            'required': True,
            'help_text': 'Product ID (enhanced inquiry form provides autocomplete).',
            'placeholder': 'e.g. 123',
            'relationship': None,
            'ui': {'widget': 'text'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'quantity',
            'label': 'Quantity',
            'type': 'number',
            'required': True,
            'help_text': '',
            'placeholder': 'e.g. 20000',
            'relationship': None,
            'ui': {'widget': 'number'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'desired_uom',
            'label': 'UOM',
            'type': 'text',
            'required': False,
            'help_text': '',
            'placeholder': None,
            'relationship': None,
            'ui': {'widget': 'select'},
            'related_entity': None,
            'choices': uom_choices,
        },
        {
            'key': 'desired_price_per_unit',
            'label': 'Desired Price / Unit',
            'type': 'number',
            'required': False,
            'help_text': '',
            'placeholder': 'e.g. 4.25',
            'relationship': None,
            'ui': {'widget': 'number'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'actual_price_per_unit',
            'label': 'Actual Price / Unit',
            'type': 'number',
            'required': False,
            'help_text': '',
            'placeholder': 'e.g. 4.40',
            'relationship': None,
            'ui': {'widget': 'number'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'supplier',
            'label': 'Supplier (optional)',
            'type': 'text',
            'required': False,
            'help_text': 'Supplier ID (optional per-line sourcing).',
            'placeholder': None,
            'relationship': None,
            'ui': {'widget': 'text'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'plant',
            'label': 'Plant (optional)',
            'type': 'text',
            'required': False,
            'help_text': 'Plant ID (optional per-line sourcing).',
            'placeholder': None,
            'relationship': None,
            'ui': {'widget': 'text'},
            'related_entity': None,
            'choices': None,
        },
        {
            'key': 'notes',
            'label': 'Line Notes',
            'type': 'textarea',
            'required': False,
            'help_text': '',
            'placeholder': None,
            'relationship': None,
            'ui': {'widget': 'textarea'},
            'related_entity': None,
            'choices': None,
        },
    ]



_SKIP_FIELDS = {
    'tenant',
    'custom_data',
    'created_at',
    'updated_at',
    'created_on',
    'updated_on',
}


def _infer_field_group(key: str) -> str:
    k = (key or '').lower()
    if k in {'name', 'title', 'status', 'entity_type'}:
        return 'Overview'
    if 'contact' in k or k in {'email', 'phone', 'phone_type'}:
        return 'Contact'
    if k in {'address', 'street_address', 'city', 'state', 'zip_code', 'country'}:
        return 'Address'
    if 'date' in k or k in {'valid_until', 'due_date', 'delivery_date', 'order_date', 'invoice_date'}:
        return 'Dates'
    if 'note' in k or k in {'notes', 'competitor_names', 'competitor_pricing_notes', 'win_loss_reason'}:
        return 'Notes'
    return 'Details'


def _normalize_schema(schema: dict[str, Any]) -> dict[str, Any]:
    fields = list(schema.get('fields') or [])
    key_fields = list(schema.get('key_fields') or [])
    header_fields = list(schema.get('header_fields') or []) or list(key_fields)

    normalized_fields: list[dict[str, Any]] = []
    for idx, f in enumerate(fields):
        ff = dict(f)
        key = str(ff.get('key') or '').strip()
        if not key:
            continue

        ui = ff.get('ui') if isinstance(ff.get('ui'), dict) else {}
        read_only = bool(ff.get('read_only')) or bool(ui.get('read_only'))
        hidden = bool(ff.get('hidden')) or bool(ui.get('hidden'))

        ff['order'] = int(ff.get('order') if ff.get('order') is not None else idx)
        ff['group'] = str(ff.get('group') or _infer_field_group(key))
        ff['read_only'] = read_only
        ff['hidden'] = hidden

        surfaces = ff.get('surfaces') if isinstance(ff.get('surfaces'), dict) else {}
        ff['surfaces'] = {
            'header': bool(surfaces.get('header', key in header_fields)),
            'form': bool(surfaces.get('form', not hidden)),
            'table': bool(surfaces.get('table', key in header_fields)),
        }

        ff['ui'] = {**ui, 'read_only': read_only}

        normalized_fields.append(ff)

    normalized_fields.sort(key=lambda x: int(x.get('order') or 0))

    # Derive ordered groups (stable by first occurrence)
    seen: set[str] = set()
    groups: list[dict[str, Any]] = []
    for f in normalized_fields:
        g = str(f.get('group') or '').strip()
        if not g or g in seen:
            continue
        seen.add(g)
        groups.append({'id': g.lower().replace(' ', '_'), 'label': g, 'order': len(groups)})

    return {
        **schema,
        'fields': normalized_fields,
        'key_fields': key_fields,
        'header_fields': header_fields,
        'groups': schema.get('groups') or groups,
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

        entity_type_lower = entity_type.lower()

        # Hierarchy v1: add inline contact arrays for Plant/Location.
        if entity_type_lower in {'plant', 'plants', 'plants.plant', 'location', 'locations', 'locations.location'}:
            canonical = 'plants.plant' if entity_type_lower.startswith('plant') else 'locations.location'

            fields = get_entity_fields(canonical)
            if not fields:
                return Response({'error': f'Entity not found: {entity_type}'}, status=status.HTTP_404_NOT_FOUND)

            core_field_keys = (
                {
                    'name',
                    'code',
                    'plant_est_num',
                    'plant_type',
                    'location_type',
                    'address',
                    'street_address',
                    'city',
                    'state',
                    'zip_code',
                    'country',
                    'supplier',
                    'customer',
                }
            )

            label_overrides = {
                'plant_est_num': 'Establishment #',
                'plant_type': 'Type',
                'location_type': 'Type',
            }

            mapped_fields: list[dict[str, Any]] = []
            for idx, f in enumerate(fields):
                name = str(f.get('name') or '').strip()
                if not name or name in _SKIP_FIELDS:
                    continue
                if name not in core_field_keys:
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
                        'label': label_overrides.get(name) or f.get('label') or name.replace('_', ' ').title(),
                        'type': mapped_type,
                        'required': bool(f.get('is_required')),
                        'placeholder': f.get('placeholder'),
                        'help_text': f.get('help_text') or '',
                        'relationship': relationship,
                        'ui': ui,
                        # Additive presentation metadata
                        'read_only': bool(f.get('read_only', False)),
                        # Backward-compat for existing clients
                        'related_entity': related_entity,
                        'choices': f.get('choices') or None,
                        'order': idx,
                    }
                )

            for extra_idx, extra in enumerate(_inline_department_fields()):
                mapped_fields.append({**extra, 'order': 1000 + extra_idx})

            key_fields = [
                'supplier' if canonical == 'plants.plant' else 'customer',
                'name',
                'code',
                'plant_est_num',
                'plant_type' if canonical == 'plants.plant' else 'location_type',
                'address',
                'city',
                'state',
                'zip_code',
                'country',
                'sales_contacts',
                'qa_contacts',
                'booking_contacts',
                'accounting_contacts',
            ]

            # Progressive disclosure support: non-key, non-required fields are considered "advanced".
            # Clients can safely ignore this field (additive-only).
            key_set = set(key_fields)
            for mf in mapped_fields:
                mf_key = str(mf.get('key') or '')
                mf_required = bool(mf.get('required'))
                mf['is_advanced'] = bool(mf_key and (mf_key not in key_set) and (not mf_required))

            return Response(
                _normalize_schema(
                    {
                        'name': 'Plant' if canonical == 'plants.plant' else 'Location',
                        'description': 'Create or edit with department contacts.',
                        'key_fields': key_fields,
                        'fields': mapped_fields,
                    }
                )
            )

        canonical = entity_type_lower
        if canonical in {
            'supplier',
            'suppliers',
            'suppliers.supplier',
            'tenant_apps.suppliers.supplier',
        }:
            schema = {
                'name': 'Supplier (Simplified)',
                'description': 'Simplified create/edit schema (HQ details only).',
                'fields': [
                    {
                        'key': 'name',
                        'label': 'Supplier Name',
                        'type': 'text',
                        'required': True,
                        'order': 0,
                        'ui': {},
                    },
                    {
                        'key': 'phone_office',
                        'label': 'Headquarters Phone Number',
                        'type': 'phone',
                        'required': False,
                        'order': 1,
                        'ui': {},
                    },
                    {
                        'key': 'address',
                        'label': 'Headquarters Address',
                        'type': 'textarea',
                        'required': False,
                        'order': 2,
                        'ui': {'widget': 'textarea'},
                    },
                    {
                        'key': 'city',
                        'label': 'Headquarters City',
                        'type': 'text',
                        'required': False,
                        'order': 3,
                        'ui': {},
                    },
                    {
                        'key': 'state',
                        'label': 'Headquarters State',
                        'type': 'text',
                        'required': False,
                        'order': 4,
                        'ui': {},
                    },
                    {
                        'key': 'zip_code',
                        'label': 'Headquarters ZIP Code',
                        'type': 'text',
                        'required': False,
                        'order': 5,
                        'ui': {},
                    },
                    {
                        'key': 'country',
                        'label': 'Country',
                        'type': 'text',
                        'required': False,
                        'order': 6,
                        'ui': {},
                    },
                ],
                'key_fields': ['name', 'phone_office', 'address', 'city', 'state', 'zip_code', 'country'],
            }

            key_set = set(schema.get('key_fields') or [])
            for mf in schema.get('fields') or []:
                mf_key = str(mf.get('key') or '')
                mf_required = bool(mf.get('required'))
                mf['is_advanced'] = bool(mf_key and (mf_key not in key_set) and (not mf_required))

            return Response(_normalize_schema(schema), status=status.HTTP_200_OK)

        if canonical in {
            'customer',
            'customers',
            'customers.customer',
            'tenant_apps.customers.customer',
        }:
            schema = {
                'name': 'Customer (Simplified)',
                'description': 'Simplified create/edit schema (HQ details only).',
                'fields': [
                    {
                        'key': 'name',
                        'label': 'Customer Name',
                        'type': 'text',
                        'required': True,
                        'order': 0,
                        'ui': {},
                    },
                    {
                        'key': 'address',
                        'label': 'Headquarters Address',
                        'type': 'textarea',
                        'required': False,
                        'order': 1,
                        'ui': {'widget': 'textarea'},
                    },
                    {
                        'key': 'city',
                        'label': 'Headquarters City',
                        'type': 'text',
                        'required': False,
                        'order': 2,
                        'ui': {},
                    },
                    {
                        'key': 'state',
                        'label': 'Headquarters State',
                        'type': 'text',
                        'required': False,
                        'order': 3,
                        'ui': {},
                    },
                    {
                        'key': 'zip_code',
                        'label': 'Headquarters ZIP Code',
                        'type': 'text',
                        'required': False,
                        'order': 4,
                        'ui': {},
                    },
                    {
                        'key': 'country',
                        'label': 'Country',
                        'type': 'text',
                        'required': False,
                        'order': 5,
                        'ui': {},
                    },
                ],
                'key_fields': ['name', 'address', 'city', 'state', 'zip_code', 'country'],
            }

            key_set = set(schema.get('key_fields') or [])
            for mf in schema.get('fields') or []:
                mf_key = str(mf.get('key') or '')
                mf_required = bool(mf.get('required'))
                mf['is_advanced'] = bool(mf_key and (mf_key not in key_set) and (not mf_required))

            return Response(_normalize_schema(schema), status=status.HTTP_200_OK)

        if canonical in {
            'inquiry',
            'inquiries',
            'inquiries.inquiry',
            'tenant_apps.inquiries.inquiry',
        }:
            schema = {
                'name': 'Inquiry (Ideal)',
                'description': 'Ideal inquiry create/edit schema (V3.5 unified UX).',
                'fields': [
                    {
                        'key': 'entity_type',
                        'label': 'Inquiry For',
                        'type': 'text',
                        'required': True,
                        'order': 0,
                        'ui': {'widget': 'select'},
                        'related_entity': None,
                        'choices': [
                            {'value': 'customer', 'label': 'Customer'},
                            {'value': 'supplier', 'label': 'Supplier'},
                        ],
                    },
                    {
                        'key': 'shipping_type',
                        'label': 'Shipping Type',
                        'type': 'text',
                        'required': False,
                        'order': 1,
                        'ui': {'widget': 'select'},
                        'related_entity': None,
                        'choices': [
                            {'value': 'tenant', 'label': 'Tenant'},
                            {'value': 'customer_pickup', 'label': 'Customer Pick-Up'},
                            {'value': 'supplier_delivering', 'label': 'Supplier Delivering'},
                        ],
                    },
                    {
                        'key': 'customer',
                        'label': 'Customer',
                        'type': 'text',
                        'required': False,
                        'order': 2,
                        'ui': {'widget': 'searchable_select'},
                        'related_entity': 'customers.customer',
                        'choices': None,
                    },
                    {
                        'key': 'supplier',
                        'label': 'Supplier',
                        'type': 'text',
                        'required': False,
                        'order': 3,
                        'ui': {'widget': 'searchable_select'},
                        'related_entity': 'suppliers.supplier',
                        'choices': None,
                    },
                    {
                        'key': 'contact',
                        'label': 'Primary Contact',
                        'type': 'text',
                        'required': False,
                        'order': 4,
                        'ui': {'widget': 'searchable_select'},
                        'related_entity': 'contacts.contact',
                        'choices': None,
                    },
                    {
                        'key': 'contact_name',
                        'label': 'Contact Name (snapshot)',
                        'type': 'text',
                        'required': False,
                        'order': 5,
                        'ui': {},
                    },
                    {
                        'key': 'contact_email',
                        'label': 'Contact Email (snapshot)',
                        'type': 'email',
                        'required': False,
                        'order': 6,
                        'ui': {'widget': 'email'},
                    },
                    {
                        'key': 'contact_phone',
                        'label': 'Contact Phone (snapshot)',
                        'type': 'phone',
                        'required': False,
                        'order': 7,
                        'ui': {'widget': 'phone'},
                    },
                    {
                        'key': 'source_type',
                        'label': 'Source',
                        'type': 'text',
                        'required': False,
                        'order': 8,
                        'ui': {'widget': 'select'},
                        'related_entity': None,
                        'choices': [
                            {'value': 'scheduled_call', 'label': 'Scheduled Call'},
                            {'value': 'inbound_call', 'label': 'Inbound Call'},
                            {'value': 'email', 'label': 'Email'},
                            {'value': 'website', 'label': 'Website'},
                            {'value': 'trade_show', 'label': 'Trade Show'},
                            {'value': 'referral', 'label': 'Referral'},
                            {'value': 'other', 'label': 'Other'},
                        ],
                    },
                    {
                        'key': 'source_call',
                        'label': 'Source Call',
                        'type': 'text',
                        'required': False,
                        'order': 9,
                        'help_text': 'Scheduled call ID (optional).',
                        'ui': {'widget': 'text'},
                        'related_entity': None,
                        'choices': None,
                    },
                    {
                        'key': 'valid_until',
                        'label': 'Valid Until',
                        'type': 'date',
                        'required': False,
                        'order': 10,
                        'ui': {'widget': 'date'},
                    },
                    {
                        'key': 'notes',
                        'label': 'Notes',
                        'type': 'textarea',
                        'required': False,
                        'order': 11,
                        'ui': {'widget': 'textarea'},
                    },
                    {
                        'key': 'products',
                        'label': 'Products',
                        'type': 'inline_form_array',
                        'required': False,
                        'order': 12,
                        'ui': {
                            'widget': 'inline_form_array',
                            'add_button_label': 'Add Product Line',
                            'item_label': 'Product Line',
                            'item_fields': _inline_inquiry_product_item_fields(),
                        },
                        'related_entity': None,
                        'choices': None,
                    },
                    {
                        'key': 'competitor_names',
                        'label': 'Competitors',
                        'type': 'textarea',
                        'required': False,
                        'order': 100,
                        'ui': {'widget': 'textarea'},
                    },
                    {
                        'key': 'competitor_pricing_notes',
                        'label': 'Competitor Pricing Notes',
                        'type': 'textarea',
                        'required': False,
                        'order': 101,
                        'ui': {'widget': 'textarea'},
                    },
                    {
                        'key': 'win_loss_reason',
                        'label': 'Win/Loss Reason',
                        'type': 'textarea',
                        'required': False,
                        'order': 102,
                        'ui': {'widget': 'textarea'},
                    },
                ],
                'key_fields': [
                    'entity_type',
                    'customer',
                    'supplier',
                    'contact',
                    'contact_name',
                    'contact_email',
                    'contact_phone',
                    'shipping_type',
                    'source_type',
                    'source_call',
                    'valid_until',
                    'notes',
                    'products',
                ],
            }

            key_set = set(schema.get('key_fields') or [])
            for mf in schema.get('fields') or []:
                mf_key = str(mf.get('key') or '')
                mf_required = bool(mf.get('required'))
                mf['is_advanced'] = bool(mf_key and (mf_key not in key_set) and (not mf_required))

            return Response(_normalize_schema(schema), status=status.HTTP_200_OK)

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
                    # Additive presentation metadata
                    'read_only': bool(f.get('read_only', False)),
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

        # Progressive disclosure support: non-key, non-required fields are considered "advanced".
        # Clients can safely ignore this field (additive-only).
        key_set = set(key_fields)
        for mf in mapped_fields:
            mf_key = str(mf.get('key') or '')
            mf_required = bool(mf.get('required'))
            mf['is_advanced'] = bool(mf_key and (mf_key not in key_set) and (not mf_required))

        schema = {
            'name': f'Universal Form: {entity_type}',
            'description': 'Auto-generated schema (V3.0 Phase 1).',
            'fields': mapped_fields,
            'key_fields': key_fields,
        }

        return Response(_normalize_schema(schema), status=status.HTTP_200_OK)

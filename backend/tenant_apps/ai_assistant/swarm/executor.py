"""Tool execution loop for PM-AS (ProjectMeats Autonomous Swarm).

Phase 8.1:
- Execute OpenAI tool calls by mapping tool names -> internal Python services.
- Return a JSON string payload for tool results to feed back into the LLM.

Reliability mandate:
- Never raise from tool execution; always return a JSON string.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict

from apps.tenants.rls import set_current_tenant

logger = logging.getLogger(__name__)


# OpenAI tool schemas (ChatCompletions-compatible).
# Keep this stable: both the frontend widget and Swarm router rely on it.
DEFAULT_OPENAI_TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'check_unread_emails',
            'description': "Checks the user's connected Microsoft Outlook inbox for unread emails and document attachments.",
            'parameters': {'type': 'object', 'properties': {}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'draft_outlook_email',
            'description': "Drafts and sends an email via the user's connected Microsoft Outlook account.",
            'parameters': {
                'type': 'object',
                'properties': {
                    'to_address': {'type': 'string', 'description': 'Recipient email address'},
                    'subject': {'type': 'string', 'description': 'Email subject'},
                    'body': {'type': 'string', 'description': 'Email body (plain text)'},
                },
                'required': ['to_address', 'subject', 'body'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_cockpit_records',
            'description': 'Searches the ERP database for Suppliers, Customers, or Purchase Orders based on a query.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity_type': {
                        'type': 'string',
                        'description': 'Entity type to search (e.g., supplier, customer, purchase_order)',
                    },
                    'search_term': {'type': 'string', 'description': 'Free-text search term'},
                },
                'required': ['entity_type', 'search_term'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_record',
            'description': 'Create a tenant-scoped record (limited to safe entity types).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity': {'type': 'string', 'description': 'Entity type (e.g., customer, supplier, contact)'},
                    'data': {'type': 'object', 'description': 'Field payload for the entity'},
                },
                'required': ['entity', 'data'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_entities',
            'description': 'Search common tenant entities (customer, supplier, contact, purchase_order, sales_order).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'query': {'type': 'string', 'description': 'Free-text search term'},
                    'entity_types': {
                        'type': 'array',
                        'items': {'type': 'string'},
                        'description': 'Optional list of entity types to include',
                    },
                    'limit': {'type': 'integer', 'description': 'Max results per entity type (default 5)'},
                },
                'required': ['query'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_recent_activity',
            'description': 'Get recent ActivityLog entries for an entity (requires entity_type + entity_id).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity_type': {'type': 'string', 'description': 'Entity type (customer, supplier, purchase_order, etc.)'},
                    'entity_id': {'type': 'string', 'description': 'Entity primary key (string/int accepted)'},
                    'limit': {'type': 'integer', 'description': 'Max rows (default 10)'},
                },
                'required': ['entity_type', 'entity_id'],
            },
        },
    },
]


class ToolExecutor:
    """Execute registered tools for a given tenant."""

    def __init__(self):
        self._tools: Dict[str, Callable[[Dict[str, Any], Any, Any], Any]] = {
            'check_unread_emails': self._check_unread_emails,
            'draft_outlook_email': self._draft_outlook_email,
            'search_cockpit_records': self._search_cockpit_records,
            'create_record': self._create_record,
            'search_entities': self._search_entities,
            'get_recent_activity': self._get_recent_activity,
        }

    def execute(self, tool_name: str, arguments: Dict[str, Any] | None, tenant: Any, user: Any = None) -> str:
        """Execute a tool and return a JSON string result.

        Args:
            tool_name: The OpenAI tool function name.
            arguments: Parsed JSON arguments dict.
            tenant: Tenant object, used for tenant-scoped execution.

        Returns:
            JSON string containing success data or an error payload.
        """
        try:
            fn = self._tools.get(tool_name)
            if not fn:
                return json.dumps({'error': f"Unknown tool: {tool_name}"})

            tenant_id = str(getattr(tenant, 'id', '') or '')
            if tenant_id:
                rls = set_current_tenant(tenant_id)
                if not rls.ok:
                    logger.warning('Failed to assert RLS tenant session var: %s', rls.error)

            result = fn(arguments or {}, tenant, user)
            return json.dumps({'ok': True, 'tool': tool_name, 'data': result}, default=str)
        except Exception as e:
            logger.warning('Tool execution failed tool=%s: %s', tool_name, str(e), exc_info=True)
            return json.dumps({'ok': False, 'tool': tool_name, 'error': str(e)}, default=str)

    def _check_unread_emails(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        from apps.integrations.models import ExternalAuthProvider
        from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            raise ValueError('Tenant not resolved; cannot access email tools')

        provider = (
            ExternalAuthProvider.objects.filter(
                tenant=tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        if not provider:
            raise ValueError('Outlook not connected. Connect it in Settings → Email Integrations.')
        if provider.is_token_expired():
            raise ValueError('Outlook connection expired. Reconnect in Settings → Email Integrations.')

        return EmailIngestionService(tenant).fetch_unread_actionable_emails()

    def _draft_outlook_email(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Send an email using the tenant's Microsoft Graph connection."""
        from apps.integrations.models import ExternalAuthProvider
        from apps.integrations.providers.microsoft import MicrosoftGraphProvider

        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            raise ValueError('Tenant not resolved; cannot access email tools')

        to_address = (arguments.get('to_address') or '').strip()
        subject = (arguments.get('subject') or '').strip()
        body = (arguments.get('body') or '').strip()

        if not to_address or not subject or not body:
            raise ValueError('Missing required parameters: to_address, subject, body')

        provider_row = (
            ExternalAuthProvider.objects.filter(
                tenant=tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        if not provider_row:
            raise ValueError('Outlook not connected. Connect it in Settings → Email Integrations.')

        # Best-effort refresh; if no refresh token exists we keep going and let Graph respond.
        try:
            provider_row.refresh_if_needed()
        except Exception:
            pass

        if provider_row.is_token_expired():
            raise ValueError('Outlook connection expired. Reconnect in Settings → Email Integrations.')

        access_token = provider_row.get_decrypted_token('access')
        graph = MicrosoftGraphProvider(tenant.id)

        result = graph.send_email(
            access_token,
            {
                'to': [to_address],
                'subject': subject,
                'body': body,
            },
        )

        return {
            'status': result.get('status') or 'sent',
            'to': to_address,
            'subject': subject,
            'provider': result.get('provider') or 'microsoft',
        }

    def _search_cockpit_records(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Tenant-scoped search used by legacy widget prompts."""
        entity_type = (arguments.get('entity_type') or '').strip().lower()
        search_term = (arguments.get('search_term') or '').strip()
        if not entity_type or not search_term:
            raise ValueError('Missing required parameters: entity_type, search_term')

        return self._search_entities(
            {'query': search_term, 'entity_types': [entity_type], 'limit': 10},
            tenant,
            user,
        )

    def _create_record(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Create a safe subset of tenant-scoped records.

        Supported entities:
        - customer: {name, email?, phone?, contact_person?, address?, city?, state?, zip_code?, country?}
        - supplier: {name, email?, phone?, contact_person?, address?, city?, state?, zip_code?, country?}
        - contact: {first_name, last_name, email?, phone?, supplier_id?, customer_id?, plant_id?, location_id?}
        """
        from django.db import transaction
        from tenant_apps.customers.models import Customer
        from tenant_apps.suppliers.models import Supplier
        from tenant_apps.contacts.models import Contact

        entity = (arguments.get('entity') or '').strip().lower()
        data = arguments.get('data')
        if not entity or not isinstance(data, dict):
            raise ValueError('Missing required parameters: entity, data')

        if entity == 'customer':
            allowed = {
                'name',
                'contact_person',
                'email',
                'phone',
                'address',
                'street_address',
                'city',
                'state',
                'zip_code',
                'country',
            }
            payload = {k: v for k, v in data.items() if k in allowed}
            if not str(payload.get('name') or '').strip():
                raise ValueError('Customer.name is required')
            with transaction.atomic():
                row = Customer.objects.create(tenant=tenant, **payload)
            return {'entity': 'customer', 'id': str(row.id), 'name': row.name}

        if entity == 'supplier':
            allowed = {
                'name',
                'contact_person',
                'email',
                'phone',
                'address',
                'street_address',
                'city',
                'state',
                'zip_code',
                'country',
            }
            payload = {k: v for k, v in data.items() if k in allowed}
            if not str(payload.get('name') or '').strip():
                raise ValueError('Supplier.name is required')
            with transaction.atomic():
                row = Supplier.objects.create(tenant=tenant, **payload)
            return {'entity': 'supplier', 'id': str(row.id), 'name': row.name}

        if entity == 'contact':
            allowed = {
                'first_name',
                'last_name',
                'email',
                'phone',
                'company',
                'position',
                'contact_type',
                'contact_title',
                'main_phone',
                'direct_phone',
                'cell_phone',
                'status',
                'supplier_id',
                'customer_id',
                'plant_id',
                'location_id',
            }
            payload = {k: v for k, v in data.items() if k in allowed}
            if not str(payload.get('first_name') or '').strip() or not str(payload.get('last_name') or '').strip():
                raise ValueError('Contact.first_name and Contact.last_name are required')

            supplier_id = payload.pop('supplier_id', None)
            customer_id = payload.pop('customer_id', None)
            plant_id = payload.pop('plant_id', None)
            location_id = payload.pop('location_id', None)

            if supplier_id:
                row = Supplier.objects.filter(tenant=tenant, id=supplier_id).first()
                if not row:
                    raise ValueError('supplier_id not found for this tenant')
                payload['supplier'] = row
            if customer_id:
                row = Customer.objects.filter(tenant=tenant, id=customer_id).first()
                if not row:
                    raise ValueError('customer_id not found for this tenant')
                payload['customer'] = row

            if plant_id:
                from tenant_apps.plants.models import Plant

                row = Plant.objects.filter(tenant=tenant, id=plant_id).first()
                if not row:
                    raise ValueError('plant_id not found for this tenant')
                payload['plant'] = row
            if location_id:
                from tenant_apps.locations.models import Location

                row = Location.objects.filter(tenant=tenant, id=location_id).first()
                if not row:
                    raise ValueError('location_id not found for this tenant')
                payload['location'] = row

            with transaction.atomic():
                row = Contact.objects.create(tenant=tenant, **payload)
            return {'entity': 'contact', 'id': str(row.id), 'name': str(row)}

        raise ValueError(f"Unsupported entity for create_record: {entity}")

    def _search_entities(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Search common entities with strict tenant filtering."""
        query = (arguments.get('query') or '').strip()
        if not query:
            raise ValueError('Missing required parameters: query')

        entity_types = arguments.get('entity_types')
        if not isinstance(entity_types, list) or not entity_types:
            entity_types = ['customer', 'supplier', 'contact', 'purchase_order', 'sales_order']

        limit = arguments.get('limit')
        try:
            limit_int = int(limit) if limit is not None else 5
        except Exception:
            limit_int = 5
        limit_int = max(1, min(25, limit_int))

        results: Dict[str, Any] = {
            'query': query,
            'results': [],
            'counts': {},
        }

        for et in [str(x).strip().lower() for x in entity_types if str(x).strip()]:
            if et == 'customer':
                from tenant_apps.customers.models import Customer

                qs = Customer.objects.filter(tenant=tenant, name__icontains=query).order_by('name')
                results['counts'][et] = qs.count()
                results['results'].append(
                    {
                        'entity_type': et,
                        'items': [
                            {'id': str(c.id), 'title': c.name, 'route': f'/cockpit?type=customer&id={c.id}'}
                            for c in qs[:limit_int]
                        ],
                    }
                )
                continue

            if et == 'supplier':
                from tenant_apps.suppliers.models import Supplier

                qs = Supplier.objects.filter(tenant=tenant, name__icontains=query).order_by('name')
                results['counts'][et] = qs.count()
                results['results'].append(
                    {
                        'entity_type': et,
                        'items': [
                            {'id': str(s.id), 'title': s.name, 'route': f'/cockpit?type=supplier&id={s.id}'}
                            for s in qs[:limit_int]
                        ],
                    }
                )
                continue

            if et == 'contact':
                from tenant_apps.contacts.models import Contact

                qs = Contact.objects.filter(tenant=tenant, last_name__icontains=query).order_by('last_name')
                results['counts'][et] = qs.count()
                results['results'].append(
                    {
                        'entity_type': et,
                        'items': [
                            {'id': str(c.id), 'title': str(c), 'route': f'/contacts/{c.id}'}
                            for c in qs[:limit_int]
                        ],
                    }
                )
                continue

            if et in {'purchase_order', 'purchaseorder', 'po'}:
                from tenant_apps.purchase_orders.models import PurchaseOrder

                qs = PurchaseOrder.objects.filter(tenant=tenant, order_number__icontains=query).order_by('-created_on')
                results['counts'][et] = qs.count()
                results['results'].append(
                    {
                        'entity_type': 'purchase_order',
                        'items': [
                            {
                                'id': str(po.id),
                                'title': getattr(po, 'order_number', '') or f'PO {po.id}',
                                'route': f'/cockpit?type=purchase_order&id={po.id}',
                            }
                            for po in qs[:limit_int]
                        ],
                    }
                )
                continue

            if et in {'sales_order', 'salesorder', 'so'}:
                from tenant_apps.sales_orders.models import SalesOrder

                qs = SalesOrder.objects.filter(tenant=tenant, our_sales_order_num__icontains=query).order_by('-created_on')
                results['counts'][et] = qs.count()
                results['results'].append(
                    {
                        'entity_type': 'sales_order',
                        'items': [
                            {
                                'id': str(so.id),
                                'title': getattr(so, 'our_sales_order_num', '') or f'SO {so.id}',
                                'route': f'/cockpit?type=sales_order&id={so.id}',
                            }
                            for so in qs[:limit_int]
                        ],
                    }
                )
                continue

            results['counts'][et] = 0
            results['results'].append({'entity_type': et, 'items': [], 'note': 'unsupported entity type'})

        return results

    def _get_recent_activity(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        from tenant_apps.cockpit.models import ActivityLog

        entity_type = (arguments.get('entity_type') or '').strip()
        entity_id = (arguments.get('entity_id') or '').strip()
        if not entity_type or not entity_id:
            raise ValueError('Missing required parameters: entity_type, entity_id')

        limit = arguments.get('limit')
        try:
            limit_int = int(limit) if limit is not None else 10
        except Exception:
            limit_int = 10
        limit_int = max(1, min(50, limit_int))

        try:
            entity_id_int = int(entity_id)
        except Exception:
            raise ValueError('entity_id must be an integer-compatible string')

        qs = (
            ActivityLog.objects.filter(
                tenant=tenant,
                entity_type=entity_type,
                entity_id=entity_id_int,
            )
            .select_related('created_by')
            .order_by('-created_on')
        )

        items = []
        for row in qs[:limit_int]:
            items.append(
                {
                    'id': str(row.id),
                    'created_on': getattr(row, 'created_on', None),
                    'title': row.title,
                    'content': row.content,
                    'created_by': getattr(getattr(row, 'created_by', None), 'username', None),
                }
            )

        return {
            'entity_type': entity_type,
            'entity_id': entity_id_int,
            'count': len(items),
            'items': items,
        }

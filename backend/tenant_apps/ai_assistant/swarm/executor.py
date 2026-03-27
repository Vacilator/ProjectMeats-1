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
            'name': 'get_record_detail',
            'description': 'Fetch a lightweight record detail payload (tenant-scoped).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity_type': {'type': 'string', 'description': 'Entity type (supplier, customer, purchase_order, ...)'},
                    'entity_id': {'type': 'string', 'description': 'Primary key value (uuid/int accepted as string)'},
                },
                'required': ['entity_type', 'entity_id'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_entity_details',
            'description': 'Fetch full entity details payload (maps to system EntityViewSet.retrieve).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'type': {'type': 'string', 'description': 'Entity type (supplier, customer, product, purchase_order, ...)'} ,
                    'id': {'type': 'string', 'description': 'Entity primary key value'}
                },
                'required': ['type', 'id'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_task',
            'description': 'Create a task for the current user (implemented as an in-app notification).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string', 'description': 'Short task title'},
                    'message': {'type': 'string', 'description': 'Task description/message'},
                    'entity_type': {'type': 'string', 'description': 'Optional related entity type'},
                    'entity_id': {'type': 'string', 'description': 'Optional related entity id'},
                },
                'required': ['title', 'message'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'ingest_feedback',
            'description': 'Save a user correction as a tenant-scoped lesson learned for future responses.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'user_message': {'type': 'string', 'description': 'The user message being corrected (optional but recommended).'},
                    'assistant_message': {'type': 'string', 'description': 'The assistant message being corrected (optional but recommended).'},
                    'user_correction': {'type': 'string', 'description': 'What the user says is the correct information.'},
                    'lesson_text': {'type': 'string', 'description': 'Canonical lesson to remember and apply in future answers.'},
                    'entity_type': {'type': 'string', 'description': 'Optional entity type the lesson applies to (purchase_order, supplier, customer, product, ...).'},
                    'entity_id': {'type': 'string', 'description': 'Optional entity id the lesson applies to.'},
                    'tags': {'type': 'object', 'description': 'Optional structured tags/metadata for the lesson.'},
                },
                'required': ['user_correction', 'lesson_text'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_recent_errors',
            'description': 'Fetch the most recent Sentry issues for the active tenant_id (last 5).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'tenant_id': {'type': 'string', 'description': 'Tenant UUID (must match active tenant)'}
                },
                'required': ['tenant_id'],
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
            'name': 'get_entity_analytics',
            'description': 'Run a tenant-scoped analytics aggregation (e.g., top purchased products, revenue by customer).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity_type': {'type': 'string', 'description': 'Entity type to analyze (product, customer, supplier, purchase_order, sales_order).'},
                    'metric': {'type': 'string', 'description': 'Metric key (top_purchased_products, revenue_by_customer, top_suppliers_by_po_value, purchase_order_trends).'},
                    'days': {'type': 'integer', 'description': 'Optional lookback window in days (default 30).'},
                    'limit': {'type': 'integer', 'description': 'Optional limit for ranked results (default 10).'},
                },
                'required': ['entity_type', 'metric'],
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
            'get_record_detail': self._get_record_detail,
            'get_entity_details': self._get_entity_details,
            'create_task': self._create_task,
            'ingest_feedback': self._ingest_feedback,
            'get_recent_errors': self._get_recent_errors,
            'create_record': self._create_record,
            'search_entities': self._search_entities,
            'get_entity_analytics': self._get_entity_analytics,
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
                return json.dumps({'ok': False, 'tool': tool_name, 'error': f"Unknown tool: {tool_name}"})

            tenant_id = str(getattr(tenant, 'id', '') or '')
            if not tenant_id:
                return json.dumps(
                    {
                        'ok': False,
                        'tool': tool_name,
                        'error': 'Tenant context missing; refusing to execute tool under RLS.',
                    },
                    default=str,
                )

            # Defense-in-depth: always assert the RLS session var before every tool call.
            rls = set_current_tenant(tenant_id)
            if not rls.ok:
                return json.dumps(
                    {
                        'ok': False,
                        'tool': tool_name,
                        'tenant_id': tenant_id,
                        'error': (
                            'Failed to set PostgreSQL RLS session variables for this request. '
                            'This prevents safe tenant-scoped queries and may indicate a DB connection/session issue. '
                            f"Details: {rls.error}"
                        ),
                    },
                    default=str,
                )

            result = fn(arguments or {}, tenant, user)
            return json.dumps({'ok': True, 'tool': tool_name, 'tenant_id': tenant_id, 'data': result}, default=str)
        except Exception as e:
            tenant_id = str(getattr(tenant, 'id', '') or '')
            logger.warning('Tool execution failed tool=%s tenant=%s: %s', tool_name, tenant_id, str(e), exc_info=True)
            return json.dumps(
                {
                    'ok': False,
                    'tool': tool_name,
                    'tenant_id': tenant_id or None,
                    'error': (
                        f"Tool '{tool_name}' failed for tenant {tenant_id or 'UNKNOWN'}. "
                        'This may be due to missing data, invalid arguments, or RLS constraints. '
                        f"Details: {type(e).__name__}: {e}"
                    ),
                },
                default=str,
            )

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


    def _get_record_detail(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        entity_type = (arguments.get('entity_type') or '').strip().lower()
        entity_id = (arguments.get('entity_id') or '').strip()
        if not entity_type or not entity_id:
            raise ValueError('Missing required parameters: entity_type, entity_id')

        from apps.core.services.universal_search import UniversalSearchService

        service = UniversalSearchService(tenant=tenant)
        detail = service.get_record_detail(entity_type, entity_id)
        if not detail:
            return {'found': False, 'entity_type': entity_type, 'entity_id': entity_id}
        return {'found': True, 'record': detail}

    def _get_entity_details(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Return the same payload as GET /api/v1/system/entities/{type}/{id}/."""
        entity_type = (arguments.get('type') or '').strip().lower()
        entity_id = (arguments.get('id') or '').strip()
        if not entity_type or not entity_id:
            raise ValueError('Missing required parameters: type, id')

        # Call the same serializer logic as EntityViewSet.retrieve without making HTTP requests.
        from apps.system.views.entity_viewset import EntityViewSet

        class _ToolRequest:
            def __init__(self, tenant, user):
                self.tenant = tenant
                self.user = user
                self.query_params = {}

        req = _ToolRequest(tenant=tenant, user=user)
        view = EntityViewSet()

        entity, resolved_type, _Model = view._get_entity_or_404(req, type=entity_type, pk=entity_id)
        can_edit = bool(getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False))
        return view._serialize_entity_detail(entity, resolved_type, can_edit=can_edit)

    def _create_task(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Create a task for the current user (implemented as an in-app notification)."""
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to create tasks')

        title = (arguments.get('title') or '').strip()
        message = (arguments.get('message') or '').strip()
        if not title or not message:
            raise ValueError('Missing required parameters: title, message')

        entity_type = (arguments.get('entity_type') or '').strip().lower() or None
        entity_id = (arguments.get('entity_id') or '').strip() or None

        action_url = ''
        metadata: Dict[str, Any] = {}

        if entity_type and entity_id:
            try:
                from apps.core.services.universal_search import UniversalSearchService

                svc = UniversalSearchService(tenant=tenant)
                detail = svc.get_record_detail(entity_type, entity_id)
                if detail and detail.get('route'):
                    action_url = str(detail.get('route') or '')
            except Exception:
                pass

        entity_uuid = None
        if entity_id:
            try:
                from uuid import UUID

                entity_uuid = UUID(str(entity_id))
            except Exception:
                metadata['entity_id'] = str(entity_id)

        from tenant_apps.workflows.models import NotificationType, NotificationPriority, UserNotification

        row = UserNotification.objects.create(
            user=user,
            tenant=tenant,
            notification_type=NotificationType.TASK_ASSIGNED,
            title=title,
            message=message,
            priority=NotificationPriority.NORMAL,
            entity_type=entity_type or '',
            entity_id=entity_uuid,
            action_url=action_url,
            metadata=metadata,
        )

        return {
            'id': str(row.id),
            'title': row.title,
            'message': row.message,
            'action_url': row.action_url,
        }

    def _ingest_feedback(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Persist a tenant-scoped lesson learned from user feedback."""

        user_correction = (arguments.get('user_correction') or '').strip()
        lesson_text = (arguments.get('lesson_text') or '').strip()
        if not user_correction or not lesson_text:
            raise ValueError('Missing required parameters: user_correction, lesson_text')

        from tenant_apps.ai_assistant.services.memory_service import ingest_feedback

        row = ingest_feedback(
            tenant=tenant,
            user=user,
            user_message=str(arguments.get('user_message') or ''),
            assistant_message=str(arguments.get('assistant_message') or ''),
            user_correction=user_correction,
            lesson_text=lesson_text,
            entity_type=str(arguments.get('entity_type') or ''),
            entity_id=str(arguments.get('entity_id') or ''),
            tags=arguments.get('tags') if isinstance(arguments.get('tags'), dict) else {},
        )

        return {
            'id': str(row.id),
            'created_on': getattr(row, 'created_on', None),
            'lesson_text': row.lesson_text,
        }

    def _get_recent_errors(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Fetch recent Sentry issues tagged with the active tenant_id."""
        import os

        tenant_id_arg = str(arguments.get('tenant_id') or '').strip()
        active_tenant_id = str(getattr(tenant, 'id', '') or '')

        if not active_tenant_id:
            raise ValueError('Tenant context missing')
        if not tenant_id_arg:
            raise ValueError('Missing required parameter: tenant_id')
        if tenant_id_arg != active_tenant_id:
            raise ValueError('tenant_id must match the active tenant')

        from tenant_apps.ai_assistant.services.sentry_issues import fetch_recent_sentry_issues_for_tenant

        token = os.environ.get('SENTRY_AUTH_TOKEN')
        org = os.environ.get('SENTRY_ORG_SLUG') or os.environ.get('SENTRY_ORG') or 'meats-central'
        base_url = os.environ.get('SENTRY_BASE_URL') or 'https://sentry.io'

        return fetch_recent_sentry_issues_for_tenant(
            tenant_id=active_tenant_id,
            token=token,
            org_slug=org,
            base_url=base_url,
            limit=5,
            timeout_seconds=10,
        )

    def _search_entities(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Search tenant entities via UniversalSearchService (unified search standard)."""
        query = (arguments.get('query') or '').strip()
        if not query:
            raise ValueError('Missing required parameters: query')

        entity_types = arguments.get('entity_types')
        if not isinstance(entity_types, list) or not entity_types:
            entity_types = None

        limit = arguments.get('limit')
        try:
            limit_int = int(limit) if limit is not None else 5
        except Exception:
            limit_int = 5
        limit_int = max(1, min(25, limit_int))

        from apps.core.services.universal_search import UniversalSearchService

        tenant_id = str(getattr(tenant, 'id', '') or '')
        service = UniversalSearchService(tenant=tenant)
        results = service.search(query, limit_per_type=limit_int, entity_types=entity_types)

        # UniversalSearchService returns a stable dict, but we defensively normalize the "empty" case.
        results_obj = results if isinstance(results, dict) else {'results': results}
        groups = results_obj.get('results') if isinstance(results_obj.get('results'), list) else []
        total = 0
        for g in groups:
            if isinstance(g, dict) and isinstance(g.get('items'), list):
                total += len(g.get('items') or [])

        message = None
        if total == 0:
            message = (
                f"The search for '{query}' returned 0 records for tenant {tenant_id}. "
                'This may be due to lack of data or RLS constraints.'
            )

        return {
            'query': query,
            'entity_types': entity_types,
            'count': total,
            'results': groups,
            'message': message,
        }

    def _get_entity_analytics(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Run tenant-scoped aggregations using the same sources as the Reports API."""
        from datetime import timedelta

        from django.db.models import Avg, Count, Sum
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        entity_type = (arguments.get('entity_type') or '').strip().lower()
        metric = (arguments.get('metric') or '').strip().lower()

        # Friendly metric/entity aliases so the LLM can answer natural questions like
        # "most purchased" or "highest revenue" without knowing internal keys.
        metric_aliases = {
            'most_purchased': 'top_purchased_products',
            'most_purchased_products': 'top_purchased_products',
            'top_purchased': 'top_purchased_products',
            'highest_revenue': 'revenue_by_customer',
            'top_revenue': 'revenue_by_customer',
            'highest_revenue_customers': 'revenue_by_customer',
            'top_suppliers': 'top_suppliers_by_po_value',
        }
        metric = metric_aliases.get(metric, metric)

        entity_aliases = {
            'products': 'product',
            'customers': 'customer',
            'suppliers': 'supplier',
            'purchase_orders': 'purchase_order',
        }
        entity_type = entity_aliases.get(entity_type, entity_type)

        if not entity_type or not metric:
            raise ValueError('Missing required parameters: entity_type, metric')

        try:
            days = int(arguments.get('days') or 30)
        except Exception:
            days = 30
        days = max(1, min(365, days))

        try:
            limit = int(arguments.get('limit') or 10)
        except Exception:
            limit = 10
        limit = max(1, min(25, limit))

        end = timezone.localdate()
        start = end - timedelta(days=days)

        data: list[dict[str, Any]] = []

        if metric == 'top_purchased_products' and entity_type == 'product':
            from tenant_apps.purchase_orders.models import PurchaseOrder

            rows = (
                PurchaseOrder.objects.for_tenant(tenant)
                .filter(order_date__gte=start, order_date__lte=end, product__isnull=False)
                .values('product_id', 'product__name', 'product__product_code')
                .annotate(
                    orders=Count('id'),
                    total_amount=Sum('total_amount'),
                    total_weight=Sum('total_weight'),
                )
                .order_by('-orders', '-total_amount')[:limit]
            )
            data = [
                {
                    'product_id': str(r['product_id']),
                    'product_code': r.get('product__product_code') or '',
                    'name': r.get('product__name') or 'Unknown',
                    'orders': int(r.get('orders') or 0),
                    'total_amount': float(r.get('total_amount') or 0),
                    'total_weight': float(r.get('total_weight') or 0),
                }
                for r in rows
            ]

        elif metric == 'revenue_by_customer' and entity_type == 'customer':
            from tenant_apps.sales_orders.models import SalesOrder

            rows = (
                SalesOrder.objects.for_tenant(tenant)
                .filter(date_time_stamp__date__gte=start, date_time_stamp__date__lte=end)
                .values('customer_id', 'customer__name')
                .annotate(
                    orders=Count('id'),
                    revenue=Sum('total_amount'),
                    total_weight=Sum('total_weight'),
                    avg_order_value=Avg('total_amount'),
                )
                .order_by('-revenue')[:limit]
            )
            data = [
                {
                    'customer_id': str(r['customer_id']),
                    'name': r.get('customer__name') or 'Unknown',
                    'orders': int(r.get('orders') or 0),
                    'revenue': float(r.get('revenue') or 0),
                    'total_weight': float(r.get('total_weight') or 0),
                    'avg_order_value': float(r.get('avg_order_value') or 0),
                }
                for r in rows
            ]

        elif metric == 'top_suppliers_by_po_value' and entity_type == 'supplier':
            from tenant_apps.purchase_orders.models import PurchaseOrder

            rows = (
                PurchaseOrder.objects.for_tenant(tenant)
                .filter(order_date__gte=start, order_date__lte=end)
                .values('supplier_id', 'supplier__name')
                .annotate(
                    orders=Count('id'),
                    revenue=Sum('total_amount'),
                )
                .order_by('-revenue')[:limit]
            )
            data = [
                {
                    'supplier_id': str(r['supplier_id']),
                    'name': r.get('supplier__name') or 'Unknown',
                    'orders': int(r.get('orders') or 0),
                    'revenue': float(r.get('revenue') or 0),
                }
                for r in rows
            ]

        elif metric == 'purchase_order_trends' and entity_type == 'purchase_order':
            from tenant_apps.purchase_orders.models import PurchaseOrder

            rows = (
                PurchaseOrder.objects.for_tenant(tenant)
                .filter(order_date__gte=start, order_date__lte=end)
                .annotate(bucket=TruncMonth('order_date'))
                .values('bucket')
                .annotate(
                    orders=Count('id'),
                    value=Sum('total_amount'),
                    averageValue=Avg('total_amount'),
                )
                .order_by('bucket')
            )
            data = [
                {
                    'bucket': (r['bucket'].date().isoformat() if r.get('bucket') else None),
                    'orders': int(r.get('orders') or 0),
                    'value': float(r.get('value') or 0),
                    'averageValue': float(r.get('averageValue') or 0),
                }
                for r in rows
            ]

        else:
            raise ValueError(
                f"Unsupported analytics request: entity_type='{entity_type}' metric='{metric}'. "
                'Supported metrics: top_purchased_products (product), revenue_by_customer (customer), '
                'top_suppliers_by_po_value (supplier), purchase_order_trends (purchase_order).'
            )

        tenant_id = str(getattr(tenant, 'id', '') or '')
        message = None
        if not data:
            message = (
                f"The analytics query '{metric}' returned 0 rows for tenant {tenant_id}. "
                'This may be due to lack of data or RLS constraints.'
            )

        return {
            'entity_type': entity_type,
            'metric': metric,
            'date_range': {'start': start.isoformat(), 'end': end.isoformat()},
            'count': len(data),
            'data': data,
            'message': message,
        }

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

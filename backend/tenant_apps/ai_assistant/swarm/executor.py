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
            'name': 'fetch_emails',
            'description': (
                "Search the user's connected Microsoft Outlook mailbox with explicit folder/read/"
                'attachment/search filters. Defaults to inbox when folder is omitted.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'folder': {
                        'type': 'string',
                        'enum': ['inbox', 'sentitems', 'archive'],
                        'description': 'Mailbox folder to search. Defaults to inbox.',
                    },
                    'is_read': {
                        'type': 'boolean',
                        'description': 'Optional read-status filter. Omit to search both read and unread mail.',
                    },
                    'has_attachments': {
                        'type': 'boolean',
                        'description': 'Optional attachment filter. Omit to include both messages with and without attachments.',
                    },
                    'search_query': {
                        'type': 'string',
                        'description': 'Optional keyword query for Graph search, e.g. "invoice".',
                    },
                    'limit': {
                        'type': 'integer',
                        'description': 'Max results to return (default 10, maximum 25).',
                    },
                },
                'additionalProperties': False,
            },
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
            'name': 'create_in_app_notification',
            'description': 'Create an in-app notification for one or more users in the current tenant.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string', 'description': 'Short notification title'},
                    'message': {'type': 'string', 'description': 'Notification message body'},
                    'notification_type': {'type': 'string', 'description': "NotificationType value (task_assigned, mention, system, ...)"},
                    'priority': {'type': 'string', 'description': "NotificationPriority value (low, normal, high, urgent)"},
                    'entity_type': {'type': 'string', 'description': 'Optional related entity type'},
                    'entity_id': {'type': 'string', 'description': 'Optional related entity id'},
                    'action_url': {'type': 'string', 'description': 'Optional URL to navigate to when clicked'},
                    'metadata': {'type': 'object', 'description': 'Optional structured metadata for the notification'},
                    'to_tenant_admins': {'type': 'boolean', 'description': 'If true, notify all active tenant owners/admins'},
                    'user_id': {'type': 'string', 'description': 'Optional recipient user id'},
                    'user_ids': {'type': 'array', 'items': {'type': 'string'}, 'description': 'Optional recipient user ids'},
                    'username': {'type': 'string', 'description': 'Optional recipient username'},
                    'usernames': {'type': 'array', 'items': {'type': 'string'}, 'description': 'Optional recipient usernames'},
                },
                'required': ['title', 'message'],
                'additionalProperties': False,
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
            'description': 'Fetch the most recent Sentry issues for the active tenant (last 5).',
            'parameters': {
                'type': 'object',
                'properties': {},
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'save_memory',
            'description': 'Upsert a durable tenant memory rule/preference (tenant-scoped).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'key': {'type': 'string', 'description': 'Stable upsert key (e.g. vendor:acme:routing_rule).'},
                    'memory_text': {'type': 'string', 'description': 'Human-readable memory text.'},
                    'memory_json': {'type': 'object', 'description': 'Optional structured memory payload.'},
                    'tags': {'type': 'object', 'description': 'Optional tags/metadata.'},
                    'is_active': {'type': 'boolean', 'description': 'Optional active flag (default true).'},
                },
                'required': ['key', 'memory_text'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'retrieve_memory',
            'description': 'Retrieve relevant durable tenant memory entries for a query.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'query': {'type': 'string', 'description': 'Search query.'},
                    'limit': {'type': 'integer', 'description': 'Max results (default 8).'},
                },
                'required': ['query'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_entity_schema',
            'description': 'Get a UI-friendly schema for an entity type (same engine as UniversalEntityForm).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity_type': {'type': 'string', 'description': 'Entity type or alias (e.g., supplier, customers.customer, purchase_order, plant).'},
                },
                'required': ['entity_type'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_entity',
            'description': 'Create a tenant-scoped entity via internal DRF ViewSets (allowlisted types only).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'entity_type': {'type': 'string', 'description': 'Entity type or alias (e.g., supplier, customer, plant, location, contact).'},
                    'payload': {'type': 'object', 'description': 'Field payload for creation.'},
                },
                'required': ['entity_type', 'payload'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'parse_document',
            'description': 'Parse an uploaded AI document (by document_id) via Unstructured API and return extracted text.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'file_id_or_url': {'type': 'string', 'description': 'AIDocument UUID (preferred). URL is not supported for SSRF safety.'},
                },
                'required': ['file_id_or_url'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'extract_purchase_order_fields',
            'description': 'Extract structured PO fields (vendor, PO number, items/weights) from document text.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'text': {'type': 'string', 'description': 'Raw text extracted from parse_document.'},
                },
                'required': ['text'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_purchase_order',
            'description': 'Create a Purchase Order record from extracted fields (draft/pending).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'order_number': {'type': 'string', 'description': 'PO number (maps to PurchaseOrder.order_number).'},
                    'supplier_id': {'type': 'string', 'description': 'Supplier ID (maps to PurchaseOrder.supplier).'},
                    'product_id': {'type': 'string', 'description': 'Optional system.Product id (maps to PurchaseOrder.product).'},
                    'item_description': {'type': 'string', 'description': 'Line item description.'},
                    'quantity': {'type': 'integer', 'description': 'Optional quantity.'},
                    'total_weight': {'type': 'number', 'description': 'Optional total weight (lbs).'},
                    'weight_unit': {'type': 'string', 'description': 'Weight unit (LBS/KG). Default LBS.'},
                    'order_date': {'type': 'string', 'description': 'Optional order date (YYYY-MM-DD). Defaults to today.'},
                    'notes': {'type': 'string', 'description': 'Optional notes.'},
                },
                'required': ['supplier_id', 'item_description'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_supplier',
            'description': 'Create a Supplier from PO header details when missing.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'email': {'type': 'string'},
                    'phone': {'type': 'string'},
                    'address': {'type': 'string'},
                    'city': {'type': 'string'},
                    'state': {'type': 'string'},
                    'zip_code': {'type': 'string'},
                    'country': {'type': 'string'},
                },
                'required': ['name'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_product',
            'description': 'Create or align a Product to the Tier-1 catalog (best-effort; may require staff).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'product_code': {'type': 'string'},
                    'protein_type': {'type': 'string'},
                },
                'required': ['name'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'ingest_purchase_order_document',
            'description': 'End-to-end PO ingestion: parse document, extract fields, create missing supplier, and draft a PO.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'document_id': {'type': 'string', 'description': 'AIDocument UUID.'},
                },
                'required': ['document_id'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'trigger_workform',
            'description': 'Trigger a TenantWorkForm execution and persist an execution record.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'workflow_id': {'type': 'string', 'description': 'TenantWorkForm UUID'},
                    'initial_data': {'type': 'object', 'description': 'Initial trigger/context payload'}
                },
                'required': ['workflow_id'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'draft_vendor_email',
            'description': 'Draft and store an outbound vendor email as a Draft (human-in-the-loop send).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'vendor_id': {'type': 'string', 'description': 'Supplier/Customer UUID'},
                    'context': {'type': 'string', 'description': 'Context for the email (issue, discrepancy, request, etc.)'},
                    'vendor_type': {'type': 'string', 'description': 'supplier|customer (default supplier)'}
                },
                'required': ['vendor_id', 'context'],
                'additionalProperties': False,
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'create_record',
            'description': 'Create a tenant-scoped record (limited to safe entity types). (Legacy tool; prefer create_entity.)',
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
            'fetch_emails': self._fetch_emails,
            'check_unread_emails': self._check_unread_emails,
            'draft_outlook_email': self._draft_outlook_email,
            'get_record_detail': self._get_record_detail,
            'get_entity_details': self._get_entity_details,
            'get_entity_schema': self._get_entity_schema,
            'create_entity': self._create_entity,
            'parse_document': self._parse_document,
            'extract_purchase_order_fields': self._extract_purchase_order_fields,
            'create_purchase_order': self._create_purchase_order,
            'create_supplier': self._create_supplier,
            'create_product': self._create_product,
            'ingest_purchase_order_document': self._ingest_purchase_order_document,
            'create_task': self._create_task,
            'create_in_app_notification': self._create_in_app_notification,
            'trigger_workform': self._trigger_workform,
            'draft_vendor_email': self._draft_vendor_email,
            'ingest_feedback': self._ingest_feedback,
            'get_recent_errors': self._get_recent_errors,
            'save_memory': self._save_memory,
            'retrieve_memory': self._retrieve_memory,
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
        from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import error_payload_from_exception

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

            # Implicit tenant scoping: never require the LLM to provide tenant_id.
            # If a tool previously took tenant_id, inject it from the authenticated session.
            safe_args = dict(arguments or {})
            if tool_name == 'get_recent_errors' and not safe_args.get('tenant_id'):
                safe_args['tenant_id'] = tenant_id

            result = fn(safe_args, tenant, user)
            return json.dumps({'ok': True, 'tool': tool_name, 'tenant_id': tenant_id, 'data': result}, default=str)
        except Exception as e:
            tenant_id = str(getattr(tenant, 'id', '') or '')
            logger.warning('Tool execution failed tool=%s tenant=%s: %s', tool_name, tenant_id, str(e), exc_info=True)
            return json.dumps(
                error_payload_from_exception(
                    tool_name=tool_name,
                    tenant_id=tenant_id or None,
                    exc=e,
                ),
                default=str,
            )

    def _fetch_emails(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            raise ValueError('Tenant not resolved; cannot access email tools')

        folder = arguments.get('folder') or 'inbox'
        is_read = arguments.get('is_read') if 'is_read' in arguments else None
        has_attachments = arguments.get('has_attachments') if 'has_attachments' in arguments else None
        search_query = arguments.get('search_query')
        limit = arguments.get('limit')

        return EmailIngestionService(tenant).fetch_emails_for_ai(
            folder=folder,
            is_read=is_read,
            has_attachments=has_attachments,
            search_query=search_query,
            limit=limit,
        )

    def _check_unread_emails(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        alias_arguments = {
            'folder': 'inbox',
            'is_read': False,
            'has_attachments': True,
            'limit': arguments.get('limit') if 'limit' in arguments else 10,
        }
        return self._fetch_emails(alias_arguments, tenant, user)

    def _draft_outlook_email(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Send an email using the tenant's Microsoft Graph connection."""
        from apps.integrations.models import ExternalAuthProvider
        from apps.integrations.providers.microsoft import MicrosoftGraphProvider
        from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import ToolExecutionError

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

        from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import decrypt_token_or_error

        access_token, err = decrypt_token_or_error(provider_row=provider_row, token_type='access')
        if err:
            raise ToolExecutionError(
                error_code=err.get('error_code') or 'DECRYPTION_FAILED',
                message=err.get('message') or 'Your Outlook connection needs to be refreshed for security reasons.',
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )

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

    def _get_entity_schema(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Return the same payload as GET /api/v1/system/forms/schema/?entity_type=..."""
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to fetch schema')

        entity_type = (arguments.get('entity_type') or '').strip()
        if not entity_type:
            raise ValueError('Missing required parameter: entity_type')

        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.system.views.forms_schema import SystemFormSchemaView

        factory = APIRequestFactory()
        req = factory.get('/api/v1/system/forms/schema/', {'entity_type': entity_type})
        force_authenticate(req, user=user)
        req.tenant = tenant

        resp = SystemFormSchemaView.as_view()(req)
        if getattr(resp, 'status_code', 200) >= 400:
            data = getattr(resp, 'data', None) or {}
            msg = None
            if isinstance(data, dict):
                msg = data.get('error') or data.get('detail')
            raise ValueError(msg or f'Failed to get schema for entity_type={entity_type}')

        return getattr(resp, 'data', {})

    def _create_entity(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Create an entity via internal DRF ViewSets.

        This is allowlisted to prevent unsafe arbitrary writes.
        """
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to create entities')

        raw_entity_type = (arguments.get('entity_type') or '').strip().lower()
        payload = arguments.get('payload')
        if not raw_entity_type or not isinstance(payload, dict):
            raise ValueError('Missing required parameters: entity_type, payload')

        forbidden_keys = {'tenant', 'tenant_id', 'owner', 'created_by', 'modified_by'}
        forbidden_present = sorted([k for k in payload.keys() if k in forbidden_keys])
        if forbidden_present:
            raise ValueError(f"Forbidden keys in payload: {', '.join(forbidden_present)}")

        from apps.system.services.entity_introspection import ENTITY_ID_ALIASES
        resolved = ENTITY_ID_ALIASES.get(raw_entity_type, raw_entity_type)

        canonical_map = {
            'suppliers.supplier': 'supplier',
            'customers.customer': 'customer',
            'contacts.contact': 'contact',
            'plants.plant': 'plant',
            'locations.location': 'location',
            'purchase_orders.purchaseorder': 'purchase_order',
            'sales_orders.salesorder': 'sales_order',
            'invoices.invoice': 'invoice',
        }

        entity_key = canonical_map.get(resolved)
        if not entity_key:
            # If it's already a simple key (supplier/customer/plant/location/contact), accept it.
            entity_key = raw_entity_type if raw_entity_type in {
                'supplier', 'customer', 'contact', 'plant', 'location', 'purchase_order', 'sales_order', 'invoice'
            } else None

        if not entity_key:
            raise ValueError(f'Unsupported entity_type: {raw_entity_type}')

        # Allowlist of viewsets (expand deliberately)
        from tenant_apps.suppliers.views import SupplierViewSet
        from tenant_apps.customers.views import CustomerViewSet
        from tenant_apps.contacts.views import ContactViewSet
        from tenant_apps.plants.views import PlantViewSet
        from tenant_apps.locations.views import LocationViewSet

        viewset_map = {
            'supplier': (SupplierViewSet, '/api/v1/suppliers/'),
            'customer': (CustomerViewSet, '/api/v1/customers/'),
            'contact': (ContactViewSet, '/api/v1/contacts/'),
            'plant': (PlantViewSet, '/api/v1/plants/'),
            'location': (LocationViewSet, '/api/v1/locations/'),
        }

        entry = viewset_map.get(entity_key)
        if not entry:
            raise ValueError(f'Unsupported entity_type for create_entity: {entity_key}')

        viewset_cls, url = entry

        from rest_framework.test import APIRequestFactory, force_authenticate

        factory = APIRequestFactory()
        req = factory.post(url, payload, format='json')
        force_authenticate(req, user=user)
        req.tenant = tenant

        view = viewset_cls.as_view({'post': 'create'})
        resp = view(req)
        if getattr(resp, 'status_code', 200) >= 400:
            data = getattr(resp, 'data', None)
            raise ValueError(f'Create failed for {entity_key}: {data}')

        return getattr(resp, 'data', {})

    def _parse_document(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Parse an uploaded AIDocument via Unstructured API.

        For safety (SSRF), this tool only accepts an AIDocument UUID.
        """
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to parse documents')

        file_id_or_url = (arguments.get('file_id_or_url') or '').strip()
        if not file_id_or_url:
            raise ValueError('Missing required parameter: file_id_or_url')

        # Safety (SSRF): only accept an uploaded AIDocument identifier (UUID or integer ID). URL fetch is disabled.
        document_uuid = None
        document_int = None

        try:
            from uuid import UUID

            document_uuid = UUID(file_id_or_url)
        except Exception:
            document_uuid = None

        if document_uuid is None:
            try:
                document_int = int(file_id_or_url)
            except Exception as e:
                raise ValueError(
                    'parse_document requires an uploaded document_id (UUID or integer). URL fetch is disabled for SSRF safety.'
                ) from e

        from tenant_apps.ai_assistant.models import AIDocument
        from tenant_apps.ai_assistant.services.document_parser import is_tabular_document, parse_tabular_document

        doc = AIDocument.objects.filter(id=(document_int or document_uuid), tenant=tenant, owner=user).first()
        if not doc:
            raise ValueError('Document not found for this tenant/user')

        if not doc.file:
            raise ValueError('Document record has no file attached')

        filename = doc.original_filename or 'document'
        content_type = doc.content_type or 'application/octet-stream'

        if is_tabular_document(filename=filename, content_type=content_type):
            from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import ToolExecutionError

            try:
                with doc.file.open('rb') as f:
                    parsed = parse_tabular_document(
                        f,
                        filename=filename,
                        content_type=content_type,
                    )
            except Exception as exc:
                raise ToolExecutionError(
                    error_code='DOCUMENT_PARSE_FAILED',
                    message='The spreadsheet file could not be parsed.',
                    hint='Upload a valid CSV or Excel file, or resave the spreadsheet and try again.',
                    retryable=False,
                    details=f'{type(exc).__name__}: {exc}',
                ) from exc
            return {
                'document_id': str(doc.id),
                'filename': filename,
                'content_type': content_type,
                'text': parsed.text,
                'elements_preview': list(parsed.preview),
                'parser': 'tabular_markdown',
                'truncated': parsed.truncated,
                'warnings': list(parsed.warnings),
            }

        from django.conf import settings

        base_url = (getattr(settings, 'UNSTRUCTURED_API_URL', '') or '').strip()
        api_key = (getattr(settings, 'UNSTRUCTURED_API_KEY', '') or '').strip()

        if not base_url or not api_key:
            raise ValueError('Unstructured API is not configured (missing UNSTRUCTURED_API_URL/UNSTRUCTURED_API_KEY)')

        # Default to the common hosted API path if a base host was provided.
        endpoint = base_url.rstrip('/')
        if '/general/' not in endpoint and not endpoint.endswith('/general/v0/general'):
            endpoint = f"{endpoint}/general/v0/general"

        import requests

        try:
            with doc.file.open('rb') as f:
                # Stream the file object; avoid f.read() to reduce memory pressure for large PDFs.
                files = {
                    'files': (filename, f, content_type),
                }

                # Auth header varies by Unstructured deployment. Send both to be compatible.
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'unstructured-api-key': api_key,
                    'Accept': 'application/json',
                }

                resp = requests.post(
                    endpoint,
                    files=files,
                    headers=headers,
                    timeout=60,
                )
        except requests.exceptions.RequestException as exc:
            logger.warning('[parse_document] Unstructured request failed (endpoint=%s): %s', endpoint, str(exc))
            return {
                'status': 'error',
                'error_code': 'UNSTRUCTURED_UNREACHABLE',
                'message': 'The document parsing service is currently unreachable. Please try again later.',
                'endpoint': endpoint,
            }

        if resp.status_code in (502, 503, 504):
            return {
                'status': 'error',
                'error_code': 'UNSTRUCTURED_UNREACHABLE',
                'message': f'The document parsing service is currently unreachable (HTTP {resp.status_code}).',
                'endpoint': endpoint,
            }

        if resp.status_code in (401, 403):
            logger.error(
                '[parse_document] Unstructured auth failed (HTTP %s). Check UNSTRUCTURED_API_KEY/header format.',
                resp.status_code,
            )
            return {
                'status': 'error',
                'error_code': 'UNSTRUCTURED_AUTH_FAILED',
                'message': f'Document parsing service authentication failed (HTTP {resp.status_code}).',
                'endpoint': endpoint,
            }

        if resp.status_code >= 400:
            raise ValueError(f'Unstructured API error {resp.status_code}: {resp.text[:500]}')

        try:
            elements = resp.json()
        except Exception as e:
            raise ValueError('Unstructured API returned non-JSON response') from e

        if not isinstance(elements, list):
            raise ValueError('Unexpected Unstructured API response shape')

        texts: list[str] = []
        for el in elements[:500]:
            if not isinstance(el, dict):
                continue
            t = el.get('text')
            if isinstance(t, str) and t.strip():
                texts.append(t.strip())

        combined_text = "\n".join(texts)

        return {
            'document_id': str(doc.id),
            'filename': filename,
            'content_type': content_type,
            'text': combined_text[:20000],
            'elements_preview': elements[:50],
        }

    def _extract_purchase_order_fields(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Extract a normalized PO payload from raw document text.

        Best-effort:
        - If OpenAI is configured, prefer JSON extraction.
        - Otherwise use a deterministic regex fallback (sufficient for tests / degraded envs).
        """
        raw_text = (arguments.get('text') or '').strip()
        if not raw_text:
            raise ValueError('Missing required parameter: text')

        # Deterministic fallback first so we always return something stable.
        import re

        text = raw_text.replace('\r', '\n')
        compact = re.sub(r'\s+', ' ', text)

        order_number = None
        m = re.search(r'\bPO[\s\-#]*([0-9]{3,})\b', compact, re.IGNORECASE)
        if m:
            order_number = m.group(1)

        vendor_name = None
        m = re.search(r'\bVendor\s*[:\-]\s*([^\n]+)', text, re.IGNORECASE)
        if m:
            vendor_name = m.group(1).strip()[:255]

        # Weight like "40,000 lbs".
        total_weight = None
        weight_unit = 'LBS'
        m = re.search(r'([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*(lbs|lb|pounds|kg|kgs)\b', compact, re.IGNORECASE)
        if m:
            num = m.group(1).replace(',', '')
            try:
                total_weight = float(num)
            except Exception:
                total_weight = None
            unit = m.group(2).lower()
            weight_unit = 'KG' if unit.startswith('kg') else 'LBS'

        item_description = None
        m = re.search(r'\b(Item|Description)\s*[:\-]\s*([^\n]+)', text, re.IGNORECASE)
        if m:
            item_description = m.group(2).strip()[:500]

        # OpenAI extractor (optional) – may override fallback values.
        from django.conf import settings
        openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=openai_api_key, organization=getattr(settings, 'OPENAI_ORG_ID', None) or None)
                prompt = (
                    'Extract purchase order fields from this text and return JSON with keys: '
                    '{order_number, vendor_name, items:[{description,total_weight,weight_unit,quantity}]}. '\
                    'If a field is missing, use null. Text:\n' + raw_text
                )
                completion = client.chat.completions.create(
                    model='gpt-4o-mini',
                    messages=[{'role': 'user', 'content': prompt}],
                    temperature=0,
                    max_tokens=600,
                )
                content = (completion.choices[0].message.content or '').strip()
                import json as _json

                parsed = _json.loads(content)
                if isinstance(parsed, dict):
                    order_number = str(parsed.get('order_number') or order_number or '').strip() or order_number
                    vendor_name = str(parsed.get('vendor_name') or vendor_name or '').strip() or vendor_name
                    items = parsed.get('items') if isinstance(parsed.get('items'), list) else None
                    if items and isinstance(items[0], dict):
                        item0 = items[0]
                        item_description = str(item0.get('description') or item_description or '').strip() or item_description
                        if total_weight is None and item0.get('total_weight') is not None:
                            try:
                                total_weight = float(item0.get('total_weight'))
                            except Exception:
                                pass
                        if item0.get('weight_unit'):
                            weight_unit = str(item0.get('weight_unit')).upper().strip() or weight_unit
            except Exception as exc:
                logger.warning('[extract_purchase_order_fields] OpenAI extraction failed; using fallback: %s', str(exc))

        items_out = []
        if item_description or total_weight is not None:
            items_out.append(
                {
                    'description': item_description,
                    'total_weight': total_weight,
                    'weight_unit': weight_unit,
                    'quantity': None,
                }
            )

        return {
            'order_number': order_number,
            'vendor_name': vendor_name,
            'items': items_out,
        }

    def _create_supplier(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        payload = {k: v for k, v in (arguments or {}).items() if v not in (None, '')}
        name = str(payload.get('name') or '').strip()
        if not name:
            raise ValueError('Supplier name is required')
        return self._create_entity({'entity_type': 'supplier', 'payload': payload}, tenant, user=user)

    def _create_product(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Best-effort product creation.

        - If the user is staff, create a system.Product (Tier-1 catalog).
        - Otherwise, return a stable error so the agent can proceed without a product FK.
        """
        name = str((arguments.get('name') or '')).strip()
        if not name:
            raise ValueError('Missing required parameter: name')

        if not (getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)):
            return {
                'status': 'error',
                'error_code': 'PRODUCT_CREATE_FORBIDDEN',
                'message': 'Creating Tier-1 catalog products requires a staff user. Proceeding without product linkage.',
                'name': name,
            }

        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.system.views.product_viewset import SystemProductViewSet

        product_code = str(arguments.get('product_code') or '').strip() or None
        protein_type = str(arguments.get('protein_type') or '').strip().lower() or ''

        factory = APIRequestFactory()
        req = factory.post('/api/v1/system/products/', {'name': name, 'product_code': product_code, 'protein_type': protein_type}, format='json')
        force_authenticate(req, user=user)
        req.tenant = tenant

        view = SystemProductViewSet.as_view({'post': 'create'})
        resp = view(req)
        if getattr(resp, 'status_code', 200) >= 400:
            raise ValueError(f'Product create failed: {getattr(resp, "data", None)}')
        return getattr(resp, 'data', {})

    def _create_purchase_order(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to create purchase orders')

        from django.utils import timezone

        supplier_id = str(arguments.get('supplier_id') or '').strip()
        if not supplier_id:
            raise ValueError('Missing required parameter: supplier_id')

        payload: Dict[str, Any] = {
            'supplier': supplier_id,
            'item_description': str(arguments.get('item_description') or '').strip(),
            'notes': str(arguments.get('notes') or '').strip() or None,
        }
        if not payload['item_description']:
            raise ValueError('Missing required parameter: item_description')

        if arguments.get('order_number'):
            payload['order_number'] = str(arguments.get('order_number') or '').strip()

        if arguments.get('product_id'):
            payload['product'] = str(arguments.get('product_id') or '').strip()

        if arguments.get('quantity') is not None:
            try:
                payload['quantity'] = int(arguments.get('quantity'))
            except Exception:
                pass

        if arguments.get('total_weight') is not None:
            try:
                payload['total_weight'] = float(arguments.get('total_weight'))
            except Exception:
                pass

        payload['weight_unit'] = str(arguments.get('weight_unit') or 'LBS').strip().upper() or 'LBS'

        order_date = str(arguments.get('order_date') or '').strip()
        payload['order_date'] = order_date or str(timezone.localdate())

        from rest_framework.test import APIRequestFactory, force_authenticate
        from tenant_apps.purchase_orders.views import PurchaseOrderViewSet

        factory = APIRequestFactory()
        req = factory.post('/api/v1/purchase-orders/', payload, format='json')
        force_authenticate(req, user=user)
        req.tenant = tenant

        view = PurchaseOrderViewSet.as_view({'post': 'create'})
        resp = view(req)
        if getattr(resp, 'status_code', 200) >= 400:
            raise ValueError(f'Purchase order create failed: {getattr(resp, "data", None)}')

        return getattr(resp, 'data', {})

    def _ingest_purchase_order_document(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Autonomous PO ingestion entry point."""
        document_id = str(arguments.get('document_id') or '').strip()
        if not document_id:
            raise ValueError('Missing required parameter: document_id')

        parsed = self._parse_document({'file_id_or_url': document_id}, tenant, user=user)
        if isinstance(parsed, dict) and parsed.get('status') == 'error':
            return parsed

        text = parsed.get('text') if isinstance(parsed, dict) else None
        if not isinstance(text, str) or not text.strip():
            return {
                'status': 'error',
                'error_code': 'PARSE_EMPTY',
                'message': 'Parsed document text was empty; cannot ingest PO.',
            }

        extracted = self._extract_purchase_order_fields({'text': text}, tenant, user=user)
        vendor_name = str(extracted.get('vendor_name') or '').strip()
        order_number = str(extracted.get('order_number') or '').strip() or None

        items = extracted.get('items') if isinstance(extracted.get('items'), list) else []
        item0 = items[0] if items else {}
        description = str((item0 or {}).get('description') or '').strip() or 'PO Item'
        total_weight = (item0 or {}).get('total_weight', None)
        weight_unit = str((item0 or {}).get('weight_unit') or 'LBS').strip().upper() or 'LBS'

        from tenant_apps.suppliers.models import Supplier

        supplier = None
        if vendor_name:
            supplier = Supplier.objects.filter(tenant=tenant, name__iexact=vendor_name).first()

        created_supplier = False
        if not supplier:
            if not vendor_name:
                vendor_name = 'Unknown Vendor'
            created = self._create_supplier({'name': vendor_name}, tenant, user=user)
            supplier_id = str((created or {}).get('id') or '').strip()
            supplier = Supplier.objects.filter(tenant=tenant, id=supplier_id).first()
            created_supplier = True

        # Try to align to Tier-1 system products, but do not block PO creation.
        product_id = None
        try:
            from apps.system.models import Product

            product = Product.objects.filter(name__icontains=description).order_by('id').first()
            if product:
                product_id = str(product.id)
        except Exception:
            product_id = None

        po = self._create_purchase_order(
            {
                'order_number': order_number,
                'supplier_id': str(supplier.id),
                'product_id': product_id,
                'item_description': description,
                'total_weight': total_weight,
                'weight_unit': weight_unit,
            },
            tenant,
            user=user,
        )

        po_number = str(po.get('order_number') or order_number or '').strip() or '(auto)'
        weight_display = None
        if total_weight is not None:
            try:
                weight_display = f"{int(float(total_weight)):,} {weight_unit.lower()}"
            except Exception:
                weight_display = f"{total_weight} {weight_unit.lower()}"

        message = None
        if created_supplier:
            if weight_display:
                message = (
                    f"I couldn't find {vendor_name}, so I created them for you. "
                    f"I've also drafted PO #{po_number} for {weight_display} of {description}."
                )
            else:
                message = (
                    f"I couldn't find {vendor_name}, so I created them for you. "
                    f"I've also drafted PO #{po_number} for {description}."
                )
        else:
            if weight_display:
                message = f"I've drafted PO #{po_number} for {weight_display} of {description}."
            else:
                message = f"I've drafted PO #{po_number} for {description}."

        return {
            'status': 'ok',
            'created_supplier': created_supplier,
            'supplier_id': str(supplier.id) if supplier else None,
            'purchase_order': po,
            'message': message,
        }

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

    def _create_in_app_notification(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Create an in-app notification for one or more users in the current tenant."""
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to create notifications')

        title = (arguments.get('title') or '').strip()
        message = (arguments.get('message') or '').strip()
        if not title or not message:
            raise ValueError('Missing required parameters: title, message')

        from apps.tenants.models import TenantUser
        from django.contrib.auth.models import User
        from tenant_apps.workflows.models import NotificationPriority, NotificationType, UserNotification

        membership = TenantUser.objects.filter(tenant=tenant, user=user, is_active=True).first()
        if not membership:
            raise ValueError('User is not an active member of this tenant')

        is_admin_sender = membership.role in {'owner', 'admin'}

        notify_admins = bool(arguments.get('to_tenant_admins'))
        user_id = (arguments.get('user_id') or '').strip() or None
        username = (arguments.get('username') or '').strip() or None
        user_ids = arguments.get('user_ids') if isinstance(arguments.get('user_ids'), list) else []
        usernames = arguments.get('usernames') if isinstance(arguments.get('usernames'), list) else []

        # Determine recipients.
        recipients: list[User] = []

        if notify_admins:
            admin_ids = list(
                TenantUser.objects.filter(
                    tenant=tenant,
                    is_active=True,
                    role__in=['owner', 'admin'],
                ).values_list('user_id', flat=True)
            )
            if admin_ids:
                recipients.extend(list(User.objects.filter(id__in=admin_ids)))

        if user_id:
            ids = list(TenantUser.objects.filter(tenant=tenant, is_active=True, user_id=user_id).values_list('user_id', flat=True))
            recipients.extend(list(User.objects.filter(id__in=ids)))

        if username:
            ids = list(
                TenantUser.objects.filter(tenant=tenant, is_active=True, user__username=username).values_list('user_id', flat=True)
            )
            recipients.extend(list(User.objects.filter(id__in=ids)))

        if user_ids:
            ids = list(
                TenantUser.objects.filter(tenant=tenant, is_active=True, user_id__in=user_ids).values_list('user_id', flat=True)
            )
            recipients.extend(list(User.objects.filter(id__in=ids)))

        if usernames:
            ids = list(
                TenantUser.objects.filter(tenant=tenant, is_active=True, user__username__in=usernames).values_list('user_id', flat=True)
            )
            recipients.extend(list(User.objects.filter(id__in=ids)))

        # Default to current user.
        if not recipients:
            recipients = [user]

        # Non-admins can only notify themselves.
        if not is_admin_sender:
            if any(r.id != user.id for r in recipients):
                raise ValueError('Only tenant owners/admins can notify other users')

        # De-dupe recipients.
        recipients = list({r.id: r for r in recipients}.values())

        notification_type_raw = str(arguments.get('notification_type') or '').strip() or NotificationType.SYSTEM
        if notification_type_raw not in NotificationType.values:
            raise ValueError(f"Invalid notification_type: {notification_type_raw}")

        priority_raw = str(arguments.get('priority') or '').strip() or NotificationPriority.NORMAL
        if priority_raw not in NotificationPriority.values:
            raise ValueError(f"Invalid priority: {priority_raw}")

        entity_type = (arguments.get('entity_type') or '').strip().lower() or ''
        entity_id = (arguments.get('entity_id') or '').strip() or None

        action_url = (arguments.get('action_url') or '').strip()
        metadata = arguments.get('metadata') if isinstance(arguments.get('metadata'), dict) else {}

        if not action_url and entity_type and entity_id:
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
                metadata = dict(metadata)
                metadata['entity_id'] = str(entity_id)

        created: list[UserNotification] = []
        for recipient in recipients:
            created.append(
                UserNotification.objects.create(
                    user=recipient,
                    tenant=tenant,
                    notification_type=notification_type_raw,
                    title=title,
                    message=message,
                    priority=priority_raw,
                    entity_type=entity_type,
                    entity_id=entity_uuid,
                    action_url=action_url,
                    metadata=metadata,
                )
            )

        return {
            'count': len(created),
            'notification_ids': [str(r.id) for r in created],
            'notified_usernames': [r.user.username for r in created],
        }

    def _trigger_workform(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Trigger a TenantWorkForm execution and persist an execution record."""
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to trigger workforms')

        workflow_id = (arguments.get('workflow_id') or '').strip()
        if not workflow_id:
            raise ValueError('Missing required parameter: workflow_id')

        initial_data = arguments.get('initial_data') if isinstance(arguments.get('initial_data'), dict) else {}

        from uuid import UUID
        from django.utils import timezone

        try:
            workflow_uuid = UUID(str(workflow_id))
        except Exception as e:
            raise ValueError('Invalid workflow_id (expected UUID)') from e

        from apps.system.models import TenantWorkForm
        from apps.system.services.workform_engine import WorkFormEngine
        from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus

        workform = TenantWorkForm.objects.filter(id=workflow_uuid, tenant=tenant).first()
        if not workform:
            raise ValueError('WorkForm not found for this tenant')

        execution = TenantWorkFormExecution.objects.create(
            tenant=tenant,
            workform=workform,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data=initial_data,
            started_by=user,
            started_at=timezone.now(),
        )

        # Execute immediately (scaffold). Future: enqueue async task.
        engine = WorkFormEngine(
            workform,
            initial_context={
                'trigger': initial_data,
                'variables': {},
                'errors': [],
                'execution_id': str(execution.id),
            },
        )

        result = engine.execute(trigger_payload=initial_data)

        execution.context_data = result.context
        if result.success:
            execution.status = TenantWorkFormExecutionStatus.COMPLETED
            execution.completed_at = timezone.now()
        else:
            execution.status = TenantWorkFormExecutionStatus.FAILED
            execution.error_message = str(result.error or '')
            execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'context_data', 'error_message', 'completed_at'])

        return {
            'execution_id': str(execution.id),
            'workflow_id': str(workform.id),
            'status': execution.status,
            'error': execution.error_message,
            'context_preview': (execution.context_data or {}),
        }

    def _draft_vendor_email(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Draft and store an outbound vendor email as a Draft (human-in-the-loop send)."""
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValueError('Authenticated user is required to draft vendor emails')

        vendor_id = (arguments.get('vendor_id') or '').strip()
        context = (arguments.get('context') or '').strip()
        vendor_type = (arguments.get('vendor_type') or '').strip().lower() or 'supplier'

        if not vendor_id or not context:
            raise ValueError('Missing required parameters: vendor_id, context')

        vendor_uuid = None
        vendor_pk = None
        try:
            from uuid import UUID

            vendor_uuid = UUID(str(vendor_id))
        except Exception:
            try:
                vendor_pk = int(str(vendor_id))
            except Exception as e:
                raise ValueError('Invalid vendor_id (expected UUID or integer id)') from e

        entity = None
        entity_email = ''
        entity_name = ''

        if vendor_type == 'supplier':
            from tenant_apps.suppliers.models import Supplier

            lookup_id = vendor_uuid if vendor_uuid is not None else vendor_pk
            entity = Supplier.objects.filter(id=lookup_id, tenant=tenant).prefetch_related('contacts').first()
            if entity:
                entity_name = entity.name
                entity_email = (entity.email or '').strip()
        elif vendor_type == 'customer':
            from tenant_apps.customers.models import Customer

            lookup_id = vendor_uuid if vendor_uuid is not None else vendor_pk
            entity = Customer.objects.filter(id=lookup_id, tenant=tenant).prefetch_related('contacts').first()
            if entity:
                entity_name = entity.name
                entity_email = (getattr(entity, 'email', '') or '').strip()
        else:
            raise ValueError('Invalid vendor_type (expected supplier|customer)')

        if not entity:
            raise ValueError('Vendor not found for this tenant')

        # Fallback: first contact email
        if not entity_email:
            try:
                contact_mgr = getattr(entity, 'contacts', None)
                contact = contact_mgr.first() if contact_mgr is not None else None
                entity_email = (getattr(contact, 'email', '') or '').strip()
            except Exception:
                entity_email = ''

        if not entity_email:
            raise ValueError('Vendor has no email address on record')

        subject = f"{entity_name}: Follow-up"
        if len(context) <= 80:
            subject = f"{entity_name}: {context}"

        sender_name = (getattr(user, 'get_full_name', None)() or '').strip() if hasattr(user, 'get_full_name') else ''
        if not sender_name:
            sender_name = getattr(user, 'username', 'ProjectMeats')

        body = (
            f"Hi {entity_name},\n\n"
            f"{context}\n\n"
            f"Thanks,\n{sender_name}\n"
        )

        from tenant_apps.ai_assistant.models import CommunicationLog, CommunicationStatus

        row = CommunicationLog.objects.create(
            tenant=tenant,
            created_by=user,
            entity_type=vendor_type,
            entity_id=str(vendor_id),
            to_email=entity_email,
            subject=subject[:300],
            body=body,
            status=CommunicationStatus.DRAFT,
            provider='manual',
            metadata={'source': 'draft_vendor_email'},
        )

        return {
            'id': str(row.id),
            'to_email': row.to_email,
            'subject': row.subject,
            'body': row.body,
            'status': row.status,
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

        # Implicit tenant scoping: tenant_id is injected server-side from the authenticated session.
        # If a caller provides tenant_id anyway, treat mismatches as an explicit cross-tenant attempt.
        if tenant_id_arg and tenant_id_arg != active_tenant_id:
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

    def _save_memory(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Upsert a durable tenant memory rule/preference."""

        key = (arguments.get('key') or '').strip()
        memory_text = (arguments.get('memory_text') or '').strip()
        if not key or not memory_text:
            raise ValueError('Missing required parameters: key, memory_text')

        memory_json = arguments.get('memory_json') if isinstance(arguments.get('memory_json'), dict) else {}
        tags = arguments.get('tags') if isinstance(arguments.get('tags'), dict) else {}
        is_active = arguments.get('is_active')
        if is_active is None:
            is_active = True

        from tenant_apps.ai_assistant.models import TenantAIMemory
        from tenant_apps.ai_assistant.services.semantic_indexing import sync_memory_embedding

        row, created = TenantAIMemory.objects.update_or_create(
            tenant=tenant,
            key=key,
            defaults={
                'memory_text': memory_text,
                'memory_json': memory_json,
                'tags': tags,
                'is_active': bool(is_active),
            },
        )
        sync_memory_embedding(row)

        return {
            'id': str(row.id),
            'key': row.key,
            'created': created,
            'is_active': row.is_active,
        }

    def _retrieve_memory(self, arguments: Dict[str, Any], tenant: Any, user: Any = None) -> Any:
        """Retrieve relevant durable tenant memory entries."""

        query = (arguments.get('query') or '').strip()
        if not query:
            raise ValueError('Missing required parameters: query')

        limit = arguments.get('limit')
        try:
            limit_int = int(limit) if limit is not None else 8
        except Exception:
            limit_int = 8
        limit_int = max(1, min(20, limit_int))

        from tenant_apps.ai_assistant.services.tenant_memory_service import get_relevant_memories

        memories = get_relevant_memories(tenant=tenant, query=query, limit=limit_int)
        results = [
            {
                'key': m.key,
                'memory_text': m.memory_text,
                'memory_json': m.memory_json,
                'tags': m.tags,
            }
            for m in memories
        ]

        return {'query': query, 'count': len(results), 'results': results}

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

        # UniversalSearchService returns a stable dict with a flat `results` list.
        results_obj = results if isinstance(results, dict) else {'results': results}
        groups = results_obj.get('results') if isinstance(results_obj.get('results'), list) else []
        total = len(groups)

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
                    'bucket': (r['bucket'].isoformat() if r.get('bucket') else None),
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

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
]


class ToolExecutor:
    """Execute registered tools for a given tenant."""

    def __init__(self):
        self._tools: Dict[str, Callable[[Dict[str, Any], Any, Any], Any]] = {
            'check_unread_emails': self._check_unread_emails,
            'draft_outlook_email': self._draft_outlook_email,
            'search_cockpit_records': self._search_cockpit_records,
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
        """Safe placeholder search over tenant-scoped business models."""
        from tenant_apps.suppliers.models import Supplier

        tenant_id = getattr(tenant, 'id', None)
        if not tenant_id:
            raise ValueError('Tenant not resolved; cannot search records')

        entity_type = (arguments.get('entity_type') or '').strip().lower()
        search_term = (arguments.get('search_term') or '').strip()
        if not entity_type or not search_term:
            raise ValueError('Missing required parameters: entity_type, search_term')

        if entity_type not in {'supplier'}:
            return {
                'entity_type': entity_type,
                'search_term': search_term,
                'results': [],
                'note': 'search_cockpit_records placeholder currently supports entity_type=supplier only',
            }

        qs = Supplier.objects.filter(tenant=tenant, name__icontains=search_term).order_by('name')
        results = [
            {
                'id': s.id,
                'name': s.name,
                'email': s.email,
                'phone': s.phone,
            }
            for s in qs[:10]
        ]

        return {
            'entity_type': 'supplier',
            'search_term': search_term,
            'count': len(results),
            'results': results,
        }

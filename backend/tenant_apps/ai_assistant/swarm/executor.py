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


# Safe default tool list for agent discovery + ChatCompletions tools parameter.
# Keep this intentionally minimal to prevent schema/introspection crashes.
DEFAULT_OPENAI_TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'check_unread_emails',
            'description': 'Check the tenant\'s connected Microsoft Outlook inbox for unread emails and attachments.',
            'parameters': {'type': 'object', 'properties': {}},
        },
    }
]


class ToolExecutor:
    """Execute registered tools for a given tenant."""

    def __init__(self):
        self._tools: Dict[str, Callable[[Dict[str, Any], Any], Any]] = {
            'check_unread_emails': self._check_unread_emails,
        }

    def execute(self, tool_name: str, arguments: Dict[str, Any] | None, tenant: Any) -> str:
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

            result = fn(arguments or {}, tenant)
            return json.dumps({'ok': True, 'tool': tool_name, 'data': result}, default=str)
        except Exception as e:
            logger.warning('Tool execution failed tool=%s: %s', tool_name, str(e), exc_info=True)
            return json.dumps({'ok': False, 'tool': tool_name, 'error': str(e)}, default=str)

    def _check_unread_emails(self, arguments: Dict[str, Any], tenant: Any) -> Any:
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

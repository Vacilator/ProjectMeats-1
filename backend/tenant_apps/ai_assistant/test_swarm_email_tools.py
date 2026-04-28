import json
import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

import requests
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
from tenant_apps.ai_assistant.swarm.router import SwarmOrchestrator, _tool_call_signature
from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import (
    ToolExecutionError,
    build_mail_request,
)
from tenant_apps.integrations.services.email_ingestion import EmailIngestionService


class MicrosoftGraphToolHelperTests(SimpleTestCase):
    def test_build_mail_request_supports_folder_filters_and_search(self):
        request_spec = build_mail_request(
            folder='sentitems',
            is_read=None,
            has_attachments=True,
            search_query='invoice',
            limit=12,
        )

        self.assertEqual(request_spec['folder'], 'sentitems')
        self.assertEqual(request_spec['url_path'], '/me/mailFolders/sentitems/messages')
        self.assertEqual(request_spec['params']['$filter'], 'hasAttachments eq true')
        self.assertEqual(request_spec['params']['$search'], '"invoice"')
        self.assertEqual(request_spec['params']['$top'], 12)
        self.assertEqual(request_spec['headers']['ConsistencyLevel'], 'eventual')
        self.assertTrue(request_spec['requires_filter_fallback'])

    def test_tool_call_signature_ignores_null_optional_arguments(self):
        signature_without_null = _tool_call_signature(
            'fetch_emails',
            {'folder': 'inbox', 'limit': 10},
        )
        signature_with_null = _tool_call_signature(
            'fetch_emails',
            {'folder': 'inbox', 'limit': 10, 'is_read': None},
        )

        self.assertEqual(signature_without_null, signature_with_null)


class EmailIngestionServiceEmailFetchTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username=f'email-tools-{unique}',
            email=f'email-tools-{unique}@example.com',
            password='pw',
        )
        self.tenant = Tenant.objects.create(
            name=f'Email Tenant {unique}',
            slug=f'email-tenant-{unique}',
            contact_email=f'tenant-{unique}@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner')

        self.provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            access_token='placeholder',
            token_expiry=timezone.now() + timedelta(days=1),
            is_active=True,
            connected_email='planner@example.com',
        )
        self.provider.set_encrypted_token('access', 'access-token')
        self.provider.save()

    def _response(self, *, status: int = 200, payload: dict | None = None, text: str = '') -> Mock:
        response = Mock()
        response.status_code = status
        response.json.return_value = payload or {}
        response.text = text
        if status >= 400:
            response.raise_for_status.side_effect = requests.HTTPError(response=response)
        else:
            response.raise_for_status.return_value = None
        return response

    @patch('apps.integrations.providers.MicrosoftGraphProvider')
    @patch('requests.get')
    def test_fetch_emails_falls_back_to_search_only_when_graph_rejects_search_and_filter_combo(
        self,
        mock_get,
        mock_graph_provider,
    ):
        mock_graph_provider.return_value = SimpleNamespace(
            GRAPH_API_BASE='https://graph.microsoft.com/v1.0'
        )
        mock_get.side_effect = [
            self._response(status=400, text='Bad Request'),
            self._response(
                payload={
                    'value': [
                        {
                            'id': 'sent-2',
                            'subject': 'Invoice attached',
                            'receivedDateTime': '2026-04-28T11:00:00Z',
                            'bodyPreview': 'Newest invoice preview',
                            'hasAttachments': True,
                            'isRead': True,
                            'from': {'emailAddress': {'address': 'seller@example.com', 'name': 'Seller'}},
                            'toRecipients': [{'emailAddress': {'address': 'buyer@example.com', 'name': 'Buyer'}}],
                        },
                        {
                            'id': 'sent-1',
                            'subject': 'Invoice without attachment',
                            'receivedDateTime': '2026-04-27T11:00:00Z',
                            'bodyPreview': 'Older invoice preview',
                            'hasAttachments': False,
                            'isRead': True,
                            'from': {'emailAddress': {'address': 'seller@example.com', 'name': 'Seller'}},
                            'toRecipients': [{'emailAddress': {'address': 'buyer@example.com', 'name': 'Buyer'}}],
                        },
                    ]
                }
            ),
        ]

        result = EmailIngestionService(self.tenant).fetch_emails_for_ai(
            folder='sentitems',
            has_attachments=True,
            search_query='invoice',
            limit=10,
        )

        self.assertEqual(result['folder'], 'sentitems')
        self.assertEqual(result['count'], 1)
        self.assertEqual(result['messages'][0]['id'], 'sent-2')

        first_call = mock_get.call_args_list[0]
        self.assertIn('/me/mailFolders/sentitems/messages', first_call.args[0])
        self.assertEqual(first_call.kwargs['params']['$filter'], 'hasAttachments eq true')
        self.assertEqual(first_call.kwargs['params']['$search'], '"invoice"')
        self.assertEqual(first_call.kwargs['headers']['ConsistencyLevel'], 'eventual')

        second_call = mock_get.call_args_list[1]
        self.assertNotIn('$filter', second_call.kwargs['params'])
        self.assertEqual(second_call.kwargs['params']['$top'], 25)


class ToolExecutorEmailToolTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username=f'executor-email-{unique}',
            email=f'executor-email-{unique}@example.com',
            password='pw',
        )
        self.tenant = Tenant.objects.create(
            name=f'Executor Email Tenant {unique}',
            slug=f'executor-email-tenant-{unique}',
            contact_email=f'executor-{unique}@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner')

    @patch('tenant_apps.ai_assistant.swarm.executor.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService.fetch_emails_for_ai')
    def test_execute_returns_structured_graph_error_payload(self, mock_fetch, _mock_rls):
        mock_fetch.side_effect = ToolExecutionError(
            error_code='GRAPH_QUERY_REJECTED',
            message='Microsoft Graph rejected the email search query format.',
            hint='Try simplifying your search terms.',
            retryable=False,
        )

        payload = json.loads(
            ToolExecutor().execute(
                'fetch_emails',
                {'folder': 'sentitems', 'has_attachments': True, 'search_query': 'invoice'},
                self.tenant,
            )
        )

        self.assertFalse(payload['ok'])
        self.assertEqual(payload['tool'], 'fetch_emails')
        self.assertEqual(payload['error']['code'], 'GRAPH_QUERY_REJECTED')
        self.assertEqual(payload['error']['hint'], 'Try simplifying your search terms.')


class SwarmRouterLoopDetectionTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username=f'loop-router-{unique}',
            email=f'loop-router-{unique}@example.com',
            password='pw',
        )
        self.tenant = Tenant.objects.create(
            name=f'Loop Router Tenant {unique}',
            slug=f'loop-router-tenant-{unique}',
            contact_email=f'loop-router-{unique}@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner')

        provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            access_token='placeholder',
            token_expiry=timezone.now() + timedelta(days=1),
            is_active=True,
            connected_email='planner@example.com',
        )
        provider.set_encrypted_token('access', 'access-token')
        provider.save()

    @staticmethod
    def _completion_with_tool_call(arguments: str):
        tool_call = SimpleNamespace(
            id='tc-1',
            type='function',
            function=SimpleNamespace(name='fetch_emails', arguments=arguments),
        )
        message = SimpleNamespace(content='', tool_calls=[tool_call])
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    @staticmethod
    def _completion_with_text(content: str):
        message = SimpleNamespace(content=content, tool_calls=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    @override_settings(OPENAI_API_KEY='test-key', SWARM_TOOL_MAX_ROUNDS=3)
    @patch('tenant_apps.ai_assistant.services.memory_service.get_relevant_lessons', return_value=[])
    @patch('tenant_apps.ai_assistant.services.memory_service.format_lessons_block', return_value='')
    @patch('tenant_apps.ai_assistant.services.tenant_memory_service.get_relevant_memories', return_value=[])
    @patch('tenant_apps.ai_assistant.services.tenant_memory_service.format_memory_block', return_value='')
    @patch('apps.system.services.ai_model_resolver.get_active_openai_model_id', return_value='gpt-4o-mini')
    @patch('tenant_apps.ai_assistant.swarm.router.ToolExecutor.execute')
    @patch('openai.OpenAI')
    def test_run_tool_loop_injects_loop_warning_before_max_rounds_exhaust(
        self,
        mock_openai,
        mock_execute,
        _mock_model,
        _mock_format_memory,
        _mock_memories,
        _mock_format_lessons,
        _mock_lessons,
    ):
        repeated_args = json.dumps(
            {
                'folder': 'sentitems',
                'has_attachments': True,
                'search_query': 'invoice',
            }
        )

        mock_execute.return_value = json.dumps(
            {
                'ok': True,
                'tool': 'fetch_emails',
                'data': {'messages': []},
            }
        )

        fake_client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=Mock(
                        side_effect=[
                            self._completion_with_tool_call(repeated_args),
                            self._completion_with_tool_call(repeated_args),
                            self._completion_with_tool_call(repeated_args),
                            self._completion_with_text('I am stuck on the same email query and need clarification.'),
                        ]
                    )
                )
            )
        )
        mock_openai.return_value = fake_client

        result = SwarmOrchestrator(tenant_id=str(self.tenant.id)).run_tool_loop(
            user_message='Please grab the last sent invoice emails with attachments.',
            tenant=self.tenant,
            user=self.user,
        )

        self.assertEqual(result['response'], 'I am stuck on the same email query and need clarification.')
        self.assertEqual(mock_execute.call_count, 2)
        self.assertTrue(
            any(
                message.get('role') == 'system'
                and 'You are stuck in a loop' in str(message.get('content') or '')
                for message in result['messages']
            )
        )

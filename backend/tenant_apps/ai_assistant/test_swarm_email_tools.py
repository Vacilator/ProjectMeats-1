import json
import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

import requests
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework import serializers as drf_serializers

from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.ai_assistant.models import ChatSession, MessageTypeChoices
from tenant_apps.ai_assistant.serializers import AIDocumentSerializer
from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
from tenant_apps.ai_assistant.swarm.router import (
    SwarmOrchestrator,
    _tool_call_signature,
    build_swarm_system_prompt,
)
from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import (
    ToolExecutionError,
    build_mail_request,
    validate_graph_attachment_metadata,
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
        self.assertEqual(
            request_spec['params']['$expand'],
            'attachments($select=id,name,contentType,size)',
        )
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

    def test_swarm_prompt_includes_attachment_ingest_workflow(self):
        prompt = build_swarm_system_prompt(
            outlook_connected=True,
            outlook_email='planner@example.com',
            outlook_expired=False,
        )

        self.assertIn('ingest_email_attachment(message_id, attachment_id, file_name)', prompt)
        self.assertIn('pass the returned document_id into parse_document', prompt)

    def test_validate_graph_attachment_metadata_rejects_item_attachments(self):
        with self.assertRaises(ToolExecutionError) as exc:
            validate_graph_attachment_metadata(
                {
                    '@odata.type': '#microsoft.graph.itemAttachment',
                }
            )

        self.assertEqual(exc.exception.error_code, 'UNSUPPORTED_ATTACHMENT_TYPE')

    def test_validate_graph_attachment_metadata_rejects_reference_attachments(self):
        with self.assertRaises(ToolExecutionError) as exc:
            validate_graph_attachment_metadata(
                {
                    '@odata.type': '#microsoft.graph.referenceAttachment',
                }
            )

        self.assertEqual(exc.exception.error_code, 'UNSUPPORTED_ATTACHMENT_TYPE')


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

    @patch('apps.integrations.providers.MicrosoftGraphProvider')
    @patch('requests.get')
    def test_fetch_emails_includes_attachment_metadata_from_graph_expand(
        self,
        mock_get,
        mock_graph_provider,
    ):
        mock_graph_provider.return_value = SimpleNamespace(
            GRAPH_API_BASE='https://graph.microsoft.com/v1.0'
        )
        mock_get.return_value = self._response(
            payload={
                'value': [
                    {
                        'id': 'msg-1',
                        'subject': 'Invoice attached',
                        'receivedDateTime': '2026-04-28T11:00:00Z',
                        'bodyPreview': 'Newest invoice preview',
                        'hasAttachments': True,
                        'isRead': True,
                        'from': {'emailAddress': {'address': 'seller@example.com', 'name': 'Seller'}},
                        'toRecipients': [{'emailAddress': {'address': 'buyer@example.com', 'name': 'Buyer'}}],
                        'attachments': [
                            {
                                'id': 'att-1',
                                'name': 'invoice.pdf',
                                'contentType': 'application/pdf',
                                'size': 2048,
                            }
                        ],
                    }
                ]
            }
        )

        result = EmailIngestionService(self.tenant).fetch_emails_for_ai(
            folder='inbox',
            has_attachments=True,
            limit=5,
        )

        self.assertEqual(result['count'], 1)
        self.assertEqual(
            result['messages'][0]['attachments'],
            [
                {
                    'attachment_id': 'att-1',
                    'name': 'invoice.pdf',
                    'content_type': 'application/pdf',
                    'size': 2048,
                    'attachment_type': None,
                }
            ],
        )
        self.assertEqual(
            mock_get.call_args.kwargs['params']['$expand'],
            'attachments($select=id,name,contentType,size)',
        )


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

    @patch('tenant_apps.ai_assistant.swarm.executor.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService._get_existing_attachment_document', return_value=None)
    @patch('tenant_apps.ai_assistant.models.ChatMessage.objects.create')
    @patch('tenant_apps.ai_assistant.models.AIDocument.objects.create')
    @patch('apps.integrations.providers.MicrosoftGraphProvider')
    @patch('requests.get')
    def test_execute_ingests_graph_attachment_into_document_session(
        self,
        mock_get,
        mock_graph_provider,
        mock_aidocument_create,
        mock_chat_message_create,
        _mock_get_existing_document,
        _mock_rls,
    ):
        session = ChatSession.objects.create(
            title='Attachment thread',
            context_data={'tenant_id': str(self.tenant.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        mock_graph_provider.return_value = SimpleNamespace(
            GRAPH_API_BASE='https://graph.microsoft.com/v1.0'
        )

        response = Mock()
        response.status_code = 200
        response.content = b'%PDF-1.4 test payload'
        response.headers = {
            'Content-Type': 'application/pdf',
            'Content-Length': str(len(response.content)),
        }
        response.iter_content.return_value = [response.content]
        response.raise_for_status.return_value = None
        metadata_response = self._response(
            payload={
                '@odata.type': '#microsoft.graph.fileAttachment',
                'id': 'att-456',
                'name': 'invoice.pdf',
                'contentType': 'application/pdf',
                'size': len(response.content),
            }
        )
        mock_get.side_effect = [metadata_response, response]
        fake_document = SimpleNamespace(
            id=uuid.uuid4(),
            tenant=self.tenant,
            owner=self.user,
            session=session,
            session_id=session.id,
            original_filename='invoice.pdf',
            content_type='application/pdf',
            file_size=len(response.content),
            file=SimpleNamespace(url='/media/ai_assistant/documents/invoice.pdf'),
        )
        mock_aidocument_create.return_value = fake_document

        payload = json.loads(
            ToolExecutor().execute(
                'ingest_email_attachment',
                {
                    'message_id': 'msg-123',
                    'attachment_id': 'att-456',
                    'file_name': 'invoice.pdf',
                },
                self.tenant,
                self.user,
                session_id=str(session.id),
            )
        )

        self.assertTrue(payload['ok'])
        self.assertEqual(payload['tool'], 'ingest_email_attachment')

        self.assertEqual(payload['data']['document_id'], str(fake_document.id))
        self.assertEqual(payload['data']['session_id'], str(session.id))
        mock_aidocument_create.assert_called_once()
        mock_chat_message_create.assert_called_once()
        self.assertEqual(
            mock_chat_message_create.call_args.kwargs['message_type'],
            MessageTypeChoices.DOCUMENT,
        )
        self.assertEqual(
            mock_chat_message_create.call_args.kwargs['metadata']['attachment_id'],
            'att-456',
        )
        self.assertEqual(
            mock_chat_message_create.call_args.kwargs['metadata']['source'],
            'microsoft_graph_attachment',
        )
        self.assertFalse(mock_get.call_args_list[0].kwargs.get('stream', False))
        self.assertTrue(mock_get.call_args_list[1].kwargs['stream'])

    @patch('tenant_apps.ai_assistant.swarm.executor.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService._get_existing_attachment_document')
    @patch('tenant_apps.ai_assistant.models.AIDocument.objects.create')
    @patch('requests.get')
    def test_execute_returns_cached_document_for_duplicate_ingest_in_same_session(
        self,
        mock_get,
        mock_aidocument_create,
        mock_get_existing_document,
        _mock_rls,
    ):
        session = ChatSession.objects.create(
            title='Attachment thread',
            context_data={'tenant_id': str(self.tenant.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        existing_document = SimpleNamespace(
            id=uuid.uuid4(),
            original_filename='invoice.pdf',
            content_type='application/pdf',
            file_size=2048,
            session_id=session.id,
            custom_data={
                'source': 'microsoft_graph_attachment',
                'message_id': 'msg-123',
                'attachment_id': 'att-456',
                'ingested_at': '2026-04-28T21:00:00Z',
            },
        )
        mock_get_existing_document.return_value = existing_document

        payload = json.loads(
            ToolExecutor().execute(
                'ingest_email_attachment',
                {
                    'message_id': 'msg-123',
                    'attachment_id': 'att-456',
                    'file_name': 'invoice.pdf',
                },
                self.tenant,
                self.user,
                session_id=str(session.id),
            )
        )

        self.assertTrue(payload['ok'])
        self.assertEqual(payload['data']['status'], 'already_ingested')
        self.assertTrue(payload['data']['cache_hit'])
        self.assertEqual(payload['data']['document_id'], str(existing_document.id))
        mock_get.assert_not_called()
        mock_aidocument_create.assert_not_called()

    @patch('tenant_apps.ai_assistant.swarm.executor.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService._get_existing_attachment_document', return_value=None)
    @patch('tenant_apps.ai_assistant.models.AIDocument.objects.create')
    @patch('apps.integrations.providers.MicrosoftGraphProvider')
    @patch('requests.get')
    def test_execute_rejects_item_attachment_before_download(
        self,
        mock_get,
        mock_graph_provider,
        mock_aidocument_create,
        _mock_get_existing_document,
        _mock_rls,
    ):
        session = ChatSession.objects.create(
            title='Attachment thread',
            context_data={'tenant_id': str(self.tenant.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        mock_graph_provider.return_value = SimpleNamespace(
            GRAPH_API_BASE='https://graph.microsoft.com/v1.0'
        )
        mock_get.return_value = self._response(
            payload={
                '@odata.type': '#microsoft.graph.itemAttachment',
                'id': 'att-456',
                'name': 'forwarded.eml',
                'contentType': 'message/rfc822',
                'size': 1024,
            }
        )

        payload = json.loads(
            ToolExecutor().execute(
                'ingest_email_attachment',
                {
                    'message_id': 'msg-123',
                    'attachment_id': 'att-456',
                    'file_name': 'forwarded.eml',
                },
                self.tenant,
                self.user,
                session_id=str(session.id),
            )
        )

        self.assertFalse(payload['ok'])
        self.assertEqual(payload['error']['code'], 'UNSUPPORTED_ATTACHMENT_TYPE')
        self.assertEqual(mock_get.call_count, 1)
        mock_aidocument_create.assert_not_called()

    @patch('tenant_apps.ai_assistant.swarm.executor.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService._get_existing_attachment_document', return_value=None)
    @patch('tenant_apps.ai_assistant.models.AIDocument.objects.create')
    @patch('apps.integrations.providers.MicrosoftGraphProvider')
    @patch('requests.get')
    def test_execute_rejects_reference_attachment_before_download(
        self,
        mock_get,
        mock_graph_provider,
        mock_aidocument_create,
        _mock_get_existing_document,
        _mock_rls,
    ):
        session = ChatSession.objects.create(
            title='Attachment thread',
            context_data={'tenant_id': str(self.tenant.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        mock_graph_provider.return_value = SimpleNamespace(
            GRAPH_API_BASE='https://graph.microsoft.com/v1.0'
        )
        mock_get.return_value = self._response(
            payload={
                '@odata.type': '#microsoft.graph.referenceAttachment',
                'id': 'att-456',
                'name': 'sharepoint-link.url',
                'contentType': 'application/octet-stream',
                'size': 1024,
            }
        )

        payload = json.loads(
            ToolExecutor().execute(
                'ingest_email_attachment',
                {
                    'message_id': 'msg-123',
                    'attachment_id': 'att-456',
                    'file_name': 'sharepoint-link.url',
                },
                self.tenant,
                self.user,
                session_id=str(session.id),
            )
        )

        self.assertFalse(payload['ok'])
        self.assertEqual(payload['error']['code'], 'UNSUPPORTED_ATTACHMENT_TYPE')
        self.assertEqual(mock_get.call_count, 1)
        mock_aidocument_create.assert_not_called()


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


class AIDocumentAuditSurfaceTests(TestCase):
    def test_serializer_exposes_source_metadata_from_custom_data(self):
        from tenant_apps.ai_assistant.models import AIDocument

        document = AIDocument(
            original_filename='invoice.pdf',
            content_type='application/pdf',
            custom_data={
                'source': 'microsoft_graph_attachment',
                'message_id': 'msg-123',
                'attachment_id': 'att-456',
                'ingested_at': '2026-04-28T21:00:00Z',
                'graph_name': 'invoice.pdf',
                'graph_content_type': 'application/pdf',
            },
        )

        payload = AIDocumentSerializer(instance=document).data

        self.assertEqual(payload['source_metadata']['source'], 'microsoft_graph_attachment')
        self.assertEqual(payload['source_metadata']['message_id'], 'msg-123')
        self.assertEqual(payload['source_metadata']['attachment_id'], 'att-456')

    @patch('tenant_apps.ai_assistant.views.AIDocument.objects.all')
    def test_viewset_filters_documents_by_source_and_session(self, mock_all):
        from tenant_apps.ai_assistant.views import AIDocumentViewSet

        queryset = Mock()
        queryset.select_related.return_value = queryset
        queryset.filter.return_value = queryset
        mock_all.return_value = queryset

        session_id = uuid.uuid4()
        tenant = SimpleNamespace(id=uuid.uuid4())
        user = SimpleNamespace(id=123)

        view = AIDocumentViewSet()
        view.request = SimpleNamespace(
            tenant=tenant,
            user=user,
            query_params={
                'source': 'microsoft_graph_attachment',
                'session': str(session_id),
            },
        )

        result = view.get_queryset()

        self.assertIs(result, queryset)
        queryset.filter.assert_any_call(owner=user)
        queryset.filter.assert_any_call(tenant=tenant)
        queryset.filter.assert_any_call(custom_data__source='microsoft_graph_attachment')
        queryset.filter.assert_any_call(session_id=session_id)

    @patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    def test_perform_create_tags_manual_upload_source_metadata(self, _mock_rls):
        from tenant_apps.ai_assistant.views import AIDocumentViewSet

        user = SimpleNamespace(id=123)
        tenant = SimpleNamespace(id=uuid.uuid4())
        upload = SimpleUploadedFile('manual.pdf', b'%PDF-1.4', content_type='application/pdf')
        serializer = Mock()
        serializer.save.return_value = SimpleNamespace(
            id=uuid.uuid4(),
            session_id=None,
            custom_data={'source': 'manual_upload'},
            original_filename='manual.pdf',
            file=SimpleNamespace(url=''),
            content_type='application/pdf',
            file_size=8,
        )

        view = AIDocumentViewSet()
        view.request = SimpleNamespace(
            tenant=tenant,
            user=user,
            FILES={'file': upload},
        )

        view.perform_create(serializer)

        save_kwargs = serializer.save.call_args.kwargs
        self.assertEqual(save_kwargs['custom_data']['source'], 'manual_upload')
        self.assertIn('uploaded_at', save_kwargs['custom_data'])

    def test_aidocument_serializer_rejects_session_from_other_tenant(self):
        request = SimpleNamespace(
            user=SimpleNamespace(id=123),
            tenant=SimpleNamespace(id=uuid.uuid4()),
            method='POST',
        )
        session = SimpleNamespace(
            owner_id=123,
            context_data={'tenant_id': str(uuid.uuid4())},
        )

        serializer = AIDocumentSerializer(context={'request': request})

        with self.assertRaises(drf_serializers.ValidationError):
            serializer.validate_session(session)

"""AI Assistant document upload API tests.

These tests ensure the AIDocument upload endpoint never returns 500s and instead
fails closed with deterministic 400 responses.

Note: The test settings historically excluded `tenant_apps.ai_assistant`. If that
happens again in a given environment, these tests should be skipped.
"""

import unittest
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.utils import DatabaseError
from rest_framework import status
from rest_framework.test import APITestCase

if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
    raise unittest.SkipTest('tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings')

from apps.tenants.models import Tenant, TenantUser
from apps.core.models import IdempotencyKey
from tenant_apps.ai_assistant.models import ChatMessage, ChatSession


class AIDocumentUploadTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='uploader', password='testpass123')
        self.other_user = User.objects.create_user(username='uploader-two', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Upload Tenant',
            slug='upload-tenant',
            contact_email='upload@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.other_user, role='admin', is_active=True)

        # Use session auth (not DRF force_authenticate) so AuthenticationMiddleware marks
        # request.user as authenticated before TenantMiddleware runs.
        # TenantMiddleware intentionally ignores X-Tenant-ID for anonymous requests.
        self.client.force_login(self.user)
        self.session = ChatSession.objects.create(
            title='Upload Session',
            context_data={'tenant_id': str(self.tenant.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )

    def _upload(
        self,
        *,
        filename='test.pdf',
        content=b'%PDF-1.4\n% test\n',
        content_type='application/pdf',
        tenant=None,
        session=None,
        idempotency_key=None,
    ):
        file = SimpleUploadedFile(filename, content, content_type=content_type)
        headers = {}
        if idempotency_key:
            headers['HTTP_IDEMPOTENCY_KEY'] = idempotency_key
        data = {'file': file}
        if session is not None:
            data['session'] = str(session.id)
        return self.client.post(
            '/api/v1/ai-assistant/ai-documents/',
            data=data,
            format='multipart',
            HTTP_X_TENANT_ID=str((tenant or self.tenant).id),
            **headers,
        )

    def test_upload_returns_201(self):
        resp = self._upload()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', resp.data)

    def test_csv_upload_returns_201(self):
        resp = self._upload(
            filename='inventory.csv',
            content=b'part,status\nribeye,Backordered\n',
            content_type='text/csv',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_xlsx_upload_returns_201(self):
        resp = self._upload(
            filename='inventory.xlsx',
            content=b'not-a-real-xlsx-but-validation-only',
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_same_key_replays_original_document_without_duplicate_side_effects(self):
        first = self._upload(
            filename='session-doc.pdf',
            content=b'%PDF-1.4\n% session\n',
            session=self.session,
            idempotency_key='ai-upload-1',
        )
        second = self._upload(
            filename='session-doc.pdf',
            content=b'%PDF-1.4\n% session\n',
            session=self.session,
            idempotency_key='ai-upload-1',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.content)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(ChatMessage.objects.filter(session=self.session).count(), 1)
        self.assertEqual(IdempotencyKey.objects.count(), 1)

    def test_same_key_with_different_file_returns_conflict(self):
        first = self._upload(
            filename='first.pdf',
            content=b'%PDF-1.4\n% first\n',
            idempotency_key='ai-upload-2',
        )
        second = self._upload(
            filename='second.pdf',
            content=b'%PDF-1.4\n% second\n',
            idempotency_key='ai-upload-2',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT, second.content)
        self.assertEqual(second.data['code'], 'IDEMPOTENCY_CONFLICT')

    def test_same_key_isolated_per_tenant(self):
        other_tenant = Tenant.objects.create(
            name='Upload Tenant B',
            slug='upload-tenant-b',
            contact_email='upload-b@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=self.user, role='owner', is_active=True)
        other_session = ChatSession.objects.create(
            title='Upload Session B',
            context_data={'tenant_id': str(other_tenant.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )

        first = self._upload(
            filename='tenant-a.pdf',
            content=b'%PDF-1.4\n% tenant-a\n',
            tenant=self.tenant,
            session=self.session,
            idempotency_key='shared-upload-key',
        )
        second = self._upload(
            filename='tenant-b.pdf',
            content=b'%PDF-1.4\n% tenant-b\n',
            tenant=other_tenant,
            session=other_session,
            idempotency_key='shared-upload-key',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.content)
        self.assertEqual(IdempotencyKey.objects.count(), 2)

    def test_same_key_from_different_user_in_same_tenant_returns_conflict(self):
        first = self._upload(
            filename='shared.pdf',
            content=b'%PDF-1.4\n% shared\n',
            idempotency_key='shared-tenant-key',
        )

        self.client.force_login(self.other_user)
        second = self._upload(
            filename='shared.pdf',
            content=b'%PDF-1.4\n% shared\n',
            idempotency_key='shared-tenant-key',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT, second.content)
        self.assertEqual(second.data['code'], 'IDEMPOTENCY_ACTOR_CONFLICT')

    @patch('tenant_apps.ai_assistant.serializers.AIDocumentSerializer.save')
    def test_storage_errors_return_400(self, mock_save):
        mock_save.side_effect = OSError('read-only file system')
        resp = self._upload()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # Must not leak OS error strings
        self.assertNotIn('read-only', str(resp.data).lower())

    @patch('tenant_apps.ai_assistant.serializers.AIDocumentSerializer.save')
    def test_rls_db_errors_return_400(self, mock_save):
        mock_save.side_effect = DatabaseError('row-level security policy')
        resp = self._upload()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('tenant_apps.ai_assistant.serializers.AIDocumentSerializer.save')
    def test_unexpected_errors_return_400(self, mock_save):
        mock_save.side_effect = RuntimeError('boom')
        resp = self._upload()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # Must not leak raw exception strings
        self.assertNotIn('boom', str(resp.data).lower())

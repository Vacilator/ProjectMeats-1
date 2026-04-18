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


class AIDocumentUploadTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='uploader', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Upload Tenant',
            slug='upload-tenant',
            contact_email='upload@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

        self.client.force_authenticate(user=self.user)

    def _upload(self):
        file = SimpleUploadedFile('test.pdf', b'%PDF-1.4\n% test\n', content_type='application/pdf')
        return self.client.post(
            '/api/v1/ai-assistant/ai-documents/',
            data={'file': file},
            format='multipart',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

    def test_upload_returns_201(self):
        resp = self._upload()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', resp.data)

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

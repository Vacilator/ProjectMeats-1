import os
import unittest
import uuid
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser


class ApiErrorContractTests(TestCase):
    """Contract tests for high-signal API error responses.

    These lock down stable fields/status codes so the frontend can reliably surface
    actionable guidance (and avoid regressions back to opaque 500s).
    """

    @classmethod
    def setUpTestData(cls):
        unique = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(username=f'testuser-{unique}', password='testpass123')
        cls.tenant = Tenant.objects.create(
            name=f'Test Tenant {unique}',
            slug=f'test-tenant-{unique}',
            contact_email=f'test-{unique}@example.com',
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role='owner')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_ai_chat_not_configured_returns_503_with_stable_shape(self):
        if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
            raise unittest.SkipTest('tenant_apps.ai_assistant not installed in this test environment')

        with override_settings(OPENAI_API_KEY=None):
            # Ensure environment variable doesn't accidentally satisfy the key check.
            with mock.patch.dict(os.environ, {}, clear=True):
                resp = self.client.post(
                    '/api/v1/ai-assistant/chat/',
                    {'message': 'hi'},
                    format='json',
                    HTTP_X_TENANT_ID=str(self.tenant.id),
                )

        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIsInstance(resp.data, dict)
        self.assertEqual(resp.data.get('code'), 'AI_NOT_CONFIGURED')
        self.assertEqual(resp.data.get('error'), 'AI is not enabled for this environment.')
        self.assertTrue(isinstance(resp.data.get('detail'), str) and resp.data.get('detail'))

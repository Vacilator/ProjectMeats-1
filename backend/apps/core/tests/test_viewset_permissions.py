import unittest
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser


class ViewSetPermissionsTests(TestCase):
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

    def test_bug_reports_requires_auth(self):
        client = APIClient()
        resp = client.get('/api/v1/bug-reports/', HTTP_X_TENANT_ID=str(self.tenant.id))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ai_feedback_requires_auth(self):
        if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
            raise unittest.SkipTest('tenant_apps.ai_assistant not installed in this test environment')

        client = APIClient()
        resp = client.get('/api/v1/ai-assistant/feedback/', HTTP_X_TENANT_ID=str(self.tenant.id))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tenant_workflows_requires_auth(self):
        client = APIClient()
        resp = client.get('/api/v1/workflows/workflows/', HTTP_X_TENANT_ID=str(self.tenant.id))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_notifications_requires_auth(self):
        client = APIClient()
        resp = client.get('/api/v1/workflows/notifications/', HTTP_X_TENANT_ID=str(self.tenant.id))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_comments_requires_auth(self):
        client = APIClient()
        resp = client.get('/api/v1/comments/', HTTP_X_TENANT_ID=str(self.tenant.id))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

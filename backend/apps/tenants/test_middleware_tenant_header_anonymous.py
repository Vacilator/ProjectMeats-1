from __future__ import annotations

from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings
from unittest.mock import Mock, patch

from apps.tenants.middleware import TenantMiddleware
from apps.tenants.models import Tenant


class TenantMiddlewareAnonymousHeaderTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.tenant = Tenant.objects.create(
            name='Header Tenant',
            slug='header-tenant',
            contact_email='header@example.com',
            is_active=True,
        )

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_anonymous_request_ignores_x_tenant_id(self):
        """Anonymous requests must not be able to inject tenant context via X-Tenant-ID."""

        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get(
            '/some/public/path/',
            HTTP_HOST='testserver',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        request.user = AnonymousUser()

        with patch('apps.tenants.rls.set_current_tenant') as set_current_tenant:
            resp = middleware(request)

        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(get_response.call_args[0][0].tenant)
        set_current_tenant.assert_not_called()

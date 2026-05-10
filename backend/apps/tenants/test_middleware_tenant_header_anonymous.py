from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings
from unittest.mock import Mock, patch

from apps.tenants.middleware import TenantMiddleware
from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class TenantMiddlewareAnonymousHeaderTests(TestCase):
    """Regression tests for TenantMiddleware anonymous X-Tenant-ID handling.

    MASTER_PLAN P0: anonymous requests must NEVER be able to inject tenant
    context via the X-Tenant-ID header, regardless of which endpoint they hit.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.tenant = Tenant.objects.create(
            name='Header Tenant',
            slug='header-tenant',
            contact_email='header@example.com',
            is_active=True,
        )

    def _make_middleware(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        return TenantMiddleware(get_response), get_response

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_anonymous_request_ignores_x_tenant_id(self):
        """Anonymous requests must not be able to inject tenant context via X-Tenant-ID."""
        middleware, get_response = self._make_middleware()

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

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_anonymous_request_to_auth_endpoint_ignores_header(self):
        """AllowAny endpoints like /auth/login/ must not honour X-Tenant-ID for anonymous users."""
        middleware, get_response = self._make_middleware()

        request = self.factory.post(
            '/api/v1/auth/login/',
            HTTP_HOST='testserver',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        request.user = AnonymousUser()

        resp = middleware(request)
        self.assertEqual(resp.status_code, 200)
        passed_request = get_response.call_args[0][0]
        self.assertIsNone(passed_request.tenant)

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_anonymous_request_with_invalid_uuid_no_crash(self):
        """Malformed X-Tenant-ID on anonymous request must not cause a 500."""
        middleware, get_response = self._make_middleware()

        request = self.factory.get(
            '/api/v1/some/endpoint/',
            HTTP_HOST='testserver',
            HTTP_X_TENANT_ID='not-a-uuid',
        )
        request.user = AnonymousUser()

        resp = middleware(request)
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(get_response.call_args[0][0].tenant)

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_authenticated_user_with_valid_tenant_gets_context(self):
        """Authenticated user with valid membership should get tenant context set."""
        middleware, get_response = self._make_middleware()

        user = User.objects.create_user(username='tenantuser', password='test')
        TenantUser.objects.create(user=user, tenant=self.tenant, is_active=True)

        request = self.factory.get(
            '/api/v1/some/endpoint/',
            HTTP_HOST='testserver',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        request.user = user

        resp = middleware(request)
        self.assertEqual(resp.status_code, 200)
        passed_request = get_response.call_args[0][0]
        self.assertEqual(passed_request.tenant, self.tenant)

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_authenticated_user_unauthorized_tenant_gets_403(self):
        """Authenticated user without membership must be denied tenant access."""
        middleware, _get_response = self._make_middleware()

        user = User.objects.create_user(username='outsider', password='test')

        request = self.factory.get(
            '/api/v1/some/endpoint/',
            HTTP_HOST='testserver',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        request.user = user

        resp = middleware(request)
        self.assertEqual(resp.status_code, 403)

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_authenticated_user_with_nonexistent_tenant_id(self):
        """X-Tenant-ID pointing to a deleted/nonexistent tenant should not crash."""
        middleware, get_response = self._make_middleware()

        user = User.objects.create_user(username='orphanuser', password='test')

        request = self.factory.get(
            '/api/v1/some/endpoint/',
            HTTP_HOST='testserver',
            HTTP_X_TENANT_ID='00000000-0000-0000-0000-999999999999',
        )
        request.user = user

        resp = middleware(request)
        # Should fall through to other resolution methods, not crash
        self.assertIn(resp.status_code, [200, 403])

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

from apps.tenants.middleware import TenantMiddleware
from apps.tenants.models import Tenant, TenantDomain, TenantUser


class TenantMiddlewareRlsResetUnconditionalTests(TestCase):
    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.tenant = Tenant.objects.create(
            name='Acme Tenant',
            slug='acme',
            contact_email='acme@example.com',
            is_active=True,
        )
        TenantDomain.objects.create(domain='acme.example.com', tenant=self.tenant, is_primary=True)

        self.user = User.objects.create_user(username='member', password='pass')
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

    @override_settings(ALLOWED_HOSTS=['acme.example.com'])
    def test_resets_rls_session_vars_even_when_set_current_tenant_fails(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get('/some/web/page/', HTTP_HOST='acme.example.com')
        request.user = self.user

        with (
            patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=False, error='boom')),
            patch.object(middleware, '_reset_rls_session_vars') as reset,
        ):
            resp = middleware(request)

        self.assertEqual(resp.status_code, 200)
        reset.assert_called_once()

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_health_route_still_resets_rls_session_vars(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get('/api/v1/health/', HTTP_HOST='testserver')
        request.user = self.user

        with patch.object(middleware, '_reset_rls_session_vars') as reset:
            resp = middleware(request)

        self.assertEqual(resp.status_code, 200)
        reset.assert_called_once()

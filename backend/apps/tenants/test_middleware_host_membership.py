from __future__ import annotations

from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

from apps.tenants.middleware import TenantMiddleware
from apps.tenants.models import Tenant, TenantDomain, TenantUser


class TenantMiddlewareHostMembershipTests(TestCase):
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
        self.non_member = User.objects.create_user(username='nonmember', password='pass')
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

    @override_settings(ALLOWED_HOSTS=['acme.example.com'])
    def test_host_resolved_tenant_requires_membership_for_authenticated_user(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get('/some/web/page/', HTTP_HOST='acme.example.com')
        request.user = self.non_member

        with patch('apps.tenants.rls.set_current_tenant') as set_current_tenant:
            resp = middleware(request)

        self.assertEqual(resp.status_code, 403)
        get_response.assert_not_called()
        set_current_tenant.assert_not_called()

    @override_settings(ALLOWED_HOSTS=['acme.example.com'])
    def test_api_routes_return_json_envelope_on_tenant_denial(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get('/api/v1/anything/', HTTP_HOST='acme.example.com')
        request.user = self.non_member

        with patch('apps.tenants.rls.set_current_tenant') as set_current_tenant:
            resp = middleware(request)

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp['Content-Type'], 'application/json')
        self.assertJSONEqual(
            resp.content,
            {'error': 'You do not have access to this tenant.', 'code': 'TENANT_ACCESS_DENIED'},
        )
        get_response.assert_not_called()
        set_current_tenant.assert_not_called()

    @override_settings(ALLOWED_HOSTS=['acme.example.com'])
    def test_host_resolved_tenant_allows_member(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get('/some/web/page/', HTTP_HOST='acme.example.com')
        request.user = self.user

        with patch('apps.tenants.rls.set_current_tenant') as set_current_tenant:
            resp = middleware(request)

        self.assertEqual(resp.status_code, 200)
        get_response.assert_called_once()
        set_current_tenant.assert_called_once()
        self.assertEqual(get_response.call_args[0][0].tenant, self.tenant)

    @override_settings(ALLOWED_HOSTS=['acme.example.com'])
    def test_invitation_validate_path_bypasses_membership_enforcement(self):
        get_response = Mock(return_value=HttpResponse('ok'))
        middleware = TenantMiddleware(get_response)

        request = self.factory.get('/api/v1/invitations/validate/', HTTP_HOST='acme.example.com')
        request.user = self.non_member

        with patch('apps.tenants.rls.set_current_tenant') as set_current_tenant:
            resp = middleware(request)

        self.assertEqual(resp.status_code, 200)
        get_response.assert_called_once()
        set_current_tenant.assert_called_once()
        self.assertEqual(get_response.call_args[0][0].tenant, self.tenant)

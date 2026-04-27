from __future__ import annotations

from unittest.mock import patch

from django.test import TestCase

from apps.tenants.rls import RlsSetResult, tenant_rls


class TenantRlsContextManagerTests(TestCase):
    def test_tenant_rls_resets_on_exit(self):
        with patch('apps.tenants.rls.set_current_tenant', return_value=RlsSetResult(ok=True)) as set_tenant, patch(
            'apps.tenants.rls.reset_current_tenant'
        ) as reset_tenant:
            with tenant_rls('t1'):
                pass

        set_tenant.assert_called_once_with('t1')
        reset_tenant.assert_called_once()

    def test_tenant_rls_strict_raises_when_set_fails(self):
        with patch(
            'apps.tenants.rls.set_current_tenant',
            return_value=RlsSetResult(ok=False, error='db down'),
        ), patch('apps.tenants.rls.reset_current_tenant') as reset_tenant:
            with self.assertRaises(RuntimeError):
                with tenant_rls('t1', strict=True):
                    pass

        reset_tenant.assert_called_once()

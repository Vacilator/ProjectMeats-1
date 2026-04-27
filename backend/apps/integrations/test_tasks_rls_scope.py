from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import patch

from django.test import TestCase


class IntegrationsEmailTasksRlsScopeTests(TestCase):
    def test_sync_email_provider_inbox_scopes_rls_and_passes_tenant_id(self):
        from apps.integrations import tasks

        calls: list[str] = []

        @contextmanager
        def fake_tenant_rls(tenant_id: str, *, strict: bool = True):
            calls.append(f"enter:{tenant_id}")
            try:
                yield None
            finally:
                calls.append(f"exit:{tenant_id}")

        with patch.object(tasks, 'tenant_rls', fake_tenant_rls), patch(
            'tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_provider_by_id',
            return_value={'tenant_id': 't1', 'emails_saved': 0, 'emails_fetched': 0, 'errors': 0},
        ) as poll_provider:
            result = tasks.sync_email_provider_inbox.run(123, 't1')

        self.assertEqual(result['success'], True)
        poll_provider.assert_called_once_with(123, tenant_id='t1')
        self.assertEqual(calls, ['enter:t1', 'exit:t1'])

    def test_sync_single_tenant_scopes_rls(self):
        from apps.integrations import tasks

        calls: list[str] = []

        @contextmanager
        def fake_tenant_rls(tenant_id: str, *, strict: bool = True):
            calls.append(f"enter:{tenant_id}")
            try:
                yield None
            finally:
                calls.append(f"exit:{tenant_id}")

        with patch.object(tasks, 'tenant_rls', fake_tenant_rls), patch(
            'tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id',
            return_value={'emails_saved': 0, 'emails_fetched': 0, 'errors': 0},
        ) as poll_tenant:
            result = tasks.sync_single_tenant.run('t1')

        self.assertEqual(result['success'], True)
        poll_tenant.assert_called_once_with('t1')
        self.assertEqual(calls, ['enter:t1', 'exit:t1'])

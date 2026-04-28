from __future__ import annotations

import io
import uuid

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.system.models import TenantForm, TenantWorkForm
from apps.system.services.workform_schema_upgrade import WORKFORM_SCHEMA_VERSION, upgrade_workform_definition
from apps.tenants.models import Tenant, TenantUser


User = get_user_model()


class UpgradeWorkformSchemaCommandTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f'user-{unique}', password='pw')
        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

        self.form = TenantForm.objects.create(
            tenant=self.tenant,
            name='Legacy form',
            description='',
            type='single_step',
            form_definition={'entity_type': 'supplier', 'fields': []},
            created_by=self.user,
            updated_by=self.user,
            usage_count=0,
        )

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='Legacy workflow',
            description='',
            status='draft',
            workflow_definition={
                'nodes': [
                    {'id': 'end-1', 'type': 'terminalEnd', 'data': {'label': 'Done'}},
                    {'id': 'notify-1', 'type': 'actionNotification', 'data': {'label': 'Notify'}},
                    {'id': 'http-1', 'type': 'actionHttp', 'data': {'label': 'Webhook'}},
                    {
                        'id': 'form-1',
                        'type': 'formStepSingle',
                        'data': {'label': 'Intake', 'formId': str(self.form.id)},
                    },
                    {
                        'id': 'container-1',
                        'type': 'formMultiStepContainer',
                        'data': {'label': 'Group', 'formId': str(self.form.id)},
                    },
                ],
                'edges': [],
            },
            created_by=self.user,
            updated_by=self.user,
        )

    def test_upgrade_workform_definition_normalizes_legacy_aliases(self):
        upgraded, stats = upgrade_workform_definition(self.workform.workflow_definition)

        self.assertTrue(stats['changed'])
        self.assertEqual(upgraded['schemaVersion'], WORKFORM_SCHEMA_VERSION)

        nodes_by_id = {node['id']: node for node in upgraded['nodes']}
        self.assertEqual(nodes_by_id['end-1']['type'], 'end')
        self.assertEqual(nodes_by_id['notify-1']['type'], 'actionNotify')
        self.assertEqual(nodes_by_id['http-1']['type'], 'actionHTTP')
        self.assertEqual(nodes_by_id['form-1']['type'], 'form')
        self.assertEqual(nodes_by_id['container-1']['type'], 'formProcess')
        self.assertEqual(nodes_by_id['form-1']['data']['tenantFormId'], str(self.form.id))
        self.assertEqual(nodes_by_id['container-1']['data']['tenantFormId'], str(self.form.id))
        self.assertEqual(stats['aliased_form_refs'], 2)

    def test_dry_run_reports_changes_without_persisting(self):
        stdout = io.StringIO()

        call_command(
            'upgrade_workform_schema',
            '--tenant-id',
            str(self.tenant.id),
            stdout=stdout,
        )

        self.workform.refresh_from_db()
        self.assertNotIn('schemaVersion', self.workform.workflow_definition)
        self.assertEqual(self.workform.workflow_definition['nodes'][0]['type'], 'terminalEnd')
        self.assertIn('DRY-RUN complete: scanned=1 upgraded=1', stdout.getvalue())

    def test_apply_persists_upgraded_definition_and_is_idempotent(self):
        first_stdout = io.StringIO()
        second_stdout = io.StringIO()

        call_command(
            'upgrade_workform_schema',
            '--workform-id',
            str(self.workform.id),
            '--apply',
            stdout=first_stdout,
        )
        self.workform.refresh_from_db()

        nodes_by_id = {node['id']: node for node in self.workform.workflow_definition['nodes']}
        self.assertEqual(self.workform.workflow_definition['schemaVersion'], WORKFORM_SCHEMA_VERSION)
        self.assertEqual(nodes_by_id['end-1']['type'], 'end')
        self.assertEqual(nodes_by_id['notify-1']['type'], 'actionNotify')
        self.assertEqual(nodes_by_id['http-1']['type'], 'actionHTTP')
        self.assertEqual(nodes_by_id['form-1']['type'], 'form')
        self.assertEqual(nodes_by_id['container-1']['type'], 'formProcess')
        self.assertEqual(nodes_by_id['form-1']['data']['tenantFormId'], str(self.form.id))
        self.assertEqual(nodes_by_id['container-1']['data']['tenantFormId'], str(self.form.id))
        self.assertEqual([str(value) for value in self.workform.form_references], [str(self.form.id)])
        self.assertIn('APPLY complete: scanned=1 upgraded=1', first_stdout.getvalue())

        call_command(
            'upgrade_workform_schema',
            '--workform-id',
            str(self.workform.id),
            '--apply',
            stdout=second_stdout,
        )
        self.assertIn('APPLY complete: scanned=1 upgraded=0', second_stdout.getvalue())

import json
import io
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
    raise unittest.SkipTest('tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings')

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.ai_assistant.models import AIDocument
from tenant_apps.ai_assistant.swarm.executor import ToolExecutor


class TabularDocumentParsingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tabular-user', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Tabular Tenant',
            slug='tabular-tenant',
            contact_email='tabular@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)
        self.executor = ToolExecutor()

    def _create_document(self, *, name: str, content: bytes, content_type: str) -> AIDocument:
        upload = SimpleUploadedFile(name, content, content_type=content_type)
        return AIDocument.objects.create(
            tenant=self.tenant,
            owner=self.user,
            file=upload,
            original_filename=name,
            content_type=content_type,
            file_size=len(content),
        )

    def test_parse_document_converts_csv_to_markdown(self):
        document = self._create_document(
            name='parts.csv',
            content=(
                b'Part,Status,Cost\n'
                b'Chuck,Backordered,10.50\n'
                b'Ribeye,Available,21.00\n'
            ),
            content_type='text/csv',
        )

        parsed = self.executor._parse_document(
            {'file_id_or_url': str(document.id)},
            self.tenant,
            user=self.user,
        )

        self.assertEqual(parsed['parser'], 'tabular_markdown')
        self.assertEqual(parsed['content_type'], 'text/csv')
        self.assertIn('| Part | Status | Cost |', parsed['text'])
        self.assertIn('| Chuck | Backordered | 10.50 |', parsed['text'])
        self.assertFalse(parsed['truncated'])

    def test_parse_document_truncates_csv_after_500_rows(self):
        rows = ['Part,Status,Cost']
        rows.extend([f'Item {index},Backordered,{index}.00' for index in range(1, 503)])
        document = self._create_document(
            name='large-parts.csv',
            content='\n'.join(rows).encode('utf-8'),
            content_type='text/csv',
        )

        parsed = self.executor._parse_document(
            {'file_id_or_url': str(document.id)},
            self.tenant,
            user=self.user,
        )

        self.assertTrue(parsed['truncated'])
        self.assertIn('[WARNING: Data truncated at 500 rows to preserve context window]', parsed['text'])
        self.assertIn('| Item 500 | Backordered | 500.00 |', parsed['text'])
        self.assertNotIn('| Item 501 | Backordered | 501.00 |', parsed['text'])

    @unittest.skipUnless(
        __import__('importlib').util.find_spec('openpyxl'),
        'openpyxl not installed'
    )
    def test_parse_document_converts_xlsx_to_markdown(self):
        from openpyxl import Workbook

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = 'Backorders'
        worksheet.append(['Part', 'Status', 'Cost'])
        worksheet.append(['Tenderloin', 'Backordered', 55.25])
        worksheet.append(['Brisket', 'Available', 14.00])

        buffer = io.BytesIO()
        workbook.save(buffer)
        workbook.close()

        document = self._create_document(
            name='parts.xlsx',
            content=buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

        parsed = self.executor._parse_document(
            {'file_id_or_url': str(document.id)},
            self.tenant,
            user=self.user,
        )

        self.assertEqual(parsed['parser'], 'tabular_markdown')
        self.assertIn('## Sheet: Backorders', parsed['text'])
        self.assertIn('| Tenderloin | Backordered | 55.25 |', parsed['text'])

    @patch('tenant_apps.ai_assistant.swarm.executor.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None))
    def test_execute_returns_structured_error_for_corrupt_spreadsheet(self, _mock_rls):
        document = self._create_document(
            name='broken.xlsx',
            content=b'not-a-real-xlsx',
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

        payload = json.loads(
            self.executor.execute(
                'parse_document',
                {'file_id_or_url': str(document.id)},
                self.tenant,
                user=self.user,
            )
        )

        self.assertFalse(payload['ok'])
        self.assertEqual(payload['tool'], 'parse_document')
        self.assertEqual(payload['error']['code'], 'DOCUMENT_PARSE_FAILED')

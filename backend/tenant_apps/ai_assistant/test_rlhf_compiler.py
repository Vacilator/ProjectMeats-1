from unittest.mock import patch

from django.test import SimpleTestCase

from tenant_apps.ai_assistant.services.rlhf_compiler import CompileOptions, write_compiled_jsonl


class RLHFCompilerStorageTests(SimpleTestCase):
    @patch('tenant_apps.ai_assistant.services.rlhf_compiler.default_storage.save')
    @patch('tenant_apps.ai_assistant.services.rlhf_compiler.default_storage.delete')
    @patch('tenant_apps.ai_assistant.services.rlhf_compiler.default_storage.exists', return_value=False)
    @patch('tenant_apps.ai_assistant.services.rlhf_compiler.compile_feedback_logs_to_jsonl_lines')
    def test_write_compiled_jsonl_uses_durable_storage_path(
        self,
        mock_compile,
        _mock_exists,
        _mock_delete,
        mock_save,
    ):
        mock_compile.return_value = (2, ['{"a":1}', '{"b":2}'])
        mock_save.side_effect = lambda path, _content: path

        summary = write_compiled_jsonl(options=CompileOptions(days=7, limit=2))

        self.assertEqual(summary['status'], 'ok')
        self.assertEqual(summary['written'], 2)
        self.assertTrue(summary['out_path'].startswith('ai_assistant/rlhf_exports/'))
        self.assertNotIn('/tmp/', summary['out_path'])

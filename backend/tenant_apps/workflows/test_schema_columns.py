from __future__ import annotations

from django.db import connection
from django.test import TestCase


class WorkflowSchemaColumnTests(TestCase):
    def _column_names(self, table_name: str) -> set[str]:
        with connection.cursor() as cursor:
            return {
                column.name
                for column in connection.introspection.get_table_description(cursor, table_name)
            }

    def test_tenantlist_has_tenantaware_columns(self):
        columns = self._column_names("workflows_tenantlist")

        self.assertIn("created_on", columns)
        self.assertIn("modified_on", columns)
        self.assertIn("custom_data", columns)

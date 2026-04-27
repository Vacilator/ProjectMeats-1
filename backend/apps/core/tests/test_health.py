"""Tests for health endpoints.

These tests ensure /api/v1/health/ remains stable and resilient even when
optional external dependency checks fail.
"""

import json
from unittest.mock import patch

from django.test import TestCase


class HealthCheckTests(TestCase):
    def test_health_includes_structured_fields(self):
        resp = self.client.get('/api/v1/health/')
        self.assertEqual(resp.status_code, 200)

        data = json.loads(resp.content.decode('utf-8'))

        # Backward compatible fields
        self.assertIn('database', data)
        self.assertIn('services', data)
        self.assertIn('features', data)

        # New additive, machine-readable fields
        self.assertIn('database_status', data)
        self.assertIsInstance(data['database_status'], dict)
        self.assertIn('service_summary', data)

        # Observability/readiness fields (additive)
        self.assertIn('integration_summary', data)
        self.assertIsInstance(data['integration_summary'], dict)
        self.assertIn('integration_warnings', data)
        self.assertIsInstance(data['integration_warnings'], list)

        # In test runs we do not have Redis configured, so redis readiness should be false.
        self.assertIs(data['features'].get('redis'), False)

    @patch('projectmeats.health.check_all_services', side_effect=Exception('boom'))
    def test_health_survives_service_check_failure(self, _mock_check):
        resp = self.client.get('/api/v1/health/')
        self.assertEqual(resp.status_code, 200)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertIn('services', data)
        self.assertIn('error', data['services'])
        self.assertEqual(data['services']['error']['code'], 'service_checks_failed')

    @patch('projectmeats.health.connection.cursor', side_effect=Exception('db down'))
    def test_health_returns_503_when_db_unhealthy(self, _mock_cursor):
        resp = self.client.get('/api/v1/health/')
        self.assertEqual(resp.status_code, 503)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertEqual(data['database_status']['status'], 'unhealthy')
        self.assertEqual(data['database_status']['error']['code'], 'db_connection_failed')
        self.assertIn('services', data)

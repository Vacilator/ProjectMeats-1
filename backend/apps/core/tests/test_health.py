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

    @patch('projectmeats.health.check_all_services', side_effect=Exception('boom'))
    def test_health_survives_service_check_failure(self, _mock_check):
        resp = self.client.get('/api/v1/health/')
        self.assertEqual(resp.status_code, 200)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertIn('services', data)
        self.assertIn('error', data['services'])
        self.assertEqual(data['services']['error']['code'], 'service_checks_failed')

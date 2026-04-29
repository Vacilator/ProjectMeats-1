"""Tests for health endpoints.

These tests ensure /api/v1/health/ remains stable and resilient even when
optional external dependency checks fail.
"""

import json
from unittest.mock import patch

from django.test import TestCase, override_settings


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
        self.assertIn('semantic_indexing', data['features'])
        self.assertIn('semantic_indexing', data['integration_summary'])

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

    def test_ready_endpoint_returns_ready_shape_when_database_is_healthy(self):
        resp = self.client.get('/api/v1/ready/')
        self.assertEqual(resp.status_code, 200)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertEqual(data['status'], 'ready')
        self.assertIn('timestamp', data)
        self.assertIn('checks', data)
        self.assertFalse(data['requires_redis_readiness'])
        self.assertFalse(data['requires_semantic_index_readiness'])

    @patch('projectmeats.health.connection.cursor', side_effect=Exception('db down'))
    def test_ready_returns_503_when_database_is_unhealthy(self, _mock_cursor):
        resp = self.client.get('/api/v1/ready/')
        self.assertEqual(resp.status_code, 503)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertEqual(data['status'], 'not_ready')
        self.assertIn('error', data)

    @override_settings(REQUIRE_REDIS_READINESS=True)
    @patch('projectmeats.health.check_all_services')
    def test_ready_returns_503_when_non_dev_redis_gate_fails(self, mock_services):
        mock_services.return_value = {
            'redis': {'available': False, 'configured': False, 'note': 'Redis fallback in use'},
            'channel_layer': {'available': False, 'configured': False, 'note': 'In-memory channels in use'},
        }

        resp = self.client.get('/api/v1/ready/')
        self.assertEqual(resp.status_code, 503)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertEqual(data['status'], 'not_ready')
        self.assertTrue(data['requires_redis_readiness'])
        self.assertEqual(data['checks']['redis'], 'unhealthy')
        self.assertEqual(data['checks']['channel_layer'], 'unhealthy')
        self.assertEqual([error['code'] for error in data['errors']], ['redis_not_ready', 'channel_layer_not_ready'])

    @override_settings(REQUIRE_SEMANTIC_INDEX_READINESS=True)
    @patch('projectmeats.health.check_all_services')
    def test_ready_returns_503_when_semantic_index_gate_fails(self, mock_services):
        mock_services.return_value = {
            'redis': {'available': True, 'configured': True},
            'channel_layer': {'available': True, 'configured': True},
            'semantic_indexing': {
                'available': False,
                'configured': False,
                'required': True,
                'note': 'Semantic indexing is unavailable.',
            },
        }

        resp = self.client.get('/api/v1/ready/')
        self.assertEqual(resp.status_code, 503)

        data = json.loads(resp.content.decode('utf-8'))
        self.assertTrue(data['requires_semantic_index_readiness'])
        self.assertEqual(data['checks']['semantic_indexing'], 'unhealthy')
        self.assertEqual([error['code'] for error in data['errors']], ['semantic_indexing_not_ready'])

"""
Tests for Infrastructure Diagnostics

Validates the connectivity testing script for Redis, OpenAI, and Sentry.
"""

import os
from unittest.mock import patch, MagicMock
from django.test import TestCase


class InfrastructureDiagnosticsTestCase(TestCase):
    """Test infrastructure connectivity checks"""
    
    def test_redis_connectivity_success(self):
        """Test Redis connectivity with successful connection"""
        from scripts.infrastructure_diagnostics import test_redis_connectivity
        
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.return_value = True
            mock_cache.get.return_value = 'REDIS_OK'
            
            result = test_redis_connectivity()
            
            self.assertEqual(result['service'], 'Redis')
            self.assertEqual(result['status'], 'CONNECTED')
            self.assertTrue(result['details']['test_passed'])
    
    def test_redis_connectivity_failure(self):
        """Test Redis connectivity with failed connection"""
        from scripts.infrastructure_diagnostics import test_redis_connectivity
        
        with patch('django.core.cache.cache') as mock_cache:
            mock_cache.set.side_effect = Exception('Connection refused')
            
            result = test_redis_connectivity()
            
            self.assertEqual(result['service'], 'Redis')
            self.assertEqual(result['status'], 'FAILED')
            self.assertIn('Connection refused', result['message'])
    
    def test_openai_connectivity_not_configured(self):
        """Test OpenAI connectivity when API key is missing"""
        from scripts.infrastructure_diagnostics import test_openai_connectivity
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}, clear=True):
            result = test_openai_connectivity()
            
            self.assertEqual(result['service'], 'OpenAI')
            self.assertEqual(result['status'], 'NOT_CONFIGURED')
            self.assertIn('not set', result['message'])
    
    def test_openai_connectivity_success(self):
        """Test OpenAI connectivity with successful API call"""
        from scripts.infrastructure_diagnostics import test_openai_connectivity
        
        mock_client = MagicMock()
        mock_models = MagicMock()
        mock_models.data = [MagicMock(id='gpt-4o-mini'), MagicMock(id='gpt-4')]
        mock_client.models.list.return_value = mock_models
        
        import sys
        from types import SimpleNamespace

        fake_openai = SimpleNamespace(OpenAI=MagicMock(return_value=mock_client))

        with patch.dict(os.environ, {'OPENAI_API_KEY': 'sk-test123456'}):
            # Provide a fake openai module so the in-function import succeeds even if openai isn't installed.
            with patch.dict(sys.modules, {'openai': fake_openai}):
                result = test_openai_connectivity()

                self.assertEqual(result['service'], 'OpenAI')
                self.assertEqual(result['status'], 'CONNECTED')
                self.assertTrue(result['details']['test_passed'])
                self.assertIn('gpt-4o-mini', result['details']['available_models'])
    
    def test_sentry_connectivity_not_configured(self):
        """Test Sentry connectivity when DSN is missing"""
        from scripts.infrastructure_diagnostics import test_sentry_connectivity
        
        # Hub is imported inside the function via: from sentry_sdk import Hub
        # Patch sentry_sdk.Hub to a fake with a simple .current attribute.
        class FakeHub:
            current = MagicMock(client=None)

        with patch('sentry_sdk.Hub', new=FakeHub):
            result = test_sentry_connectivity()

            self.assertEqual(result['service'], 'Sentry')
            self.assertEqual(result['status'], 'NOT_CONFIGURED')
    
    def test_sentry_connectivity_success(self):
        """Test Sentry connectivity with valid DSN"""
        from scripts.infrastructure_diagnostics import test_sentry_connectivity
        
        mock_dsn = MagicMock()
        mock_dsn.scheme = 'https'
        mock_dsn.host = 'sentry.io'
        
        mock_client = MagicMock()
        mock_client.dsn = mock_dsn
        
        class FakeHub:
            current = MagicMock(client=mock_client)

        with patch('sentry_sdk.Hub', new=FakeHub):
            with patch('sentry_sdk.capture_message', return_value='test-event-id'):
                result = test_sentry_connectivity()

                self.assertEqual(result['service'], 'Sentry')
                self.assertEqual(result['status'], 'CONNECTED')
                self.assertTrue(result['details']['test_passed'])
    
    def test_run_full_diagnostic(self):
        """Test full diagnostic runner"""
        from scripts.infrastructure_diagnostics import run_full_diagnostic
        
        with patch('scripts.infrastructure_diagnostics.test_redis_connectivity') as mock_redis:
            with patch('scripts.infrastructure_diagnostics.test_openai_connectivity') as mock_openai:
                with patch('scripts.infrastructure_diagnostics.test_sentry_connectivity') as mock_sentry:
                    mock_redis.return_value = {'service': 'Redis', 'status': 'CONNECTED', 'message': 'OK', 'details': {}}
                    mock_openai.return_value = {'service': 'OpenAI', 'status': 'CONNECTED', 'message': 'OK', 'details': {}}
                    mock_sentry.return_value = {'service': 'Sentry', 'status': 'CONNECTED', 'message': 'OK', 'details': {}}
                    
                    result = run_full_diagnostic()
                    
                    self.assertEqual(result['overall_status'], 'READY')
                    self.assertEqual(len(result['services']), 3)

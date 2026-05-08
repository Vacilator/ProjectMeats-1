"""
Tests for Infrastructure Diagnostics

Validates the connectivity testing script for Redis, OpenAI, and Sentry.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import TestCase

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))


class InfrastructureDiagnosticsTestCase(TestCase):
    """Test infrastructure connectivity checks"""

    def test_redis_connectivity_success(self):
        """Test Redis connectivity with successful connection"""
        from infrastructure_diagnostics import test_redis_connectivity

        with patch("infrastructure_diagnostics.check_redis") as mock_check_redis:
            mock_check_redis.return_value = {"available": True, "configured": True, "backend": "redis"}

            result = test_redis_connectivity()

            self.assertEqual(result["service"], "Redis")
            self.assertEqual(result["status"], "CONNECTED")
            self.assertTrue(result["details"]["test_passed"])

    def test_redis_connectivity_not_configured(self):
        """Test Redis connectivity when Redis backend is not configured"""
        from infrastructure_diagnostics import test_redis_connectivity

        with patch("infrastructure_diagnostics.check_redis") as mock_check_redis:
            mock_check_redis.return_value = {
                "available": False,
                "configured": False,
                "backend": "django.core.cache.backends.locmem.LocMemCache",
                "note": "Redis not configured",
            }

            result = test_redis_connectivity()

            self.assertEqual(result["service"], "Redis")
            self.assertEqual(result["status"], "NOT_CONFIGURED")

    def test_channel_layer_connectivity_failure(self):
        """Test channel-layer connectivity when Redis-backed channels are unavailable"""
        from infrastructure_diagnostics import test_channel_layer_connectivity

        with patch("infrastructure_diagnostics.check_channel_layer") as mock_channel_layer:
            mock_channel_layer.return_value = {
                "available": False,
                "configured": True,
                "backend": "channels_redis.core.RedisChannelLayer",
                "error": "Connection refused",
            }

            result = test_channel_layer_connectivity()

            self.assertEqual(result["service"], "Channel Layer")
            self.assertEqual(result["status"], "FAILED")
            self.assertIn("Connection refused", result["message"])

    def test_redis_guardrails_warning(self):
        from infrastructure_diagnostics import test_redis_guardrails

        with patch("infrastructure_diagnostics.check_redis_guardrails") as mock_guardrails:
            mock_guardrails.return_value = {
                "configured": True,
                "available": True,
                "expected_policy": "noeviction",
                "actual_policy": "allkeys-lru",
                "memory_status": "warning",
                "warnings": ["eviction_policy_mismatch"],
                "overall_status": "warning",
            }

            result = test_redis_guardrails()

            self.assertEqual(result["service"], "Redis Guardrails")
            self.assertEqual(result["status"], "WARNING")
            self.assertEqual(result["details"]["actual_policy"], "allkeys-lru")

    def test_queue_health_warning(self):
        from infrastructure_diagnostics import test_queue_health

        with patch("infrastructure_diagnostics.check_celery_queue_health") as mock_queue_health:
            mock_queue_health.return_value = {
                "configured": True,
                "available": True,
                "overall_status": "critical",
                "warning_queues": ["pm.email"],
                "critical_queues": ["pm.workforms"],
            }

            result = test_queue_health()

            self.assertEqual(result["service"], "Queue Health")
            self.assertEqual(result["status"], "WARNING")
            self.assertEqual(result["details"]["critical_queues"], ["pm.workforms"])

    def test_openai_connectivity_not_configured(self):
        """Test OpenAI connectivity when API key is missing"""
        from infrastructure_diagnostics import test_openai_connectivity

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=True):
            result = test_openai_connectivity()

            self.assertEqual(result["service"], "OpenAI")
            self.assertEqual(result["status"], "NOT_CONFIGURED")
            self.assertIn("not set", result["message"])

    def test_openai_connectivity_success(self):
        """Test OpenAI connectivity with successful API call"""
        from infrastructure_diagnostics import test_openai_connectivity

        mock_client = MagicMock()
        mock_models = MagicMock()
        mock_models.data = [MagicMock(id="gpt-4o-mini"), MagicMock(id="gpt-4")]
        mock_client.models.list.return_value = mock_models

        import sys
        from types import SimpleNamespace

        fake_openai = SimpleNamespace(OpenAI=MagicMock(return_value=mock_client))

        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test123456"}):
            # Provide a fake openai module so the in-function import succeeds even if openai isn't installed.
            with patch.dict(sys.modules, {"openai": fake_openai}):
                result = test_openai_connectivity()

                self.assertEqual(result["service"], "OpenAI")
                self.assertEqual(result["status"], "CONNECTED")
                self.assertTrue(result["details"]["test_passed"])
                self.assertIn("gpt-4o-mini", result["details"]["available_models"])

    def test_sentry_connectivity_not_configured(self):
        """Test Sentry connectivity when DSN is missing"""
        from infrastructure_diagnostics import test_sentry_connectivity

        # Hub is imported inside the function via: from sentry_sdk import Hub
        # Patch sentry_sdk.Hub to a fake with a simple .current attribute.
        class FakeHub:
            current = MagicMock(client=None)

        with patch("sentry_sdk.Hub", new=FakeHub):
            result = test_sentry_connectivity()

            self.assertEqual(result["service"], "Sentry")
            self.assertEqual(result["status"], "NOT_CONFIGURED")

    def test_sentry_connectivity_success(self):
        """Test Sentry connectivity with valid DSN"""
        from infrastructure_diagnostics import test_sentry_connectivity

        mock_dsn = MagicMock()
        mock_dsn.scheme = "https"
        mock_dsn.host = "sentry.io"

        mock_client = MagicMock()
        mock_client.dsn = mock_dsn

        class FakeHub:
            current = MagicMock(client=mock_client)

        with patch("sentry_sdk.Hub", new=FakeHub):
            with patch("sentry_sdk.capture_message", return_value="test-event-id"):
                result = test_sentry_connectivity()

                self.assertEqual(result["service"], "Sentry")
                self.assertEqual(result["status"], "CONNECTED")
                self.assertTrue(result["details"]["test_passed"])

    def test_run_full_diagnostic(self):
        """Test full diagnostic runner"""
        from infrastructure_diagnostics import run_full_diagnostic

        with patch("infrastructure_diagnostics.test_redis_connectivity") as mock_redis:
            with patch("infrastructure_diagnostics.test_openai_connectivity") as mock_openai:
                with patch("infrastructure_diagnostics.test_sentry_connectivity") as mock_sentry:
                    with patch("infrastructure_diagnostics.test_channel_layer_connectivity") as mock_channel_layer:
                        with patch("infrastructure_diagnostics.test_redis_guardrails") as mock_guardrails:
                            with patch("infrastructure_diagnostics.test_queue_health") as mock_queue_health:
                                mock_redis.return_value = {
                                    "service": "Redis",
                                    "status": "CONNECTED",
                                    "message": "OK",
                                    "details": {},
                                }
                                mock_channel_layer.return_value = {
                                    "service": "Channel Layer",
                                    "status": "CONNECTED",
                                    "message": "OK",
                                    "details": {},
                                }
                                mock_guardrails.return_value = {
                                    "service": "Redis Guardrails",
                                    "status": "CONNECTED",
                                    "message": "OK",
                                    "details": {},
                                }
                                mock_queue_health.return_value = {
                                    "service": "Queue Health",
                                    "status": "CONNECTED",
                                    "message": "OK",
                                    "details": {},
                                }
                                mock_openai.return_value = {
                                    "service": "OpenAI",
                                    "status": "CONNECTED",
                                    "message": "OK",
                                    "details": {},
                                }
                                mock_sentry.return_value = {
                                    "service": "Sentry",
                                    "status": "CONNECTED",
                                    "message": "OK",
                                    "details": {},
                                }

                                result = run_full_diagnostic()

                                self.assertEqual(result["overall_status"], "READY")
                                self.assertEqual(len(result["services"]), 6)

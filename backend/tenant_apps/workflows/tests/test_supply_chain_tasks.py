"""
Unit tests for supply-chain AI template suggestion Celery task.

Tests cover:
- Cache hit path (no DB/OpenAI calls)
- Fallback path (no AIConfiguration available)
- Error handling (invalid domain)

Note: The OpenAI live-call path is not exercised here to avoid requiring
a real API key in CI.  It is covered by integration tests in staging.
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings


# Use local-memory cache so tests never require Redis
@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-supply-chain",
        }
    }
)
class GenerateAITemplateSuggestionsTaskTestCase(TestCase):
    """Tests for workflows.generate_ai_template_suggestions Celery task."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def _make_tenant(self, tenant_id=1, name="Test Meat Co", industry_type="processor"):
        tenant = MagicMock()
        tenant.id = tenant_id
        tenant.name = name
        tenant.custom_data = {"industry_type": industry_type}
        return tenant

    # ------------------------------------------------------------------
    # Invalid domain
    # ------------------------------------------------------------------

    @patch("tenant_apps.workflows.tasks.Tenant")
    def test_invalid_domain_returns_error(self, MockTenant):
        from tenant_apps.workflows.tasks import generate_ai_template_suggestions

        result = generate_ai_template_suggestions(
            tenant_id=1,
            template_domain="not_a_real_domain",
        )
        self.assertFalse(result["success"])
        self.assertIn("Unknown template_domain", result["error"])

    # ------------------------------------------------------------------
    # Fallback path (no AIConfiguration)
    # ------------------------------------------------------------------

    @patch("tenant_apps.workflows.tasks.AIConfiguration")
    @patch("tenant_apps.workflows.tasks.Tenant")
    def test_fallback_cold_storage(self, MockTenant, MockAIConfig):
        """Without AIConfiguration the task returns static fallback suggestions."""
        from tenant_apps.workflows.tasks import generate_ai_template_suggestions

        tenant = self._make_tenant()
        MockTenant.objects.get.return_value = tenant
        # Simulate no active default config
        MockAIConfig.objects.filter.return_value.first.return_value = None

        result = generate_ai_template_suggestions(
            tenant_id=1,
            template_domain="cold_storage_monitoring",
        )

        self.assertEqual(result["mode"], "static")
        self.assertEqual(result["template_domain"], "cold_storage_monitoring")
        self.assertIn("suggestions", result)
        self.assertGreater(len(result["suggestions"]), 0)
        self.assertFalse(result["cached"])

    @patch("tenant_apps.workflows.tasks.AIConfiguration")
    @patch("tenant_apps.workflows.tasks.Tenant")
    def test_fallback_quality_inspection(self, MockTenant, MockAIConfig):
        tenant = self._make_tenant()
        MockTenant.objects.get.return_value = tenant
        MockAIConfig.objects.filter.return_value.first.return_value = None

        from tenant_apps.workflows.tasks import generate_ai_template_suggestions

        result = generate_ai_template_suggestions(
            tenant_id=1,
            template_domain="quality_inspection",
        )

        self.assertEqual(result["mode"], "static")
        self.assertEqual(result["template_domain"], "quality_inspection")

    @patch("tenant_apps.workflows.tasks.AIConfiguration")
    @patch("tenant_apps.workflows.tasks.Tenant")
    def test_fallback_carrier_compliance(self, MockTenant, MockAIConfig):
        tenant = self._make_tenant()
        MockTenant.objects.get.return_value = tenant
        MockAIConfig.objects.filter.return_value.first.return_value = None

        from tenant_apps.workflows.tasks import generate_ai_template_suggestions

        result = generate_ai_template_suggestions(
            tenant_id=1,
            template_domain="carrier_compliance",
        )

        self.assertEqual(result["mode"], "static")
        self.assertEqual(result["template_domain"], "carrier_compliance")

    # ------------------------------------------------------------------
    # Cache hit path
    # ------------------------------------------------------------------

    @patch("tenant_apps.workflows.tasks.AIConfiguration")
    @patch("tenant_apps.workflows.tasks.Tenant")
    def test_cache_hit_skips_db_and_openai(self, MockTenant, MockAIConfig):
        """Second call for the same tenant/domain uses the Redis cache."""
        from tenant_apps.workflows.tasks import generate_ai_template_suggestions

        tenant = self._make_tenant()
        MockTenant.objects.get.return_value = tenant
        MockAIConfig.objects.filter.return_value.first.return_value = None

        # First call — populates cache
        first_result = generate_ai_template_suggestions(
            tenant_id=1,
            template_domain="quality_inspection",
        )
        self.assertFalse(first_result["cached"])

        # Second call — should be served from cache
        second_result = generate_ai_template_suggestions(
            tenant_id=1,
            template_domain="quality_inspection",
        )
        self.assertTrue(second_result["cached"])
        # Tenant DB lookup should only have been called once (first call)
        MockTenant.objects.get.assert_called_once()

    # ------------------------------------------------------------------
    # Tenant not found
    # ------------------------------------------------------------------

    @patch("tenant_apps.workflows.tasks.Tenant")
    def test_tenant_not_found(self, MockTenant):
        from apps.tenants.models import Tenant
        MockTenant.objects.get.side_effect = Tenant.DoesNotExist

        from tenant_apps.workflows.tasks import generate_ai_template_suggestions

        result = generate_ai_template_suggestions(
            tenant_id=9999,
            template_domain="cold_storage_monitoring",
        )
        self.assertFalse(result["success"])
        self.assertIn("Tenant not found", result["error"])

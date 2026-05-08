"""
Tests for rate limiting / throttling functionality.

Wave S2: Security Hardening - Rate Limiting
"""

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient


class ThrottleClassesTestCase(TestCase):
    """Test custom throttle classes."""

    def test_auth_rate_throttle_import(self):
        """Test AuthRateThrottle can be imported."""
        from apps.core.throttling import AuthRateThrottle

        self.assertEqual(AuthRateThrottle.scope, "auth")

    def test_burst_rate_throttle_import(self):
        """Test BurstRateThrottle can be imported."""
        from apps.core.throttling import BurstRateThrottle

        self.assertEqual(BurstRateThrottle.scope, "burst")

    def test_sensitive_endpoint_throttle_import(self):
        """Test SensitiveEndpointThrottle can be imported."""
        from apps.core.throttling import SensitiveEndpointThrottle

        self.assertEqual(SensitiveEndpointThrottle.scope, "sensitive")
        self.assertEqual(SensitiveEndpointThrottle.rate, "3/minute")

    def test_tenant_aware_throttle_import(self):
        """Test TenantAwareThrottle can be imported."""
        from apps.core.throttling import TenantAwareThrottle

        self.assertEqual(TenantAwareThrottle.scope, "tenant")
        self.assertEqual(TenantAwareThrottle.rate, "500/minute")


class LoginThrottleTestCase(TestCase):
    """Test rate limiting on login endpoint."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()  # Clear cache before each test

    def tearDown(self):
        cache.clear()  # Clean up after each test

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_RATES": {
                "auth": "2/minute",  # Low limit for testing
            }
        }
    )
    def test_login_throttle_allows_requests_under_limit(self):
        """Test that requests under the limit are allowed."""
        # First request should work
        response = self.client.post("/api/v1/auth/login/", {"username": "test", "password": "wrong"})
        # Should get 401 (invalid credentials), not 429 (throttled)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_endpoint_exists(self):
        """Test login endpoint is accessible."""
        response = self.client.post("/api/v1/auth/login/", {"username": "test", "password": "test"})
        # Should get auth error, not 404
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED])


class ThrottleConfigurationTestCase(TestCase):
    """Test throttle configuration in settings."""

    def test_throttle_rates_configured(self):
        """Test that throttle rates are configured in settings."""
        from django.conf import settings

        throttle_rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})

        # Check all expected rates are configured
        self.assertIn("anon", throttle_rates)
        self.assertIn("user", throttle_rates)
        self.assertIn("auth", throttle_rates)
        self.assertIn("burst", throttle_rates)

    def test_throttle_classes_configured(self):
        """Test that throttle classes are configured in settings."""
        from django.conf import settings

        throttle_classes = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_CLASSES", [])

        # Check default throttle classes are enabled
        self.assertIn("rest_framework.throttling.AnonRateThrottle", throttle_classes)
        self.assertIn("rest_framework.throttling.UserRateThrottle", throttle_classes)

    def test_anon_rate_is_restrictive(self):
        """Test anonymous rate is more restrictive than user rate."""
        from django.conf import settings

        throttle_rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})

        # Parse rates (format: "N/period")
        anon_rate = int(throttle_rates.get("anon", "0/minute").split("/")[0])
        user_rate = int(throttle_rates.get("user", "0/minute").split("/")[0])

        self.assertLess(anon_rate, user_rate, "Anonymous rate should be lower than user rate")

    def test_auth_rate_is_most_restrictive(self):
        """Test auth rate is most restrictive."""
        from django.conf import settings

        throttle_rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})

        auth_rate = int(throttle_rates.get("auth", "0/minute").split("/")[0])
        anon_rate = int(throttle_rates.get("anon", "0/minute").split("/")[0])

        self.assertLess(auth_rate, anon_rate, "Auth rate should be lower than anon rate (stricter)")


class GuestLoginThrottleTestCase(TestCase):
    """Test rate limiting on guest login endpoint."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_guest_login_throttle_class_applied(self):
        """Test guest login has AuthRateThrottle applied."""
        from apps.core.throttling import AuthRateThrottle
        from apps.core.views import guest_login

        # Check the view has throttle classes
        throttle_classes = getattr(guest_login, "cls", guest_login).throttle_classes
        self.assertIn(AuthRateThrottle, throttle_classes)

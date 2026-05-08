"""
Tests for JWT authentication functionality.

Wave S1: Security Hardening - JWT Authentication
"""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser


class JWTConfigurationTestCase(TestCase):
    """Test JWT configuration in settings."""

    def test_simplejwt_in_installed_apps(self):
        """Test that simplejwt blacklist app is installed."""
        from django.conf import settings

        self.assertIn("rest_framework_simplejwt.token_blacklist", settings.INSTALLED_APPS)

    def test_jwt_authentication_class_configured(self):
        """Test JWT authentication is in DEFAULT_AUTHENTICATION_CLASSES."""
        from django.conf import settings

        auth_classes = settings.REST_FRAMEWORK.get("DEFAULT_AUTHENTICATION_CLASSES", [])
        self.assertIn(
            "apps.tenants.authentication.TenantAwareJWTAuthentication",
            auth_classes,
        )

    def test_simple_jwt_settings_exist(self):
        """Test SIMPLE_JWT settings are configured."""
        from django.conf import settings

        self.assertTrue(hasattr(settings, "SIMPLE_JWT"))

        jwt_settings = settings.SIMPLE_JWT
        self.assertIn("ACCESS_TOKEN_LIFETIME", jwt_settings)
        self.assertIn("REFRESH_TOKEN_LIFETIME", jwt_settings)
        self.assertIn("ROTATE_REFRESH_TOKENS", jwt_settings)
        self.assertIn("BLACKLIST_AFTER_ROTATION", jwt_settings)

    def test_access_token_lifetime_is_short(self):
        """Test access token lifetime is appropriately short for security."""
        from datetime import timedelta

        from django.conf import settings

        access_lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
        # Should be 30 minutes or less for security
        self.assertLessEqual(access_lifetime, timedelta(minutes=30))

    def test_refresh_token_rotation_enabled(self):
        """Test refresh token rotation is enabled."""
        from django.conf import settings

        self.assertTrue(settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS"))

    def test_blacklist_after_rotation_enabled(self):
        """Test old tokens are blacklisted after rotation."""
        from django.conf import settings

        self.assertTrue(settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION"))


class JWTEndpointsTestCase(TestCase):
    """Test JWT endpoint availability."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

    def test_token_obtain_endpoint_exists(self):
        """Test token obtain endpoint is accessible."""
        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        # Should get 200 (success) with valid credentials
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_token_obtain_returns_access_and_refresh(self):
        """Test token obtain returns both access and refresh tokens."""
        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_token_obtain_returns_user_info(self):
        """Test token obtain returns user information."""
        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], "testuser")

    def test_token_refresh_endpoint_exists(self):
        """Test token refresh endpoint is accessible."""
        # First obtain tokens
        obtain_response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        refresh_token = obtain_response.data["refresh"]

        # Then refresh
        response = self.client.post("/api/v1/auth/token/refresh/", {"refresh": refresh_token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_refresh_rotation_blacklists_old_refresh_token(self):
        """Regression: refresh rotation enabled -> old refresh token is rejected after use."""
        obtain_response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        refresh1 = obtain_response.data["refresh"]

        rotated = self.client.post(
            "/api/v1/auth/token/refresh/",
            {
                "refresh": refresh1,
            },
        )
        self.assertEqual(rotated.status_code, status.HTTP_200_OK)
        self.assertIn("access", rotated.data)
        self.assertIn("refresh", rotated.data)

        refresh2 = rotated.data["refresh"]
        self.assertNotEqual(refresh1, refresh2)

        reused = self.client.post(
            "/api/v1/auth/token/refresh/",
            {
                "refresh": refresh1,
            },
        )
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

        rotated2 = self.client.post(
            "/api/v1/auth/token/refresh/",
            {
                "refresh": refresh2,
            },
        )
        self.assertEqual(rotated2.status_code, status.HTTP_200_OK)
        self.assertIn("access", rotated2.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated2.data['access']}")
        resp = self.client.get("/api/v1/choices/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_token_verify_endpoint_exists(self):
        """Test token verify endpoint is accessible."""
        # First obtain tokens
        obtain_response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        access_token = obtain_response.data["access"]

        # Reset shared throttle state so this assertion isolates endpoint behavior.
        cache.clear()

        # Then verify
        response = self.client.post("/api/v1/auth/token/verify/", {"token": access_token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_credentials_returns_401(self):
        """Test invalid credentials return 401."""
        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "wrongpassword"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class JWTAuthenticationTestCase(TestCase):
    """Test JWT authentication flow."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

    def test_jwt_auth_with_bearer_token(self):
        """Test authentication with Bearer token."""
        # Obtain token
        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})
        access_token = response.data["access"]

        # Use token for authenticated request
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        # Access a protected endpoint
        response = self.client.get("/api/v1/choices/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_token_returns_401(self):
        """Test invalid token returns 401."""
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token")

        response = self.client.get("/api/v1/choices/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TenantAwareJWTTestCase(TestCase):
    """Test tenant-aware JWT claims."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        # Create tenant and tenant user
        self.tenant = Tenant.objects.create(name="Test Tenant", slug="test-tenant")
        self.tenant_user = TenantUser.objects.create(user=self.user, tenant=self.tenant, role="admin", is_active=True)

    def tearDown(self):
        cache.clear()

    def test_token_includes_tenant_info(self):
        """Test JWT includes tenant information."""
        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})

        # Check response includes tenants list
        self.assertIn("tenants", response.data)
        self.assertEqual(len(response.data["tenants"]), 1)

    def test_token_claims_include_username(self):
        """Test JWT claims include username."""
        from rest_framework_simplejwt.tokens import AccessToken

        response = self.client.post("/api/v1/auth/token/", {"username": "testuser", "password": "testpass123"})

        # Decode access token and check claims
        access_token = response.data["access"]
        token = AccessToken(access_token)

        self.assertEqual(token["username"], "testuser")
        self.assertEqual(token["email"], "test@example.com")

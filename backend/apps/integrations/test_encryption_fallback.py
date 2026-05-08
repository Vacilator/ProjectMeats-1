from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from cryptography.fernet import Fernet, InvalidToken

from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant


class ExternalAuthProviderEncryptionKeyTests(SimpleTestCase):
    """Unit tests for key-derivation helpers — no database required."""

    def test_env_key_absent_returns_none(self):
        """_get_env_encryption_key returns None when OAUTH_ENCRYPTION_KEY is not set."""
        with patch.dict("os.environ", {}, clear=True):
            self.assertIsNone(ExternalAuthProvider._get_env_encryption_key())

    def test_env_key_present_returns_bytes(self):
        """_get_env_encryption_key returns bytes when OAUTH_ENCRYPTION_KEY is set."""
        sample_key = Fernet.generate_key().decode("utf-8")
        with patch.dict("os.environ", {"OAUTH_ENCRYPTION_KEY": sample_key}, clear=True):
            result = ExternalAuthProvider._get_env_encryption_key()
            self.assertIsNotNone(result)
            self.assertIsInstance(result, bytes)

    def test_primary_key_falls_back_to_derived_when_env_absent(self):
        """_get_primary_encryption_key never raises even when OAUTH_ENCRYPTION_KEY is absent."""
        with patch.dict("os.environ", {}, clear=True):
            key = ExternalAuthProvider._get_primary_encryption_key()
            self.assertIsNotNone(key)
            # Must be a valid Fernet key (no exception raised on construction).
            Fernet(key)

    def test_decryption_keys_always_contains_derived_key(self):
        """_get_decryption_keys always includes the SECRET_KEY-derived key."""
        with patch.dict("os.environ", {}, clear=True):
            keys = ExternalAuthProvider._get_decryption_keys()
            self.assertGreater(len(keys), 0)
            # All returned keys must be valid Fernet keys.
            for k in keys:
                Fernet(k)

    def test_decryption_keys_includes_both_when_env_set(self):
        """_get_decryption_keys returns env key first when OAUTH_ENCRYPTION_KEY is set."""
        sample_key = Fernet.generate_key().decode("utf-8")
        with patch.dict("os.environ", {"OAUTH_ENCRYPTION_KEY": sample_key}, clear=True):
            keys = ExternalAuthProvider._get_decryption_keys()
            self.assertEqual(len(keys), 2)
            self.assertEqual(keys[0], sample_key.encode("utf-8"))


class ExternalAuthProviderEncryptionFallbackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="enc-user", password="pass")
        self.tenant = Tenant.objects.create(
            name="Enc Tenant",
            slug="enc-tenant",
            contact_email="enc@example.com",
            created_by=self.user,
        )

    def _make_provider(self, **kwargs):
        defaults = dict(
            tenant=self.tenant,
            provider_type="microsoft",
            is_active=True,
            token_expiry=timezone.now() + timedelta(days=1),
            access_token="placeholder",
        )
        defaults.update(kwargs)
        return ExternalAuthProvider.objects.create(**defaults)

    def test_decrypt_falls_back_to_secret_key_derived_key(self):
        """If an env key is present but the token was encrypted with the derived key,
        we should still decrypt successfully (prevents false reconnect-required errors).
        """
        provider = self._make_provider()
        plaintext = "access-token-123"

        # Encrypt using the SECRET_KEY-derived key (simulate old code path / missing env key).
        with patch.dict("os.environ", {}, clear=True):
            provider.set_encrypted_token("access", plaintext)
            provider.save()

        # Now set an unrelated env key; decrypt should fall back and still succeed.
        wrong_env_key = Fernet.generate_key().decode("utf-8")
        with patch.dict("os.environ", {"OAUTH_ENCRYPTION_KEY": wrong_env_key}, clear=True):
            self.assertEqual(provider.get_decrypted_token("access"), plaintext)

    def test_no_value_error_when_env_key_missing(self):
        """Regression test for Sentry PROJECTMEATS-BACKEND-1N.

        Missing OAUTH_ENCRYPTION_KEY must NOT raise ValueError during encrypt or decrypt.
        The old _get_encryption_key() raised ValueError when the env var was absent.
        """
        provider = self._make_provider()
        plaintext = "token-without-env-key"

        # Both operations must succeed without OAUTH_ENCRYPTION_KEY set.
        with patch.dict("os.environ", {}, clear=True):
            provider.set_encrypted_token("access", plaintext)
            provider.save()
            result = provider.get_decrypted_token("access")

        self.assertEqual(result, plaintext)

    def test_get_decrypted_token_no_env_key_round_trip(self):
        """Full round-trip: encrypt without env key → decrypt without env key."""
        provider = self._make_provider()
        plaintext = "round-trip-token"

        with patch.dict("os.environ", {}, clear=True):
            provider.set_encrypted_token("access", plaintext)
            provider.save()
            self.assertEqual(provider.get_decrypted_token("access"), plaintext)

    def test_get_decrypted_token_with_env_key_round_trip(self):
        """Full round-trip: encrypt with env key → decrypt with same env key."""
        provider = self._make_provider()
        plaintext = "env-key-round-trip"
        env_key = Fernet.generate_key().decode("utf-8")

        with patch.dict("os.environ", {"OAUTH_ENCRYPTION_KEY": env_key}, clear=True):
            provider.set_encrypted_token("access", plaintext)
            provider.save()
            self.assertEqual(provider.get_decrypted_token("access"), plaintext)

    def test_decrypt_raises_invalid_token_not_value_error_on_bad_ciphertext(self):
        """Corrupt/unrecognised ciphertext must raise InvalidToken, never ValueError."""
        provider = self._make_provider(access_token="not-a-valid-fernet-token")

        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(InvalidToken):
                provider.get_decrypted_token("access")

    def test_refresh_token_round_trip_without_env_key(self):
        """Refresh token encryption/decryption works without OAUTH_ENCRYPTION_KEY."""
        provider = self._make_provider(refresh_token=None)
        plaintext = "refresh-token-value"

        with patch.dict("os.environ", {}, clear=True):
            provider.set_encrypted_token("refresh", plaintext)
            provider.save()
            self.assertEqual(provider.get_decrypted_token("refresh"), plaintext)

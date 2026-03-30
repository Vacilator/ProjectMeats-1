from datetime import timedelta
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant


class ExternalAuthProviderEncryptionFallbackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='enc-user', password='pass')
        self.tenant = Tenant.objects.create(
            name='Enc Tenant',
            slug='enc-tenant',
            contact_email='enc@example.com',
            created_by=self.user,
        )

    def test_decrypt_falls_back_to_secret_key_derived_key(self):
        """If an env key is present but the token was encrypted with the derived key,
        we should still decrypt successfully (prevents false reconnect-required errors).
        """

        provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            is_active=True,
            token_expiry=timezone.now() + timedelta(days=1),
            access_token='placeholder',
        )

        plaintext = 'access-token-123'

        # Encrypt using the SECRET_KEY-derived key (simulate old code path / missing env key).
        with patch.dict('os.environ', {}, clear=True):
            provider.set_encrypted_token('access', plaintext)
            provider.save()

        # Now set an unrelated env key; decrypt should fall back and still succeed.
        wrong_env_key = Fernet.generate_key().decode('utf-8')
        with patch.dict('os.environ', {'OAUTH_ENCRYPTION_KEY': wrong_env_key}, clear=True):
            self.assertEqual(provider.get_decrypted_token('access'), plaintext)

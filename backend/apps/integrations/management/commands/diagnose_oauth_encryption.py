"""Diagnose OAuth token decryption for ExternalAuthProvider.

Usage:
  python manage.py diagnose_oauth_encryption --tenant-id <uuid>

Reports whether decryption fails due to:
- cryptography.fernet.InvalidToken (key mismatch / tampered token)
- Data missing (no provider row, missing token field)
- Config missing (OAUTH_ENCRYPTION_KEY not set)

Security:
- Never prints plaintext tokens.
"""

from __future__ import annotations

import json

from cryptography.fernet import Fernet, InvalidToken
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Diagnose OAuth token encryption/decryption for a tenant (ExternalAuthProvider)'

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=True, type=str)
        parser.add_argument('--provider-type', default='microsoft', type=str)
        parser.add_argument('--token-type', default='access', choices=['access', 'refresh'])

    def handle(self, *args, **options):
        from apps.integrations.models import ExternalAuthProvider
        from apps.tenants.rls import set_current_tenant

        tenant_id = str(options['tenant_id']).strip()
        provider_type = str(options['provider_type']).strip() or 'microsoft'
        token_type = str(options['token_type']).strip() or 'access'

        # Ensure RLS session vars are set so tenant-scoped rows are visible.
        set_current_tenant(tenant_id)

        row = (
            ExternalAuthProvider.objects.filter(
                tenant_id=tenant_id,
                provider_type=provider_type,
                is_active=True,
            )
            .order_by('-updated_at')
            .first()
        )

        if not row:
            self.stdout.write(
                json.dumps(
                    {
                        'ok': False,
                        'tenant_id': tenant_id,
                        'provider_type': provider_type,
                        'error_type': 'DATA_MISSING',
                        'message': 'No active ExternalAuthProvider row found for this tenant/provider.',
                    }
                )
            )
            return

        encrypted = row.access_token if token_type == 'access' else row.refresh_token
        if not encrypted:
            self.stdout.write(
                json.dumps(
                    {
                        'ok': False,
                        'tenant_id': tenant_id,
                        'provider_type': provider_type,
                        'provider_id': row.id,
                        'token_type': token_type,
                        'error_type': 'DATA_MISSING',
                        'message': f'Missing {token_type}_token value on ExternalAuthProvider.',
                    }
                )
            )
            return

        # Attempt decryption using the same multi-key logic used by the model.
        keys = ExternalAuthProvider._get_decryption_keys()
        results = []
        plaintext = None

        for idx, key in enumerate(keys):
            try:
                fernet = Fernet(key)
                plaintext = fernet.decrypt(str(encrypted).encode('utf-8'))
                results.append({'key_index': idx, 'ok': True})
                break
            except InvalidToken:
                results.append({'key_index': idx, 'ok': False, 'error_type': 'INVALID_TOKEN'})
            except Exception as e:
                results.append({'key_index': idx, 'ok': False, 'error_type': type(e).__name__, 'message': str(e)})

        if plaintext is not None:
            self.stdout.write(
                json.dumps(
                    {
                        'ok': True,
                        'tenant_id': tenant_id,
                        'provider_type': provider_type,
                        'provider_id': row.id,
                        'token_type': token_type,
                        'token_length': len(plaintext or b''),
                        'message': 'Decryption OK',
                        'attempts': results,
                    }
                )
            )
            return

        self.stdout.write(
            json.dumps(
                {
                    'ok': False,
                    'tenant_id': tenant_id,
                    'provider_type': provider_type,
                    'provider_id': row.id,
                    'token_type': token_type,
                    'error_type': 'INVALID_TOKEN',
                    'message': 'Token could not be decrypted with any configured key (env OAUTH_ENCRYPTION_KEY or SECRET_KEY-derived).',
                    'hint': 'Reconnect Outlook for this tenant to refresh encrypted tokens.',
                    'attempts': results,
                }
            )
        )

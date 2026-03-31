"""Microsoft Graph tool helpers for PM-AS.

Centralizes structured error responses so the LLM can react deterministically.

This module is the canonical place to catch decryption failures and translate them
into stable, user-facing error payloads.
"""

from __future__ import annotations

from cryptography.fernet import InvalidToken


def decryption_failed_payload() -> dict:
    return {
        'status': 'error',
        'error_code': 'DECRYPTION_FAILED',
        'message': 'Your Outlook connection needs to be refreshed for security reasons.',
    }


def decrypt_token_or_error(*, provider_row, token_type: str) -> tuple[str | None, dict | None]:
    """Return (token, error_payload). Never raises InvalidToken."""

    try:
        token = provider_row.get_decrypted_token(token_type)
        return token, None
    except InvalidToken:
        return None, decryption_failed_payload()

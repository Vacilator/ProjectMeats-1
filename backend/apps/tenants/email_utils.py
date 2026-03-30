"""
Email utility helpers.

Provides detection of well-known email provider errors (e.g. SendGrid quota
exceeded) so callers can distinguish permanent failures from transient ones
and log/alert accordingly.
"""

from __future__ import annotations

_QUOTA_PHRASES = (
    "maximum credits exceeded",
    "quota exceeded",
    "credits exceeded",
)


def is_sendgrid_quota_exceeded(exc: BaseException) -> bool:
    """Return True when *exc* is a SendGrid "Maximum credits exceeded" error.

    SendGrid raises ``python_http_client.exceptions.UnauthorizedError`` (which
    is a subclass of ``Exception``) with a message like::

        HTTP Error 401: Unauthorized, response body:
        b'{"errors":[{"message":"Maximum credits exceeded",...}]}'

    We deliberately inspect the string representation so this helper stays
    robust even if the sendgrid library is not installed (e.g. in tests that
    stub ``send_mail``).
    """
    message = str(exc).lower()
    return any(phrase in message for phrase in _QUOTA_PHRASES)

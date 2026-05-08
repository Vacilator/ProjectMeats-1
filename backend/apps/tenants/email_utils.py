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


def classify_email_send_exception(exc: BaseException) -> dict:
    """Classify common email sending failures into stable error codes.

    This returns a small, stable contract the frontend can rely on (without
    leaking secrets).

    Returns:
        dict: {
          'error_code': str,
          'message': str,
          'http_status': int,
          'retryable': bool,
        }
    """

    message_lower = str(exc).lower()

    if "sendgrid_api_key" in message_lower and "not set" in message_lower:
        return {
            "error_code": "EMAIL_SEND_NOT_CONFIGURED",
            "message": "Email sending is not configured for this environment.",
            "http_status": 503,
            "retryable": False,
        }

    if is_sendgrid_quota_exceeded(exc):
        return {
            "error_code": "EMAIL_SEND_QUOTA_EXCEEDED",
            "message": "Email provider quota exceeded. Please upgrade the plan or wait for quota reset.",
            "http_status": 429,
            "retryable": False,
        }

    if "http error 401" in message_lower or "unauthorized" in message_lower:
        return {
            "error_code": "EMAIL_SEND_UNAUTHORIZED",
            "message": "Email provider rejected credentials. Please reconnect or update credentials.",
            "http_status": 502,
            "retryable": False,
        }

    return {
        "error_code": "EMAIL_SEND_FAILED",
        "message": "Failed to send email.",
        "http_status": 502,
        "retryable": True,
    }

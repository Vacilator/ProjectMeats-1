"""Centralized redaction helpers for logs, Celery, and Sentry payloads."""

from __future__ import annotations

import copy
import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any

REDACTED = "[REDACTED]"
REDACTED_EMAIL = "[REDACTED:EMAIL]"
REDACTED_PHONE = "[REDACTED:PHONE]"
REDACTED_TOKEN = "[REDACTED:TOKEN]"
REDACTED_COOKIE = "[REDACTED:COOKIE]"
REDACTED_DEPTH = "[REDACTED:DEPTH]"
REDACTED_CYCLE = "[REDACTED:CYCLE]"

EMAIL_RE = re.compile(
    r"(?P<email>\b[A-Z0-9._%+\-]+@[A-Z0-9\-]+(?:\.[A-Z0-9\-]+)*\.[A-Z]{2,}\b)",
    re.IGNORECASE,
)
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?!\w)")
AUTH_RE = re.compile(r"\b(?P<scheme>Bearer|Basic)\s+[A-Za-z0-9._~+/=\-]+", re.IGNORECASE)
HEADER_ASSIGNMENT_RE = re.compile(
    r"(?P<key>authorization|x-api-key|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|secret|cookie)"
    r"(?P<sep>\s*[:=]\s*)(?P<value>[^\s,;]+)",
    re.IGNORECASE,
)
QUERY_ASSIGNMENT_RE = re.compile(
    r"(?P<key>token|access_token|refresh_token|api_key|password|secret)"
    r"(?P<sep>=)(?P<value>[^&\s]+)",
    re.IGNORECASE,
)

SENSITIVE_KEY_PATTERNS = (
    "password",
    "passcode",
    "secret",
    "token",
    "authorization",
    "cookie",
    "set-cookie",
    "api_key",
    "apikey",
    "client_secret",
    "email",
    "phone",
    "username",
)

_SAMPLE_RECORD = logging.makeLogRecord({})
STANDARD_LOG_RECORD_FIELDS = set(_SAMPLE_RECORD.__dict__.keys())


def _redacted_for_key(key: str) -> str:
    lowered = key.lower()
    if "email" in lowered:
        return REDACTED_EMAIL
    if "phone" in lowered:
        return REDACTED_PHONE
    if "cookie" in lowered:
        return REDACTED_COOKIE
    if any(fragment in lowered for fragment in ("authorization", "token", "secret", "api", "password")):
        return REDACTED_TOKEN
    return REDACTED


def _is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    return any(fragment in lowered for fragment in SENSITIVE_KEY_PATTERNS)


def sanitize_text(value: str) -> str:
    """Redact common PII and secret patterns while preserving log usefulness."""

    redacted = EMAIL_RE.sub(REDACTED_EMAIL, value)
    redacted = PHONE_RE.sub(REDACTED_PHONE, redacted)
    redacted = AUTH_RE.sub(lambda match: f"{match.group('scheme')} {REDACTED_TOKEN}", redacted)
    redacted = HEADER_ASSIGNMENT_RE.sub(
        lambda match: f"{match.group('key')}{match.group('sep')}{_redacted_for_key(match.group('key'))}",
        redacted,
    )
    redacted = QUERY_ASSIGNMENT_RE.sub(
        lambda match: f"{match.group('key')}{match.group('sep')}{REDACTED_TOKEN}",
        redacted,
    )
    return redacted


def sanitize_data(value: Any, *, _depth: int = 0, _seen: set[int] | None = None) -> Any:
    """Recursively sanitize nested telemetry/log payloads."""

    if _depth > 6:
        return REDACTED_DEPTH

    if _seen is None:
        _seen = set()

    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        return sanitize_text(value)

    if isinstance(value, bytes):
        return REDACTED_TOKEN

    if isinstance(value, BaseException):
        return {
            "type": value.__class__.__name__,
            "message": sanitize_text(str(value)),
        }

    if isinstance(value, Mapping):
        obj_id = id(value)
        if obj_id in _seen:
            return REDACTED_CYCLE
        _seen.add(obj_id)
        return {
            str(key): _redacted_for_key(str(key))
            if _is_sensitive_key(str(key))
            else sanitize_data(item, _depth=_depth + 1, _seen=_seen)
            for key, item in value.items()
        }

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        obj_id = id(value)
        if obj_id in _seen:
            return REDACTED_CYCLE
        _seen.add(obj_id)
        return [sanitize_data(item, _depth=_depth + 1, _seen=_seen) for item in value]

    if hasattr(value, "__dict__"):
        obj_id = id(value)
        if obj_id in _seen:
            return REDACTED_CYCLE
        _seen.add(obj_id)
        return sanitize_data(vars(value), _depth=_depth + 1, _seen=_seen)

    return sanitize_text(repr(value))


class RedactingLogFilter(logging.Filter):
    """Sanitize log messages and extra payloads before they hit handlers."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = sanitize_data(record.msg)

        if isinstance(record.args, Mapping):
            record.args = {
                key: sanitize_data(value)
                for key, value in record.args.items()
            }
        elif isinstance(record.args, tuple):
            record.args = tuple(sanitize_data(value) for value in record.args)
        elif record.args:
            record.args = sanitize_data(record.args)

        for key, value in list(record.__dict__.items()):
            if key not in STANDARD_LOG_RECORD_FIELDS:
                record.__dict__[key] = sanitize_data(value)

        return True


class RedactingFormatter(logging.Formatter):
    """Formatter that redacts exception text and final rendered strings."""

    def format(self, record: logging.LogRecord) -> str:
        clone = copy.copy(record)

        if clone.exc_info:
            clone.exc_text = sanitize_text(self.formatException(clone.exc_info))
        if clone.stack_info:
            clone.stack_info = sanitize_text(clone.stack_info)

        return sanitize_text(super().format(clone))


def sentry_before_send(event: dict[str, Any], hint: dict[str, Any] | None) -> dict[str, Any] | None:
    """Drop noisy 404s and sanitize the rest of the Sentry event."""

    exception_type = event.get("exception", {}).get("values", [{}])[0].get("type")
    if exception_type == "Http404":
        return None

    return sanitize_data(event)


def sentry_before_breadcrumb(
    crumb: dict[str, Any],
    hint: dict[str, Any] | None,
) -> dict[str, Any] | None:
    return sanitize_data(crumb)


def sentry_before_send_transaction(
    event: dict[str, Any],
    hint: dict[str, Any] | None,
) -> dict[str, Any] | None:
    return sanitize_data(event)

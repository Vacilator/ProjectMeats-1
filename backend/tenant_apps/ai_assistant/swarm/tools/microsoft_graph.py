"""Microsoft Graph tool helpers for PM-AS.

Centralizes structured error responses, query construction, and payload shaping so
the LLM can react deterministically.

This module is the canonical place to catch decryption failures and translate them
into stable, user-facing error payloads.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cryptography.fernet import InvalidToken


DEFAULT_MAIL_FOLDER = 'inbox'
DEFAULT_MAIL_LIMIT = 10
MAX_MAIL_LIMIT = 25

SUPPORTED_MAIL_FOLDERS = {
    'archive': 'archive',
    'inbox': 'inbox',
    'sent': 'sentitems',
    'sentitems': 'sentitems',
}

GRAPH_MAIL_SELECT_FIELDS = (
    'id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,'
    'hasAttachments,conversationId,isRead,webLink'
)


@dataclass(frozen=True)
class ToolExecutionError(Exception):
    """Structured tool failure that the router/LLM can reason about."""

    error_code: str
    message: str
    hint: str | None = None
    retryable: bool = False
    details: str | None = None

    def __str__(self) -> str:
        return self.message


def decryption_failed_payload() -> dict[str, str]:
    return {
        'status': 'error',
        'error_code': 'DECRYPTION_FAILED',
        'message': 'Your Outlook connection needs to be refreshed for security reasons.',
    }


def decrypt_token_or_error(*, provider_row, token_type: str) -> tuple[str | None, dict[str, str] | None]:
    """Return (token, error_payload). Never raises InvalidToken."""

    try:
        token = provider_row.get_decrypted_token(token_type)
        return token, None
    except InvalidToken:
        return None, decryption_failed_payload()


def build_tool_error_payload(
    *,
    tool_name: str,
    tenant_id: str | None = None,
    error_code: str,
    message: str,
    hint: str | None = None,
    retryable: bool = False,
    details: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'ok': False,
        'tool': tool_name,
        'tenant_id': tenant_id,
        'error': {
            'code': error_code,
            'message': message,
            'retryable': retryable,
        },
    }
    if hint:
        payload['error']['hint'] = hint
    if details:
        payload['error']['details'] = details
    return payload


def error_payload_from_exception(
    *,
    tool_name: str,
    tenant_id: str | None = None,
    exc: Exception,
) -> dict[str, Any]:
    if isinstance(exc, ToolExecutionError):
        return build_tool_error_payload(
            tool_name=tool_name,
            tenant_id=tenant_id,
            error_code=exc.error_code,
            message=exc.message,
            hint=exc.hint,
            retryable=exc.retryable,
            details=exc.details,
        )

    if isinstance(exc, ValueError):
        return build_tool_error_payload(
            tool_name=tool_name,
            tenant_id=tenant_id,
            error_code='INVALID_TOOL_ARGUMENTS',
            message=str(exc) or 'Tool arguments were invalid.',
            hint='Adjust the request parameters and try again.',
            retryable=False,
        )

    return build_tool_error_payload(
        tool_name=tool_name,
        tenant_id=tenant_id,
        error_code='TOOL_EXECUTION_FAILED',
        message='The tool failed before it could complete the request.',
        hint='Do not repeat the exact same tool call. Simplify the request or ask the user for clarification.',
        retryable=False,
        details=f'{type(exc).__name__}: {exc}',
    )


def normalize_mail_folder(folder: str | None) -> str:
    raw = str(folder or DEFAULT_MAIL_FOLDER).strip().lower()
    normalized = SUPPORTED_MAIL_FOLDERS.get(raw)
    if not normalized:
        supported = ', '.join(sorted(set(SUPPORTED_MAIL_FOLDERS)))
        raise ToolExecutionError(
            error_code='UNSUPPORTED_MAIL_FOLDER',
            message=f"Unsupported mail folder '{folder}'.",
            hint=f'Use one of: {supported}.',
            retryable=False,
        )
    return normalized


def normalize_mail_limit(limit: Any) -> int:
    if limit in (None, ''):
        return DEFAULT_MAIL_LIMIT

    try:
        parsed = int(limit)
    except (TypeError, ValueError) as exc:
        raise ToolExecutionError(
            error_code='INVALID_MAIL_LIMIT',
            message='Email result limit must be an integer.',
            hint=f'Use a number between 1 and {MAX_MAIL_LIMIT}.',
            retryable=False,
        ) from exc

    if parsed < 1 or parsed > MAX_MAIL_LIMIT:
        raise ToolExecutionError(
            error_code='INVALID_MAIL_LIMIT',
            message=f'Email result limit must be between 1 and {MAX_MAIL_LIMIT}.',
            hint='Reduce the number of requested emails and try again.',
            retryable=False,
        )

    return parsed


def build_mail_request(
    *,
    folder: str | None = None,
    is_read: bool | None = None,
    has_attachments: bool | None = None,
    search_query: str | None = None,
    limit: Any = None,
) -> dict[str, Any]:
    """Build a safe Microsoft Graph mail request descriptor."""

    folder_id = normalize_mail_folder(folder)
    top = normalize_mail_limit(limit)
    trimmed_query = str(search_query or '').strip()

    params: dict[str, Any] = {
        '$select': GRAPH_MAIL_SELECT_FIELDS,
        '$top': top,
    }
    headers: dict[str, str] = {}

    filter_parts: list[str] = []
    if is_read is not None:
        filter_parts.append(f"isRead eq {'true' if bool(is_read) else 'false'}")
    if has_attachments is not None:
        filter_parts.append(f"hasAttachments eq {'true' if bool(has_attachments) else 'false'}")
    if filter_parts:
        params['$filter'] = ' and '.join(filter_parts)

    if trimmed_query:
        escaped = trimmed_query.replace('"', '\\"')
        params['$search'] = f'"{escaped}"'
        headers['ConsistencyLevel'] = 'eventual'
    else:
        params['$orderby'] = 'receivedDateTime desc'

    return {
        'folder': folder_id,
        'limit': top,
        'url_path': f'/me/mailFolders/{folder_id}/messages',
        'params': params,
        'headers': headers,
        'requires_filter_fallback': bool(trimmed_query and filter_parts),
    }


def post_filter_messages(
    messages: list[dict[str, Any]],
    *,
    is_read: bool | None = None,
    has_attachments: bool | None = None,
) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for message in messages:
        if is_read is not None and bool(message.get('isRead')) is not bool(is_read):
            continue
        if has_attachments is not None and bool(message.get('hasAttachments')) is not bool(has_attachments):
            continue
        filtered.append(message)
    return filtered


def serialize_graph_message(message: dict[str, Any], *, folder: str) -> dict[str, Any]:
    from_data = ((message.get('from') or {}).get('emailAddress') or {}) if isinstance(message.get('from'), dict) else {}

    def _recipient_list(key: str) -> list[dict[str, str]]:
        rows = message.get(key) or []
        if not isinstance(rows, list):
            return []
        recipients: list[dict[str, str]] = []
        for row in rows[:10]:
            email = ((row or {}).get('emailAddress') or {}) if isinstance(row, dict) else {}
            address = str(email.get('address') or '').strip()
            name = str(email.get('name') or '').strip()
            if not address and not name:
                continue
            recipients.append({'name': name, 'address': address})
        return recipients

    preview = str(message.get('bodyPreview') or '').strip()

    return {
        'id': message.get('id'),
        'folder': folder,
        'subject': message.get('subject') or '(No Subject)',
        'received_at': message.get('receivedDateTime'),
        'is_read': bool(message.get('isRead')),
        'has_attachments': bool(message.get('hasAttachments')),
        'from': {
            'name': str(from_data.get('name') or '').strip(),
            'address': str(from_data.get('address') or '').strip(),
        },
        'to': _recipient_list('toRecipients'),
        'cc': _recipient_list('ccRecipients'),
        'preview': preview[:500],
        'web_link': message.get('webLink'),
        'conversation_id': message.get('conversationId'),
    }

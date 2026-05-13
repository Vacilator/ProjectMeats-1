"""Microsoft Graph tool helpers for PM-AS.

Centralizes structured error responses, query construction, and payload shaping so
the LLM can react deterministically.

This module is the canonical place to catch decryption failures and translate them
into stable, user-facing error payloads.
"""

from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from typing import Any

from cryptography.fernet import InvalidToken

from apps.integrations.email_failure_contract import build_email_failure, build_sync_action

DEFAULT_MAIL_FOLDER = "inbox"
DEFAULT_MAIL_LIMIT = 10
MAX_MAIL_LIMIT = 25

SUPPORTED_MAIL_FOLDERS = {
    "archive": "archive",
    "inbox": "inbox",
    "sent": "sentitems",
    "sentitems": "sentitems",
}

GRAPH_MAIL_SELECT_FIELDS = (
    "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,"
    "hasAttachments,conversationId,isRead,webLink"
)
GRAPH_ATTACHMENT_SELECT_FIELDS = "id,name,contentType,size,isInline"
GRAPH_FILE_ATTACHMENT_TYPE = "#microsoft.graph.fileattachment"
GRAPH_ITEM_ATTACHMENT_TYPE = "#microsoft.graph.itemattachment"
GRAPH_REFERENCE_ATTACHMENT_TYPE = "#microsoft.graph.referenceattachment"
SUPPORTED_GRAPH_ATTACHMENT_TYPES = frozenset({GRAPH_FILE_ATTACHMENT_TYPE})
SUPPORTED_AI_ATTACHMENT_EXTENSIONS = frozenset({".pdf", ".csv", ".xlsx", ".xls", ".docx", ".doc", ".txt"})
SUPPORTED_AI_ATTACHMENT_CONTENT_TYPES = frozenset(
    {
        "application/msword",
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/csv",
        "text/plain",
    }
)
GENERIC_ATTACHMENT_CONTENT_TYPES = frozenset({"", "application/octet-stream"})


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
        "status": "error",
        "error_code": "DECRYPTION_FAILED",
        "message": "Your Outlook connection needs to be refreshed for security reasons.",
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
    extra_error_fields: dict[str, Any] | None = None,
    action: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ok": False,
        "tool": tool_name,
        "tenant_id": tenant_id,
        "error": {
            "code": error_code,
            "message": message,
            "retryable": retryable,
        },
    }
    if hint:
        payload["error"]["hint"] = hint
    if details:
        payload["error"]["details"] = details
    if extra_error_fields:
        payload["error"].update(extra_error_fields)
    if action:
        payload["error"]["action"] = action
    return payload


def error_payload_from_exception(
    *,
    tool_name: str,
    tenant_id: str | None = None,
    exc: Exception,
) -> dict[str, Any]:
    if isinstance(exc, ToolExecutionError):
        failure = build_email_failure(
            exc.error_code,
            message=exc.message,
            hint=exc.hint,
            retryable=exc.retryable,
            stage="email_tool",
            details=exc.details,
        )
        extra_error_fields = {
            key: value for key, value in failure.items() if key not in {"code", "message", "retryable", "details"}
        }
        return build_tool_error_payload(
            tool_name=tool_name,
            tenant_id=tenant_id,
            error_code=failure["code"],
            message=failure["message"],
            hint=failure.get("hint"),
            retryable=failure["retryable"],
            details=failure.get("details"),
            extra_error_fields=extra_error_fields,
            action=build_sync_action(failure, tenant_id=tenant_id),
        )

    if isinstance(exc, ValueError):
        return build_tool_error_payload(
            tool_name=tool_name,
            tenant_id=tenant_id,
            error_code="INVALID_TOOL_ARGUMENTS",
            message=str(exc) or "Tool arguments were invalid.",
            hint="Adjust the request parameters and try again.",
            retryable=False,
        )

    return build_tool_error_payload(
        tool_name=tool_name,
        tenant_id=tenant_id,
        error_code="TOOL_EXECUTION_FAILED",
        message="The tool failed before it could complete the request.",
        hint="Do not repeat the exact same tool call. Simplify the request or ask the user for clarification.",
        retryable=False,
        details=f"{type(exc).__name__}: {exc}",
    )


def normalize_mail_folder(folder: str | None) -> str:
    raw = str(folder or DEFAULT_MAIL_FOLDER).strip().lower()
    normalized = SUPPORTED_MAIL_FOLDERS.get(raw)
    if not normalized:
        supported = ", ".join(sorted(set(SUPPORTED_MAIL_FOLDERS)))
        raise ToolExecutionError(
            error_code="UNSUPPORTED_MAIL_FOLDER",
            message=f"Unsupported mail folder '{folder}'.",
            hint=f"Use one of: {supported}.",
            retryable=False,
        )
    return normalized


def normalize_mail_limit(limit: Any) -> int:
    if limit in (None, ""):
        return DEFAULT_MAIL_LIMIT

    try:
        parsed = int(limit)
    except (TypeError, ValueError) as exc:
        raise ToolExecutionError(
            error_code="INVALID_MAIL_LIMIT",
            message="Email result limit must be an integer.",
            hint=f"Use a number between 1 and {MAX_MAIL_LIMIT}.",
            retryable=False,
        ) from exc

    if parsed < 1 or parsed > MAX_MAIL_LIMIT:
        raise ToolExecutionError(
            error_code="INVALID_MAIL_LIMIT",
            message=f"Email result limit must be between 1 and {MAX_MAIL_LIMIT}.",
            hint="Reduce the number of requested emails and try again.",
            retryable=False,
        )

    return parsed


def normalize_graph_attachment_type(raw_type: Any) -> str:
    return str(raw_type or "").strip().lower()


def validate_graph_attachment_metadata(attachment: dict[str, Any]) -> None:
    attachment_type = normalize_graph_attachment_type(attachment.get("@odata.type"))
    if attachment_type in SUPPORTED_GRAPH_ATTACHMENT_TYPES:
        return

    if attachment_type == GRAPH_ITEM_ATTACHMENT_TYPE:
        raise ToolExecutionError(
            error_code="UNSUPPORTED_ATTACHMENT_TYPE",
            message="Embedded Outlook item attachments are not supported for AI ingestion.",
            hint="Download the embedded item locally and upload a supported document file instead.",
            retryable=False,
        )

    if attachment_type == GRAPH_REFERENCE_ATTACHMENT_TYPE:
        raise ToolExecutionError(
            error_code="UNSUPPORTED_ATTACHMENT_TYPE",
            message="Cloud-link Outlook attachments are not supported for AI ingestion.",
            hint="Open the linked file in Outlook or SharePoint, then upload the document directly into ProjectMeats.",
            retryable=False,
        )

    raise ToolExecutionError(
        error_code="UNSUPPORTED_ATTACHMENT_TYPE",
        message="This Outlook attachment type is not supported for AI ingestion.",
        hint="Use a standard file attachment (PDF, image, Word, CSV, or Excel) or upload the file manually.",
        retryable=False,
        details=f'attachment_type={attachment_type or "unknown"}',
    )


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
    trimmed_query = str(search_query or "").strip()

    params: dict[str, Any] = {
        "$select": GRAPH_MAIL_SELECT_FIELDS,
        "$expand": f"attachments($select={GRAPH_ATTACHMENT_SELECT_FIELDS})",
        "$top": top,
    }
    headers: dict[str, str] = {}

    filter_parts: list[str] = []
    if is_read is not None:
        filter_parts.append(f"isRead eq {'true' if bool(is_read) else 'false'}")
    if has_attachments is not None:
        filter_parts.append(f"hasAttachments eq {'true' if bool(has_attachments) else 'false'}")
    if filter_parts:
        params["$filter"] = " and ".join(filter_parts)

    if trimmed_query:
        escaped = trimmed_query.replace('"', '\\"')
        params["$search"] = f'"{escaped}"'
        headers["ConsistencyLevel"] = "eventual"
    else:
        params["$orderby"] = "receivedDateTime desc"

    return {
        "folder": folder_id,
        "limit": top,
        "url_path": f"/me/mailFolders/{folder_id}/messages",
        "params": params,
        "headers": headers,
        "requires_filter_fallback": bool(trimmed_query and filter_parts),
    }


def post_filter_messages(
    messages: list[dict[str, Any]],
    *,
    is_read: bool | None = None,
    has_attachments: bool | None = None,
) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for message in messages:
        if is_read is not None and bool(message.get("isRead")) is not bool(is_read):
            continue
        if has_attachments is not None and bool(message.get("hasAttachments")) is not bool(has_attachments):
            continue
        filtered.append(message)
    return filtered


def serialize_graph_message(message: dict[str, Any], *, folder: str) -> dict[str, Any]:
    from_data = ((message.get("from") or {}).get("emailAddress") or {}) if isinstance(message.get("from"), dict) else {}

    def _recipient_list(key: str) -> list[dict[str, str]]:
        rows = message.get(key) or []
        if not isinstance(rows, list):
            return []
        recipients: list[dict[str, str]] = []
        for row in rows[:10]:
            email = ((row or {}).get("emailAddress") or {}) if isinstance(row, dict) else {}
            address = str(email.get("address") or "").strip()
            name = str(email.get("name") or "").strip()
            if not address and not name:
                continue
            recipients.append({"name": name, "address": address})
        return recipients

    preview = str(message.get("bodyPreview") or "").strip()
    attachments = message.get("attachments") or []
    serialized_attachments: list[dict[str, Any]] = []
    if isinstance(attachments, list):
        for attachment in attachments[:20]:
            if not isinstance(attachment, dict):
                continue
            attachment_id = str(attachment.get("id") or "").strip()
            name = str(attachment.get("name") or "").strip()
            if not attachment_id and not name:
                continue
            content_type = str(attachment.get("contentType") or "").strip()
            skip_reason = classify_attachment_for_ai_ingest(
                file_name=name,
                content_type=content_type,
                is_inline=attachment.get("isInline"),
            )
            if skip_reason:
                continue
            serialized_attachments.append(
                {
                    "attachment_id": attachment_id,
                    "name": name,
                    "content_type": content_type,
                    "size": attachment.get("size"),
                    "attachment_type": normalize_graph_attachment_type(attachment.get("@odata.type")) or None,
                }
            )

    return {
        "id": message.get("id"),
        "folder": folder,
        "subject": message.get("subject") or "(No Subject)",
        "received_at": message.get("receivedDateTime"),
        "is_read": bool(message.get("isRead")),
        "has_attachments": bool(message.get("hasAttachments")),
        "from": {
            "name": str(from_data.get("name") or "").strip(),
            "address": str(from_data.get("address") or "").strip(),
        },
        "to": _recipient_list("toRecipients"),
        "cc": _recipient_list("ccRecipients"),
        "preview": preview[:500],
        "web_link": message.get("webLink"),
        "conversation_id": message.get("conversationId"),
        "attachments": serialized_attachments,
    }


def infer_content_type(*, file_name: str | None, fallback: str | None = None) -> str:
    guessed, _ = mimetypes.guess_type(str(file_name or "").strip())
    fallback_type = str(fallback or "").split(";", 1)[0].strip()

    if guessed:
        return guessed
    if fallback_type:
        return fallback_type
    return "application/octet-stream"


def get_attachment_extension(file_name: str | None) -> str:
    return os.path.splitext(str(file_name or "").strip())[1].lower()


def classify_attachment_for_ai_ingest(
    *,
    file_name: str | None,
    content_type: str | None = None,
    is_inline: Any = None,
) -> str | None:
    normalized_name = str(file_name or "").strip() or "attachment"
    normalized_content_type = str(content_type or "").split(";", 1)[0].strip().lower()
    extension = get_attachment_extension(normalized_name)

    if bool(is_inline):
        return f"File type not supported for parsing: {normalized_name}. Ignored inline attachment."

    if normalized_content_type.startswith("image/"):
        return f"File type not supported for parsing: {normalized_name}. Ignored image attachment."

    if extension:
        if extension in SUPPORTED_AI_ATTACHMENT_EXTENSIONS:
            return None
        return f"File type not supported for parsing: {normalized_name}. Ignored."

    if normalized_content_type in SUPPORTED_AI_ATTACHMENT_CONTENT_TYPES:
        return None

    if normalized_content_type and normalized_content_type not in GENERIC_ATTACHMENT_CONTENT_TYPES:
        return f"File type not supported for parsing: {normalized_name}. Ignored."

    return f"File type not supported for parsing: {normalized_name}. Ignored."

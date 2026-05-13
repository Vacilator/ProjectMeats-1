"""Canonical email ingest/sync failure contract helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

EMAIL_INTEGRATIONS_CTA = {
    "type": "open_email_integrations",
    "label": "Open Email Integrations",
    "url": "/settings/email-integrations",
}


@dataclass(frozen=True)
class EmailFailureSpec:
    code: str
    category: str
    retryable: bool
    legacy_error_code: str
    default_message: str
    default_hint: str | None
    sync_code: str
    sync_summary: str
    sync_http_status: int = 200


EMAIL_FAILURE_SPECS: dict[str, EmailFailureSpec] = {
    "OUTLOOK_NOT_CONNECTED": EmailFailureSpec(
        code="OUTLOOK_NOT_CONNECTED",
        category="auth",
        retryable=False,
        legacy_error_code="not_connected",
        default_message="No active Microsoft account is connected for this tenant.",
        default_hint="Connect Outlook in Settings → Email Integrations, then retry.",
        sync_code="not_connected",
        sync_summary="Email sync requires an Outlook connection",
        sync_http_status=400,
    ),
    "DECRYPTION_FAILED": EmailFailureSpec(
        code="DECRYPTION_FAILED",
        category="decrypt",
        retryable=False,
        legacy_error_code="decryption_failed",
        default_message="Your Outlook connection needs to be refreshed for security reasons.",
        default_hint="Reconnect Outlook in Settings → Email Integrations.",
        sync_code="decryption_failed",
        sync_summary="Email sync requires reconnect",
    ),
    "OUTLOOK_TOKEN_REFRESH_FAILED": EmailFailureSpec(
        code="OUTLOOK_TOKEN_REFRESH_FAILED",
        category="auth",
        retryable=False,
        legacy_error_code="token_refresh_failed",
        default_message="Outlook could not refresh the current credentials for this tenant.",
        default_hint="Reconnect Outlook in Settings → Email Integrations.",
        sync_code="sync_failed",
        sync_summary="Email sync requires reconnect",
    ),
    "OUTLOOK_CONNECTION_EXPIRED": EmailFailureSpec(
        code="OUTLOOK_CONNECTION_EXPIRED",
        category="auth",
        retryable=False,
        legacy_error_code="token_invalid",
        default_message="Your Outlook connection has expired.",
        default_hint="Reconnect Outlook in Settings → Email Integrations.",
        sync_code="sync_failed",
        sync_summary="Email sync requires reconnect",
    ),
    "OUTLOOK_ACCESS_TOKEN_MISSING": EmailFailureSpec(
        code="OUTLOOK_ACCESS_TOKEN_MISSING",
        category="auth",
        retryable=False,
        legacy_error_code="token_missing",
        default_message="No Outlook access token is available for this tenant.",
        default_hint="Reconnect Outlook in Settings → Email Integrations.",
        sync_code="sync_failed",
        sync_summary="Email sync requires reconnect",
    ),
    "GRAPH_AUTH_FAILED": EmailFailureSpec(
        code="GRAPH_AUTH_FAILED",
        category="auth",
        retryable=False,
        legacy_error_code="token_invalid",
        default_message="Microsoft Graph rejected the current Outlook credentials.",
        default_hint="Reconnect Outlook in Settings → Email Integrations.",
        sync_code="sync_failed",
        sync_summary="Email sync requires reconnect",
    ),
    "GRAPH_TIMEOUT": EmailFailureSpec(
        code="GRAPH_TIMEOUT",
        category="network",
        retryable=True,
        legacy_error_code="graph_timeout",
        default_message="Microsoft Graph timed out while syncing email.",
        default_hint="Retry the sync. If the problem persists, narrow the request or try again shortly.",
        sync_code="sync_failed",
        sync_summary="Email sync can be retried",
    ),
    "GRAPH_RATE_LIMITED": EmailFailureSpec(
        code="GRAPH_RATE_LIMITED",
        category="quota",
        retryable=True,
        legacy_error_code="graph_rate_limited",
        default_message="Microsoft Graph rate-limited the email sync request.",
        default_hint="Wait a moment and retry the sync.",
        sync_code="sync_failed",
        sync_summary="Email sync can be retried",
    ),
    "GRAPH_SERVICE_UNAVAILABLE": EmailFailureSpec(
        code="GRAPH_SERVICE_UNAVAILABLE",
        category="network",
        retryable=True,
        legacy_error_code="graph_service_unavailable",
        default_message="Microsoft Graph is temporarily unavailable for email sync.",
        default_hint="Retry the sync in a few moments.",
        sync_code="sync_failed",
        sync_summary="Email sync can be retried",
    ),
    "GRAPH_QUERY_REJECTED": EmailFailureSpec(
        code="GRAPH_QUERY_REJECTED",
        category="processing",
        retryable=False,
        legacy_error_code="graph_query_rejected",
        default_message="Microsoft Graph rejected the current email search query.",
        default_hint="Simplify the email search request and try again.",
        sync_code="sync_failed",
        sync_summary="Email sync completed with errors",
    ),
    "GRAPH_ATTACHMENT_NOT_FOUND": EmailFailureSpec(
        code="GRAPH_ATTACHMENT_NOT_FOUND",
        category="processing",
        retryable=False,
        legacy_error_code="graph_attachment_not_found",
        default_message="The selected Outlook attachment could not be found.",
        default_hint="Refresh the email results and choose the attachment again.",
        sync_code="sync_failed",
        sync_summary="Email sync completed with errors",
    ),
    "GRAPH_REQUEST_FAILED": EmailFailureSpec(
        code="GRAPH_REQUEST_FAILED",
        category="network",
        retryable=False,
        legacy_error_code="graph_request_failed",
        default_message="Microsoft Graph email sync failed before returning results.",
        default_hint="Retry the sync. If the problem persists, reconnect Outlook.",
        sync_code="sync_failed",
        sync_summary="Email sync completed with errors",
    ),
    "GRAPH_HTTP_ERROR": EmailFailureSpec(
        code="GRAPH_HTTP_ERROR",
        category="network",
        retryable=False,
        legacy_error_code="graph_http_error",
        default_message="Microsoft Graph returned an unexpected email sync error.",
        default_hint="Retry the sync. If the problem persists, reconnect Outlook.",
        sync_code="sync_failed",
        sync_summary="Email sync completed with errors",
    ),
    "ATTACHMENT_TOO_LARGE": EmailFailureSpec(
        code="ATTACHMENT_TOO_LARGE",
        category="quota",
        retryable=False,
        legacy_error_code="attachment_too_large",
        default_message="The selected Outlook attachment is too large to ingest safely.",
        default_hint="Choose a smaller attachment or upload it manually through the document UI.",
        sync_code="sync_failed",
        sync_summary="Email sync completed with errors",
    ),
    "EMAIL_SYNC_SCHEDULE_FAILED": EmailFailureSpec(
        code="EMAIL_SYNC_SCHEDULE_FAILED",
        category="processing",
        retryable=True,
        legacy_error_code="sync_schedule_failed",
        default_message="Email sync could not be queued right now.",
        default_hint="Retry the sync in a few moments.",
        sync_code="sync_schedule_failed",
        sync_summary="Email sync could not be queued right now",
    ),
    "EMAIL_SYNC_FAILED": EmailFailureSpec(
        code="EMAIL_SYNC_FAILED",
        category="processing",
        retryable=False,
        legacy_error_code="sync_exception",
        default_message="Email sync failed before it could complete.",
        default_hint="Retry the sync. If the problem persists, reconnect Outlook in Settings → Email Integrations.",
        sync_code="sync_exception",
        sync_summary="Email sync failed",
    ),
    "EMAIL_PROCESSING_FAILED": EmailFailureSpec(
        code="EMAIL_PROCESSING_FAILED",
        category="processing",
        retryable=False,
        legacy_error_code="processing_failed",
        default_message="Email processing failed before it could complete.",
        default_hint=None,
        sync_code="sync_failed",
        sync_summary="Email processing failed",
    ),
}


def get_email_failure_spec(code: str | None) -> EmailFailureSpec | None:
    normalized = str(code or "").strip().upper()
    if not normalized:
        return None
    return EMAIL_FAILURE_SPECS.get(normalized)


def should_include_integrations_cta(failure: dict[str, Any]) -> bool:
    return str(failure.get("category") or "").strip().lower() in {"auth", "decrypt"}


def build_sync_action(failure: dict[str, Any] | None, *, tenant_id: str | None = None) -> dict[str, Any] | None:
    if not isinstance(failure, dict):
        return None

    category = str(failure.get("category") or "").strip().lower()
    if category in {"auth", "decrypt"}:
        if tenant_id:
            query = urlencode(
                {
                    "provider": "microsoft",
                    "tenant_id": tenant_id,
                    "redirect": "1",
                }
            )
            return {
                "type": "reconnect_outlook",
                "label": "Reconnect Outlook",
                "url": f"/api/v1/integrations/oauth/authorize/?{query}",
            }
        return {
            "type": "reconnect_outlook",
            "label": "Reconnect Outlook",
            "url": EMAIL_INTEGRATIONS_CTA["url"],
        }

    if bool(failure.get("retryable")):
        return {
            "type": "retry_sync",
            "label": "Retry Sync",
        }

    return None


def build_email_failure(
    code: str,
    *,
    message: str | None = None,
    hint: str | None = None,
    retryable: bool | None = None,
    stage: str | None = None,
    provider: str = "microsoft",
    details: Any = None,
    detail_type: str | None = None,
    legacy_error_code: str | None = None,
) -> dict[str, Any]:
    resolved_code = str(code or "").strip().upper()
    spec = get_email_failure_spec(resolved_code) or EMAIL_FAILURE_SPECS["EMAIL_SYNC_FAILED"]
    resolved_retryable = spec.retryable if retryable is None else bool(retryable)
    payload: dict[str, Any] = {
        "state": "retryable_failure" if resolved_retryable else "non_retryable_failure",
        "category": spec.category,
        "code": resolved_code or spec.code,
        "legacy_error_code": legacy_error_code
        or (spec.legacy_error_code if resolved_code == spec.code else resolved_code.lower()),
        "retryable": resolved_retryable,
        "message": message or spec.default_message,
        "provider": provider,
    }
    resolved_hint = hint if hint is not None else spec.default_hint
    if resolved_hint:
        payload["hint"] = resolved_hint
    if stage:
        payload["stage"] = stage
    if detail_type:
        payload["detail_type"] = detail_type
    if details not in (None, "", [], {}):
        payload["details"] = details
    return payload


def build_sync_failure_response(
    failure: dict[str, Any],
    *,
    tenant_id: str,
    provider_email: str | None = None,
    stats: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], int]:
    spec = get_email_failure_spec(failure.get("code")) or EMAIL_FAILURE_SPECS["EMAIL_SYNC_FAILED"]
    payload: dict[str, Any] = {
        "ok": False,
        "message": spec.sync_summary,
        "error": failure.get("message"),
        "code": spec.sync_code,
        "error_code": failure.get("legacy_error_code") or spec.legacy_error_code,
        "tenant_id": tenant_id,
        "failure": failure,
    }
    if failure.get("hint"):
        payload["hint"] = failure["hint"]
    if provider_email:
        payload["provider_email"] = provider_email
    if stats is not None:
        payload["stats"] = stats
    action = build_sync_action(failure, tenant_id=tenant_id)
    if action:
        payload["action"] = action
    if should_include_integrations_cta(failure):
        payload["cta"] = EMAIL_INTEGRATIONS_CTA
    if failure.get("detail_type"):
        payload.setdefault("details", {})["type"] = failure["detail_type"]
    return payload, spec.sync_http_status


def infer_email_failure(
    *,
    code: str | None = None,
    detail: str | None = None,
    stage: str | None = None,
    detail_type: str | None = None,
) -> dict[str, Any] | None:
    normalized = str(code or "").strip().lower()
    normalized_detail = str(detail or "").strip()
    detail_lower = normalized_detail.lower()

    if normalized in {"not_connected"}:
        return build_email_failure("OUTLOOK_NOT_CONNECTED", stage=stage, detail_type=detail_type)
    if normalized in {"decryption_failed"} or (
        "decrypt" in detail_lower or "invalidtoken" in detail_lower or "oauth_encryption_key" in detail_lower
    ):
        return build_email_failure(
            "DECRYPTION_FAILED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"token_refresh_failed"} or "token refresh failed" in detail_lower:
        return build_email_failure(
            "OUTLOOK_TOKEN_REFRESH_FAILED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"token_invalid", "outlook_connection_expired"} or "invalid/expired" in detail_lower:
        return build_email_failure(
            "OUTLOOK_CONNECTION_EXPIRED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"token_missing", "outlook_access_token_missing"} or (
        "no microsoft access token" in detail_lower or "no access token" in detail_lower
    ):
        return build_email_failure(
            "OUTLOOK_ACCESS_TOKEN_MISSING",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"graph_timeout"} or "timed out" in detail_lower:
        return build_email_failure(
            "GRAPH_TIMEOUT", message=normalized_detail or None, stage=stage, detail_type=detail_type
        )
    if normalized in {"graph_rate_limited"} or "rate limit" in detail_lower or "too many requests" in detail_lower:
        return build_email_failure(
            "GRAPH_RATE_LIMITED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"graph_service_unavailable"}:
        return build_email_failure(
            "GRAPH_SERVICE_UNAVAILABLE",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"graph_auth_failed"}:
        return build_email_failure(
            "GRAPH_AUTH_FAILED", message=normalized_detail or None, stage=stage, detail_type=detail_type
        )
    if normalized in {"graph_request_failed"}:
        return build_email_failure(
            "GRAPH_REQUEST_FAILED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"graph_http_error"}:
        return build_email_failure(
            "GRAPH_HTTP_ERROR", message=normalized_detail or None, stage=stage, detail_type=detail_type
        )
    if normalized in {"attachment_too_large"}:
        return build_email_failure(
            "ATTACHMENT_TOO_LARGE",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"sync_schedule_failed"}:
        return build_email_failure(
            "EMAIL_SYNC_SCHEDULE_FAILED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    if normalized in {"sync_failed", "sync_exception", "processing_failed"} or normalized_detail:
        return build_email_failure(
            "EMAIL_SYNC_FAILED" if stage and "sync" in stage else "EMAIL_PROCESSING_FAILED",
            message=normalized_detail or None,
            stage=stage,
            detail_type=detail_type,
        )
    return None


def failure_from_stats(stats: Any, *, stage: str = "sync") -> dict[str, Any] | None:
    if not isinstance(stats, dict):
        return None

    raw_failure = stats.get("failure")
    if isinstance(raw_failure, dict):
        return build_email_failure(
            raw_failure.get("code") or raw_failure.get("legacy_error_code") or "EMAIL_SYNC_FAILED",
            message=raw_failure.get("message"),
            hint=raw_failure.get("hint"),
            retryable=raw_failure.get("retryable"),
            stage=raw_failure.get("stage") or stage,
            provider=raw_failure.get("provider") or "microsoft",
            details=raw_failure.get("details"),
            detail_type=raw_failure.get("detail_type"),
            legacy_error_code=raw_failure.get("legacy_error_code"),
        )

    detail = ""
    errors_detail = stats.get("errors_detail")
    if isinstance(errors_detail, list) and errors_detail:
        detail = str(errors_detail[0] or "").strip()
    if not detail and stats.get("error"):
        detail = str(stats.get("error") or "").strip()

    return infer_email_failure(
        code=str(stats.get("error_code") or "").strip(),
        detail=detail or None,
        stage=stage,
    )


def failure_from_log_fields(
    *,
    failure_code: str | None = None,
    status_metadata: dict[str, Any] | None = None,
    processing_error: str | None = None,
) -> dict[str, Any] | None:
    if isinstance(status_metadata, dict) and status_metadata.get("code"):
        return build_email_failure(
            status_metadata.get("code"),
            message=status_metadata.get("message"),
            hint=status_metadata.get("hint"),
            retryable=status_metadata.get("retryable"),
            stage=status_metadata.get("stage"),
            provider=status_metadata.get("provider") or "microsoft",
            details=status_metadata.get("details"),
            detail_type=status_metadata.get("detail_type"),
            legacy_error_code=status_metadata.get("legacy_error_code"),
        )
    return infer_email_failure(code=failure_code, detail=processing_error, stage="processing")

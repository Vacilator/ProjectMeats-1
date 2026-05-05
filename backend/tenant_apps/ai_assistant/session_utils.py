"""Helpers for tenant-bound AI chat sessions."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime


SESSION_ATTACHMENT_ALLOWLIST_KEY = 'graph_attachment_allowlist'
SESSION_ATTACHMENT_ALLOWLIST_TTL = timedelta(minutes=30)
SESSION_ATTACHMENT_ALLOWLIST_MAX_ENTRIES = 100
SESSION_COMPACTION_KEY = 'compaction'


def get_tenant_id(tenant: Any) -> str:
    """Return a normalized tenant UUID string or empty string."""
    return str(getattr(tenant, 'id', '') or '').strip()


def get_request_tenant_id(request: Any) -> str:
    """Return the current request tenant ID or empty string."""
    return get_tenant_id(getattr(request, 'tenant', None))


def get_session_tenant_id(session: Any) -> str:
    """Return the canonical tenant FK for a session or empty string."""
    return str(getattr(session, 'tenant_id', '') or '').strip()


def bind_context_to_tenant(context_data: Any, tenant: Any) -> dict:
    """Return a dict context payload hard-bound to the provided tenant."""
    bound = dict(context_data) if isinstance(context_data, dict) else {}
    tenant_id = get_tenant_id(tenant)
    if tenant_id:
        bound['tenant_id'] = tenant_id
    return bound


def session_matches_tenant(session: Any, tenant: Any) -> bool:
    """Return True when the session is explicitly bound to the given tenant."""
    tenant_id = get_tenant_id(tenant)
    if not tenant_id:
        return False
    return get_session_tenant_id(session) == tenant_id


def _attachment_allowlist_key(message_id: Any, attachment_id: Any) -> str:
    return f'{str(message_id or "").strip()}::{str(attachment_id or "").strip()}'


def _normalize_staged_entry(entry: Any, *, now=None) -> dict[str, Any] | None:
    if not isinstance(entry, dict):
        return None

    message_id = str(entry.get('message_id') or '').strip()
    attachment_id = str(entry.get('attachment_id') or '').strip()
    staged_at_raw = str(entry.get('staged_at') or '').strip()
    staged_at = parse_datetime(staged_at_raw) if staged_at_raw else None
    if not message_id or not attachment_id or staged_at is None:
        return None

    current_time = now or timezone.now()
    if timezone.is_naive(staged_at):
        staged_at = timezone.make_aware(staged_at)
    if staged_at < current_time - SESSION_ATTACHMENT_ALLOWLIST_TTL:
        return None

    return {
        'message_id': message_id,
        'attachment_id': attachment_id,
        'name': str(entry.get('name') or '').strip(),
        'content_type': str(entry.get('content_type') or '').strip(),
        'size': entry.get('size'),
        'attachment_type': str(entry.get('attachment_type') or '').strip() or None,
        'staged_at': staged_at.isoformat(),
    }


def get_staged_attachment_allowlist(context_data: Any, *, now=None) -> dict[str, dict[str, Any]]:
    """Return the active staged attachment allowlist from session context."""
    if not isinstance(context_data, dict):
        return {}

    raw_entries = context_data.get(SESSION_ATTACHMENT_ALLOWLIST_KEY)
    if not isinstance(raw_entries, dict):
        return {}

    active_entries: list[tuple[str, dict[str, Any]]] = []
    current_time = now or timezone.now()
    for raw_key, raw_entry in raw_entries.items():
        normalized = _normalize_staged_entry(raw_entry, now=current_time)
        if not normalized:
            continue
        active_entries.append((_attachment_allowlist_key(normalized['message_id'], normalized['attachment_id']), normalized))

    active_entries.sort(key=lambda item: item[1]['staged_at'], reverse=True)
    return dict(active_entries[:SESSION_ATTACHMENT_ALLOWLIST_MAX_ENTRIES])


def bind_attachment_allowlist(context_data: Any, attachments: list[dict[str, Any]], *, now=None) -> dict:
    """Merge staged attachment refs into session context and prune expired entries."""
    bound = dict(context_data) if isinstance(context_data, dict) else {}
    allowlist = get_staged_attachment_allowlist(bound, now=now)
    current_time = now or timezone.now()
    staged_at = current_time.isoformat()

    for attachment in attachments:
        message_id = str(attachment.get('message_id') or '').strip()
        attachment_id = str(attachment.get('attachment_id') or '').strip()
        if not message_id or not attachment_id:
            continue

        allowlist[_attachment_allowlist_key(message_id, attachment_id)] = {
            'message_id': message_id,
            'attachment_id': attachment_id,
            'name': str(attachment.get('name') or '').strip(),
            'content_type': str(attachment.get('content_type') or '').strip(),
            'size': attachment.get('size'),
            'attachment_type': str(attachment.get('attachment_type') or '').strip() or None,
            'staged_at': staged_at,
        }

    sorted_entries = sorted(
        allowlist.items(),
        key=lambda item: item[1].get('staged_at') or '',
        reverse=True,
    )[:SESSION_ATTACHMENT_ALLOWLIST_MAX_ENTRIES]

    if sorted_entries:
        bound[SESSION_ATTACHMENT_ALLOWLIST_KEY] = dict(sorted_entries)
    else:
        bound.pop(SESSION_ATTACHMENT_ALLOWLIST_KEY, None)

    return bound


def get_staged_attachment_status(
    session: Any,
    *,
    message_id: Any,
    attachment_id: Any,
    now=None,
) -> tuple[str, dict[str, Any] | None]:
    """Return ('active'|'expired'|'missing', metadata) for a staged attachment ref."""
    key = _attachment_allowlist_key(message_id, attachment_id)
    context_data = getattr(session, 'context_data', None)
    raw_entries = context_data.get(SESSION_ATTACHMENT_ALLOWLIST_KEY) if isinstance(context_data, dict) else {}
    active_entries = get_staged_attachment_allowlist(context_data, now=now)

    if key in active_entries:
        return 'active', active_entries[key]
    if isinstance(raw_entries, dict) and key in raw_entries:
        return 'expired', None
    return 'missing', None


def get_session_compaction_state(context_data: Any) -> dict[str, Any]:
    """Return normalized session compaction state from session context."""
    if not isinstance(context_data, dict):
        return {}
    raw_state = context_data.get(SESSION_COMPACTION_KEY)
    if not isinstance(raw_state, dict):
        return {}
    state = dict(raw_state)
    memory_key = str(state.get('memory_key') or '').strip()
    if memory_key:
        state['memory_key'] = memory_key
    else:
        state.pop('memory_key', None)
    return state


def get_session_compaction_watermark(context_data: Any):
    """Return the parsed compaction watermark timestamp, if present."""
    state = get_session_compaction_state(context_data)
    raw_value = str(state.get('last_compacted_created_on') or '').strip()
    if not raw_value:
        return None
    parsed = parse_datetime(raw_value)
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def bind_session_compaction_state(
    context_data: Any,
    tenant: Any,
    *,
    memory_key: str,
    last_compacted_created_on: Any,
    last_compacted_message_id: Any,
    compacted_count: int,
) -> dict:
    """Bind session compaction metadata while preserving tenant affinity."""
    bound = bind_context_to_tenant(context_data, tenant)
    watermark = last_compacted_created_on
    if hasattr(watermark, 'isoformat'):
        watermark = watermark.isoformat()

    bound[SESSION_COMPACTION_KEY] = {
        'memory_key': str(memory_key or '').strip(),
        'last_compacted_created_on': str(watermark or '').strip(),
        'last_compacted_message_id': str(last_compacted_message_id or '').strip(),
        'compacted_count': max(0, int(compacted_count or 0)),
        'updated_at': timezone.now().isoformat(),
    }
    return bound

"""Sentry integration helpers for the AI assistant.

This module intentionally contains *no* tenant resolution logic.
Callers must provide the active tenant_id and enforce that it matches
request.tenant / app.current_tenant.

We keep this logic here so both:
- Swarm tool execution (internal)
- Optional admin-only diagnostics endpoints
share a single implementation.
"""

from __future__ import annotations

from typing import Any, Dict, List


def fetch_recent_sentry_issues_for_tenant(
    *,
    tenant_id: str,
    token: str | None,
    org_slug: str | None,
    base_url: str = "https://sentry.io",
    limit: int = 5,
    timeout_seconds: int = 10,
) -> Dict[str, Any]:
    """Fetch recent Sentry issues tagged with the given tenant_id.

    Returns a stable JSON-ish payload:
      { ok: bool, error?: str, issues?: [...] }

    Caller is responsible for verifying `tenant_id` is the active tenant.
    """

    tenant_id = (tenant_id or "").strip()
    if not tenant_id:
        raise ValueError("tenant_id is required")

    if not token:
        return {"ok": False, "error": "SENTRY_AUTH_TOKEN not configured"}
    if not org_slug:
        return {"ok": False, "error": "SENTRY_ORG_SLUG not configured"}

    try:
        import requests
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "error": f"requests not available: {exc}"}

    base_url = (base_url or "https://sentry.io").rstrip("/")
    url = f"{base_url}/api/0/organizations/{org_slug}/issues/"

    try:
        limit_int = int(limit)
    except Exception:
        limit_int = 5
    limit_int = max(1, min(20, limit_int))

    params = {
        "query": f"tenant_id:{tenant_id}",
        "limit": limit_int,
        "sort": "date",
    }

    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            params=params,
            timeout=timeout_seconds,
        )
    except Exception as exc:
        return {"ok": False, "error": "Sentry API request failed", "detail": str(exc)[:300]}

    if resp.status_code >= 400:
        return {
            "ok": False,
            "status": resp.status_code,
            "error": "Sentry API request failed",
            "detail": (resp.text or "")[:300],
        }

    issues: List[Dict[str, Any]] = resp.json() if resp.content else []
    out: List[Dict[str, Any]] = []
    for it in (issues or [])[:limit_int]:
        out.append(
            {
                "id": it.get("id"),
                "shortId": it.get("shortId") or it.get("short_id"),
                "title": it.get("title"),
                "permalink": it.get("permalink"),
                "culprit": it.get("culprit"),
                "level": it.get("level"),
                "status": it.get("status"),
                "firstSeen": it.get("firstSeen"),
                "lastSeen": it.get("lastSeen"),
                "count": it.get("count"),
            }
        )

    return {"ok": True, "tenant_id": tenant_id, "issues": out}

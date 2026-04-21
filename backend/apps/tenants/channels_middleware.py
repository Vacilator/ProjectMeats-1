from __future__ import annotations

import uuid
from typing import Any
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.tenants.models import Tenant, TenantUser


def _headers_dict(scope: dict[str, Any]) -> dict[str, str]:
    headers = {}
    for k, v in scope.get('headers') or []:
        try:
            key = k.decode('latin1').lower()
            val = v.decode('latin1')
            headers[key] = val
        except Exception:
            continue
    return headers


def _query_params(scope: dict[str, Any]) -> dict[str, str]:
    raw = (scope.get('query_string') or b'').decode('utf-8', errors='ignore')
    parsed = parse_qs(raw)
    return {k: (v[0] if v else '') for k, v in parsed.items()}


def _get_bearer_token(scope: dict[str, Any]) -> str | None:
    params = _query_params(scope)
    token = params.get('access_token') or params.get('token') or params.get('jwt')
    if token:
        return token

    headers = _headers_dict(scope)
    auth = headers.get('authorization')
    if not auth:
        return None

    lowered = auth.lower()
    if lowered.startswith('bearer '):
        return auth.split(' ', 1)[1].strip() or None

    return None


@database_sync_to_async
def _get_user_for_token(raw_token: str):
    auth = JWTAuthentication()
    try:
        validated = auth.get_validated_token(raw_token)
        user = auth.get_user(validated)
        return user
    except Exception:
        return None


@database_sync_to_async
def _resolve_tenant_for_user(user, tenant_id: str | None):
    if not tenant_id:
        return None

    try:
        tenant_uuid = uuid.UUID(str(tenant_id))
    except Exception:
        return None

    try:
        tenant = Tenant.objects.get(id=tenant_uuid, is_active=True)
    except Tenant.DoesNotExist:
        return None

    is_global_admin = user.groups.filter(name='Global System Admins').exists()
    if user.is_superuser or is_global_admin:
        return tenant

    if TenantUser.objects.filter(user=user, tenant=tenant, is_active=True).exists():
        return tenant

    return None


class JwtAuthMiddleware(BaseMiddleware):
    """Authenticate WebSocket connections using JWT when no session user exists.

    Browsers cannot set Authorization headers on WebSocket handshakes, so we also
    accept an access token in the query string: ?access_token=<jwt>.

    This middleware does NOT log token values.
    """

    async def __call__(self, scope, receive, send):
        user = scope.get('user')
        if user is None:
            scope['user'] = AnonymousUser()
        elif getattr(user, 'is_authenticated', False):
            return await super().__call__(scope, receive, send)

        token = _get_bearer_token(scope)
        if token:
            resolved = await _get_user_for_token(token)
            if resolved is not None:
                scope['user'] = resolved

        return await super().__call__(scope, receive, send)


class TenantContextMiddleware(BaseMiddleware):
    """Resolve and authorize tenant context for WebSocket connections.

    For collaboration we require explicit tenant selection via query string:
      ?tenant_id=<tenant_uuid>

    The resolved tenant is stored as scope['tenant'].
    """

    async def __call__(self, scope, receive, send):
        scope.setdefault('tenant', None)

        user = scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            return await super().__call__(scope, receive, send)

        params = _query_params(scope)
        tenant_id = params.get('tenant_id') or params.get('tenantId')

        tenant = await _resolve_tenant_for_user(user, tenant_id)
        scope['tenant'] = tenant

        return await super().__call__(scope, receive, send)

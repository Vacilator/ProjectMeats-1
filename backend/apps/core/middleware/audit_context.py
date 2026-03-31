"""Middleware to populate audit thread-local context."""

from __future__ import annotations

from django.utils.deprecation import MiddlewareMixin

from apps.system.models.audit_log import ConfigAuditLog
from apps.core.utils.audit_context import AuditRequestContext, clear_audit_context, set_audit_context


class AuditContextMiddleware(MiddlewareMixin):
    """Capture request metadata for audit trail signals.

    Must run AFTER AuthenticationMiddleware and TenantMiddleware.
    """

    def process_request(self, request):
        try:
            ip = ConfigAuditLog._get_client_ip(request)
        except Exception:
            ip = None

        ua = (request.META.get('HTTP_USER_AGENT') or '')[:500]
        set_audit_context(
            AuditRequestContext(
                tenant=getattr(request, 'tenant', None),
                user=getattr(request, 'user', None),
                ip_address=ip,
                user_agent=ua,
            )
        )

    def process_response(self, request, response):
        clear_audit_context()
        return response

    def process_exception(self, request, exception):
        clear_audit_context()
        return None

"""
Middleware for shared-schema multi-tenancy support in ProjectMeats.

Architecture: Shared Schema Multi-Tenancy with PostgreSQL RLS
==============================================================
This middleware sets the current tenant in the request context based on:
1. X-Tenant-ID header (for API requests) - HIGHEST PRIORITY
2. Full domain name match (via TenantDomain model)
3. Subdomain (if configured)
4. Authenticated user's default tenant association - FALLBACK

All tenant isolation is enforced via:
- tenant_id foreign keys on business models (application-level)
- PostgreSQL Row-Level Security (RLS) policies (database-level)

The middleware sets the PostgreSQL session variable 'app.current_tenant_id'
which is used by RLS policies to enforce tenant isolation at the database level.

Tenant Resolution Order:
-----------------------
1. **X-Tenant-ID Header**: For explicit tenant selection in API requests
   - Format: UUID string
   - Validates user has access to requested tenant
   - Returns 403 Forbidden if user lacks permission

2. **Domain Match**: For multi-tenant domain routing
   - Matches full domain against TenantDomain model entries
   - Example: tenant.example.com → TenantDomain.objects.get(domain="tenant.example.com")

3. **Subdomain**: For multi-tenant web applications
   - Extracts subdomain from request host
   - Matches against tenant.slug field
   - Example: acme.meatscentral.com → tenant with slug="acme"

4. **User's Default Tenant**: Automatic fallback for authenticated users
   - Queries TenantUser association
   - Prioritizes owner/admin roles
   - Returns first active tenant for user

If no tenant can be resolved, request.tenant is set to None.
ViewSets should handle None tenant by returning empty querysets or raising validation errors.
"""

import logging

from django.db import connection
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden, JsonResponse

from .models import Tenant, TenantDomain, TenantUser

logger = logging.getLogger(__name__)


_TENANT_MEMBERSHIP_BYPASS_PATH_PREFIXES = (
    "/api/v1/invitations/validate/",
    "/api/v1/auth/signup-with-invitation/",
    "/api/v1/integrations/oauth/callback/",
    "/api/v1/workflows/email/email/outlook/auth/callback/",
    "/api/v1/workflows/email/email/gmail/auth/callback/",
    "/api/v1/workflows/email/email/outlook/webhook/notifications/",
    "/api/v1/workflows/email/email/gmail/webhook/notifications/",
)


def _bypass_tenant_membership_enforcement(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in _TENANT_MEMBERSHIP_BYPASS_PATH_PREFIXES)


class TenantMiddleware:
    """
    Middleware to set the current tenant in the request context.

    Sets two request attributes:
    - request.tenant: The resolved Tenant instance or None
    - request.tenant_user: The TenantUser association or None

    Security:
    - Verifies user has TenantUser association when using X-Tenant-ID header
    - Superusers can access any tenant
    - Returns 403 Forbidden for unauthorized tenant access attempts
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def _reset_rls_session_vars(self) -> None:
        """Best-effort RESET of RLS session vars (defense-in-depth for pooled connections)."""
        try:
            with connection.cursor() as cursor:
                cursor.execute("RESET app.current_tenant_id")
                cursor.execute("RESET app.current_tenant")
        except Exception:
            pass

    def _forbidden(self, request: HttpRequest, message: str):
        """Return a clear forbidden response (JSON for API routes)."""
        self._reset_rls_session_vars()

        if request.path.startswith("/api/v1/"):
            # Use a stable error shape for frontend + tests.
            return JsonResponse({"error": message, "code": "TENANT_ACCESS_DENIED"}, status=403)

        return HttpResponseForbidden(message)

    def _service_unavailable(self, request: HttpRequest, message: str):
        """Return a stable service-unavailable response for tenant isolation failures."""
        self._reset_rls_session_vars()

        if request.path.startswith("/api/v1/"):
            return JsonResponse({"error": message, "code": "TENANT_ISOLATION_UNAVAILABLE"}, status=503)

        return HttpResponse(message, status=503)

    def __call__(self, request: HttpRequest):
        """Process the request and set tenant context."""
        # Skip tenant resolution for health check and readiness endpoints.
        # Still RESET session vars to prevent pooled-connection tenant leakage.
        if request.path.startswith("/api/v1/health/") or request.path.startswith("/api/v1/ready/"):
            request.tenant = None
            request.tenant_user = None
            try:
                return self.get_response(request)
            finally:
                self._reset_rls_session_vars()

        tenant = None
        resolution_method = None  # Track how tenant was resolved for logging

        # Temporary debugging for staging.meatscentral.com and uat.meatscentral.com
        host = request.get_host().split(":")[0]
        is_debug_host = host in ["staging.meatscentral.com", "uat.meatscentral.com"]
        debug_prefix = "[STAGING DEBUG]" if host == "staging.meatscentral.com" else "[UAT DEBUG]"
        if is_debug_host:
            logger.info(
                f"{debug_prefix} Request received - "
                f"host={host}, path={request.path}, "
                f"method={request.method}, "
                f"user={request.user.username if request.user.is_authenticated else 'Anonymous'}"
            )

        # 1. FIRST: Try to get tenant from X-Tenant-ID header (explicit tenant selection)
        # This takes priority even for Global System Admins so they can switch tenants.
        #
        # SECURITY: Never honor X-Tenant-ID for truly-anonymous requests.
        #
        # NOTE: DRF's APIClient.force_authenticate() does not mark request.user authenticated
        # at middleware time, but it *does* attach a private _force_auth_user on the request.
        # We treat that as authenticated for tenant resolution in tests so CI doesn't regress.
        forced_user = getattr(request, "_force_auth_user", None)
        tenant_actor = request.user if request.user.is_authenticated else forced_user

        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id and tenant_actor:
            try:
                tenant = Tenant.objects.get(id=tenant_id, is_active=True)
                resolution_method = "X-Tenant-ID header"

                # Verify user has access to this tenant
                # Superusers and Global System Admins can access any tenant
                is_global_admin = tenant_actor.groups.filter(name="Global System Admins").exists()
                if not tenant_actor.is_superuser and not is_global_admin:
                    if not TenantUser.objects.filter(user=tenant_actor, tenant=tenant, is_active=True).exists():
                        logger.warning(
                            f"Unauthorized tenant access attempt: "
                            f"user={getattr(tenant_actor, 'username', 'unknown')}, tenant_id={tenant_id}, "
                            f"path={request.path}"
                        )
                        return self._forbidden(request, "You do not have access to this tenant.")
                elif is_global_admin:
                    logger.info(
                        f"Global System Admin explicit tenant selection: "
                        f"user={tenant_actor.username}, tenant={tenant.slug}, "
                        f"path={request.path}"
                    )
            except Tenant.DoesNotExist:
                logger.warning(f"Invalid tenant ID in X-Tenant-ID header: {tenant_id}, " f"path={request.path}")
            except ValueError:
                logger.warning(f"Invalid tenant ID format in X-Tenant-ID header: {tenant_id}, " f"path={request.path}")
        elif tenant_id and not tenant_actor:
            logger.debug(
                "Ignoring X-Tenant-ID for anonymous request: tenant_id=%s path=%s",
                tenant_id,
                request.path,
            )

        # 2. SECOND: Global System Admins default to System Root if no explicit tenant
        if not tenant and hasattr(request, "user") and request.user.is_authenticated:
            if request.user.groups.filter(name="Global System Admins").exists():
                try:
                    # Assign the System Root tenant (zero-UUID) as default
                    tenant = Tenant.objects.get(id="00000000-0000-0000-0000-000000000000")
                    resolution_method = "Global System Admin (System Root default)"

                    logger.info(
                        f"Global System Admin default to System Root: "
                        f"user={request.user.username}, path={request.path}"
                    )
                except Tenant.DoesNotExist:
                    logger.error(
                        f"System Root tenant not found for Global System Admin: "
                        f"user={request.user.username}. Run Phase 1.2 migrations."
                    )
                    # Fall through to standard resolution if System Root doesn't exist

        # 3. Try to get tenant from full domain match (via TenantDomain model)
        if not tenant:
            if is_debug_host:
                logger.info(f"{debug_prefix} Attempting domain lookup for: {host}")

            try:
                domain_obj = TenantDomain.objects.select_related("tenant").get(domain=host)
                if domain_obj.tenant.is_active:
                    tenant = domain_obj.tenant
                    resolution_method = f"domain ({host})"
                    if is_debug_host:
                        logger.info(
                            f"{debug_prefix} Tenant resolved via domain - "
                            f"tenant={tenant.slug}, tenant_id={tenant.id}"
                        )
                else:
                    if is_debug_host:
                        logger.info(
                            f"{debug_prefix} Domain found but tenant is inactive - " f"tenant={domain_obj.tenant.slug}"
                        )
            except TenantDomain.DoesNotExist:
                if is_debug_host:
                    logger.info(f"{debug_prefix} No TenantDomain entry found for: {host}")
                logger.debug(f"No TenantDomain entry found for: {host}, " f"path={request.path}")

        # 3. Try to get tenant from subdomain
        if not tenant:
            host = request.get_host().split(":")[0]  # Remove port if present
            subdomain = host.split(".")[0] if "." in host else None

            if subdomain and subdomain != "www":
                if is_debug_host:
                    logger.info(f"{debug_prefix} Attempting subdomain lookup for: {subdomain}")

                try:
                    tenant = Tenant.objects.get(slug=subdomain, is_active=True)
                    resolution_method = f"subdomain ({subdomain})"
                    if is_debug_host:
                        logger.info(
                            f"{debug_prefix} Tenant resolved via subdomain - "
                            f"tenant={tenant.slug}, tenant_id={tenant.id}"
                        )
                except Tenant.DoesNotExist:
                    if is_debug_host:
                        logger.info(f"{debug_prefix} No tenant found for subdomain: {subdomain}")
                    logger.debug(f"No tenant found for subdomain: {subdomain}, " f"path={request.path}")

        # 4. Get user's default tenant if authenticated
        #
        # SECURITY (fail-closed): Only allow an implicit default when the user belongs
        # to exactly ONE active tenant. If multiple memberships exist, require explicit
        # selection via X-Tenant-ID or host routing.
        if not tenant and hasattr(request, "user") and request.user.is_authenticated:
            if is_debug_host:
                logger.info(f"{debug_prefix} Attempting default tenant lookup for user: {request.user.username}")

            memberships = list(
                TenantUser.objects.filter(user=request.user, is_active=True)
                .select_related("tenant")
                .order_by("-role")[:2]
            )

            if len(memberships) == 1:
                tenant_user = memberships[0]
                tenant = tenant_user.tenant
                resolution_method = f"user default tenant (role={tenant_user.role})"
                if is_debug_host:
                    logger.info(
                        f"{debug_prefix} Tenant resolved via user default - "
                        f"tenant={tenant.slug}, tenant_id={tenant.id}, role={tenant_user.role}"
                    )
            elif len(memberships) > 1:
                if is_debug_host:
                    logger.info(
                        f"{debug_prefix} Multiple tenant memberships detected for user {request.user.username}; "
                        "explicit selection required"
                    )
            else:
                if is_debug_host:
                    logger.info(f"{debug_prefix} No default tenant found for user: {request.user.username}")

        # SECURITY: If tenant was resolved via host routing (domain/subdomain) and the user is
        # authenticated (session-auth), require active TenantUser membership unless global admin.
        if (
            tenant
            and request.user.is_authenticated
            and resolution_method
            and (resolution_method.startswith("domain") or resolution_method.startswith("subdomain"))
            and not _bypass_tenant_membership_enforcement(request.path)
        ):
            is_global_admin = request.user.groups.filter(name="Global System Admins").exists()
            if not (request.user.is_superuser or is_global_admin):
                if not TenantUser.objects.filter(user=request.user, tenant=tenant, is_active=True).exists():
                    logger.warning(
                        "Unauthorized tenant host access attempt: user=%s tenant=%s method=%s path=%s",
                        request.user.username,
                        str(tenant.id),
                        resolution_method,
                        request.path,
                    )
                    return self._forbidden(request, "You do not have access to this tenant.")

        # Final tenant resolution result for debug hosts
        if is_debug_host:
            if tenant:
                logger.info(
                    f"{debug_prefix} Final tenant resolution SUCCESS - "
                    f"tenant={tenant.slug}, method={resolution_method}"
                )
            else:
                logger.info(
                    f"{debug_prefix} Final tenant resolution FAILED - " f"No tenant could be resolved for request"
                )

        # Log tenant resolution for debugging (at DEBUG level to avoid noise)
        if tenant:
            logger.debug(
                f"Tenant resolved: tenant={tenant.slug}, method={resolution_method}, "
                f"user={request.user.username if request.user.is_authenticated else 'Anonymous'}, "
                f"path={request.path}"
            )
        elif request.user.is_authenticated and not request.path.startswith("/admin"):
            # Log when authenticated user has no tenant (but not for admin/static paths)
            logger.debug(
                f"No tenant resolved for authenticated user: " f"user={request.user.username}, path={request.path}"
            )

        # Set tenant in request
        request.tenant = tenant
        request.tenant_user = None

        # Set PostgreSQL session variables for Row-Level Security (RLS).
        #
        # Why we set BOTH:
        # - Some RLS policies reference app.current_tenant
        # - Others reference app.current_tenant_id
        #
        # Why we use SET (not SET LOCAL): Django often runs in autocommit mode, and SET LOCAL
        # only persists for the current transaction.
        rls_set = False
        if tenant:
            from apps.tenants.rls import set_current_tenant

            result = set_current_tenant(str(tenant.id))
            rls_set = result.ok

            if result.ok:
                logger.debug(f"RLS: Set current_tenant_id/current_tenant={tenant.id} for tenant={tenant.slug}")
            else:
                logger.error(f"Failed to set RLS session variables for tenant={tenant.slug}: {result.error}")
                return self._service_unavailable(
                    request,
                    "Tenant isolation enforcement is temporarily unavailable.",
                )
        else:
            # Clear session variables if no tenant is resolved
            try:
                with connection.cursor() as cursor:
                    cursor.execute("RESET app.current_tenant_id")
                    cursor.execute("RESET app.current_tenant")
            except Exception:
                pass  # Silently fail for RESET

        # Set tenant_user if we have both tenant and an authenticated actor (session-auth or force_authenticate)
        if tenant and tenant_actor:
            try:
                request.tenant_user = TenantUser.objects.get(user=tenant_actor, tenant=tenant, is_active=True)
            except TenantUser.DoesNotExist:
                # User is superuser or accessing via header without association
                logger.debug(f"No TenantUser association found: " f"user={request.user.username}, tenant={tenant.slug}")
            except Exception as e:
                # Catch database errors (e.g., readonly database, connection issues)
                logger.error(
                    f"Database error when fetching TenantUser: "
                    f"user={request.user.username}, tenant={tenant.slug}, "
                    f"error={type(e).__name__}: {str(e)}"
                )

        try:
            response = self.get_response(request)

            if is_debug_host:
                logger.info(
                    f"{debug_prefix} Response generated - "
                    f"status_code={response.status_code if hasattr(response, 'status_code') else 'unknown'}"
                )
        except Exception as e:
            if is_debug_host:
                logger.error(
                    f"{debug_prefix} Exception during request processing - "
                    f"error_type={type(e).__name__}, error={str(e)}"
                )
            # Log session-related errors that may indicate readonly database
            if "readonly" in str(e).lower() or "read-only" in str(e).lower():
                logger.error(
                    f"Readonly database error detected: "
                    f"user={request.user.username if request.user.is_authenticated else 'Anonymous'}, "
                    f"path={request.path}, error={type(e).__name__}: {str(e)}"
                )
            raise
        finally:
            # Prevent cross-request tenant leakage on pooled DB connections.
            # This is best-effort and intentionally unconditional: if SET fails (or a request
            # never sets tenant context), we still must not carry a stale tenant into the next request.
            self._reset_rls_session_vars()

        return response

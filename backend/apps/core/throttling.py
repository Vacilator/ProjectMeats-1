"""
Custom throttling classes for ProjectMeats API.

Wave S2: Security Hardening - Rate Limiting

These throttle classes provide different rate limits for various API endpoints:
- AuthRateThrottle: Strict limits on authentication endpoints (prevents brute force)
- BurstRateThrottle: Higher limits for endpoints that need burst capability
- SensitiveEndpointThrottle: Extra strict for sensitive operations
"""

from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """
    Rate throttle for authentication endpoints (login, register, password reset).
    
    Uses a stricter limit (5/minute) to prevent brute force attacks.
    Anonymous users are identified by IP address.
    """
    scope = "auth"
    
    def get_cache_key(self, request, view):
        """
        Use IP address for both anonymous and authenticated users.
        This prevents authenticated users from bypassing auth rate limits.
        """
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class BurstRateThrottle(SimpleRateThrottle):
    """
    Rate throttle for endpoints that need higher burst capability.
    
    Used for search, autocomplete, and other endpoints that may receive
    rapid sequential requests during normal usage.
    """
    scope = "burst"
    
    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class SensitiveEndpointThrottle(SimpleRateThrottle):
    """
    Extra strict throttle for sensitive operations.
    
    Used for:
    - Password changes
    - Email changes  
    - Account deletion
    - Bulk operations
    
    Limit: 3 requests per minute per user/IP.
    """
    scope = "sensitive"
    rate = "3/minute"  # Override default - not configurable in settings
    
    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class TenantAwareThrottle(SimpleRateThrottle):
    """
    Throttle that considers tenant context for shared-resource endpoints.
    
    Prevents any single tenant from monopolizing shared resources.
    Rate limit is applied per-tenant rather than per-user.
    """
    scope = "tenant"
    rate = "500/minute"  # 500 requests per minute per tenant
    
    def get_cache_key(self, request, view):
        # Get tenant from request (set by TenantMiddleware)
        tenant = getattr(request, "tenant", None)
        if tenant:
            ident = f"tenant_{tenant.id}"
        elif request.user and request.user.is_authenticated:
            ident = f"user_{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}

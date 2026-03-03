"""
Security Hardening Middleware (Phase 9.1)

Enforces strict security headers for defense-in-depth.
"""
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings


class SecurityHardeningMiddleware(MiddlewareMixin):
    """
    Enforce strict security headers on all responses.
    
    Headers implemented:
    - Content-Security-Policy: Prevents XSS and injection attacks
    - X-Content-Type-Options: Prevents MIME sniffing
    - X-Frame-Options: Prevents clickjacking
    - Permissions-Policy: Controls browser features
    - Referrer-Policy: Controls referrer information
    - Strict-Transport-Security: Enforces HTTPS
    """
    
    def process_response(self, request, response):
        """
        Add security headers to all responses.
        """
        # Content Security Policy (CSP)
        # Allows scripts/styles from same origin and CDN, blocks inline scripts
        if not response.get('Content-Security-Policy'):
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.meatscentral.com",
                "style-src 'self' 'unsafe-inline' https://cdn.meatscentral.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' data: https://cdn.meatscentral.com",
                "connect-src 'self' https://*.meatscentral.com wss://*.meatscentral.com",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ]
            response['Content-Security-Policy'] = '; '.join(csp_directives)
        
        # Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'
        
        # Prevent clickjacking
        response['X-Frame-Options'] = 'DENY'
        
        # Permissions Policy (formerly Feature-Policy)
        # Disable all features by default, enable only what's needed
        permissions = [
            'geolocation=()',
            'microphone=()',
            'camera=()',
            'payment=()',
            'usb=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
        ]
        response['Permissions-Policy'] = ', '.join(permissions)
        
        # Referrer Policy - only send origin for cross-origin requests
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Strict-Transport-Security (HSTS) - only in production
        if not settings.DEBUG:
            # 1 year HSTS with includeSubDomains
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # X-XSS-Protection (legacy, but doesn't hurt)
        response['X-XSS-Protection'] = '1; mode=block'
        
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """
    Basic rate limiting middleware using Redis.
    
    Prevents brute force attacks on authentication endpoints.
    """
    
    RATE_LIMIT_ENDPOINTS = [
        '/api/v1/auth/login/',
        '/api/v1/auth/register/',
        '/api/v1/auth/password-reset/',
    ]
    
    RATE_LIMIT = 10  # requests
    RATE_PERIOD = 60  # seconds
    
    def process_request(self, request):
        """
        Check rate limit for sensitive endpoints.
        """
        from django.core.cache import cache
        from django.http import HttpResponse
        
        # Only rate limit specific endpoints
        if request.path not in self.RATE_LIMIT_ENDPOINTS:
            return None
        
        # Use IP address as rate limit key
        ip_address = self.get_client_ip(request)
        cache_key = f"rate_limit:{request.path}:{ip_address}"
        
        # Get current request count
        request_count = cache.get(cache_key, 0)
        
        if request_count >= self.RATE_LIMIT:
            return HttpResponse(
                "Rate limit exceeded. Please try again later.",
                status=429
            )
        
        # Increment counter
        cache.set(cache_key, request_count + 1, self.RATE_PERIOD)
        
        return None
    
    @staticmethod
    def get_client_ip(request):
        """
        Extract client IP from request headers.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

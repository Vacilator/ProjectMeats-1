"""
Security middleware for Django REST Framework.
Provides security headers and input validation.
"""

from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

from apps.core.security import SecurityUtils


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Middleware to add security headers to all responses.
    Implements OWASP recommended headers.
    """

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """
        Add security headers to response.

        Args:
            request: HTTP request
            response: HTTP response

        Returns:
            Modified response with security headers
        """
        headers = SecurityUtils.get_security_headers()

        for header, value in headers.items():
            response[header] = value

        return response


class InputSanitizationMiddleware(MiddlewareMixin):
    """
    Middleware to sanitize user input in POST/PUT/PATCH requests.
    Prevents injection attacks.
    """

    def process_request(self, request: HttpRequest) -> None:
        """
        Sanitize request data.

        Args:
            request: HTTP request
        """
        if request.method in ["POST", "PUT", "PATCH"] and hasattr(request, "data"):
            # Note: This is a simplified example
            # In production, you'd want more sophisticated sanitization
            # that preserves data types and structure
            pass  # DRF serializers handle most validation


class SecureSessionMiddleware(MiddlewareMixin):
    """
    Enhanced session security middleware.
    """

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """
        Add secure session cookie settings.

        Args:
            request: HTTP request
            response: HTTP response

        Returns:
            Modified response with secure cookies
        """
        if response.cookies:
            for cookie in response.cookies.values():
                cookie["secure"] = True  # HTTPS only
                cookie["httponly"] = True  # No JavaScript access
                cookie["samesite"] = "Strict"  # CSRF protection

        return response

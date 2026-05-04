"""Custom exception handler for ProjectMeats API.

Provides centralized error handling and logging for Django REST Framework.

Sentry hardening: ensure 5xx errors are captured even when we return a
friendly Response body.
"""

import logging

from django.core.exceptions import (
    RequestDataTooBig,
    SuspiciousOperation,
    ValidationError as DjangoValidationError,
)
from django.db import DatabaseError
from django.http import Http404
from django.http.multipartparser import MultiPartParserError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

try:
    import sentry_sdk
except Exception:  # pragma: no cover
    sentry_sdk = None


def _capture_exception(exc, context, response_status: int | None = None) -> None:
    if not sentry_sdk:
        return

    request = context.get("request")
    view = context.get("view")

    with sentry_sdk.push_scope() as scope:
        if response_status is not None:
            scope.set_tag("http.status_code", response_status)

        if request is not None:
            scope.set_tag("http.method", getattr(request, "method", "unknown"))
            scope.set_tag("http.path", getattr(request, "path", "unknown"))

            try:
                if hasattr(request, "tenant") and request.tenant:
                    scope.set_tag("tenant.id", str(request.tenant.id))
                    scope.set_tag("tenant.slug", getattr(request.tenant, "slug", "unknown"))
            except Exception:
                pass

            try:
                user = getattr(request, "user", None)
                if user and getattr(user, "is_authenticated", False):
                    scope.set_user({"id": str(user.id)})
            except Exception:
                pass

        if view is not None:
            scope.set_tag("drf.view", view.__class__.__name__)

        sentry_sdk.capture_exception(exc)


def exception_handler(exc, context):
    """
    Custom exception handler for DRF that logs errors and provides consistent responses.
    
    Args:
        exc: The exception being handled
        context: Context dictionary containing view, request, args, kwargs
    
    Returns:
        Response object with error details
    """
    # Call DRF's default exception handler first to get the standard error response
    response = drf_exception_handler(exc, context)

    # If DRF handled it, add extra logging and return
    if response is not None:
        # Log the error with context
        view = context.get('view', None)
        request = context.get('request', None)

        logger.error(
            f'API Error: {exc.__class__.__name__} - {str(exc)}',
            extra={
                'status_code': response.status_code,
                'view': view.__class__.__name__ if view else 'Unknown',
                'method': request.method if request else 'Unknown',
                'path': request.path if request else 'Unknown',
                'user': request.user.username if request and hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous',
            },
            exc_info=True
        )

        if response.status_code >= 500:
            _capture_exception(exc, context, response_status=response.status_code)

        return response

    # Handle request payloads that exceed server limits (commonly seen as 500s on multipart uploads)
    # RequestDataTooBig subclasses SuspiciousOperation, so it must be checked first.
    if isinstance(exc, RequestDataTooBig):
        logger.warning(
            f'Request payload too large: {str(exc)}',
            extra={
                'path': context.get('request').path if context.get('request') else 'Unknown',
            },
            exc_info=True,
        )
        return Response(
            {
                'error': 'Payload Too Large',
                'code': 'PAYLOAD_TOO_LARGE',
                'details': 'The uploaded file is too large for the server to accept. Please upload a smaller file.',
            },
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    # Handle malformed multipart uploads cleanly (avoid generic 500)
    if isinstance(exc, MultiPartParserError):
        logger.warning(
            f'Multipart parse error: {str(exc)}',
            extra={
                'path': context.get('request').path if context.get('request') else 'Unknown',
            },
            exc_info=True,
        )
        return Response(
            {
                'error': 'Bad Request',
                'code': 'MULTIPART_PARSE_ERROR',
                'details': 'Upload failed: malformed multipart request. Please retry.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Handle suspicious operations (e.g., invalid multipart boundaries, tampered payloads)
    if isinstance(exc, SuspiciousOperation):
        logger.warning(
            f'Suspicious operation: {exc.__class__.__name__} - {str(exc)}',
            extra={
                'path': context.get('request').path if context.get('request') else 'Unknown',
            },
            exc_info=True,
        )
        return Response(
            {
                'error': 'Bad Request',
                'code': 'SUSPICIOUS_OPERATION',
                'details': 'Request rejected. Please retry.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Handle Django validation errors
    if isinstance(exc, DjangoValidationError):
        logger.error(
            f'Django Validation Error: {str(exc)}',
            extra={
                'view': context.get('view').__class__.__name__ if context.get('view') else 'Unknown',
            },
            exc_info=True
        )
        return Response(
            {
                'error': 'Validation Error',
                'details': exc.messages if hasattr(exc, 'messages') else str(exc)
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Handle 404 errors
    if isinstance(exc, Http404):
        logger.warning(
            f'404 Not Found: {str(exc)}',
            extra={
                'path': context.get('request').path if context.get('request') else 'Unknown',
            }
        )
        return Response(
            {'error': 'Not Found', 'details': str(exc)},
            status=status.HTTP_404_NOT_FOUND
        )

    # Handle database errors
    if isinstance(exc, DatabaseError):
        logger.critical(
            f'Database Error: {str(exc)}',
            extra={
                'view': context.get('view').__class__.__name__ if context.get('view') else 'Unknown',
            },
            exc_info=True
        )

        _capture_exception(exc, context, response_status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'error': 'Database Error',
                'details': 'A database error occurred. Please try again later.'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Handle any other unhandled exceptions
    logger.error(
        f'Unhandled Exception: {exc.__class__.__name__} - {str(exc)}',
        extra={
            'view': context.get('view').__class__.__name__ if context.get('view') else 'Unknown',
            'request_method': context.get('request').method if context.get('request') else 'Unknown',
            'request_path': context.get('request').path if context.get('request') else 'Unknown',
        },
        exc_info=True
    )

    _capture_exception(exc, context, response_status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(
        {
            'error': 'Internal Server Error',
            'details': 'An unexpected error occurred. Please try again later.'
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )

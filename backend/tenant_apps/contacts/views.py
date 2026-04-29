"""
Contacts views for ProjectMeats.

Provides REST API endpoints for contact management.
"""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import IsRoleAuthorized
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.core.exceptions import ValidationError
from tenant_apps.contacts.models import Contact
from tenant_apps.contacts.serializers import ContactSerializer
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class ContactViewSet(viewsets.ModelViewSet):
    """ViewSet for managing contacts."""

    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated, IsRoleAuthorized]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["supplier", "customer", "plant", "location", "status"]
    search_fields = ["first_name", "last_name", "email", "company", "position"]
    ordering_fields = ["last_name", "first_name", "created_at", "updated_at"]
    ordering = ["last_name", "first_name"]

    def get_queryset(self):
        """Filter contacts by current tenant."""
        if hasattr(self.request, 'tenant') and self.request.tenant:
            return Contact.objects.for_tenant(self.request.tenant)
        return Contact.objects.none()

    def perform_create(self, serializer):
        """Set the tenant when creating a new contact.

        Tenant context must already be resolved by middleware/auth. We do not
        silently choose a membership when the request is ambiguous.
        """

        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            logger.error(
                'Contact creation attempted without tenant context',
                extra={
                    'user': self.request.user.username if self.request.user and self.request.user.is_authenticated else 'Anonymous',
                    'has_request_tenant': hasattr(self.request, 'tenant'),
                    'timestamp': timezone.now().isoformat()
                }
            )
            raise DRFValidationError('Tenant context is required to create a contact.')

        serializer.save(tenant=tenant)

    def create(self, request, *args, **kwargs):
        """Create a new contact with enhanced error handling."""
        try:
            return super().create(request, *args, **kwargs)
        except DRFValidationError as e:
            logger.error(
                f'Validation error creating contact: {str(e.detail)}',
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            # Re-raise DRF validation errors to return 400
            raise
        except ValidationError as e:
            logger.error(
                f'Validation error creating contact: {str(e)}',
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            return Response(
                {'error': 'Validation failed', 'details': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(
                f'Error creating contact: {str(e)}',
                exc_info=True,
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            return Response(
                {'error': 'Failed to create contact', 'details': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

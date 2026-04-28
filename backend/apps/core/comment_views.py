from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter

from apps.core.comments import normalize_entity_type
from apps.core.models import Comment
from apps.core.serializers_comments import CommentSerializer
from apps.tenants.models import TenantUser


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        'entity_type': ['exact'],
        'created_by': ['exact'],
    }
    search_fields = ['body', 'created_by__username', 'created_by__first_name', 'created_by__last_name']
    ordering_fields = ['created_on', 'modified_on']
    ordering = ['-created_on']

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        user = getattr(self.request, 'user', None)
        if not tenant or not user or not user.is_authenticated:
            return Comment.objects.none()

        queryset = Comment.objects.filter(tenant=tenant).select_related('tenant', 'created_by', 'content_type')

        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            try:
                queryset = queryset.filter(entity_type=normalize_entity_type(entity_type))
            except ValueError:
                return Comment.objects.none()

        entity_id = self.request.query_params.get('entity_id')
        if entity_id not in (None, ''):
            queryset = queryset.filter(object_id=str(entity_id))

        return queryset

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise ValidationError({'tenant': 'Tenant context required'})
        serializer.save()

    def perform_update(self, serializer):
        self._assert_can_mutate(self.get_object())
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._assert_can_mutate(self.get_object())
        return super().destroy(request, *args, **kwargs)

    def _assert_can_mutate(self, comment: Comment):
        user = self.request.user
        if comment.created_by_id == user.id or user.is_superuser:
            return

        tenant = getattr(self.request, 'tenant', None)
        is_admin = bool(
            tenant
            and TenantUser.objects.filter(
                tenant=tenant,
                user=user,
                role__in=['owner', 'admin'],
                is_active=True,
            ).exists()
        )
        if not is_admin:
            raise PermissionDenied('You do not have permission to modify this comment.')

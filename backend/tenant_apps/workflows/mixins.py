"""
Query Optimization Mixins for Workflow ViewSets

Provides caching and query optimization utilities to improve performance
when fetching workflows and forms with complex related data.

Phase 6.5 - Performance Hardening
Authority: .github/copilot-instructions.md (Phase 6 & 7)
"""
from django.core.cache import cache
from django.db.models import Prefetch, Count
from rest_framework.response import Response
import hashlib


class QueryOptimizationMixin:
    """
    Mixin to optimize queryset performance with select_related and prefetch_related.
    
    Automatically optimizes ForeignKey and ManyToMany relationships to reduce
    database queries (N+1 problem).
    """
    
    # Define ForeignKey fields to optimize with select_related
    select_related_fields = []
    
    # Define ManyToMany/reverse ForeignKey fields to optimize with prefetch_related
    prefetch_related_fields = []
    
    def get_optimized_queryset(self, queryset=None):
        """
        Apply query optimizations to reduce database hits.
        
        Args:
            queryset: Optional base queryset (uses self.get_queryset() if None)
            
        Returns:
            Optimized queryset with select_related and prefetch_related applied
        """
        if queryset is None:
            queryset = self.get_queryset()
        
        # Apply select_related for ForeignKey fields
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        
        # Apply prefetch_related for ManyToMany/reverse FK fields
        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
        
        return queryset


class CachingMixin:
    """
    Mixin to add response caching to ViewSet endpoints.
    
    Caches serialized data for GET requests to reduce database load and
    improve response times. Cache is invalidated on create/update/delete.
    
    Usage:
        class MyViewSet(CachingMixin, viewsets.ModelViewSet):
            cache_timeout = 300  # 5 minutes
            cache_key_prefix = 'mymodel'
    """
    
    # Cache configuration
    cache_timeout = 300  # Default: 5 minutes
    cache_key_prefix = 'viewset'
    cache_enabled = True
    
    def _get_cache_key(self, request, view_name='list', obj_id=None):
        """
        Generate a unique cache key for the request.
        
        Args:
            request: Django request object
            view_name: Name of the view (list, retrieve, etc.)
            obj_id: Optional object ID for detail views
            
        Returns:
            Cache key string
        """
        # Include tenant ID for multi-tenancy
        tenant_id = getattr(request, 'tenant', None)
        tenant_part = f'_{tenant_id.id}' if tenant_id else ''
        
        # Include query params for list views
        if view_name == 'list':
            query_string = request.META.get('QUERY_STRING', '')
            query_hash = hashlib.md5(query_string.encode()).hexdigest()[:8]
            return f'{self.cache_key_prefix}{tenant_part}_list_{query_hash}'
        
        # Include object ID for detail views
        if obj_id:
            return f'{self.cache_key_prefix}{tenant_part}_{view_name}_{obj_id}'
        
        return f'{self.cache_key_prefix}{tenant_part}_{view_name}'
    
    def _should_use_cache(self, request):
        """
        Determine if caching should be used for this request.
        
        Args:
            request: Django request object
            
        Returns:
            Boolean indicating if cache should be used
        """
        # Only cache GET requests
        if request.method != 'GET':
            return False
        
        # Check if caching is enabled
        if not self.cache_enabled:
            return False
        
        # Don't cache if user explicitly requests fresh data
        if request.query_params.get('no_cache') == 'true':
            return False
        
        return True
    
    def list(self, request, *args, **kwargs):
        """Override list to add caching."""
        if not self._should_use_cache(request):
            return super().list(request, *args, **kwargs)
        
        cache_key = self._get_cache_key(request, 'list')
        cached_response = cache.get(cache_key)
        
        if cached_response is not None:
            return Response(cached_response)
        
        # Get fresh data
        response = super().list(request, *args, **kwargs)
        
        # Cache the response data
        if response.status_code == 200:
            cache.set(cache_key, response.data, self.cache_timeout)
        
        return response
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to add caching."""
        if not self._should_use_cache(request):
            return super().retrieve(request, *args, **kwargs)
        
        obj_id = kwargs.get('pk')
        cache_key = self._get_cache_key(request, 'retrieve', obj_id)
        cached_response = cache.get(cache_key)
        
        if cached_response is not None:
            return Response(cached_response)
        
        # Get fresh data
        response = super().retrieve(request, *args, **kwargs)
        
        # Cache the response data
        if response.status_code == 200:
            cache.set(cache_key, response.data, self.cache_timeout)
        
        return response
    
    def _invalidate_cache(self, request, obj_id=None):
        """
        Invalidate cache entries for this resource.
        
        Called after create/update/delete operations.
        
        Args:
            request: Django request object
            obj_id: Optional object ID
        """
        tenant_id = getattr(request, 'tenant', None)
        tenant_part = f'_{tenant_id.id}' if tenant_id else ''
        
        # Invalidate list cache (delete with pattern if available, otherwise just clear main key)
        try:
            # Try Redis-specific pattern delete first
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern(f'{self.cache_key_prefix}{tenant_part}_list_*')
            else:
                # Fallback: delete a few common variations
                for i in range(10):
                    cache.delete(f'{self.cache_key_prefix}{tenant_part}_list_{i}')
        except Exception:
            # If pattern delete not supported, ignore
            pass
        
        # Invalidate specific object cache if ID provided
        if obj_id:
            cache.delete(f'{self.cache_key_prefix}{tenant_part}_retrieve_{obj_id}')
    
    def perform_create(self, serializer):
        """Override to invalidate cache after create."""
        instance = super().perform_create(serializer)
        self._invalidate_cache(self.request)
        return instance
    
    def perform_update(self, serializer):
        """Override to invalidate cache after update."""
        instance = super().perform_update(serializer)
        self._invalidate_cache(self.request, obj_id=instance.pk)
        return instance
    
    def perform_destroy(self, instance):
        """Override to invalidate cache after delete."""
        obj_id = instance.pk
        super().perform_destroy(instance)
        self._invalidate_cache(self.request, obj_id=obj_id)


class WorkflowQueryOptimizationMixin(QueryOptimizationMixin):
    """
    Specialized query optimization for Workflow-related models.
    
    Pre-configured with common workflow relationships to reduce N+1 queries.
    """
    
    def get_workflow_optimized_queryset(self, queryset=None):
        """
        Optimize workflow queries with all related data.
        
        This method should be called in get_queryset() of WorkflowViewSet.
        
        Args:
            queryset: Base queryset
            
        Returns:
            Optimized queryset
        """
        if queryset is None:
            queryset = self.get_queryset()
        
        # Optimize with select_related for ForeignKeys
        queryset = queryset.select_related('tenant')
        
        # Prefetch all related collections
        from .models import TenantWorkflowCondition, TenantWorkflowAction
        
        queryset = queryset.prefetch_related(
            Prefetch(
                'conditions',
                queryset=TenantWorkflowCondition.objects.order_by('order')
            ),
            Prefetch(
                'actions',
                queryset=TenantWorkflowAction.objects.order_by('order')
            ),
        )
        
        return queryset


class FormQueryOptimizationMixin(QueryOptimizationMixin):
    """
    Specialized query optimization for Form-related models.
    
    Pre-configured with common form relationships to reduce N+1 queries.
    """
    
    def get_form_optimized_queryset(self, queryset=None):
        """
        Optimize form queries with all related data.
        
        This method should be called in get_queryset() of FormViewSet.
        
        Args:
            queryset: Base queryset
            
        Returns:
            Optimized queryset
        """
        if queryset is None:
            queryset = self.get_queryset()
        
        # Optimize with select_related for ForeignKeys
        queryset = queryset.select_related('tenant')
        
        # Prefetch nested relationships (form → entities → fields)
        from .models import TenantFormEntity, TenantFormField, TenantFormRule
        
        queryset = queryset.prefetch_related(
            Prefetch(
                'entities',
                queryset=TenantFormEntity.objects.order_by('order').prefetch_related(
                    Prefetch(
                        'fields',
                        queryset=TenantFormField.objects.order_by('order')
                    )
                )
            ),
            Prefetch(
                'rules',
                queryset=TenantFormRule.objects.order_by('order')
            ),
        ).annotate(_entity_count=Count('entities'))
        
        return queryset


# Convenience exports
__all__ = [
    'QueryOptimizationMixin',
    'CachingMixin',
    'WorkflowQueryOptimizationMixin',
    'FormQueryOptimizationMixin',
]

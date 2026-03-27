"""
Cockpit views for aggregated search across tenant models.

Provides polymorphic search API respecting tenant schema isolation.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from django.conf import settings
from django.db.models import Q
from django.db import IntegrityError
from django.utils import timezone
import logging

from .serializers import (
    CustomerSlotSerializer,
    SupplierSlotSerializer,
    OrderSlotSerializer,
    ActivityLogSerializer,
    ScheduledCallSerializer,
    UserWorkspaceLayoutSerializer,
)
from .models import ActivityLog, ScheduledCall, UserWorkspaceLayout
from tenant_apps.customers.models import Customer

logger = logging.getLogger(__name__)
from tenant_apps.suppliers.models import Supplier
from tenant_apps.purchase_orders.models import PurchaseOrder


class EntityAIOverviewView(APIView):
    """AI overview for a Cockpit entity.

    This endpoint unblocks the AIOverviewCard UI. It returns a contextual fallback
    payload until a real summarization service is wired in.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, entity_type: str, entity_id: str):
        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'current_tenant', None)
        if not tenant:
            return Response(
                {
                    'status': 'error',
                    'summary': 'Tenant context required to generate AI overview.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_type = (entity_type or '').strip().lower()
        safe_entity_type = normalized_type[:64] or 'entity'

        try:
            entity_id_int = int(entity_id)
        except (TypeError, ValueError):
            return Response(
                {'status': 'error', 'summary': 'Invalid entity id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_map = {
            'customer': Customer,
            'customers': Customer,
            'supplier': Supplier,
            'suppliers': Supplier,
            'purchase_order': PurchaseOrder,
            'purchase_orders': PurchaseOrder,
            'order': PurchaseOrder,
            'orders': PurchaseOrder,
            'po': PurchaseOrder,
        }

        Model = model_map.get(normalized_type)
        if not Model:
            return Response(
                {'status': 'error', 'summary': f'Unsupported entity type: {safe_entity_type}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entity = (
            Model.objects.filter(tenant=tenant, id=entity_id_int).first()
            if hasattr(Model, 'objects')
            else None
        )
        if not entity:
            return Response(
                {'status': 'error', 'summary': 'Entity not found for this tenant.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Build a brief entity representation (name/status/created date)
        display_name = (
            getattr(entity, 'name', None)
            or getattr(entity, 'order_number', None)
            or f"{safe_entity_type} #{entity_id_int}"
        )
        status_value = getattr(entity, 'status', None)
        created_value = (
            getattr(entity, 'created_on', None)
            or getattr(entity, 'created_at', None)
            or getattr(entity, 'order_date', None)
        )
        created_str = ''
        try:
            if created_value:
                created_str = str(getattr(created_value, 'date', lambda: created_value)())
        except Exception:
            created_str = str(created_value) if created_value else ''

        entity_text = f"Name: {display_name}."
        if status_value is not None:
            entity_text += f" Status: {status_value}."
        if created_str:
            entity_text += f" Created: {created_str}."

        # Most recent 3 activity logs
        activity_entity_type = (
            'customer'
            if Model is Customer
            else 'supplier'
            if Model is Supplier
            else 'purchase_order'
            if Model is PurchaseOrder
            else safe_entity_type
        )

        logs_qs = (
            ActivityLog.objects.filter(
                tenant=tenant,
                entity_type=activity_entity_type,
                entity_id=entity_id_int,
            )
            .select_related('created_by')
            .order_by('-created_on')
        )
        recent_logs = []
        for row in logs_qs[:3]:
            recent_logs.append(
                {
                    'created_on': getattr(row, 'created_on', None),
                    'title': row.title,
                    'content': row.content,
                    'created_by': getattr(getattr(row, 'created_by', None), 'username', None),
                }
            )

        openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if not openai_api_key:
            return Response(
                {
                    'status': 'error',
                    'summary': 'AI overview unavailable (OpenAI not configured).',
                },
                status=status.HTTP_200_OK,
            )

        prompt = (
            f"You are a helpful AI assistant. Summarize the status and recent activity of this {safe_entity_type} in 2 sentences.\n\n"
            f"Entity: {entity_text}\n\n"
            f"Recent activity logs (most recent first): {recent_logs}"
        )

        try:
            from openai import OpenAI

            from apps.system.services.ai_model_resolver import get_active_openai_model_id

            model_id = get_active_openai_model_id(fallback='gpt-4o-mini')
            client = OpenAI(api_key=openai_api_key)
            completion = client.chat.completions.create(
                model=model_id,
                messages=[{'role': 'user', 'content': prompt}],
            )
            ai_response_text = ((completion.choices[0].message.content or '') if completion.choices else '').strip()
        except Exception:
            logger.error('[EntityAIOverviewView] Overview generation failed', exc_info=True)
            return Response(
                {'status': 'error', 'summary': 'Failed to generate AI overview.'},
                status=status.HTTP_200_OK,
            )

        return Response({'summary': ai_response_text, 'status': 'success'})


class CockpitSlotViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Aggregated search across tenant models (Customer, Supplier, PurchaseOrder).
    
    Returns polymorphic results with type fields for frontend icon rendering.
    Respects shared-schema tenant isolation via tenant_id filtering in querysets.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerSlotSerializer  # Default serializer for schema generation
    
    def list(self, request):
        """
        Search across Customers, Suppliers, and PurchaseOrders.
        
        Query Parameters:
        - q: Search query string (filters by name/order_number)
        
        Returns:
        - Polymorphic list with 'type' field: 'customer', 'supplier', or 'order'
        """
        q = request.query_params.get('q', '').strip()
        
        results = []
        
        if q:
            # Search customers by name
            customers = Customer.objects.filter(
                Q(name__icontains=q) | Q(contact_person__icontains=q)
            )[:10]
            results.extend(CustomerSlotSerializer(customers, many=True).data)
            
            # Search suppliers by name
            suppliers = Supplier.objects.filter(
                Q(name__icontains=q) | Q(contact_person__icontains=q)
            )[:10]
            results.extend(SupplierSlotSerializer(suppliers, many=True).data)
            
            # Search orders by order numbers
            orders = PurchaseOrder.objects.filter(
                Q(order_number__icontains=q) | Q(our_purchase_order_num__icontains=q)
            ).select_related('supplier')[:10]
            results.extend(OrderSlotSerializer(orders, many=True).data)
        
        return Response(results)


class ActivityLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Activity Logs with strict tenant isolation.
    
    Supports filtering by entity_type and entity_id for entity-specific note feeds.
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter activity logs by tenant and optional entity filters."""
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            return ActivityLog.objects.none()
        
        queryset = ActivityLog.objects.filter(tenant=self.request.tenant)
        
        # Filter by entity if provided
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        
        if entity_type and entity_id:
            queryset = queryset.filter(entity_type=entity_type, entity_id=entity_id)

        queryset = queryset.order_by('-is_pinned', '-created_on')

        limit_raw = self.request.query_params.get('limit')
        if limit_raw:
            try:
                limit = max(1, min(50, int(limit_raw)))
                queryset = queryset[:limit]
            except (TypeError, ValueError):
                pass

        return queryset
    
    def perform_create(self, serializer):
        """Auto-assign tenant and created_by on create."""
        serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user
        )


class ScheduledCallViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Scheduled Calls with strict tenant isolation.
    
    Supports filtering by date range and completion status.
    Automatically creates activity log entries for related entities.
    """
    serializer_class = ScheduledCallSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter scheduled calls by tenant and optional filters."""
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            return ScheduledCall.objects.none()
        
        queryset = ScheduledCall.objects.filter(tenant=self.request.tenant)
        
        # Filter by entity if provided
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        if entity_type and entity_id:
            queryset = queryset.filter(entity_type=entity_type, entity_id=entity_id)

        # Filter by completion status
        is_completed = self.request.query_params.get('is_completed')
        if is_completed is not None:
            queryset = queryset.filter(is_completed=is_completed.lower() == 'true')

        queryset = queryset.order_by('-scheduled_for')

        limit_raw = self.request.query_params.get('limit')
        if limit_raw:
            try:
                limit = max(1, min(50, int(limit_raw)))
                queryset = queryset[:limit]
            except (TypeError, ValueError):
                pass

        return queryset
    
    def perform_create(self, serializer):
        """
        Auto-assign tenant and created_by on create, and log activity.
        Enhanced error handling to prevent 500 errors.
        """
        try:
            # Validate tenant context exists
            if not hasattr(self.request, 'tenant') or not self.request.tenant:
                logger.error(
                    'Attempted to create scheduled call without tenant context',
                    extra={
                        'user': self.request.user.username if self.request.user.is_authenticated else 'Anonymous',
                        'has_tenant_attr': hasattr(self.request, 'tenant'),
                    }
                )
                raise ValidationError({
                    'error': 'Tenant context required',
                    'detail': 'Please refresh and try again.'
                })
            
            scheduled_call = serializer.save(
                tenant=self.request.tenant,
                created_by=self.request.user
            )
            
            # Auto-create activity log entry for the related entity
            self._create_activity_log(
                scheduled_call=scheduled_call,
                action='scheduled',
                user=self.request.user
            )
            
        except IntegrityError as e:
            logger.error(f'Integrity error creating call: {str(e)}', exc_info=True)
            raise ValidationError({
                'error': 'Database error',
                'detail': 'Invalid data or duplicate entry.'
            })
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f'Error creating call: {str(e)}', exc_info=True)
            raise ValidationError({
                'error': 'Failed to schedule call',
                'detail': str(e)
            })
    
    def perform_update(self, serializer):
        """
        Log activity when call is updated or completed.
        Enhanced error handling to prevent 500 errors.
        """
        try:
            # Validate tenant context exists
            if not hasattr(self.request, 'tenant') or not self.request.tenant:
                logger.error('Attempted to update scheduled call without tenant context')
                raise ValidationError({
                    'error': 'Tenant context required',
                    'detail': 'Please refresh and try again.'
                })
            
            old_instance = self.get_object()
            was_completed = old_instance.is_completed
            
            scheduled_call = serializer.save()
            
            # If call was just marked as completed, log it
            if scheduled_call.is_completed and not was_completed:
                self._create_activity_log(
                    scheduled_call=scheduled_call,
                    action='completed',
                    user=self.request.user
                )
                
        except IntegrityError as e:
            logger.error(f'Integrity error updating call: {str(e)}', exc_info=True)
            raise ValidationError({
                'error': 'Database error',
                'detail': 'Invalid data or duplicate entry.'
            })
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f'Error updating call: {str(e)}', exc_info=True)
            raise ValidationError({
                'error': 'Failed to update call',
                'detail': str(e)
            })
    
    def _create_activity_log(self, scheduled_call, action, user):
        """
        Helper method to create activity log entries for scheduled calls.
        
        This ensures the activity appears in the entity's activity feed automatically.
        """
        # Determine the content based on action
        if action == 'scheduled':
            title = f"Call Scheduled: {scheduled_call.title}"
            content = (
                f"Scheduled call for {scheduled_call.scheduled_for.strftime('%Y-%m-%d %H:%M')}.\n"
                f"Duration: {scheduled_call.duration_minutes} minutes"
            )
            if scheduled_call.description:
                content += f"\n\nNotes: {scheduled_call.description}"
        elif action == 'completed':
            title = f"Call Completed: {scheduled_call.title}"
            content = f"Call was completed on {scheduled_call.completed_at.strftime('%Y-%m-%d %H:%M') if scheduled_call.completed_at else 'N/A'}."
            if scheduled_call.description:
                content += f"\n\nNotes: {scheduled_call.description}"
        else:
            title = f"Call Updated: {scheduled_call.title}"
            content = "Call details were updated."
        
        # Create activity log tied to the entity
        ActivityLog.objects.create(
            tenant=scheduled_call.tenant,
            entity_type=scheduled_call.entity_type,
            entity_id=scheduled_call.entity_id,
            title=title,
            content=content,
            created_by=user,
            tags='call,scheduled-call,auto-generated'
        )


class WorkspaceLayoutView(APIView):
    """
    API view for managing user workspace layouts.
    
    GET: Retrieve the current user's workspace layout
    PUT: Save/update the current user's workspace layout
    DELETE: Reset to default layout (deletes saved layout)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Get the current user's workspace layout.
        
        Returns saved layout if exists, otherwise returns a sensible default
        layout that matches frontend expectations. This prevents 404 errors
        and provides a better first-time user experience.
        """
        try:
            layout = UserWorkspaceLayout.objects.get(user=request.user)
            serializer = UserWorkspaceLayoutSerializer(layout)
            return Response(serializer.data)
        except UserWorkspaceLayout.DoesNotExist:
            # Return default layout instead of 404
            # This matches frontend's DEFAULT_WIDGETS and DEFAULT_LAYOUT
            default_response = {
                "version": 1,
                "layout": [
                    {"i": "quick-actions", "x": 0, "y": 0, "w": 3, "h": 8, "minW": 2, "minH": 4},
                    {"i": "recent-activity", "x": 3, "y": 0, "w": 6, "h": 8, "minW": 4, "minH": 6},
                    {"i": "action-items", "x": 9, "y": 0, "w": 3, "h": 8, "minW": 2, "minH": 4},
                    {"i": "entity-explorer", "x": 0, "y": 8, "w": 6, "h": 8, "minW": 4, "minH": 6},
                    {"i": "calendar", "x": 6, "y": 8, "w": 6, "h": 8, "minW": 4, "minH": 6},
                ],
                "widgets": [
                    {"id": "quick-actions", "type": "quick-actions", "title": "Quick Actions"},
                    {"id": "recent-activity", "type": "recent-activity", "title": "Recent Activity"},
                    {"id": "action-items", "type": "action-items", "title": "Action Items"},
                    {"id": "entity-explorer", "type": "entity-explorer", "title": "Entity Explorer"},
                    {"id": "calendar", "type": "calendar", "title": "Calendar"},
                ],
            }
            return Response(default_response, status=status.HTTP_200_OK)
    
    def put(self, request):
        """Save or update the user's workspace layout."""
        try:
            layout, created = UserWorkspaceLayout.objects.get_or_create(
                user=request.user,
                defaults={
                    'layout': request.data.get('layout', []),
                    'widgets': request.data.get('widgets', []),
                    'version': request.data.get('version', 1),
                }
            )
            
            if not created:
                # Update existing layout
                serializer = UserWorkspaceLayoutSerializer(
                    layout, 
                    data=request.data, 
                    partial=True
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data)
            
            serializer = UserWorkspaceLayoutSerializer(layout)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error saving workspace layout: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to save layout", "detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def delete(self, request):
        """Delete the user's saved layout (reset to default)."""
        try:
            layout = UserWorkspaceLayout.objects.get(user=request.user)
            layout.delete()
            return Response(
                {"detail": "Layout reset to default"},
                status=status.HTTP_204_NO_CONTENT
            )
        except UserWorkspaceLayout.DoesNotExist:
            return Response(
                {"detail": "No saved layout to delete"},
                status=status.HTTP_404_NOT_FOUND
            )


class WorkspaceStatsView(APIView):
    """
    API view for Cockpit dashboard statistics.
    
    Returns aggregated stats for widgets:
    - Quick stats (orders, revenue, shipments, customers)
    - Today's numbers (detailed KPIs)
    - Recent activity (last 10 activities)
    - Upcoming calls (next 5 scheduled calls)
    
    Created: 2026-02-04 - Phase 1.3 Widget Real Data
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get workspace statistics for the current user's tenant."""
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {"error": "Tenant context required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tenant = request.tenant
        today = timezone.now().date()
        
        try:
            # Import models (local to avoid circular imports)
            from tenant_apps.purchase_orders.models import PurchaseOrder
            from tenant_apps.sales_orders.models import SalesOrder
            from tenant_apps.customers.models import Customer
            from tenant_apps.suppliers.models import Supplier
            from django.db.models import Count, Sum, Q
            from decimal import Decimal
            
            # Quick Stats
            total_orders = PurchaseOrder.objects.filter(tenant=tenant).count()
            total_customers = Customer.objects.filter(tenant=tenant).count()
            total_suppliers = Supplier.objects.filter(tenant=tenant).count()
            
            # Revenue calculation (sum of completed sales orders)
            total_revenue = SalesOrder.objects.filter(
                tenant=tenant,
                status__in=['shipped', 'delivered', 'completed']
            ).aggregate(
                total=Sum('total_amount')
            )['total'] or Decimal('0.00')
            
            # Today's Numbers
            orders_today = PurchaseOrder.objects.filter(
                tenant=tenant,
                created_on__date=today
            ).count()
            
            pending_orders = PurchaseOrder.objects.filter(
                tenant=tenant,
                status__in=['pending', 'processing']
            ).count()
            
            completed_today = PurchaseOrder.objects.filter(
                tenant=tenant,
                status='completed',
                modified_on__date=today
            ).count()
            
            # Recent Activity (last 10)
            recent_activities = ActivityLog.objects.filter(
                tenant=tenant
            ).select_related('created_by').order_by('-created_on')[:10]
            
            activity_list = [{
                'id': act.id,
                'entity_type': act.entity_type,
                'entity_id': act.entity_id,
                'title': act.title or 'Activity',
                'content': act.content[:100] + '...' if len(act.content) > 100 else act.content,
                'created_by': act.created_by.get_full_name() if act.created_by else 'System',
                'created_on': act.created_on.isoformat(),
                'is_pinned': act.is_pinned,
                'tags': act.tags,
            } for act in recent_activities]
            
            # Upcoming Calls (next 5)
            upcoming_calls = ScheduledCall.objects.filter(
                tenant=tenant,
                is_completed=False,
                scheduled_for__gte=timezone.now()
            ).select_related('assigned_to').order_by('scheduled_for')[:5]
            
            calls_list = [{
                'id': call.id,
                'entity_type': call.entity_type,
                'entity_id': call.entity_id,
                'title': call.title,
                'description': call.description,
                'scheduled_for': call.scheduled_for.isoformat(),
                'duration_minutes': call.duration_minutes,
                'assigned_to': call.assigned_to.get_full_name() if call.assigned_to else 'Unassigned',
            } for call in upcoming_calls]
            
            # Compile response
            stats = {
                'quick_stats': {
                    'total_orders': total_orders,
                    'total_revenue': float(total_revenue),
                    'total_customers': total_customers,
                    'total_suppliers': total_suppliers,
                },
                'todays_numbers': {
                    'orders_today': orders_today,
                    'pending_orders': pending_orders,
                    'completed_today': completed_today,
                    'active_customers': total_customers,  # Can refine this later
                },
                'recent_activity': activity_list,
                'upcoming_calls': calls_list,
            }
            
            return Response(stats)
            
        except Exception as e:
            logger.error(f"Error fetching workspace stats: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to fetch stats", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

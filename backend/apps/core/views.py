import logging

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.serializers import ValidationError
from apps.tenants.models import TenantUser
from apps.core.throttling import AuthRateThrottle
from apps.core.models import UserFavorite
from apps.core.serializers import LoginRequestSerializer, UserFavoriteSerializer

logger = logging.getLogger(__name__)


@extend_schema(
    tags=["Auth"],
    request=LoginRequestSerializer,
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT},
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login(request):
    """
    Login endpoint for token-based authentication.
    """
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"error": "Username and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)

    if user:
        token, created = Token.objects.get_or_create(user=user)
        
        # Get user's tenants
        user_tenants = TenantUser.objects.filter(
            user=user,
            is_active=True
        ).select_related('tenant').values(
            'tenant__id',
            'tenant__name',
            'tenant__slug',
            'role'
        )
        
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                    "is_active": user.is_active,
                },
                "tenants": list(user_tenants),
            }
        )

    return Response(
        {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def guest_login(request):
    """
    Guest login endpoint - automatically logs in as the guest user.
    
    This allows users to try ProjectMeats without creating an account.
    The guest user has admin-level permissions within the guest tenant,
    but is NOT a superuser.
    """
    try:
        # Get guest user (default username: 'guest')
        guest_username = 'guest'
        guest_user = User.objects.get(username=guest_username)
        
        if not guest_user.is_active:
            return Response(
                {"error": "Guest account is currently disabled"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Get or create token for guest user
        token, created = Token.objects.get_or_create(user=guest_user)
        
        # Get guest tenant info
        guest_tenant_user = TenantUser.objects.filter(
            user=guest_user,
            is_active=True
        ).select_related('tenant').first()
        
        if not guest_tenant_user:
            return Response(
                {"error": "Guest tenant not configured. Please run: python manage.py create_guest_tenant"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": guest_user.id,
                    "username": guest_user.username,
                    "email": guest_user.email,
                    "first_name": guest_user.first_name,
                    "last_name": guest_user.last_name,
                    "is_staff": guest_user.is_staff,
                    "is_superuser": guest_user.is_superuser,
                    "is_active": guest_user.is_active,
                },
                "tenant": {
                    "id": str(guest_tenant_user.tenant.id),
                    "name": guest_tenant_user.tenant.name,
                    "slug": guest_tenant_user.tenant.slug,
                    "role": guest_tenant_user.role,
                    "is_guest": True,
                },
                "message": "Welcome to ProjectMeats! You are logged in as a guest user."
            }
        )
        
    except User.DoesNotExist:
        return Response(
            {
                "error": "Guest account not found. Please run: python manage.py create_guest_tenant",
                "setup_command": "python manage.py create_guest_tenant"
            },
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def signup(request):
    """
    DEPRECATED: Open signup is disabled. Use invitation-based signup.
    
    Registration is now invite-only to ensure all users are properly associated
    with a tenant. Users must sign up using an invitation link.
    """
    return Response(
        {
            "error": "Open registration is disabled.",
            "message": "Registration is invite-only. Please contact your tenant administrator for an invitation link.",
            "endpoint": "Use /api/tenants/api/auth/signup-with-invitation/ instead"
        },
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["POST"])
def logout(request):
    """
    Logout endpoint that deletes the user's token.
    """
    try:
        token = Token.objects.get(user=request.user)
        token.delete()
        return Response({"message": "Successfully logged out"})
    except Token.DoesNotExist:
        return Response({"message": "Already logged out"})


from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from apps.core.models import (
    UserPreferences,
    EdibleInedibleChoices,
    AccountingPaymentTermsChoices,
    CreditLimitChoices,
    AccountLineOfCreditChoices,
    ProteinTypeChoices,
    FreshOrFrozenChoices,
    PackageTypeChoices,
    NetOrCatchChoices,
    PlantTypeChoices,
    CertificateTypeChoices,
    OriginChoices,
    CountryOriginChoices,
    ShippingOfferedChoices,
    IndustryChoices,
    WeightUnitChoices,
    AppointmentMethodChoices,
    ContactTypeChoices,
    DepartmentChoicesSupplier,
    CarrierDepartmentChoices,
    CartonTypeChoices,
)
from apps.core.serializers import UserPreferencesSerializer


class ChoicesAPIView(APIView):
    """
    API endpoint for getting all static choices (Django TextChoices).
    
    Returns all choice options defined in core.models for use in
    form dropdowns. These are static options that don't require
    database lookups.
    
    GET /api/v1/choices/
    GET /api/v1/choices/?choice_type=protein_type
    """
    permission_classes = [IsAuthenticated]
    
    # Map choice type names to choice classes
    CHOICE_CLASSES = {
        'edible_inedible': EdibleInedibleChoices,
        'accounting_payment_terms': AccountingPaymentTermsChoices,
        'credit_limit': CreditLimitChoices,
        'account_line_of_credit': AccountLineOfCreditChoices,
        'protein_type': ProteinTypeChoices,
        'fresh_or_frozen': FreshOrFrozenChoices,
        'package_type': PackageTypeChoices,
        'net_or_catch': NetOrCatchChoices,
        'plant_type': PlantTypeChoices,
        'certificate_type': CertificateTypeChoices,
        'origin': OriginChoices,
        'country_origin': CountryOriginChoices,
        'shipping_offered': ShippingOfferedChoices,
        'industry': IndustryChoices,
        'weight_unit': WeightUnitChoices,
        'appointment_method': AppointmentMethodChoices,
        'contact_type': ContactTypeChoices,
        'department_supplier': DepartmentChoicesSupplier,
        'carrier_department': CarrierDepartmentChoices,
        'carton_type': CartonTypeChoices,
    }
    
    def get(self, request):
        """Get all choices or a specific choice type."""
        choice_type = request.query_params.get('choice_type')
        
        if choice_type:
            # Return a specific choice type
            if choice_type not in self.CHOICE_CLASSES:
                return Response(
                    {'error': f'Unknown choice type: {choice_type}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            choice_class = self.CHOICE_CLASSES[choice_type]
            options = [
                {'value': c.value, 'label': c.label}
                for c in choice_class
            ]
            
            return Response({
                'choice_type': choice_type,
                'options': options,
                'count': len(options),
            })
        
        # Return all choices
        all_choices = {}
        for choice_name, choice_class in self.CHOICE_CLASSES.items():
            all_choices[choice_name] = [
                {'value': c.value, 'label': c.label}
                for c in choice_class
            ]
        
        return Response({
            'choices': all_choices,
            'choice_types': list(self.CHOICE_CLASSES.keys()),
        })


class UserPreferencesViewSet(viewsets.ModelViewSet):
    """
    ViewSet for UserPreferences.
    
    Provides CRUD operations for user preferences.
    Users can only access/modify their own preferences.
    """
    
    serializer_class = UserPreferencesSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return preferences for the current user only."""
        return UserPreferences.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Create preferences for the current user."""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """
        Get or update preferences for the current user.
        
        GET: Returns current user's preferences (creates if not exists)
        PUT/PATCH: Updates current user's preferences
        """
        # Get or create preferences for current user
        preferences, created = UserPreferences.objects.get_or_create(
            user=request.user
        )
        
        if request.method in ['PUT', 'PATCH']:
            serializer = self.get_serializer(
                preferences,
                data=request.data,
                partial=(request.method == 'PATCH')
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        # GET request
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)


# ==============================================================================
# Universal Search API (Wave 2: Cockpit Command Center)
# ==============================================================================

from apps.core.throttling import BurstRateThrottle


class RankedSearchView(APIView):
    """
    Universal search with intelligent ranking and smart labels.
    
    GET /api/v1/search/ranked/?q=query&date_range=7d&entity_types=customer,supplier
    
    Query Parameters:
    - q: Search query string (required)
    - date_range: Filter by activity date (7d, 30d, 90d, all) [default: all]
    - entity_types: Comma-separated entity types to search [default: all]
    - limit: Max results per entity type [default: 10]
    
    Features:
    - 4-factor scoring (recency, relevance, value, activity)
    - Smart labels ("Last contact: 3 days ago", etc.)
    - Date range filters
    - Tenant isolation
    
    Created: 2026-02-24 - Cockpit Phase 2A Smart Rankings Integration
    """
    
    permission_classes = [IsAuthenticated]
    throttle_classes = [BurstRateThrottle]
    
    def get(self, request):
        from apps.core.services import UniversalSearchService
        
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response({
                'query': query,
                'results': [],
                'total': 0,
                'message': 'Query must be at least 2 characters'
            })
        
        # Extract parameters
        date_range = request.query_params.get('date_range', 'all')
        entity_types_param = request.query_params.get('entity_types', '')
        entity_types = [t.strip() for t in entity_types_param.split(',') if t.strip()] if entity_types_param else None
        limit = min(int(request.query_params.get('limit', 10)), 50)
        
        # Validate date range
        valid_ranges = ['7d', '30d', '90d', 'all']
        if date_range not in valid_ranges:
            date_range = 'all'
        
        # Use existing UniversalSearchService for base search
        search_service = UniversalSearchService(tenant=request.tenant)
        base_results_response = search_service.search(query, limit_per_type=limit, entity_types=entity_types)
        
        # Extract results array from response
        base_results = base_results_response.get('results', [])
        
        # Apply date filter if specified
        if date_range != 'all':
            days = int(date_range.rstrip('d'))
            cutoff_date = timezone.now() - timedelta(days=days)
            base_results = self._filter_by_date(base_results, cutoff_date)
        
        # Enhance results with rankings and labels
        enhanced_results = []
        for result in base_results:
            enhanced = self._enhance_result(result, query, request.tenant)
            enhanced_results.append(enhanced)
        
        # Sort by score (descending)
        enhanced_results.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        return Response({
            'query': query,
            'results': enhanced_results,
            'total': len(enhanced_results),
            'applied_filters': {
                'date_range': date_range,
                'entity_types': entity_types or 'all'
            }
        })
    
    def _filter_by_date(self, results: list, cutoff_date) -> list:
        """Filter results by last activity date"""
        filtered = []
        for result in results:
            metadata = result.get('metadata', {})
            last_activity = metadata.get('modified_at') or metadata.get('created_at')
            
            if last_activity:
                # Handle both datetime objects and strings
                if isinstance(last_activity, str):
                    try:
                        from dateutil import parser
                        last_activity = parser.parse(last_activity)
                    except:
                        continue
                
                # Make cutoff_date timezone-aware if last_activity is
                if timezone.is_aware(last_activity) and timezone.is_naive(cutoff_date):
                    cutoff_date = timezone.make_aware(cutoff_date)
                
                if last_activity >= cutoff_date:
                    filtered.append(result)
        
        return filtered
    
    def _enhance_result(self, result: dict, query: str, tenant) -> dict:
        """
        Enhance a search result with ranking score and smart labels.
        """
        from apps.system.services.ranking_service import EntityRanking, EntityLabels
        
        entity_type = result['type']
        entity_id = result['id']
        entity_name = result.get('title', '')
        
        # Get entity object for detailed scoring
        entity_obj = self._get_entity_object(entity_type, entity_id, tenant)
        
        if not entity_obj:
            # Fallback scoring without entity object
            score = EntityRanking.score_relevance(query, entity_name)
            labels = {}
        else:
            # Calculate full score
            score = EntityRanking.calculate_total_score(
                entity_type=entity_type,
                entity=entity_obj,
                query=query
            )
            
            # Generate smart labels
            labels = EntityLabels.get_labels(entity_type, entity_obj)
        
        # Add score and labels to result
        result['score'] = score
        result['labels'] = labels
        
        return result
    
    def _get_entity_object(self, entity_type: str, entity_id: int, tenant):
        """
        Fetch the actual entity object for detailed scoring.
        """
        try:
            if entity_type == 'customer':
                from tenant_apps.customers.models import Customer
                return Customer.objects.filter(tenant=tenant, id=entity_id).first()

            if entity_type == 'supplier':
                from tenant_apps.suppliers.models import Supplier
                return Supplier.objects.filter(tenant=tenant, id=entity_id).first()

            if entity_type == 'product':
                from apps.system.models import Product
                return Product.objects.filter(id=entity_id).first()

            if entity_type == 'sales_order':
                from tenant_apps.sales_orders.models import SalesOrder
                return SalesOrder.objects.filter(tenant=tenant, id=entity_id).first()

            if entity_type == 'purchase_order':
                from tenant_apps.purchase_orders.models import PurchaseOrder
                return PurchaseOrder.objects.filter(tenant=tenant, id=entity_id).first()

            return None

        except Exception:
            logger.exception("[RankedSearchView] Error fetching %s %s", entity_type, entity_id)
            return None


class UniversalSearchView(APIView):
    """
    Universal search across all tenant entities.
    
    GET /api/v1/search/universal/?q=query
    
    Supports search operators:
    - supplier:ABC or s:ABC - Search only suppliers
    - customer:XYZ or c:XYZ - Search only customers  
    - po:1234 - Search only purchase orders
    - so:5678 - Search only sales orders
    - product:beef or p:beef - Search only products
    - @john - Search only contacts
    - invoice:INV001 or inv:INV001 - Search only invoices
    - plant:PLANT1 - Search only plants
    - carrier:CARRIER1 - Search only carriers
    
    Query Parameters:
    - q: Search query (required, min 2 chars)
    - types: Comma-separated entity types to search (optional)
    - limit: Results per type (default: 5, max: 20)
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [BurstRateThrottle]
    
    def get(self, request):
        from apps.core.services import UniversalSearchService
        
        query = request.query_params.get('q', '').strip()
        types_param = request.query_params.get('types', '')
        limit = min(int(request.query_params.get('limit', 5)), 20)
        
        if len(query) < 2:
            return Response({
                'query': query,
                'results': [],
                'counts': {},
                'total': 0,
                'message': 'Query must be at least 2 characters'
            })
        
        # Parse entity types if provided
        entity_types = None
        if types_param:
            entity_types = [t.strip() for t in types_param.split(',') if t.strip()]
        
        # Check tenant context
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Execute search
        service = UniversalSearchService(tenant=request.tenant)
        results = service.search(query, limit_per_type=limit, entity_types=entity_types)
        
        return Response(results)


class RecentItemsView(APIView):
    """
    Get recently accessed items for the current user.
    
    GET /api/v1/search/recent/
    POST /api/v1/search/recent/ - Track item access
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.core.services import UniversalSearchService
        
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        limit = min(int(request.query_params.get('limit', 10)), 20)
        
        service = UniversalSearchService(tenant=request.tenant)
        recent = service.get_recent_items(request.user, limit=limit)
        
        return Response({
            'items': recent,
            'count': len(recent)
        })
    
    def post(self, request):
        """Track an item access."""
        from apps.core.services import UniversalSearchService
        
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        entity_type = request.data.get('entity_type')
        entity_id = request.data.get('entity_id')
        title = request.data.get('title', '')
        
        if not entity_type or not entity_id:
            return Response(
                {'error': 'entity_type and entity_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = UniversalSearchService(tenant=request.tenant)
        service.track_item_access(request.user, entity_type, entity_id, title)
        
        return Response({'status': 'tracked'})


class SearchOperatorsView(APIView):
    """
    Get available search operators and help text.
    
    GET /api/v1/search/operators/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.core.services import UniversalSearchService
        
        return Response({
            'operators': UniversalSearchService.get_operators_help(),
            'entity_types': UniversalSearchService.get_all_entity_types()
        })


# ==============================================================================
# Entity Graph API (Wave 2: Cockpit Command Center)
# ==============================================================================

class EntityDetailView(APIView):
    """
    Get entity details by type and ID.
    
    GET /api/v1/entities/{type}/{id}/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, entity_type: str, entity_id: int):
        from apps.core.services import EntityGraphService
        
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        service = EntityGraphService(tenant=request.tenant)
        entity = service.get_entity(entity_type, entity_id)
        
        if not entity:
            return Response(
                {'error': 'Entity not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(entity)


class EntityRelationshipsView(APIView):
    """
    Get relationships for an entity.
    
    GET /api/v1/entities/{type}/{id}/relationships/
    GET /api/v1/entities/{type}/{id}/relationships/{relationship_name}/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, entity_type: str, entity_id: int, relationship_name: str = None):
        from apps.core.services import EntityGraphService
        
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        service = EntityGraphService(tenant=request.tenant)
        
        if relationship_name:
            # Get specific relationship with pagination
            limit = min(int(request.query_params.get('limit', 20)), 100)
            offset = int(request.query_params.get('offset', 0))
            
            result = service.get_related_entities(
                entity_type, entity_id, relationship_name,
                limit=limit, offset=offset
            )
            return Response(result)
        else:
            # Get all relationships summary
            include_counts = request.query_params.get('counts', 'true').lower() == 'true'
            relationships = service.get_relationships(
                entity_type, entity_id, include_counts=include_counts
            )
            return Response({
                'entity_type': entity_type,
                'entity_id': entity_id,
                'relationships': relationships
            })


class EntityGraphView(APIView):
    """
    Get entity graph for visualization.
    
    GET /api/v1/entities/{type}/{id}/graph/
    
    Query Parameters:
    - depth: How many levels to traverse (1-3, default: 1)
    - max_nodes: Maximum nodes to return (default: 50, max: 100)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, entity_type: str, entity_id: int):
        from apps.core.services import EntityGraphService
        
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        depth = min(int(request.query_params.get('depth', 1)), 3)
        max_nodes = min(int(request.query_params.get('max_nodes', 50)), 100)
        
        service = EntityGraphService(tenant=request.tenant)
        graph = service.get_entity_graph(
            entity_type, entity_id, 
            depth=depth, max_nodes=max_nodes
        )
        
        if not graph['nodes']:
            return Response(
                {'error': 'Entity not found or no relationships'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(graph)


class EntityTypesView(APIView):
    """
    Get supported entity types for graph traversal.
    
    GET /api/v1/entities/types/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.core.services import EntityGraphService
        
        types = EntityGraphService.get_supported_entity_types()
        visuals = {t: EntityGraphService.get_entity_visuals(t) for t in types}
        
        return Response({
            'entity_types': types,
            'visuals': visuals
        })


# ============================================================================
# Workspace API Views (Wave 2: Cockpit Command Center)
# ============================================================================

class WorkspaceLayoutView(APIView):
    """
    User workspace layout storage.
    
    GET /api/v1/workspace/layout/
    POST /api/v1/workspace/layout/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user's saved workspace layout."""
        from django.core.cache import cache
        
        cache_key = f"workspace_layout_{request.user.id}"
        layout = cache.get(cache_key)
        
        if layout:
            return Response(layout)
        
        # Return default layout if none saved
        return Response({
            'layout': None,
            'widgets': None,
            'version': 1
        })
    
    def post(self, request):
        """Save user's workspace layout."""
        from django.core.cache import cache
        
        layout_data = {
            'layout': request.data.get('layout', []),
            'widgets': request.data.get('widgets', []),
            'version': request.data.get('version', 1),
            'user_id': request.user.id
        }
        
        cache_key = f"workspace_layout_{request.user.id}"
        # Cache for 30 days
        cache.set(cache_key, layout_data, 60 * 60 * 24 * 30)
        
        return Response({'status': 'saved'}, status=status.HTTP_200_OK)


class WorkspaceStatsView(APIView):
    """
    Quick stats for workspace widgets.
    
    GET /api/v1/workspace/stats/quick/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get quick stats for the current tenant."""
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from tenant_apps.purchase_orders.models import PurchaseOrder
        from tenant_apps.sales_orders.models import SalesOrder
        from tenant_apps.suppliers.models import Supplier
        from tenant_apps.customers.models import Customer
        from django.utils import timezone
        
        tenant = request.tenant
        today = timezone.now().date()
        
        # Calculate stats
        try:
            po_today = PurchaseOrder.objects.filter(
                tenant=tenant,
                created_on__date=today,
            ).count()

            so_today = SalesOrder.objects.filter(
                tenant=tenant,
                created_on__date=today,
            ).count()
            
            supplier_count = Supplier.objects.filter(
                tenant=tenant,
            ).count()
            
            active_customers = Customer.objects.filter(
                tenant=tenant,
            ).count()
            
            return Response({
                'stats': [
                    {
                        'id': 'orders_today',
                        'label': 'Orders Today',
                        'value': po_today + so_today,
                        'change': 0,
                        'changeLabel': 'vs yesterday',
                        'color': 'rgb(59, 130, 246)'
                    },
                    {
                        'id': 'suppliers',
                        'label': 'Suppliers',
                        'value': supplier_count,
                        'change': 0,
                        'changeLabel': 'total',
                        'color': 'rgb(34, 197, 94)'
                    },
                    {
                        'id': 'active_customers',
                        'label': 'Active Customers',
                        'value': active_customers,
                        'change': 0,
                        'changeLabel': 'total',
                        'color': 'rgb(168, 85, 247)'
                    },
                    {
                        'id': 'pending_orders',
                        'label': 'Pending Orders',
                        'value': PurchaseOrder.objects.filter(
                            tenant=tenant,
                            status='pending'
                        ).count(),
                        'change': 0,
                        'changeLabel': 'awaiting',
                        'color': 'rgb(234, 179, 8)'
                    }
                ]
            })
        except Exception as e:
            return Response({
                'stats': [],
                'error': str(e)
            })


class WorkspaceActivityView(APIView):
    """
    Recent activity feed for workspace widgets.
    
    GET /api/v1/workspace/activity/recent/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get recent activity for the current tenant."""
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        min(int(request.query_params.get('limit', 10)), 50)
        
        # For now, return empty - this would integrate with an activity log
        # or audit trail system in a full implementation
        return Response({
            'activities': [],
            'total': 0
        })


class WorkspaceCallsView(APIView):
    """
    Upcoming calls for workspace widgets.
    
    GET /api/v1/workspace/calls/upcoming/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get upcoming calls for the current tenant."""
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {'error': 'Tenant context required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        min(int(request.query_params.get('limit', 10)), 50)
        
        # This would integrate with a CRM/call scheduling system
        return Response({
            'calls': [],
            'total': 0
        })


# ==============================================================================
# Feature Flags API (Wave 0: Preparation)
# ==============================================================================

class FeatureFlagsView(APIView):
    """
    Get feature flags for the current user/tenant.
    
    GET /api/v1/feature-flags/
    
    Returns enabled/disabled status of all feature flags.
    Used by frontend to conditionally render features.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all feature flags with their current status."""
        from flags.state import flag_enabled
        from django.conf import settings
        
        # Get all configured flags
        configured_flags = getattr(settings, 'FLAGS', {})
        
        # Build response with flag status
        flags = {}
        for flag_name in configured_flags.keys():
            try:
                flags[flag_name] = flag_enabled(flag_name, request=request)
            except Exception:
                # If flag check fails, default to False
                flags[flag_name] = False
        
        return Response({
            'flags': flags,
            'user_id': request.user.id,
            'tenant_id': str(request.tenant.id) if hasattr(request, 'tenant') and request.tenant else None
        })



# ============================================================================
# Favorites ViewSet
# ============================================================================

class FavoritesViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user favorites."""
    serializer_class = UserFavoriteSerializer
    permission_classes = [IsAuthenticated]

    def _get_tenant(self):
        tenant = getattr(self.request, 'tenant', None)
        return tenant

    def get_queryset(self):
        tenant = self._get_tenant()
        if not tenant:
            return UserFavorite.objects.none()
        return UserFavorite.objects.filter(user=self.request.user, tenant=tenant)

    def perform_create(self, serializer):
        tenant = self._get_tenant()
        if not tenant:
            raise ValidationError({'error': 'Tenant context required'})
        serializer.save(user=self.request.user, tenant=tenant)
    
    @action(detail=False, methods=['post'])
    def toggle(self, request):
        tenant = getattr(request, 'tenant', None)
        entity_type = request.data.get('entity_type')
        entity_id = request.data.get('entity_id')
        entity_title = request.data.get('entity_title', '')

        if not tenant:
            return Response({'error': 'tenant required'}, status=400)

        if not entity_type or entity_id is None:
            return Response({'error': 'entity_type and entity_id required'}, status=400)

        try:
            entity_id = int(entity_id)
        except (TypeError, ValueError):
            return Response({'error': 'entity_id must be an integer'}, status=400)

        favorite = UserFavorite.objects.filter(
            user=request.user, tenant=tenant, entity_type=entity_type, entity_id=entity_id
        ).first()
        
        if favorite:
            favorite.delete()
            return Response({'action': 'removed', 'favorite': None})
        else:
            favorite = UserFavorite.objects.create(
                user=request.user,
                tenant=tenant,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_title=entity_title,
            )
            return Response({'action': 'added', 'favorite': UserFavoriteSerializer(favorite).data}, status=201)
    
    @action(detail=False, methods=['get'])
    def check(self, request):
        tenant = getattr(request, 'tenant', None)
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')

        if not tenant:
            return Response({'error': 'tenant required'}, status=400)

        if not entity_type or entity_id is None:
            return Response({'error': 'entity_type and entity_id required'}, status=400)

        try:
            entity_id = int(entity_id)
        except (TypeError, ValueError):
            return Response({'error': 'entity_id must be an integer'}, status=400)

        is_favorited = UserFavorite.objects.filter(
            user=request.user, tenant=tenant, entity_type=entity_type, entity_id=entity_id
        ).exists()
        
        return Response({'is_favorited': is_favorited})


# ==============================================================================
# Sentry Webhooks (Sentry-GitHub-Copilot Loop)
# ==============================================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def sentry_issue_created_webhook(request):
    """Stub receiver for Sentry "Issue Created" webhooks.

    This is intentionally permissive (no signature validation yet) and exists
    to establish the stable endpoint + contract for future automation.

    Expected future flow:
    - Sentry issue created -> webhook -> route/assign -> create GitHub issue/PR tasks -> Copilot triage
    """
    try:
        resource = request.headers.get('Sentry-Hook-Resource') or request.headers.get('X-Sentry-Hook-Resource')
        event = request.headers.get('Sentry-Hook-Event') or request.headers.get('X-Sentry-Hook-Event')
        payload = request.data if isinstance(request.data, dict) else {}

        issue = payload.get('data', {}).get('issue', {}) if isinstance(payload.get('data'), dict) else {}
        issue_id = issue.get('id')
        issue_title = issue.get('title')
        issue_permalink = issue.get('permalink')

        logger.info(
            '[SentryWebhook] received resource=%s event=%s issue_id=%s title=%s',
            resource,
            event,
            issue_id,
            issue_title,
        )

        return Response(
            {
                'ok': True,
                'resource': resource,
                'event': event,
                'issue': {
                    'id': issue_id,
                    'title': issue_title,
                    'permalink': issue_permalink,
                },
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        logger.warning('[SentryWebhook] failed to process payload: %s', str(e), exc_info=True)
        return Response({'ok': False}, status=status.HTTP_200_OK)

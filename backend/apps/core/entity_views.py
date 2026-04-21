"""
Entity API Views for WorkForms Enhancement Project.

Provides endpoints for entity registry, schema extraction, and lookup data.

Phase 1.1-1.3 of WF-ENH-2026-Q1
Created: 2026-02-06
"""
from django.apps import apps
from django.db import models
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.paginator import Paginator
from django.db.models import Q

from apps.tenants.models import TenantUser


# ============================================================================
# Field Type Mapping (Django → Frontend)
# ============================================================================

FIELD_TYPE_MAP = {
    'CharField': 'text',
    'TextField': 'textarea',
    'EmailField': 'email',
    'URLField': 'url',
    'IntegerField': 'number',
    'PositiveIntegerField': 'number',
    'DecimalField': 'currency',
    'FloatField': 'number',
    'BooleanField': 'checkbox',
    'DateField': 'date',
    'DateTimeField': 'datetime',
    'TimeField': 'time',
    'ForeignKey': 'reference',
    'ManyToManyField': 'multi-reference',
    'JSONField': 'json',
    'ArrayField': 'array',
}


# ============================================================================
# Entity Registry (Phase 1.1)
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def entity_registry(request):
    """
    GET /api/v1/entities/
    
    Returns list of all tenant-aware entities with metadata.
    
    Response:
    {
        "entities": [
            {
                "type": "supplier",
                "label": "Supplier",
                "app_label": "suppliers",
                "model_name": "Supplier",
                "icon": "building",
                "category": "procurement",
                "has_schema": true,
                "description": "Supplier management"
            },
            ...
        ]
    }
    """
    
    # Define entity registry manually for now
    # In production, this could be auto-discovered from models with TenantAwareModel base
    entity_registry_data = [
        {
            "type": "supplier",
            "label": "Supplier",
            "app_label": "suppliers",
            "model_name": "Supplier",
            "icon": "building",
            "category": "procurement",
            "has_schema": True,
            "description": "Supplier management and information"
        },
        {
            "type": "customer",
            "label": "Customer",
            "app_label": "customers",
            "model_name": "Customer",
            "icon": "users",
            "category": "sales",
            "has_schema": True,
            "description": "Customer management and information"
        },
        {
            "type": "product",
            "label": "Product",
            "app_label": "system",
            "model_name": "Product",
            "icon": "package",
            "category": "inventory",
            "has_schema": True,
            "description": "Product catalog and specifications"
        },
        {
            "type": "contact",
            "label": "Contact",
            "app_label": "contacts",
            "model_name": "Contact",
            "icon": "user",
            "category": "general",
            "has_schema": True,
            "description": "Contact information"
        },
    ]
    
    return Response({"entities": entity_registry_data})


# ============================================================================
# Entity Schema Extraction (Phase 1.2)
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def entity_schema(request, entity_type):
    """
    GET /api/v1/entities/{entity_type}/schema/
    
    Extracts field definitions from Django model and returns frontend-ready schema.
    
    Args:
        entity_type: Entity identifier (e.g., 'supplier', 'customer')
    
    Response:
    {
        "entity_type": "supplier",
        "app_label": "suppliers",
        "model_name": "Supplier",
        "fields": [
            {
                "name": "name",
                "label": "Supplier Name",
                "type": "text",
                "required": true,
                "max_length": 255,
                "help_text": "Supplier company name",
                "validation": {"min_length": 1}
            },
            {
                "name": "plant",
                "label": "Plant",
                "type": "reference",
                "required": false,
                "reference_entity": "location",
                "lookup_endpoint": "/api/v1/entities/location/lookup/"
            },
            ...
        ]
    }
    """
    
    # Map entity types to Django apps and models
    entity_map = {
        'supplier': ('suppliers', 'Supplier'),
        'customer': ('customers', 'Customer'),
        'product': ('system', 'Product'),
        'contact': ('contacts', 'Contact'),
    }
    
    if entity_type not in entity_map:
        return Response(
            {"error": f"Entity type '{entity_type}' not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    app_label, model_name = entity_map[entity_type]
    
    try:
        model = apps.get_model(app_label, model_name)
    except LookupError:
        return Response(
            {"error": f"Model {app_label}.{model_name} not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Extract fields from model
    fields = []
    for field in model._meta.get_fields():
        # Skip reverse relations and auto-created fields
        if field.auto_created or field.many_to_many and field.related_model:
            continue
        
        # Skip tenant field (always filtered automatically)
        if field.name == 'tenant':
            continue
        
        field_info = {
            "name": field.name,
            "label": field.verbose_name.title() if hasattr(field, 'verbose_name') else field.name.replace('_', ' ').title(),
            "type": FIELD_TYPE_MAP.get(field.__class__.__name__, 'text'),
            "required": not field.blank if hasattr(field, 'blank') else False,
            "help_text": field.help_text if hasattr(field, 'help_text') else "",
        }
        
        # Add field-specific attributes
        if hasattr(field, 'max_length') and field.max_length:
            field_info['max_length'] = field.max_length
        
        if hasattr(field, 'choices') and field.choices:
            field_info['choices'] = [
                {"value": choice[0], "label": choice[1]}
                for choice in field.choices
            ]
        
        # Handle reference fields (ForeignKey)
        if isinstance(field, models.ForeignKey):
            related_model = field.related_model
            related_app = related_model._meta.app_label
            related_name = related_model._meta.model_name
            
            field_info['reference_entity'] = related_name
            field_info['reference_model'] = f"{related_app}.{related_model.__name__}"
            field_info['lookup_endpoint'] = f"/api/v1/entities/{related_name}/lookup/"
        
        # Validation rules
        validation = {}
        if hasattr(field, 'max_length') and field.max_length:
            validation['max_length'] = field.max_length
        if field_info['required']:
            validation['required'] = True
        
        if validation:
            field_info['validation'] = validation
        
        fields.append(field_info)
    
    return Response({
        "entity_type": entity_type,
        "app_label": app_label,
        "model_name": model_name,
        "fields": fields
    })


# ============================================================================
# Entity Lookup Data (Phase 1.3)
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def entity_lookup(request, entity_type):
    """
    GET /api/v1/entities/{entity_type}/lookup/?search=&page=1&page_size=20
    
    Returns formatted lookup data for dropdowns/selects.
    Filters by tenant automatically.
    
    Query Parameters:
        - search: Search term (optional)
        - page: Page number (default: 1)
        - page_size: Results per page (default: 20, max: 100)
    
    Response:
    {
        "results": [
            {"value": "uuid-1", "label": "Acme Corp (AC001)"},
            {"value": "uuid-2", "label": "Beta Industries (BI002)"}
        ],
        "count": 47,
        "next": "/api/v1/entities/supplier/lookup/?page=2",
        "previous": null
    }
    """
    
    # Map entity types to Django apps and models
    entity_map = {
        'supplier': ('suppliers', 'Supplier'),
        'customer': ('customers', 'Customer'),
        'product': ('system', 'Product'),
        'contact': ('contacts', 'Contact'),
        'location': ('locations', 'Location'),
        # Utility entity for lookup selectors (no tenant FK)
        'user': ('auth', 'User'),
    }
    
    if entity_type not in entity_map:
        return Response(
            {"error": f"Entity type '{entity_type}' not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    app_label, model_name = entity_map[entity_type]

    # auth.User may be swapped; use get_user_model() for lookup selectors.
    if entity_type == 'user':
        model = get_user_model()
    else:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response(
                {"error": f"Model {app_label}.{model_name} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    # Get query parameters
    search_query = request.query_params.get('search', '')
    page_number = int(request.query_params.get('page', 1))
    page_size = min(int(request.query_params.get('page_size', 20)), 100)
    
    # Get tenant from request (set by TenantMiddleware)
    tenant = getattr(request, 'tenant', None)

    # Fallback: DRF authentication can populate request.user after middleware.
    # For API endpoints that require tenant filtering, resolve a default tenant
    # association here if middleware couldn't.
    if not tenant and getattr(request, 'user', None) and request.user.is_authenticated:
        tenant_user = (
            TenantUser.objects.filter(user=request.user, is_active=True)
            .select_related('tenant')
            .order_by('-role')
            .first()
        )
        if tenant_user:
            tenant = tenant_user.tenant

    # Build base queryset with tenant filter where applicable.
    # Some entities are system-wide (e.g., system.Product) or utility (e.g., User).
    queryset = model.objects.all()

    if entity_type == 'user':
        # Safe default: only allow selecting the current user.
        queryset = queryset.filter(id=request.user.id)
    elif entity_type == 'product':
        # system.Product has no tenant FK; apply visibility rules so we don't leak
        # tenant-owned custom products or tenant-hidden system products.
        from apps.system.services.product_visibility import visible_products_qs

        queryset = visible_products_qs(tenant=tenant, qs=queryset)
    else:
        if not tenant:
            return Response(
                {"error": "Tenant context required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hasattr(model, 'tenant'):
            queryset = queryset.filter(tenant=tenant)
    
    # Apply search filter (search across common fields)
    if search_query:
        search_fields = []
        
        # Determine search fields based on model
        if hasattr(model, 'name'):
            search_fields.append('name')
        if hasattr(model, 'code'):
            search_fields.append('code')
        if hasattr(model, 'product_code'):
            search_fields.append('product_code')
        if hasattr(model, 'company_name'):
            search_fields.append('company_name')
        if hasattr(model, 'email'):
            search_fields.append('email')
        
        # Build Q object for OR search across fields
        if search_fields:
            q_objects = Q()
            for field in search_fields:
                q_objects |= Q(**{f"{field}__icontains": search_query})
            queryset = queryset.filter(q_objects)
    
    # Order by name or primary key
    if hasattr(model, 'name'):
        queryset = queryset.order_by('name')
    else:
        queryset = queryset.order_by('pk')
    
    # Paginate results
    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page_number)
    
    # Format results for dropdown
    results = []
    for obj in page_obj:
        # Determine display label
        if hasattr(obj, 'name'):
            label = obj.name
            # Add code if available
            if hasattr(obj, 'code') and obj.code:
                label = f"{obj.name} ({obj.code})"
            # Product uses product_code not code
            if hasattr(obj, 'product_code') and getattr(obj, 'product_code', None):
                label = f"{obj.product_code} - {obj.name}"
        elif hasattr(obj, 'company_name'):
            label = obj.company_name
        elif hasattr(obj, 'email'):
            label = obj.email
        else:
            label = str(obj)
        
        results.append({
            "value": str(obj.pk),
            "label": label
        })
    
    # Build pagination URLs
    next_url = None
    previous_url = None
    base_url = f"/api/v1/entities/{entity_type}/lookup/"
    
    if page_obj.has_next():
        next_url = f"{base_url}?page={page_obj.next_page_number()}"
        if search_query:
            next_url += f"&search={search_query}"
    
    if page_obj.has_previous():
        previous_url = f"{base_url}?page={page_obj.previous_page_number()}"
        if search_query:
            previous_url += f"&search={search_query}"
    
    # Backward compatibility: some clients expect `options` instead of `results`.
    return Response(
        {
            "results": results,
            "options": results,
            "count": paginator.count,
            "next": next_url,
            "previous": previous_url,
            "page": page_number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
        }
    )

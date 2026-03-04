"""
Entity Graph ViewSet
Provides unified API for entity relationships across all business models.

This ViewSet enables the Cockpit SmartSearch to dynamically discover and navigate
entity relationships without hardcoded URL logic.

Created: 2026-03-03 - Cockpit Integration Task 1
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.apps import apps
from django.core.exceptions import ObjectDoesNotExist


class EntityViewSet(viewsets.ViewSet):
    """
    Unified entity relationship API for the Cockpit.
    
    Endpoints:
    - GET /api/v1/system/entities/{type}/{id}/relationships/ - Get related entities
    - GET /api/v1/system/entities/{type}/{id}/ - Get single entity details
    """
    permission_classes = [IsAuthenticated]
    
    # Map entity types to (app_label, model_name)
    MODEL_MAP = {
        'customer': ('customers', 'Customer'),
        'supplier': ('suppliers', 'Supplier'),
        'product': ('products', 'Product'),
        'contact': ('contacts', 'Contact'),
        'purchase_order': ('purchase_orders', 'PurchaseOrder'),
        'sales_order': ('sales_orders', 'SalesOrder'),
    }
    
    @action(detail=True, methods=['get'], url_path='relationships')
    def relationships(self, request, type=None, pk=None):
        """
        Get all related entities for a given entity.
        
        Query params:
        - relationship_types: Comma-separated list (e.g., "customers,purchase_orders")
        
        Returns:
        {
          "entity": { "id": 123, "type": "customer", "name": "Acme Corp" },
          "relationships": {
            "purchase_orders": [
              { "id": 456, "type": "purchase_order", "title": "PO-001", "metadata": {...} }
            ],
            "sales_orders": [...],
            "contacts": [...]
          },
          "counts": {
            "purchase_orders": 15,
            "sales_orders": 8,
            "contacts": 3
          }
        }
        """
        tenant = request.tenant
        
        if type not in self.MODEL_MAP:
            return Response(
                {"error": f"Unknown entity type: {type}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        app_label, model_name = self.MODEL_MAP[type]
        
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response(
                {"error": f"Model not found: {app_label}.{model_name}"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get the entity
        try:
            if hasattr(Model, 'tenant'):
                entity = Model.objects.filter(tenant=tenant).get(pk=pk)
            else:
                # Products are shared across tenants
                entity = Model.objects.get(pk=pk)
        except ObjectDoesNotExist:
            return Response(
                {"error": f"{model_name} not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get relationship types to load
        requested_types = request.query_params.get('relationship_types', '').split(',')
        if not requested_types or requested_types == ['']:
            # Default: Load all common relationships
            requested_types = self._get_default_relationships(type)
        
        # Build relationships
        relationships = {}
        counts = {}
        
        for rel_type in requested_types:
            rel_data = self._get_relationship_data(entity, type, rel_type, tenant)
            if rel_data:
                relationships[rel_type] = rel_data['items']
                counts[rel_type] = rel_data['count']
        
        return Response({
            "entity": self._serialize_entity(entity, type),
            "relationships": relationships,
            "counts": counts
        })
    
    def retrieve(self, request, pk=None, type=None):
        """
        Get single entity details.
        
        Example: GET /api/v1/system/entities/customer/123/
        """
        tenant = request.tenant
        
        if type not in self.MODEL_MAP:
            return Response(
                {"error": f"Unknown entity type: {type}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        app_label, model_name = self.MODEL_MAP[type]
        
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response(
                {"error": f"Model not found: {app_label}.{model_name}"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            if hasattr(Model, 'tenant'):
                entity = Model.objects.filter(tenant=tenant).get(pk=pk)
            else:
                entity = Model.objects.get(pk=pk)
        except ObjectDoesNotExist:
            return Response(
                {"error": f"{model_name} not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(self._serialize_entity(entity, type))
    
    def _get_default_relationships(self, entity_type):
        """Return default relationship types for each entity."""
        defaults = {
            'customer': ['purchase_orders', 'sales_orders', 'contacts'],
            'supplier': ['purchase_orders', 'contacts'],
            'product': ['purchase_orders', 'sales_orders'],
            'purchase_order': ['line_items', 'supplier'],
            'sales_order': ['line_items', 'customer'],
            'contact': ['customer', 'supplier']
        }
        return defaults.get(entity_type, [])
    
    def _get_relationship_data(self, entity, entity_type, rel_type, tenant):
        """
        Get related entities of a specific type.
        Returns: {"items": [...], "count": N} or None if relationship doesn't exist.
        """
        # Customer relationships
        if entity_type == 'customer':
            if rel_type == 'purchase_orders':
                return self._get_purchase_orders_for_customer(entity, tenant)
            elif rel_type == 'sales_orders':
                return self._get_sales_orders_for_customer(entity, tenant)
            elif rel_type == 'contacts':
                return self._get_contacts_for_customer(entity, tenant)
        
        # Supplier relationships
        if entity_type == 'supplier':
            if rel_type == 'purchase_orders':
                return self._get_purchase_orders_for_supplier(entity, tenant)
            elif rel_type == 'contacts':
                return self._get_contacts_for_supplier(entity, tenant)
        
        # Product relationships
        if entity_type == 'product':
            if rel_type == 'purchase_orders':
                return self._get_purchase_orders_for_product(entity, tenant)
            elif rel_type == 'sales_orders':
                return self._get_sales_orders_for_product(entity, tenant)
        
        # Purchase Order relationships
        if entity_type == 'purchase_order':
            if rel_type == 'line_items':
                return self._get_line_items_for_po(entity, tenant)
            elif rel_type == 'supplier':
                return self._get_supplier_for_po(entity, tenant)
        
        # Sales Order relationships
        if entity_type == 'sales_order':
            if rel_type == 'line_items':
                return self._get_line_items_for_so(entity, tenant)
            elif rel_type == 'customer':
                return self._get_customer_for_so(entity, tenant)
        
        return None
    
    def _get_purchase_orders_for_customer(self, customer, tenant):
        """Get purchase orders for a customer."""
        try:
            PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
            qs = PurchaseOrder.objects.filter(tenant=tenant, customer=customer).order_by('-created_on')
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(po, 'purchase_order') for po in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_sales_orders_for_customer(self, customer, tenant):
        """Get sales orders for a customer."""
        try:
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            qs = SalesOrder.objects.filter(tenant=tenant, customer=customer).order_by('-created_on')
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(so, 'sales_order') for so in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_contacts_for_customer(self, customer, tenant):
        """Get contacts for a customer."""
        try:
            Contact = apps.get_model('contacts', 'Contact')
            qs = Contact.objects.filter(tenant=tenant, customer=customer)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(contact, 'contact') for contact in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_purchase_orders_for_supplier(self, supplier, tenant):
        """Get purchase orders for a supplier."""
        try:
            PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
            qs = PurchaseOrder.objects.filter(tenant=tenant, supplier=supplier).order_by('-created_on')
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(po, 'purchase_order') for po in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_contacts_for_supplier(self, supplier, tenant):
        """Get contacts for a supplier."""
        try:
            Contact = apps.get_model('contacts', 'Contact')
            qs = Contact.objects.filter(tenant=tenant, supplier=supplier)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(contact, 'contact') for contact in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_purchase_orders_for_product(self, product, tenant):
        """Get purchase orders containing this product."""
        try:
            PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
            LineItem = apps.get_model('purchase_orders', 'LineItem')
            
            # Get POs that have line items with this product
            po_ids = LineItem.objects.filter(product=product).values_list('purchase_order_id', flat=True).distinct()
            qs = PurchaseOrder.objects.filter(tenant=tenant, id__in=po_ids).order_by('-created_on')
            
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(po, 'purchase_order') for po in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_sales_orders_for_product(self, product, tenant):
        """Get sales orders containing this product."""
        try:
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            LineItem = apps.get_model('sales_orders', 'LineItem')
            
            # Get SOs that have line items with this product
            so_ids = LineItem.objects.filter(product=product).values_list('sales_order_id', flat=True).distinct()
            qs = SalesOrder.objects.filter(tenant=tenant, id__in=so_ids).order_by('-created_on')
            
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(so, 'sales_order') for so in qs[:10]]
            }
        except LookupError:
            return None
    
    def _get_line_items_for_po(self, purchase_order, tenant):
        """Get line items for a purchase order."""
        try:
            LineItem = apps.get_model('purchase_orders', 'LineItem')
            qs = LineItem.objects.filter(purchase_order=purchase_order)
            return {
                "count": qs.count(),
                "items": [self._serialize_line_item(li, 'purchase_order_line') for li in qs[:20]]
            }
        except LookupError:
            return None
    
    def _get_line_items_for_so(self, sales_order, tenant):
        """Get line items for a sales order."""
        try:
            LineItem = apps.get_model('sales_orders', 'LineItem')
            qs = LineItem.objects.filter(sales_order=sales_order)
            return {
                "count": qs.count(),
                "items": [self._serialize_line_item(li, 'sales_order_line') for li in qs[:20]]
            }
        except LookupError:
            return None
    
    def _get_supplier_for_po(self, purchase_order, tenant):
        """Get supplier for a purchase order."""
        if hasattr(purchase_order, 'supplier') and purchase_order.supplier:
            return {
                "count": 1,
                "items": [self._serialize_entity(purchase_order.supplier, 'supplier')]
            }
        return None
    
    def _get_customer_for_so(self, sales_order, tenant):
        """Get customer for a sales order."""
        if hasattr(sales_order, 'customer') and sales_order.customer:
            return {
                "count": 1,
                "items": [self._serialize_entity(sales_order.customer, 'customer')]
            }
        return None
    
    def _serialize_entity(self, entity, entity_type):
        """Minimal serialization for entity references."""
        base = {
            "id": entity.pk,
            "type": entity_type,
        }
        
        # Add type-specific fields
        if hasattr(entity, 'name'):
            base['title'] = entity.name
        elif hasattr(entity, 'title'):
            base['title'] = entity.title
        elif hasattr(entity, 'number'):
            base['title'] = entity.number
        else:
            base['title'] = f"{entity_type.title()} {entity.pk}"
        
        # Add metadata (last activity, labels, etc.)
        base['metadata'] = self._get_entity_metadata(entity, entity_type)
        
        # Add common fields
        if hasattr(entity, 'created_on'):
            base['created_at'] = entity.created_on
        elif hasattr(entity, 'created_at'):
            base['created_at'] = entity.created_at
        
        return base
    
    def _serialize_line_item(self, line_item, item_type):
        """Serialize line item with product details."""
        base = {
            "id": line_item.pk,
            "type": item_type,
        }
        
        # Add product name
        if hasattr(line_item, 'product') and line_item.product:
            base['title'] = line_item.product.name
            base['product_id'] = line_item.product.pk
        else:
            base['title'] = f"Line Item {line_item.pk}"
        
        # Add quantity and pricing
        if hasattr(line_item, 'quantity'):
            base['quantity'] = line_item.quantity
        if hasattr(line_item, 'unit_price'):
            base['unit_price'] = float(line_item.unit_price)
        if hasattr(line_item, 'total_price'):
            base['total_price'] = float(line_item.total_price)
        
        return base
    
    def _get_entity_metadata(self, entity, entity_type):
        """Get contextual metadata for an entity."""
        try:
            from apps.system.services.ranking_service import EntityLabels
            
            metadata = {
                "labels": EntityLabels.get_labels(entity, entity_type),
            }
            
            # Add last activity timestamp
            if hasattr(entity, 'modified_on'):
                metadata['last_activity'] = entity.modified_on
            elif hasattr(entity, 'updated_at'):
                metadata['last_activity'] = entity.updated_at
            
            return metadata
        except Exception as e:
            # Graceful fallback if labeling fails
            return {"labels": []}
    
    @action(detail=True, methods=['get'], url_path='fuzzy-related')
    def fuzzy_related(self, request, type=None, pk=None):
        """
        Discover related entities using fuzzy matching (email domain, tax ID, name).
        
        This endpoint finds relationships even when foreign keys are NULL by matching:
        - Email domains (@company.com)
        - Tax IDs / Business numbers
        - Company names / Short names
        - SKUs / Reference numbers
        
        Example: GET /api/v1/system/entities/customer/123/fuzzy-related/
        
        Query params:
        - max_results: Maximum fuzzy matches to return (default: 50)
        
        Returns:
        {
          "entity": { "id": 123, "type": "customer", "name": "Acme Corp" },
          "fuzzy_matches": [
            {
              "id": "456",
              "type": "order",
              "name": "Order #1234",
              "subtitle": "Email: john@acme.com",
              "metadata": {
                "match_type": "email_domain",
                "domain": "acme.com"
              },
              "relevance_score": 0.9
            },
            ...
          ],
          "total": 15
        }
        """
        from apps.system.services import RelationshipDiscoveryService
        
        tenant = request.tenant
        
        if type not in self.MODEL_MAP:
            return Response(
                {"error": f"Unknown entity type: {type}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get max results from query params
        max_results = int(request.query_params.get('max_results', 50))
        
        # Initialize fuzzy discovery service
        discovery_service = RelationshipDiscoveryService(tenant)
        
        try:
            # Discover fuzzy relationships
            fuzzy_matches = discovery_service.discover_related_entities(
                entity_type=type,
                entity_id=pk,
                max_results=max_results
            )
            
            # Get source entity for response
            app_label, model_name = self.MODEL_MAP[type]
            Model = apps.get_model(app_label, model_name)
            
            if hasattr(Model, 'tenant'):
                entity = Model.objects.filter(tenant=tenant).get(pk=pk)
            else:
                entity = Model.objects.get(pk=pk)
            
            return Response({
                "entity": self._serialize_entity(entity, type),
                "fuzzy_matches": fuzzy_matches,
                "total": len(fuzzy_matches)
            })
            
        except ObjectDoesNotExist:
            return Response(
                {"error": f"Entity not found: {type} #{pk}"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # Graceful error handling - return empty results
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Fuzzy discovery failed for {type} #{pk}: {str(e)}', exc_info=True)
            
            return Response({
                "entity": {"id": pk, "type": type},
                "fuzzy_matches": [],
                "total": 0,
                "error": "Fuzzy discovery temporarily unavailable"
            })

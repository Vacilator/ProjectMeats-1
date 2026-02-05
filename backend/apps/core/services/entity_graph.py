"""
Entity Graph Service for ProjectMeats Cockpit/Workspace.

Provides entity relationship traversal with:
- Relationship discovery between entities
- Graph traversal with depth control
- Relationship metadata (type, direction, count)
- Tenant isolation

Part of Wave 2: Cockpit Command Center implementation.
"""
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from django.db.models import Q, Count
from django.apps import apps
from django.contrib.contenttypes.models import ContentType

from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


# Entity relationship configuration
ENTITY_RELATIONSHIPS = {
    'supplier': {
        'model': ('tenant_apps.suppliers', 'Supplier'),
        'relationships': {
            'purchase_orders': {
                'related_model': ('tenant_apps.purchase_orders', 'PurchaseOrder'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Purchase Orders',
                'direction': 'outgoing',
            },
            'contacts': {
                'related_model': ('tenant_apps.contacts', 'Contact'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Contacts',
                'direction': 'outgoing',
            },
            'plants': {
                'related_model': ('tenant_apps.plants', 'Plant'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Plants',
                'direction': 'outgoing',
            },
            'products': {
                'related_model': ('tenant_apps.products', 'Product'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Products',
                'direction': 'outgoing',
            },
        },
    },
    'customer': {
        'model': ('tenant_apps.customers', 'Customer'),
        'relationships': {
            'sales_orders': {
                'related_model': ('tenant_apps.sales_orders', 'SalesOrder'),
                'field': 'customer',
                'reverse': True,
                'label': 'Sales Orders',
                'direction': 'outgoing',
            },
            'contacts': {
                'related_model': ('tenant_apps.contacts', 'Contact'),
                'field': 'customer',
                'reverse': True,
                'label': 'Contacts',
                'direction': 'outgoing',
            },
            'invoices': {
                'related_model': ('tenant_apps.invoices', 'Invoice'),
                'field': 'customer',
                'reverse': True,
                'label': 'Invoices',
                'direction': 'outgoing',
            },
        },
    },
    'purchase_order': {
        'model': ('tenant_apps.purchase_orders', 'PurchaseOrder'),
        'relationships': {
            'supplier': {
                'related_model': ('tenant_apps.suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
            'line_items': {
                'related_model': ('tenant_apps.purchase_orders', 'PurchaseOrderLine'),
                'field': 'purchase_order',
                'reverse': True,
                'label': 'Line Items',
                'direction': 'outgoing',
            },
        },
    },
    'sales_order': {
        'model': ('tenant_apps.sales_orders', 'SalesOrder'),
        'relationships': {
            'customer': {
                'related_model': ('tenant_apps.customers', 'Customer'),
                'field': 'customer',
                'reverse': False,
                'label': 'Customer',
                'direction': 'incoming',
            },
            'line_items': {
                'related_model': ('tenant_apps.sales_orders', 'SalesOrderLine'),
                'field': 'sales_order',
                'reverse': True,
                'label': 'Line Items',
                'direction': 'outgoing',
            },
            'fulfillments': {
                'related_model': ('tenant_apps.fulfillments', 'Fulfillment'),
                'field': 'sales_order',
                'reverse': True,
                'label': 'Fulfillments',
                'direction': 'outgoing',
            },
        },
    },
    'product': {
        'model': ('tenant_apps.products', 'Product'),
        'relationships': {
            'supplier': {
                'related_model': ('tenant_apps.suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
        },
    },
    'contact': {
        'model': ('tenant_apps.contacts', 'Contact'),
        'relationships': {
            'supplier': {
                'related_model': ('tenant_apps.suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
            'customer': {
                'related_model': ('tenant_apps.customers', 'Customer'),
                'field': 'customer',
                'reverse': False,
                'label': 'Customer',
                'direction': 'incoming',
            },
        },
    },
    'invoice': {
        'model': ('tenant_apps.invoices', 'Invoice'),
        'relationships': {
            'customer': {
                'related_model': ('tenant_apps.customers', 'Customer'),
                'field': 'customer',
                'reverse': False,
                'label': 'Customer',
                'direction': 'incoming',
            },
            'payments': {
                'related_model': ('tenant_apps.invoices', 'PaymentTransaction'),
                'field': 'invoice',
                'reverse': True,
                'label': 'Payments',
                'direction': 'outgoing',
            },
        },
    },
    'plant': {
        'model': ('tenant_apps.plants', 'Plant'),
        'relationships': {
            'supplier': {
                'related_model': ('tenant_apps.suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
        },
    },
    'carrier': {
        'model': ('tenant_apps.carriers', 'Carrier'),
        'relationships': {
            'contacts': {
                'related_model': ('tenant_apps.contacts', 'Contact'),
                'field': 'carrier',
                'reverse': True,
                'label': 'Contacts',
                'direction': 'outgoing',
            },
        },
    },
}

# Visual configuration for entity types
ENTITY_VISUALS = {
    'supplier': {'icon': 'Building2', 'color': '#3b82f6'},
    'customer': {'icon': 'Users', 'color': '#10b981'},
    'purchase_order': {'icon': 'ShoppingCart', 'color': '#f59e0b'},
    'sales_order': {'icon': 'Receipt', 'color': '#8b5cf6'},
    'product': {'icon': 'Package', 'color': '#ec4899'},
    'contact': {'icon': 'User', 'color': '#06b6d4'},
    'invoice': {'icon': 'FileText', 'color': '#14b8a6'},
    'plant': {'icon': 'Factory', 'color': '#f97316'},
    'carrier': {'icon': 'Truck', 'color': '#6366f1'},
    'line_item': {'icon': 'List', 'color': '#6b7280'},
    'fulfillment': {'icon': 'Package', 'color': '#22c55e'},
    'payment': {'icon': 'CreditCard', 'color': '#eab308'},
}


class EntityGraphService:
    """
    Service for discovering and traversing entity relationships.
    
    Usage:
        service = EntityGraphService(tenant=request.tenant)
        entity = service.get_entity('supplier', 123)
        relationships = service.get_relationships('supplier', 123)
        graph = service.get_entity_graph('supplier', 123, depth=2)
    """
    
    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self._model_cache = {}
    
    def _get_model(self, app_model: Tuple[str, str]):
        """Lazy load and cache model classes."""
        cache_key = f"{app_model[0]}.{app_model[1]}"
        if cache_key not in self._model_cache:
            try:
                self._model_cache[cache_key] = apps.get_model(app_model[0], app_model[1])
            except LookupError:
                logger.warning(f"Model not found: {cache_key}")
                return None
        return self._model_cache[cache_key]
    
    def _get_display_name(self, obj, entity_type: str) -> str:
        """Get display name for an entity."""
        # Try common name fields
        for field in ['name', 'title', 'order_number', 'invoice_number']:
            if hasattr(obj, field):
                value = getattr(obj, field)
                if value:
                    return str(value)
        
        # Special case for contacts
        if entity_type == 'contact':
            first = getattr(obj, 'first_name', '')
            last = getattr(obj, 'last_name', '')
            if first or last:
                return f"{first} {last}".strip()
        
        return str(obj)
    
    def get_entity(self, entity_type: str, entity_id: int) -> Optional[Dict[str, Any]]:
        """
        Get entity details by type and ID.
        
        Returns entity data with visual metadata.
        """
        config = ENTITY_RELATIONSHIPS.get(entity_type)
        if not config:
            return None
        
        Model = self._get_model(config['model'])
        if not Model:
            return None
        
        try:
            obj = Model.objects.filter(tenant=self.tenant, id=entity_id).first()
            if not obj:
                return None
            
            visuals = ENTITY_VISUALS.get(entity_type, {})
            
            return {
                'id': obj.id,
                'type': entity_type,
                'name': self._get_display_name(obj, entity_type),
                'icon': visuals.get('icon', 'File'),
                'color': visuals.get('color', '#6b7280'),
                'created_on': getattr(obj, 'created_on', None),
                'updated_on': getattr(obj, 'updated_on', None),
            }
        except Exception as e:
            logger.error(f"Error getting entity {entity_type}/{entity_id}: {e}")
            return None
    
    def get_relationships(
        self, 
        entity_type: str, 
        entity_id: int,
        include_counts: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get all relationships for an entity.
        
        Returns list of relationship types with counts and sample data.
        """
        config = ENTITY_RELATIONSHIPS.get(entity_type)
        if not config:
            return []
        
        Model = self._get_model(config['model'])
        if not Model:
            return []
        
        try:
            obj = Model.objects.filter(tenant=self.tenant, id=entity_id).first()
            if not obj:
                return []
            
            relationships = []
            
            for rel_name, rel_config in config.get('relationships', {}).items():
                RelatedModel = self._get_model(rel_config['related_model'])
                if not RelatedModel:
                    continue
                
                # Get related objects
                if rel_config['reverse']:
                    # Reverse relationship (e.g., supplier.purchase_orders)
                    filter_kwargs = {rel_config['field']: obj}
                    if hasattr(RelatedModel, 'tenant'):
                        filter_kwargs['tenant'] = self.tenant
                    related_qs = RelatedModel.objects.filter(**filter_kwargs)
                else:
                    # Forward relationship (e.g., purchase_order.supplier)
                    related_obj = getattr(obj, rel_config['field'], None)
                    if related_obj:
                        related_qs = RelatedModel.objects.filter(
                            tenant=self.tenant, 
                            id=related_obj.id
                        )
                    else:
                        related_qs = RelatedModel.objects.none()
                
                count = related_qs.count() if include_counts else None
                
                # Get sample items (first 3)
                samples = []
                for related_obj in related_qs[:3]:
                    # Determine related entity type
                    related_type = rel_name.rstrip('s')  # Simple pluralization
                    if related_type == 'line_item':
                        related_type = 'line_item'
                    elif related_type == 'purchase_order':
                        related_type = 'purchase_order'
                    elif related_type == 'sales_order':
                        related_type = 'sales_order'
                    
                    visuals = ENTITY_VISUALS.get(related_type, {})
                    samples.append({
                        'id': related_obj.id,
                        'name': self._get_display_name(related_obj, related_type),
                        'icon': visuals.get('icon', 'File'),
                        'color': visuals.get('color', '#6b7280'),
                    })
                
                relationships.append({
                    'name': rel_name,
                    'label': rel_config['label'],
                    'direction': rel_config['direction'],
                    'count': count,
                    'samples': samples,
                    'entity_type': rel_name.rstrip('s'),
                })
            
            return relationships
            
        except Exception as e:
            logger.error(f"Error getting relationships for {entity_type}/{entity_id}: {e}")
            return []
    
    def get_related_entities(
        self,
        entity_type: str,
        entity_id: int,
        relationship_name: str,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get paginated related entities for a specific relationship.
        """
        config = ENTITY_RELATIONSHIPS.get(entity_type)
        if not config:
            return {'items': [], 'total': 0}
        
        rel_config = config.get('relationships', {}).get(relationship_name)
        if not rel_config:
            return {'items': [], 'total': 0}
        
        Model = self._get_model(config['model'])
        RelatedModel = self._get_model(rel_config['related_model'])
        if not Model or not RelatedModel:
            return {'items': [], 'total': 0}
        
        try:
            obj = Model.objects.filter(tenant=self.tenant, id=entity_id).first()
            if not obj:
                return {'items': [], 'total': 0}
            
            # Get related queryset
            if rel_config['reverse']:
                filter_kwargs = {rel_config['field']: obj}
                if hasattr(RelatedModel, 'tenant'):
                    filter_kwargs['tenant'] = self.tenant
                related_qs = RelatedModel.objects.filter(**filter_kwargs)
            else:
                related_obj = getattr(obj, rel_config['field'], None)
                if related_obj:
                    related_qs = RelatedModel.objects.filter(
                        tenant=self.tenant, 
                        id=related_obj.id
                    )
                else:
                    related_qs = RelatedModel.objects.none()
            
            total = related_qs.count()
            items = []
            
            related_type = relationship_name.rstrip('s')
            visuals = ENTITY_VISUALS.get(related_type, {})
            
            for related_obj in related_qs[offset:offset + limit]:
                items.append({
                    'id': related_obj.id,
                    'type': related_type,
                    'name': self._get_display_name(related_obj, related_type),
                    'icon': visuals.get('icon', 'File'),
                    'color': visuals.get('color', '#6b7280'),
                })
            
            return {
                'items': items,
                'total': total,
                'limit': limit,
                'offset': offset,
            }
            
        except Exception as e:
            logger.error(f"Error getting related entities: {e}")
            return {'items': [], 'total': 0}
    
    def get_entity_graph(
        self,
        entity_type: str,
        entity_id: int,
        depth: int = 1,
        max_nodes: int = 50
    ) -> Dict[str, Any]:
        """
        Get a graph of entities starting from a root entity.
        
        Returns nodes and edges suitable for visualization.
        
        Args:
            entity_type: Root entity type
            entity_id: Root entity ID
            depth: How many levels of relationships to traverse (1-3)
            max_nodes: Maximum nodes to return
        """
        depth = min(max(depth, 1), 3)  # Clamp to 1-3
        
        nodes = []
        edges = []
        visited: Set[str] = set()
        
        def add_node(etype: str, eid: int, level: int) -> Optional[str]:
            """Add a node if not already visited."""
            node_id = f"{etype}:{eid}"
            if node_id in visited or len(nodes) >= max_nodes:
                return node_id if node_id in visited else None
            
            entity = self.get_entity(etype, eid)
            if not entity:
                return None
            
            visited.add(node_id)
            nodes.append({
                'id': node_id,
                'entity_id': eid,
                'entity_type': etype,
                'label': entity['name'],
                'icon': entity['icon'],
                'color': entity['color'],
                'level': level,
            })
            return node_id
        
        def traverse(etype: str, eid: int, current_depth: int):
            """Recursively traverse relationships."""
            if current_depth > depth or len(nodes) >= max_nodes:
                return
            
            source_id = add_node(etype, eid, current_depth)
            if not source_id:
                return
            
            relationships = self.get_relationships(etype, eid, include_counts=False)
            
            for rel in relationships:
                for sample in rel.get('samples', []):
                    if len(nodes) >= max_nodes:
                        break
                    
                    target_type = rel['entity_type']
                    target_id = sample['id']
                    target_node_id = f"{target_type}:{target_id}"
                    
                    # Add target node
                    actual_target_id = add_node(target_type, target_id, current_depth + 1)
                    if actual_target_id:
                        # Add edge
                        edge_id = f"{source_id}->{actual_target_id}"
                        if rel['direction'] == 'incoming':
                            edge_id = f"{actual_target_id}->{source_id}"
                        
                        edges.append({
                            'id': edge_id,
                            'source': source_id if rel['direction'] == 'outgoing' else actual_target_id,
                            'target': actual_target_id if rel['direction'] == 'outgoing' else source_id,
                            'label': rel['label'],
                            'relationship': rel['name'],
                        })
                        
                        # Recurse if not at max depth
                        if current_depth + 1 < depth:
                            traverse(target_type, target_id, current_depth + 1)
        
        # Start traversal from root
        traverse(entity_type, entity_id, 0)
        
        return {
            'root': f"{entity_type}:{entity_id}",
            'nodes': nodes,
            'edges': edges,
            'depth': depth,
            'truncated': len(nodes) >= max_nodes,
        }
    
    @staticmethod
    def get_supported_entity_types() -> List[str]:
        """Get list of entity types that support graph traversal."""
        return list(ENTITY_RELATIONSHIPS.keys())
    
    @staticmethod
    def get_entity_visuals(entity_type: str) -> Dict[str, str]:
        """Get visual configuration for an entity type."""
        return ENTITY_VISUALS.get(entity_type, {'icon': 'File', 'color': '#6b7280'})

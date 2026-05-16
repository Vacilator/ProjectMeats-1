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
from django.apps import apps

from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


# Entity relationship configuration
# NOTE: app labels must match Django AppConfig.label (e.g., 'suppliers', not 'tenant_apps.suppliers').
ENTITY_RELATIONSHIPS = {
    'supplier': {
        'model': ('suppliers', 'Supplier'),
        'relationships': {
            'purchase_orders': {
                'related_model': ('purchase_orders', 'PurchaseOrder'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Purchase Orders',
                'direction': 'outgoing',
            },
            'recent_orders': {
                # Cockpit UX alias: show supplier order history in a single panel.
                'related_model': ('purchase_orders', 'PurchaseOrder'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Recent Orders',
                'direction': 'outgoing',
                'entity_type': 'purchase_order',
            },
            'contacts': {
                # Contacts are associated via Supplier.contacts M2M in the primary UI,
                # but we also support legacy Contact.supplier FK.
                'computed': 'supplier_contacts',
                'related_model': ('contacts', 'Contact'),
                'label': 'Contacts',
                'direction': 'outgoing',
                'entity_type': 'contact',
            },
            'plants': {
                'related_model': ('plants', 'Plant'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Plants',
                'direction': 'outgoing',
            },
            'locations': {
                # Cockpit detail view calls this relationship for both customers + suppliers.
                'related_model': ('locations', 'Location'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Locations',
                'direction': 'outgoing',
                'entity_type': 'location',
            },
            'inquiries': {
                'related_model': ('inquiries', 'Inquiry'),
                'field': 'supplier',
                'reverse': True,
                'label': 'Inquiries',
                'direction': 'outgoing',
                'entity_type': 'inquiry',
            },
            'products': {
                # Cockpit detail view calls this relationship name.
                'computed': 'supplier_related_products',
                'related_model': ('system', 'Product'),
                'label': 'Products',
                'direction': 'outgoing',
                'entity_type': 'product',
            },
            'related_products': {
                # Back-compat: older UI uses this label.
                'computed': 'supplier_related_products',
                'related_model': ('system', 'Product'),
                'label': 'Related Products',
                'direction': 'outgoing',
                'entity_type': 'product',
            },
        },
    },
    'customer': {
        'model': ('customers', 'Customer'),
        'relationships': {
            'sales_orders': {
                'related_model': ('sales_orders', 'SalesOrder'),
                'field': 'customer',
                'reverse': True,
                'label': 'Sales Orders',
                'direction': 'outgoing',
            },
            'recent_orders': {
                # Cockpit UX alias: customer "recent orders" are SalesOrders.
                'related_model': ('sales_orders', 'SalesOrder'),
                'field': 'customer',
                'reverse': True,
                'label': 'Recent Orders',
                'direction': 'outgoing',
                'entity_type': 'sales_order',
            },
            'contacts': {
                # Contacts are associated via Customer.contacts M2M in the primary UI,
                # but we also support legacy Contact.customer FK.
                'computed': 'customer_contacts',
                'related_model': ('contacts', 'Contact'),
                'label': 'Contacts',
                'direction': 'outgoing',
                'entity_type': 'contact',
            },
            'invoices': {
                'related_model': ('invoices', 'Invoice'),
                'field': 'customer',
                'reverse': True,
                'label': 'Invoices',
                'direction': 'outgoing',
            },
            'locations': {
                'related_model': ('locations', 'Location'),
                'field': 'customer',
                'reverse': True,
                'label': 'Locations',
                'direction': 'outgoing',
                'entity_type': 'location',
            },
            'inquiries': {
                'related_model': ('inquiries', 'Inquiry'),
                'field': 'customer',
                'reverse': True,
                'label': 'Inquiries',
                'direction': 'outgoing',
                'entity_type': 'inquiry',
            },
            'products': {
                # Cockpit detail view calls this relationship name.
                'computed': 'customer_related_products',
                'related_model': ('system', 'Product'),
                'label': 'Products',
                'direction': 'outgoing',
                'entity_type': 'product',
            },
            'related_products': {
                # Back-compat: older UI uses this label.
                'computed': 'customer_related_products',
                'related_model': ('system', 'Product'),
                'label': 'Related Products',
                'direction': 'outgoing',
                'entity_type': 'product',
            },
        },
    },
    'purchase_order': {
        'model': ('purchase_orders', 'PurchaseOrder'),
        'relationships': {
            'supplier': {
                'related_model': ('suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
            'product': {
                'related_model': ('system', 'Product'),
                'field': 'product',
                'reverse': False,
                'label': 'Product',
                'direction': 'outgoing',
            },
        },
    },
    'sales_order': {
        'model': ('sales_orders', 'SalesOrder'),
        'relationships': {
            'customer': {
                'related_model': ('customers', 'Customer'),
                'field': 'customer',
                'reverse': False,
                'label': 'Customer',
                'direction': 'incoming',
            },
            'supplier': {
                'related_model': ('suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
            'product': {
                'related_model': ('system', 'Product'),
                'field': 'product',
                'reverse': False,
                'label': 'Product',
                'direction': 'outgoing',
            },
            'contact': {
                'related_model': ('contacts', 'Contact'),
                'field': 'contact',
                'reverse': False,
                'label': 'Contact',
                'direction': 'incoming',
            },
            'fulfillments': {
                'related_model': ('fulfillments', 'Fulfillment'),
                'field': 'sales_order',
                'reverse': True,
                'label': 'Fulfillments',
                'direction': 'outgoing',
            },
        },
    },
    'product': {
        'model': ('system', 'Product'),
        'relationships': {},
    },
    'contact': {
        'model': ('contacts', 'Contact'),
        'relationships': {
            'supplier': {
                'related_model': ('suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
            },
            'customer': {
                'related_model': ('customers', 'Customer'),
                'field': 'customer',
                'reverse': False,
                'label': 'Customer',
                'direction': 'incoming',
            },
        },
    },
    'invoice': {
        'model': ('invoices', 'Invoice'),
        'relationships': {
            'customer': {
                'related_model': ('customers', 'Customer'),
                'field': 'customer',
                'reverse': False,
                'label': 'Customer',
                'direction': 'incoming',
            },
            'payments': {
                'related_model': ('invoices', 'PaymentTransaction'),
                'field': 'invoice',
                'reverse': True,
                'label': 'Payments',
                'direction': 'outgoing',
            },
        },
    },
    'plant': {
        'model': ('plants', 'Plant'),
        'relationships': {
            'supplier': {
                'related_model': ('suppliers', 'Supplier'),
                'field': 'supplier',
                'reverse': False,
                'label': 'Supplier',
                'direction': 'incoming',
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
    'location': {'icon': 'MapPin', 'color': '#f97316'},
    'inquiry': {'icon': 'ClipboardList', 'color': '#0ea5e9'},
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
        for field in ['name', 'title', 'product_code', 'order_number', 'our_sales_order_num', 'invoice_number']:
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

    def _order_queryset_recent_first(self, qs):
        """Order a queryset by the most reliable "recent" timestamp available."""
        model = getattr(qs, 'model', None)
        if not model:
            return qs

        candidates = [
            'modified_on',
            'updated_at',
            'created_on',
            'created_at',
            'date_time_stamp',
            'date_time_stamp_created',
        ]
        field_names = {f.name for f in model._meta.get_fields() if hasattr(f, 'name')}
        for name in candidates:
            if name in field_names:
                return qs.order_by(f'-{name}')
        return qs

    def _get_computed_relationship_qs(self, computed: str, obj):
        """Return a queryset for computed relationships.

        Computed relationships are used when there is no direct FK to traverse
        (e.g., system-wide Product related via tenant orders).
        """
        if computed == 'supplier_related_products':
            return self._get_related_products_for_supplier(obj)
        if computed == 'customer_related_products':
            return self._get_related_products_for_customer(obj)
        if computed == 'supplier_contacts':
            return self._get_related_contacts_for_supplier(obj)
        if computed == 'customer_contacts':
            return self._get_related_contacts_for_customer(obj)
        logger.warning(f"Unknown computed relationship: {computed}")
        Product = self._get_model(('system', 'Product'))
        return Product.objects.none() if Product else []

    def _get_related_products_for_supplier(self, supplier):
        Product = self._get_model(('system', 'Product'))
        PurchaseOrder = self._get_model(('purchase_orders', 'PurchaseOrder'))
        if not Product:
            return []

        qs = Product.objects.none()

        # 1) Direct M2M association (preferred, matches Supplier UI)
        try:
            supplier_products = getattr(supplier, 'products', None)
            if supplier_products is not None:
                qs = qs | supplier_products.all()
        except Exception as e:
            logger.debug(f"supplier.products M2M lookup failed: {e}")

        # 2) Order-derived association (fallback / extra signal)
        if PurchaseOrder:
            try:
                product_ids = (
                    PurchaseOrder.objects.filter(tenant=self.tenant, supplier=supplier)
                    .exclude(product__isnull=True)
                    .values_list('product_id', flat=True)
                    .distinct()
                )
                qs = qs | Product.objects.filter(id__in=product_ids)
            except Exception as e:
                logger.warning(f"Failed to compute supplier related products from orders: {e}")

        return qs.distinct()

    def _get_related_contacts_for_supplier(self, supplier):
        Contact = self._get_model(('contacts', 'Contact'))
        if not Contact:
            return []

        qs = Contact.objects.none()

        # 1) Direct M2M association (preferred, matches Supplier UI)
        try:
            supplier_contacts = getattr(supplier, 'contacts', None)
            if supplier_contacts is not None:
                qs = qs | supplier_contacts.all()
        except Exception as e:
            logger.debug(f"supplier.contacts M2M lookup failed: {e}")

        # 2) Legacy FK association (Contact.supplier)
        try:
            qs = qs | Contact.objects.filter(tenant=self.tenant, supplier=supplier)
        except Exception as e:
            logger.debug(f"Contact.supplier FK lookup failed: {e}")

        return qs.filter(tenant=self.tenant).distinct()

    def _get_related_contacts_for_customer(self, customer):
        Contact = self._get_model(('contacts', 'Contact'))
        if not Contact:
            return []

        qs = Contact.objects.none()

        # 1) Direct M2M association (preferred, matches Customer UI)
        try:
            customer_contacts = getattr(customer, 'contacts', None)
            if customer_contacts is not None:
                qs = qs | customer_contacts.all()
        except Exception as e:
            logger.debug(f"customer.contacts M2M lookup failed: {e}")

        # 2) Legacy FK association (Contact.customer)
        try:
            qs = qs | Contact.objects.filter(tenant=self.tenant, customer=customer)
        except Exception as e:
            logger.debug(f"Contact.customer FK lookup failed: {e}")

        return qs.filter(tenant=self.tenant).distinct()

    def _get_related_products_for_customer(self, customer):
        Product = self._get_model(('system', 'Product'))
        SalesOrder = self._get_model(('sales_orders', 'SalesOrder'))
        if not Product:
            return []

        qs = Product.objects.none()

        # 1) Direct M2M association (preferred, matches Customer UI)
        try:
            customer_products = getattr(customer, 'products', None)
            if customer_products is not None:
                qs = qs | customer_products.all()
        except Exception as e:
            logger.debug(f"customer.products M2M lookup failed: {e}")

        # 2) Order-derived association (fallback / extra signal)
        if SalesOrder:
            try:
                product_ids = (
                    SalesOrder.objects.filter(tenant=self.tenant, customer=customer)
                    .exclude(product__isnull=True)
                    .values_list('product_id', flat=True)
                    .distinct()
                )
                qs = qs | Product.objects.filter(id__in=product_ids)
            except Exception as e:
                logger.warning(f"Failed to compute customer related products from orders: {e}")

        return qs.distinct()
    
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
            base_qs = Model.objects.all()
            if hasattr(Model, 'tenant'):
                base_qs = base_qs.filter(tenant=self.tenant)
            obj = base_qs.filter(id=entity_id).first()
            if not obj:
                return None
            
            visuals = ENTITY_VISUALS.get(entity_type, {})
            
            return {
                'id': obj.id,
                'type': entity_type,
                'name': self._get_display_name(obj, entity_type),
                'icon': visuals.get('icon', 'File'),
                'color': visuals.get('color', '#6b7280'),
                'created_on': getattr(obj, 'created_on', None) or getattr(obj, 'created_at', None),
                'updated_on': getattr(obj, 'modified_on', None) or getattr(obj, 'updated_at', None),
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
            base_qs = Model.objects.all()
            if hasattr(Model, 'tenant'):
                base_qs = base_qs.filter(tenant=self.tenant)
            obj = base_qs.filter(id=entity_id).first()
            if not obj:
                return []
            
            relationships: List[Dict[str, Any]] = []
            
            for rel_name, rel_config in config.get('relationships', {}).items():
                try:
                    RelatedModel = (
                        self._get_model(rel_config.get('related_model')) if rel_config.get('related_model') else None
                    )
                    if rel_config.get('computed'):
                        related_qs = self._get_computed_relationship_qs(rel_config['computed'], obj)
                        related_type = (
                            rel_config.get('entity_type')
                            or ('product' if rel_name == 'related_products' else rel_name.rstrip('s'))
                        )
                    else:
                        if not RelatedModel:
                            continue
                        # Get related objects
                        if rel_config.get('reverse'):
                            # Reverse relationship (e.g., supplier.purchase_orders)
                            filter_kwargs = {rel_config['field']: obj}
                            if hasattr(RelatedModel, 'tenant'):
                                filter_kwargs['tenant'] = self.tenant
                            related_qs = RelatedModel.objects.filter(**filter_kwargs)
                        else:
                            # Forward relationship (e.g., purchase_order.supplier)
                            related_obj = getattr(obj, rel_config['field'], None)
                            if related_obj:
                                rel_base_qs = RelatedModel.objects.all()
                                if hasattr(RelatedModel, 'tenant'):
                                    rel_base_qs = rel_base_qs.filter(tenant=self.tenant)
                                related_qs = rel_base_qs.filter(id=related_obj.id)
                            else:
                                related_qs = RelatedModel.objects.none()
                        related_type = rel_config.get('entity_type') or rel_name.rstrip('s')

                    # Prefer "recent-first" ordering when possible.
                    try:
                        related_qs = self._order_queryset_recent_first(related_qs)
                    except Exception:
                        logger.debug("Non-critical exception suppressed", exc_info=True)

                    count = related_qs.count() if include_counts else None

                    # Get sample items (first 3)
                    samples: List[Dict[str, Any]] = []
                    visuals = ENTITY_VISUALS.get(related_type, {})
                    for related_obj in related_qs[:3]:
                        samples.append(
                            {
                                'id': related_obj.id,
                                'name': self._get_display_name(related_obj, related_type),
                                'icon': visuals.get('icon', 'File'),
                                'color': visuals.get('color', '#6b7280'),
                            }
                        )

                    relationships.append(
                        {
                            'name': rel_name,
                            'label': rel_config['label'],
                            'direction': rel_config['direction'],
                            'count': count,
                            'samples': samples,
                            'entity_type': related_type,
                        }
                    )
                except Exception as e:
                    # Never let a single misconfigured relationship wipe the entire panel.
                    logger.warning(
                        f"Error computing relationship '{rel_name}' for {entity_type}/{entity_id}: {e}"
                    )
                    continue
            
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
        RelatedModel = self._get_model(rel_config.get('related_model')) if rel_config.get('related_model') else None
        if not Model:
            return {'items': [], 'total': 0}
        
        try:
            base_qs = Model.objects.all()
            if hasattr(Model, 'tenant'):
                base_qs = base_qs.filter(tenant=self.tenant)
            obj = base_qs.filter(id=entity_id).first()
            if not obj:
                return {'items': [], 'total': 0}
            
            # Get related queryset
            if rel_config.get('computed'):
                related_qs = self._get_computed_relationship_qs(rel_config['computed'], obj)
                related_type = (
                    rel_config.get('entity_type')
                    or ('product' if relationship_name == 'related_products' else relationship_name.rstrip('s'))
                )
            else:
                if not RelatedModel:
                    return {'items': [], 'total': 0}
                if rel_config.get('reverse'):
                    filter_kwargs = {rel_config['field']: obj}
                    if hasattr(RelatedModel, 'tenant'):
                        filter_kwargs['tenant'] = self.tenant
                    related_qs = RelatedModel.objects.filter(**filter_kwargs)
                else:
                    related_obj = getattr(obj, rel_config['field'], None)
                    if related_obj:
                        rel_base_qs = RelatedModel.objects.all()
                        if hasattr(RelatedModel, 'tenant'):
                            rel_base_qs = rel_base_qs.filter(tenant=self.tenant)
                        related_qs = rel_base_qs.filter(id=related_obj.id)
                    else:
                        related_qs = RelatedModel.objects.none()
                related_type = rel_config.get('entity_type') or relationship_name.rstrip('s')

            try:
                related_qs = self._order_queryset_recent_first(related_qs)
            except Exception:
                logger.debug("Non-critical exception suppressed", exc_info=True)

            total = related_qs.count()
            items: List[Dict[str, Any]] = []
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

"""
Universal Search Service for ProjectMeats Cockpit/Workspace.

Provides cross-entity search with:
- Multi-model search (suppliers, customers, POs, SOs, etc.)
- Search operators (supplier:, customer:, po:, so:, @user)
- Relevance ranking
- Recent items tracking
- Tenant isolation

Part of Wave 2: Cockpit Command Center implementation.
"""
import re
import logging
from datetime import timedelta
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional, Tuple
from django.db.models import Q
from django.core.cache import cache
from django.contrib.auth.models import User
from django.utils import timezone

from apps.core.caching import CacheService
from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


# Entity type configuration for universal search
SEARCHABLE_ENTITIES = {
    'supplier': {
        'app': 'suppliers',
        'model': 'Supplier',
        'search_fields': ['name', 'contact_person', 'email', 'phone'],
        'display_field': 'name',
        'icon': 'Building2',
        'color': '#3b82f6',  # blue
        'route': '/suppliers/{id}',
        'operators': ['supplier:', 's:'],
    },
    'customer': {
        'app': 'customers',
        'model': 'Customer',
        'search_fields': ['name', 'contact_person', 'email', 'phone'],
        'display_field': 'name',
        'icon': 'Users',
        'color': '#10b981',  # green
        'route': '/customers/{id}',
        'operators': ['customer:', 'c:'],
    },
    'purchase_order': {
        'app': 'purchase_orders',
        'model': 'PurchaseOrder',
        'search_fields': ['order_number', 'our_purchase_order_num', 'notes'],
        'display_field': 'order_number',
        'icon': 'ShoppingCart',
        'color': '#f59e0b',  # amber
        'route': '/purchase-orders/{id}',
        'operators': ['po:', 'purchase:'],
        'related_display': 'supplier__name',
    },
    'sales_order': {
        'app': 'sales_orders',
        'model': 'SalesOrder',
        'search_fields': ['our_sales_order_num', 'delivery_po_num', 'notes'],
        'display_field': 'our_sales_order_num',
        'icon': 'Receipt',
        'color': '#8b5cf6',  # violet
        'route': '/sales-orders/{id}',
        'operators': ['so:', 'sales:'],
        'related_display': 'customer__name',
    },
    'product': {
        # Products are system-wide (tenantless) after Phase 3 deduplication.
        'app': 'system',
        'model': 'Product',
        'search_fields': ['product_code', 'name', 'description', 'protein_type'],
        'display_field': 'product_code',
        'icon': 'Package',
        'color': '#ec4899',  # pink
        'route': '/products/{id}',
        'operators': ['product:', 'p:'],
    },
    'contact': {
        'app': 'contacts',
        'model': 'Contact',
        'search_fields': ['first_name', 'last_name', 'email', 'phone'],
        'display_field': 'full_name',  # Computed
        'icon': 'User',
        'color': '#06b6d4',  # cyan
        'route': '/contacts/{id}',
        'operators': ['contact:', '@'],
    },
    'invoice': {
        'app': 'invoices',
        'model': 'Invoice',
        'search_fields': ['invoice_number', 'notes'],
        'display_field': 'invoice_number',
        'icon': 'FileText',
        'color': '#14b8a6',  # teal
        'route': '/accounting/receivables/invoices/{id}',
        'operators': ['invoice:', 'inv:'],
        'related_display': 'customer__name',
    },
    'plant': {
        'app': 'plants',
        'model': 'Plant',
        'search_fields': ['name', 'plant_est_num', 'city'],
        'display_field': 'name',
        'icon': 'Factory',
        'color': '#f97316',  # orange
        'route': '/plants/{id}',
        'operators': ['plant:'],
    },
    'carrier': {
        'app': 'carriers',
        'model': 'Carrier',
        'search_fields': ['name', 'mc_number', 'dot_number'],
        'display_field': 'name',
        'icon': 'Truck',
        'color': '#6366f1',  # indigo
        'route': '/carriers/{id}',
        'operators': ['carrier:'],
    },
    'inquiry': {
        'app': 'inquiries',
        'model': 'Inquiry',
        'search_fields': ['inquiry_number', 'notes', 'contact_name', 'contact_company', 'contact_email', 'contact_phone'],
        'display_field': 'inquiry_number',
        'icon': 'FileText',
        'color': '#ef4444',  # red
        'route': '/inquiries/{id}',
        'operators': ['inquiry:', 'inq:'],
        'related_display': ['customer__name', 'supplier__name'],
    },
    'claim': {
        'app': 'invoices',
        'model': 'Claim',
        'search_fields': ['claim_number', 'reason', 'description'],
        'display_field': 'claim_number',
        'icon': 'AlertTriangle',
        'color': '#f97316',  # orange
        'route': '/accounting/claims/{id}',
        'operators': ['claim:', 'clm:'],
        'related_display': ['invoice__invoice_number', 'supplier__name', 'customer__name'],
    },
    'call': {
        'app': 'cockpit',
        'model': 'ScheduledCall',
        'search_fields': ['title', 'description'],
        'display_field': 'title',
        'icon': 'PhoneCall',
        'color': '#06b6d4',  # cyan
        'route': '/cockpit',
        'operators': ['call:'],
        'related_display': 'scheduled_for',
    },
    'tenant_user': {
        'app': 'tenants',
        'model': 'TenantUser',
        'search_fields': ['user__username', 'user__email', 'user__first_name', 'user__last_name', 'role'],
        'display_field': 'user__username',
        'icon': 'User',
        'color': '#64748b',  # slate
        'route': '/admin/users',
        'operators': ['user:', 'u:', 'tenant-user:'],
        'related_display': 'role',
    },
}


class UniversalSearchService:
    """
    Cross-entity search service with operator support.
    
    Usage:
        service = UniversalSearchService(tenant=request.tenant)
        results = service.search("beef supplier:ABC")
        
    Operators:
        - supplier:, s: - Search only suppliers
        - customer:, c: - Search only customers
        - po:, purchase: - Search only purchase orders
        - so:, sales: - Search only sales orders
        - product:, p: - Search only products
        - contact:, @ - Search only contacts
        - invoice:, inv: - Search only invoices
        - plant: - Search only plants
        - carrier: - Search only carriers
    """
    
    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self._model_cache = {}
    
    def _get_model(self, entity_type: str):
        """Lazy load and cache model classes."""
        if entity_type not in self._model_cache:
            config = SEARCHABLE_ENTITIES.get(entity_type)
            if not config:
                return None
            
            try:
                from django.apps import apps
                self._model_cache[entity_type] = apps.get_model(
                    config['app'], 
                    config['model']
                )
            except LookupError:
                logger.warning(f"Model not found: {config['app']}.{config['model']}")
                return None
        
        return self._model_cache[entity_type]
    
    def _parse_query(self, query: str) -> Tuple[str, Optional[str]]:
        """Parse query for operators and return (search_text, entity_type).

        Examples:
            "beef supplier:ABC" -> ("beef ABC", "supplier")
            "po:1234" -> ("1234", "purchase_order")
            "@john" -> ("john", "contact")
            "purchase" -> ("", "purchase_order")
        """
        query = query.strip()
        lower = query.lower()

        # If the query is basically an entity name, treat it like a type filter.
        type_aliases = {
            'purchase': 'purchase_order',
            'purchase order': 'purchase_order',
            'purchase orders': 'purchase_order',
            'po': 'purchase_order',
            'sales': 'sales_order',
            'sales order': 'sales_order',
            'sales orders': 'sales_order',
            'so': 'sales_order',
            'invoice': 'invoice',
            'invoices': 'invoice',
            'inquiry': 'inquiry',
            'inquiries': 'inquiry',
            'claim': 'claim',
            'claims': 'claim',
            'call': 'call',
            'calls': 'call',
            'user': 'tenant_user',
            'users': 'tenant_user',
            'tenant user': 'tenant_user',
            'tenant users': 'tenant_user',
        }

        if lower in type_aliases:
            return '', type_aliases[lower]

        # Check for explicit operators
        for entity_type, config in SEARCHABLE_ENTITIES.items():
            for operator in config.get('operators', []):
                pattern = rf'{re.escape(operator)}(\S+)'
                match = re.search(pattern, query, re.IGNORECASE)
                if match:
                    operator_value = match.group(1)
                    remaining = re.sub(pattern, '', query, flags=re.IGNORECASE).strip()
                    search_text = f"{remaining} {operator_value}".strip()
                    return search_text, entity_type

        return query, None
    
    def _build_query_filter(self, search_text: str, search_fields: List[str]) -> Q:
        """Build Q filter for search across multiple fields with fuzzy tolerance."""
        if not search_text:
            return Q()
        
        terms = search_text.split()
        combined = Q()
        
        for term in terms:
            term_filter = Q()
            for field in search_fields:
                term_filter |= Q(**{f'{field}__icontains': term})
            combined &= term_filter
        
        return combined

    def _build_fuzzy_query_filter(
        self, search_text: str, search_fields: List[str]
    ) -> Q:
        """Build an expanded Q filter that tolerates common single-char typos.

        For short search terms (≤ 8 chars) we generate single-char-deleted
        variants so that ``icontains`` can match despite a typo.  For longer
        terms we fall back to the standard exact ``icontains`` match only –
        the substring overlap is usually enough.
        """
        if not search_text:
            return Q()

        terms = search_text.split()
        combined = Q()

        for term in terms:
            term_filter = Q()
            variants = {term.lower()}

            # Generate single-char-deletion variants for short terms
            if 3 <= len(term) <= 8:
                for i in range(len(term)):
                    variant = term[:i] + term[i + 1:]
                    if len(variant) >= 2:
                        variants.add(variant.lower())

            for variant in variants:
                for field in search_fields:
                    term_filter |= Q(**{f'{field}__icontains': variant})
            combined &= term_filter

        return combined

    def _compute_relevance_score(
        self,
        obj: Any,
        search_text: str,
        config: Dict[str, Any],
    ) -> float:
        """Compute a relevance score (0–1) for a search result.

        Factors (weighted):
          * Exact / prefix match on display field  – 0.50
          * Substring / word-boundary match        – 0.25
          * Fuzzy string similarity                – 0.10
          * Recency boost                          – 0.15
        """
        if not search_text:
            return 0.5

        query_lower = search_text.lower().strip()
        display_value = self._get_display_value(obj, config).lower()

        # --- Text relevance (0.85 total) ---
        text_score = 0.0

        # Exact match
        if display_value == query_lower:
            text_score = 0.85
        # Prefix match (display starts with query)
        elif display_value.startswith(query_lower):
            text_score = 0.70
        # Word-boundary match (query appears at the start of a word)
        elif re.search(rf'\b{re.escape(query_lower)}', display_value):
            text_score = 0.55
        # Substring match
        elif query_lower in display_value:
            text_score = 0.40
        else:
            # Check all searchable fields for substring
            for field_name in config.get('search_fields', []):
                field_val = str(getattr(obj, field_name, '') or '').lower()
                if query_lower in field_val:
                    text_score = max(text_score, 0.30)
                elif re.search(rf'\b{re.escape(query_lower)}', field_val):
                    text_score = max(text_score, 0.35)

            # Fuzzy similarity on display field
            if text_score < 0.30:
                ratio = SequenceMatcher(None, query_lower, display_value).ratio()
                text_score = max(text_score, ratio * 0.40)

        # --- Recency boost (0.15 max) ---
        recency_score = 0.0
        created = getattr(obj, 'created_at', None) or getattr(obj, 'created_on', None)
        if created:
            try:
                now = timezone.now()
                if timezone.is_naive(created):
                    created = timezone.make_aware(created)
                age_days = max((now - created).total_seconds() / 86400, 0)
                # Exponential decay: full boost within 7 days, halves every 30 days
                recency_score = 0.15 * (0.5 ** (age_days / 30))
            except Exception:
                pass

        return round(min(text_score + recency_score, 1.0), 4)
    
    def _search_entity(
        self,
        entity_type: str,
        search_text: str,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Search a single entity type with relevance scoring and fuzzy matching."""
        config = SEARCHABLE_ENTITIES.get(entity_type)
        if not config:
            return {'items': [], 'total_count': 0}

        Model = self._get_model(entity_type)
        if not Model:
            return {'items': [], 'total_count': 0}
        
        try:
            # Execute with tenant filter when applicable.
            base_qs = Model.objects.all()
            if hasattr(Model, 'tenant'):
                base_qs = base_qs.filter(tenant=self.tenant)

            # Product visibility follows the Three-Tier Product Strategy:
            # system products (visible by default, can be hidden) + tenant custom products.
            if entity_type == 'product':
                from apps.system.services.product_visibility import visible_products_qs

                base_qs = visible_products_qs(tenant=self.tenant, qs=base_qs)

            if search_text:
                # Primary: exact icontains match
                query_filter = self._build_query_filter(search_text, config['search_fields'])
                queryset = base_qs.filter(query_filter)

                # If too few results, expand with fuzzy matching
                exact_count = queryset.count()
                if exact_count < limit:
                    fuzzy_filter = self._build_fuzzy_query_filter(search_text, config['search_fields'])
                    queryset = base_qs.filter(fuzzy_filter).distinct()
            else:
                # If the user is effectively filtering by entity type (e.g. query="purchase"),
                # show the most recent records for that type.
                field_names = {f.name for f in Model._meta.fields}
                if 'created_at' in field_names:
                    ordering = '-created_at'
                elif 'created_on' in field_names:
                    ordering = '-created_on'
                else:
                    ordering = '-id'
                queryset = base_qs.order_by(ordering)

            total_count = queryset.count()
            # Fetch more for scoring then truncate
            fetch_limit = min(limit * 3, 100)
            queryset = queryset[:fetch_limit]
            
            # Format results with relevance scoring
            results = []
            for obj in queryset:
                display_value = self._get_display_value(obj, config)
                subtitle = self._get_subtitle(obj, config)
                score = self._compute_relevance_score(obj, search_text, config) if search_text else 0.5
                
                results.append({
                    'id': obj.id,
                    'type': entity_type,
                    'title': display_value,
                    'subtitle': subtitle,
                    'icon': config['icon'],
                    'color': config['color'],
                    'route': config['route'].format(id=obj.id),
                    'score': score,
                })

            # Sort by score descending, then truncate to limit
            results.sort(key=lambda x: x['score'], reverse=True)
            results = results[:limit]
            
            return {
                'items': results,
                'total_count': total_count,
            }
            
        except Exception as e:
            logger.error(f"Search error for {entity_type}: {e}")
            return {'items': [], 'total_count': 0}

    def get_record_detail(self, entity_type: str, entity_id: str | int) -> Optional[Dict[str, Any]]:
        """Fetch a single record detail payload for a given entity type.

        This is intentionally lightweight and uses the same entity config and tenant
        filtering rules as universal search.
        """
        config = SEARCHABLE_ENTITIES.get(entity_type)
        if not config:
            return None

        Model = self._get_model(entity_type)
        if not Model:
            return None

        try:
            base_qs = Model.objects.all()
            if hasattr(Model, 'tenant'):
                base_qs = base_qs.filter(tenant=self.tenant)

            if entity_type == 'product':
                from apps.system.services.product_visibility import visible_products_qs

                base_qs = visible_products_qs(tenant=self.tenant, qs=base_qs)

            obj = base_qs.filter(id=entity_id).first()
            if not obj:
                return None

            display_value = self._get_display_value(obj, config)
            subtitle = self._get_subtitle(obj, config)

            return {
                'id': obj.id,
                'type': entity_type,
                'title': display_value,
                'subtitle': subtitle,
                'route': config['route'].format(id=obj.id),
            }

        except Exception as e:
            logger.error(f"Record detail error for {entity_type}/{entity_id}: {e}")
            return None

    def _get_display_value(self, obj, config: Dict) -> str:
        """Get the display value for an object."""
        display_field = config['display_field']

        # Handle computed fields
        if display_field == 'full_name':
            first = getattr(obj, 'first_name', '')
            last = getattr(obj, 'last_name', '')
            return f"{first} {last}".strip() or str(obj)

        # Support nested fields like 'user__username'
        if '__' in display_field:
            value = obj
            for part in display_field.split('__'):
                value = getattr(value, part, None)
                if value is None:
                    break
            return str(value) if value is not None else str(obj)

        return getattr(obj, display_field, str(obj))
    
    def _get_subtitle(self, obj, config: Dict) -> Optional[str]:
        """Get subtitle (related display) for an object."""
        related_field = config.get('related_display')
        if not related_field:
            return None

        # Allow a list of candidate subtitles and use the first non-empty.
        candidates = related_field if isinstance(related_field, list) else [related_field]

        for field_path in candidates:
            if not field_path:
                continue

            # Handle nested fields like 'supplier__name'
            parts = str(field_path).split('__')
            value = obj
            for part in parts:
                value = getattr(value, part, None)
                if value is None:
                    break

            if value:
                return str(value)

        return None
    
    def search(
        self,
        query: str,
        limit_per_type: int = 5,
        entity_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Execute universal search across all or specified entity types.

        Caching (Phase 8.1):
        - Results are cached per-tenant to preserve strict isolation.
        - Keys include tenant_id + normalized query + selected entity types.
        - TTL is intentionally short to keep results fresh.

        Returns:
            {
                'query': original query,
                'results': [list of result objects],
                'counts': {entity_type: count},
                'total': total count,
            }
        """
        if not query or len(query.strip()) < 2:
            return {
                'query': query,
                'results': [],
                'counts': {},
                'total': 0,
            }

        # Parse for operators
        search_text, operator_type = self._parse_query(query)

        # Determine which types to search
        if operator_type:
            types_to_search = [operator_type]
        elif entity_types:
            types_to_search = entity_types
        else:
            types_to_search = list(SEARCHABLE_ENTITIES.keys())

        # Normalize for cache key stability
        normalized_query = " ".join(search_text.strip().lower().split())
        normalized_types = ",".join(sorted([t.strip() for t in types_to_search if t and t.strip()]))

        cache_key = CacheService.generate_cache_key(
            "universal_search",
            tenant_id=str(self.tenant.id),
            q=normalized_query,
            operator=operator_type or "",
            types=normalized_types,
            limit=limit_per_type,
        )

        def _compute() -> Dict[str, Any]:
            # Execute searches
            all_results: list[dict[str, Any]] = []
            counts: dict[str, int] = {}

            for entity_type in types_to_search:
                result = self._search_entity(entity_type, normalized_query, limit_per_type)
                items = result.get('items') if isinstance(result.get('items'), list) else []
                total_count = int(result.get('total_count') or 0)

                all_results.extend(items)
                counts[entity_type] = total_count

            # Sort by score (can enhance with relevance ranking)
            all_results.sort(key=lambda x: x.get("score", 0), reverse=True)

            return {
                "query": query,
                "search_text": search_text,
                "operator": operator_type,
                "results": all_results,
                "counts": counts,
                "total": sum(counts.values()),
                "returned": len(all_results),
            }

        # Short TTL keeps search results fresh while protecting the database.
        return CacheService.cache_query_result(cache_key, _compute, ttl=60)
    
    def get_recent_items(self, user: User, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recently accessed items for the user.
        
        Uses cache to track recent item access.
        """
        cache_key = f"recent_items:{self.tenant.id}:{user.id}"
        recent = cache.get(cache_key, [])
        return recent[:limit]
    
    def track_item_access(
        self, 
        user: User, 
        entity_type: str, 
        entity_id: int,
        title: str
    ):
        """Track item access for recent items list."""
        cache_key = f"recent_items:{self.tenant.id}:{user.id}"
        recent = cache.get(cache_key, [])
        
        config = SEARCHABLE_ENTITIES.get(entity_type, {})
        
        # Create item entry
        item = {
            'id': entity_id,
            'type': entity_type,
            'title': title,
            'icon': config.get('icon', 'File'),
            'color': config.get('color', '#6b7280'),
            'route': config.get('route', '').format(id=entity_id),
        }
        
        # Remove if already exists (to move to front)
        recent = [r for r in recent if not (r['type'] == entity_type and r['id'] == entity_id)]
        
        # Add to front
        recent.insert(0, item)
        
        # Keep only last 20
        recent = recent[:20]
        
        # Cache for 7 days
        cache.set(cache_key, recent, 60 * 60 * 24 * 7)
    
    @staticmethod
    def get_entity_config(entity_type: str) -> Optional[Dict]:
        """Get configuration for an entity type."""
        return SEARCHABLE_ENTITIES.get(entity_type)
    
    @staticmethod
    def get_all_entity_types() -> List[str]:
        """Get list of all searchable entity types."""
        return list(SEARCHABLE_ENTITIES.keys())
    
    @staticmethod
    def get_operators_help() -> List[Dict[str, str]]:
        """Get help text for all search operators."""
        operators = []
        for entity_type, config in SEARCHABLE_ENTITIES.items():
            for operator in config.get('operators', []):
                operators.append({
                    'operator': operator,
                    'entity_type': entity_type,
                    'description': f"Search {entity_type.replace('_', ' ')}s",
                    'example': f"{operator}example",
                })
        return operators

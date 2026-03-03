"""
Search Intelligence Service (Phase 3)

Combines NLP query processing, continuous search, and real-time updates.
"""
import json
import re
from typing import Dict, List, Any
from django.core.cache import cache
from django.db.models import Q
import os


class SearchIntelligenceService:
    """AI-powered search with Redis caching."""
    
    CACHE_TTL = 600  # 10 minutes
    
    @staticmethod
    def continuous_search(query: str, entity_type: str, tenant_id: str, limit: int = 20) -> List[Dict]:
        """Continuous search with Redis caching (Phase 3.4)."""
        cache_key = f"search:{entity_type}:{tenant_id}:{query}"
        cached = cache.get(cache_key)
        if cached:
            return json.loads(cached)
        
        results = SearchIntelligenceService._execute_search(query, entity_type, tenant_id, limit)
        cache.set(cache_key, json.dumps(results), SearchIntelligenceService.CACHE_TTL)
        return results
    
    @staticmethod
    def _execute_search(query: str, entity_type: str, tenant_id: str, limit: int) -> List[Dict]:
        """Execute database search."""
        model_class = SearchIntelligenceService._get_model_class(entity_type)
        q_objects = Q()
        
        for field in ['name', 'description', 'product_code', 'email']:
            if hasattr(model_class, field):
                q_objects |= Q(**{f"{field}__icontains": query})
        
        queryset = model_class.objects.filter(tenant_id=tenant_id).filter(q_objects)[:limit]
        
        return [{'id': str(obj.id), 'label': str(obj), 'entity_type': entity_type} for obj in queryset]
    
    @staticmethod
    def _get_model_class(entity_type: str):
        """Import model class."""
        mapping = {
            'product': ('tenant_apps.products.models', 'Product'),
            'supplier': ('tenant_apps.suppliers.models', 'Supplier'),
            'customer': ('tenant_apps.customers.models', 'Customer'),
        }
        module_path, model_name = mapping[entity_type]
        module = __import__(module_path, fromlist=[''])
        return getattr(module, model_name)

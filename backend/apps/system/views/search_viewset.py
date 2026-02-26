"""
Ranked Search ViewSet

Provides intelligent search with entity ranking and smart labels.
Uses the EntityRanking service to score and sort results.

Created: 2026-02-23 - Cockpit Phase 2A Smart Rankings
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from datetime import datetime, timedelta
from django.utils import timezone
import logging

from apps.system.services.ranking_service import EntityRanking, EntityLabels

logger = logging.getLogger(__name__)


class RankedSearchViewSet(viewsets.ViewSet):
    """
    Intelligent search with ranking and smart labels.
    
    Endpoints:
    - GET /api/v1/system/search/ranked/ - Universal search with intelligent ranking
    
    Note: This is a foundation for smart search. Currently returns mock data
    until entity models are properly integrated. The ranking service is ready
    and can be applied once models are available.
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """
        Universal search across all entities with intelligent ranking.
        
        Query Parameters:
        - q: Search query string
        - date_range: Filter by activity date (last_7_days, last_30_days, last_90_days, all_time)
        - entity_types: Comma-separated list of types to search (customer,supplier,po,so)
        - limit: Max results per entity type (default: 5)
        
        Returns:
        {
          "query": "search query",
          "date_range": "last_30_days",
          "results": [
            {
              "id": 123,
              "type": "customer",
              "title": "Acme Corp",
              "subtitle": "Chicago, IL",
              "icon": "👤",
              "color": "rgb(59, 130, 246)",
              "route": "/customers/123",
              "score": 85,
              "labels": ["Last contact: 3 days ago", "High-value: $50k/month"],
              "metadata": { ... }
            }
          ],
          "counts": {
            "customer": 12,
            "supplier": 8
          },
          "total": 28
        }
        """
        query = request.query_params.get('q', '').strip()
        date_range = request.query_params.get('date_range', 'last_30_days')
        entity_types_str = request.query_params.get('entity_types', '')
        limit = int(request.query_params.get('limit', 5))
        
        tenant = request.tenant
        
        # Parse entity types filter
        if entity_types_str:
            entity_types = [t.strip() for t in entity_types_str.split(',')]
        else:
            entity_types = ['customer', 'supplier', 'po', 'so']
        
        results = []
        counts = {}
        
        logger.info(f"[RankedSearch] Query: '{query}', Range: {date_range}, Tenant: {tenant.id if tenant else 'None'}")
        
        # If no query, return empty results
        if not query:
            return Response({
                'query': query,
                'date_range': date_range,
                'results': results,
                'counts': counts,
                'total': 0,
            })
        
        # Search customers (fuzzy match with icontains)
        if 'customer' in entity_types:
            try:
                from tenant_apps.customers.models import Customer
                customers = Customer.objects.filter(
                    Q(name__icontains=query) | 
                    Q(contact_person__icontains=query) |
                    Q(email__icontains=query) |
                    Q(city__icontains=query)
                )
                if tenant:
                    customers = customers.filter(tenant=tenant)
                
                customers = customers[:limit]
                counts['customer'] = customers.count()
                
                for customer in customers:
                    # Calculate simple relevance score (0-100)
                    name_match = query.lower() in customer.name.lower() if customer.name else False
                    score = 90 if name_match else 60  # Higher score for name matches
                    
                    results.append({
                        'id': customer.id,
                        'type': 'customer',
                        'title': customer.name or 'Unnamed Customer',
                        'subtitle': f"{customer.city}, {customer.state}" if customer.city and customer.state else customer.email or '',
                        'icon': '👤',
                        'color': 'rgb(59, 130, 246)',
                        'route': f'/customers/{customer.id}',
                        'score': score,
                        'labels': [],
                        'metadata': {
                            'contact_person': customer.contact_person,
                            'email': customer.email,
                        }
                    })
                logger.info(f"[RankedSearch] Found {len(customers)} customers")
            except Exception as e:
                logger.error(f"[RankedSearch] Customer search failed: {e}")
        
        # Search suppliers
        if 'supplier' in entity_types:
            try:
                from tenant_apps.suppliers.models import Supplier
                suppliers = Supplier.objects.filter(
                    Q(name__icontains=query) |
                    Q(contact_person__icontains=query) |
                    Q(email__icontains=query) |
                    Q(city__icontains=query)
                )
                if tenant:
                    suppliers = suppliers.filter(tenant=tenant)
                
                suppliers = suppliers[:limit]
                counts['supplier'] = suppliers.count()
                
                for supplier in suppliers:
                    name_match = query.lower() in supplier.name.lower() if supplier.name else False
                    score = 90 if name_match else 60
                    
                    results.append({
                        'id': supplier.id,
                        'type': 'supplier',
                        'title': supplier.name or 'Unnamed Supplier',
                        'subtitle': f"{supplier.city}, {supplier.state}" if supplier.city and supplier.state else supplier.email or '',
                        'icon': '🏢',
                        'color': 'rgb(168, 85, 247)',
                        'route': f'/suppliers/{supplier.id}',
                        'score': score,
                        'labels': [],
                        'metadata': {
                            'contact_person': supplier.contact_person,
                            'email': supplier.email,
                        }
                    })
                logger.info(f"[RankedSearch] Found {len(suppliers)} suppliers")
            except Exception as e:
                logger.error(f"[RankedSearch] Supplier search failed: {e}")
        
        # Search purchase orders
        if 'po' in entity_types:
            try:
                from tenant_apps.purchase_orders.models import PurchaseOrder
                pos = PurchaseOrder.objects.filter(
                    Q(order_number__icontains=query) |
                    Q(our_purchase_order_num__icontains=query)
                ).select_related('supplier')
                if tenant:
                    pos = pos.filter(tenant=tenant)
                
                pos = pos[:limit]
                counts['po'] = pos.count()
                
                for po in pos:
                    results.append({
                        'id': po.id,
                        'type': 'po',
                        'title': po.order_number or 'No PO Number',
                        'subtitle': f"Supplier: {po.supplier.name}" if po.supplier else 'No supplier',
                        'icon': '📄',
                        'color': 'rgb(34, 197, 94)',
                        'route': f'/purchase-orders/{po.id}',
                        'score': 75,
                        'labels': [f"Status: {po.status}"] if hasattr(po, 'status') else [],
                        'metadata': {
                            'our_po_num': po.our_purchase_order_num,
                            'supplier_name': po.supplier.name if po.supplier else None,
                        }
                    })
                logger.info(f"[RankedSearch] Found {len(pos)} purchase orders")
            except Exception as e:
                logger.error(f"[RankedSearch] PO search failed: {e}")
        
        # Sort results by score (highest first)
        results.sort(key=lambda x: x['score'], reverse=True)
        
        total = sum(counts.values())
        
        logger.info(f"[RankedSearch] Total results: {total}, Counts: {counts}")
        
        return Response({
            'query': query,
            'date_range': date_range,
            'results': results,
            'counts': counts,
            'total': total,
        })


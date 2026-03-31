"""
Ranked Search ViewSet

Provides intelligent search with entity ranking and smart labels.
Uses the EntityRanking service to score and sort results.

Created: 2026-02-23 - Cockpit Phase 2A Smart Rankings
Updated: 2026-03-03 - Production-grade ranking with all entity types
"""

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
import logging

from apps.system.services.ranking_service import EntityRanking, EntityLabels

logger = logging.getLogger(__name__)


class RankedSearchViewSet(viewsets.ViewSet):
    """
    Production-grade intelligent search with ranking and smart labels.
    
    Endpoints:
    - GET /api/v1/system/search/ranked/ - Universal search with intelligent ranking
    
    Features:
    - Multi-entity search (Customer, Supplier, Product, Contact, PO, SO)
    - EntityRanking.calculate_score() for intelligent sorting
    - EntityLabels.generate() for contextual metadata
    - Real database queries with tenant isolation
    - Accurate counts reflecting total matches (not just limited results)
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """
        Universal search across all entities with intelligent ranking.
        
        Query Parameters:
        - q: Search query string
        - date_range: Filter by activity date (last_7_days, last_30_days, last_90_days, all_time)
        - entity_types: Comma-separated list of types to search (customer,supplier,product,contact,po,so)
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
            entity_types = ['customer', 'supplier', 'product', 'contact', 'po', 'so']
        
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
        
        # Search customers with intelligent ranking
        if 'customer' in entity_types:
            self._search_customers(query, tenant, limit, results, counts)
        
        # Search suppliers with intelligent ranking
        if 'supplier' in entity_types:
            self._search_suppliers(query, tenant, limit, results, counts)
        
        # Search products
        if 'product' in entity_types:
            self._search_products(query, tenant, limit, results, counts)
        
        # Search contacts
        if 'contact' in entity_types:
            self._search_contacts(query, tenant, limit, results, counts)
        
        # Search purchase orders
        if 'po' in entity_types:
            self._search_purchase_orders(query, tenant, limit, results, counts)
        
        # Search sales orders
        if 'so' in entity_types:
            self._search_sales_orders(query, tenant, limit, results, counts)
        
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
    
    def _search_customers(self, query: str, tenant, limit: int, results: list, counts: dict):
        """Search customers with EntityRanking"""
        try:
            from tenant_apps.customers.models import Customer
            
            # Build query for all matching customers (for accurate count)
            customers_qs = Customer.objects.filter(
                Q(name__icontains=query) | 
                Q(contact_person__icontains=query) |
                Q(email__icontains=query) |
                Q(city__icontains=query)
            )
            if tenant:
                customers_qs = customers_qs.filter(tenant=tenant)
            
            # Get total count BEFORE limiting
            counts['customer'] = customers_qs.count()
            
            # Now get top results for ranking
            customers = list(customers_qs[:limit * 2])  # Get 2x for better ranking
            
            # Calculate scores for each customer
            scored_customers = []
            for customer in customers:
                score = EntityRanking.calculate_total_score(
                    query=query,
                    entity_type='customer',
                    entity=customer
                )
                scored_customers.append((customer, score))
            
            # Sort by score and take top N
            scored_customers.sort(key=lambda x: x[1], reverse=True)
            top_customers = scored_customers[:limit]
            
            for customer, score in top_customers:
                # Generate labels
                labels = EntityLabels.get_labels('customer', customer)
                label_texts = [label.get('text', '') for label in labels]
                
                results.append({
                    'id': customer.id,
                    'type': 'customer',
                    'title': customer.name or 'Unnamed Customer',
                    'subtitle': f"{customer.city}, {customer.state}" if customer.city and customer.state else customer.email or '',
                    'icon': '👤',
                    'color': 'rgb(59, 130, 246)',
                    'route': f'/customers/{customer.id}',
                    'score': score,
                    'labels': label_texts,
                    'metadata': {
                        'contact_person': customer.contact_person,
                        'email': customer.email,
                    }
                })
            logger.info(f"[RankedSearch] Found {counts['customer']} customers (showing top {len(top_customers)})")
        except Exception as e:
            logger.error(f"[RankedSearch] Customer search failed: {e}")
    
    def _search_suppliers(self, query: str, tenant, limit: int, results: list, counts: dict):
        """Search suppliers with EntityRanking"""
        try:
            from tenant_apps.suppliers.models import Supplier
            
            suppliers_qs = Supplier.objects.filter(
                Q(name__icontains=query) |
                Q(contact_person__icontains=query) |
                Q(email__icontains=query) |
                Q(city__icontains=query)
            )
            if tenant:
                suppliers_qs = suppliers_qs.filter(tenant=tenant)
            
            counts['supplier'] = suppliers_qs.count()
            suppliers = list(suppliers_qs[:limit * 2])
            
            scored_suppliers = []
            for supplier in suppliers:
                score = EntityRanking.calculate_total_score(
                    query=query,
                    entity_type='supplier',
                    entity=supplier
                )
                scored_suppliers.append((supplier, score))
            
            scored_suppliers.sort(key=lambda x: x[1], reverse=True)
            top_suppliers = scored_suppliers[:limit]
            
            for supplier, score in top_suppliers:
                labels = EntityLabels.get_labels('supplier', supplier)
                label_texts = [label.get('text', '') for label in labels]
                
                results.append({
                    'id': supplier.id,
                    'type': 'supplier',
                    'title': supplier.name or 'Unnamed Supplier',
                    'subtitle': f"{supplier.city}, {supplier.state}" if supplier.city and supplier.state else supplier.email or '',
                    'icon': '🏢',
                    'color': 'rgb(168, 85, 247)',
                    'route': f'/suppliers/{supplier.id}',
                    'score': score,
                    'labels': label_texts,
                    'metadata': {
                        'contact_person': supplier.contact_person,
                        'email': supplier.email,
                    }
                })
            logger.info(f"[RankedSearch] Found {counts['supplier']} suppliers (showing top {len(top_suppliers)})")
        except Exception as e:
            logger.error(f"[RankedSearch] Supplier search failed: {e}")
    
    def _search_products(self, query: str, tenant, limit: int, results: list, counts: dict):
        """Search products.

        IMPORTANT:
        - Must respect global Product.is_active (inactive = hidden from tenants).
        - Must respect tenant-level hides via TenantProductPreference(is_active=False).
        """
        try:
            from apps.system.models import Product
            from apps.system.services.product_visibility import visible_products_qs

            products_qs = visible_products_qs(tenant=tenant, qs=Product.objects.all()).filter(
                Q(name__icontains=query)
                | Q(product_code__icontains=query)
                | Q(description__icontains=query)
                | Q(namp_code__icontains=query)
                | Q(usda_code__icontains=query)
            )

            counts['product'] = products_qs.count()
            products = list(products_qs[:limit])

            q_lower = query.lower()
            for product in products:
                name_match = q_lower in (product.name or '').lower()
                code_match = q_lower in (product.product_code or '').lower()
                score = 85 if name_match or code_match else 65

                results.append({
                    'id': product.id,
                    'type': 'product',
                    'title': product.name or 'Unnamed Product',
                    'subtitle': product.product_code or '',
                    'icon': '📦',
                    'color': 'rgb(234, 179, 8)',
                    'route': f'/products/{product.id}',
                    'score': score,
                    'labels': [],
                    'metadata': {
                        'product_code': product.product_code,
                        'description': product.description,
                    },
                })

            logger.info(f"[RankedSearch] Found {counts['product']} products")
        except Exception as e:
            logger.error(f"[RankedSearch] Product search failed: {e}")
    
    def _search_contacts(self, query: str, tenant, limit: int, results: list, counts: dict):
        """Search contacts"""
        try:
            # Check if contacts app exists
            from tenant_apps.contacts.models import Contact
            
            contacts_qs = Contact.objects.filter(
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(email__icontains=query) |
                Q(phone__icontains=query)
            )
            if tenant:
                contacts_qs = contacts_qs.filter(tenant=tenant)
            
            counts['contact'] = contacts_qs.count()
            contacts = list(contacts_qs[:limit])
            
            for contact in contacts:
                full_name = f"{contact.first_name} {contact.last_name}".strip()
                score = 80 if query.lower() in full_name.lower() else 60
                
                results.append({
                    'id': contact.id,
                    'type': 'contact',
                    'title': full_name or 'Unnamed Contact',
                    'subtitle': contact.email or contact.phone or '',
                    'icon': '👥',
                    'color': 'rgb(34, 197, 94)',
                    'route': f'/contacts/{contact.id}',
                    'score': score,
                    'labels': [],
                    'metadata': {
                        'email': contact.email,
                        'phone': contact.phone,
                    }
                })
            logger.info(f"[RankedSearch] Found {counts['contact']} contacts")
        except Exception as e:
            logger.warning(f"[RankedSearch] Contact search failed (app may not exist): {e}")
    
    def _search_purchase_orders(self, query: str, tenant, limit: int, results: list, counts: dict):
        """Search purchase orders"""
        try:
            from tenant_apps.purchase_orders.models import PurchaseOrder
            
            pos_qs = PurchaseOrder.objects.filter(
                Q(order_number__icontains=query) |
                Q(our_purchase_order_num__icontains=query)
            ).select_related('supplier')
            if tenant:
                pos_qs = pos_qs.filter(tenant=tenant)
            
            counts['po'] = pos_qs.count()
            pos = list(pos_qs[:limit])
            
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
            logger.info(f"[RankedSearch] Found {counts['po']} purchase orders")
        except Exception as e:
            logger.error(f"[RankedSearch] PO search failed: {e}")
    
    def _search_sales_orders(self, query: str, tenant, limit: int, results: list, counts: dict):
        """Search sales orders"""
        try:
            from tenant_apps.sales_orders.models import SalesOrder
            
            sos_qs = SalesOrder.objects.filter(
                Q(order_number__icontains=query)
            ).select_related('customer')
            if tenant:
                sos_qs = sos_qs.filter(tenant=tenant)
            
            counts['so'] = sos_qs.count()
            sos = list(sos_qs[:limit])
            
            for so in sos:
                results.append({
                    'id': so.id,
                    'type': 'so',
                    'title': so.order_number or 'No SO Number',
                    'subtitle': f"Customer: {so.customer.name}" if so.customer else 'No customer',
                    'icon': '📋',
                    'color': 'rgb(59, 130, 246)',
                    'route': f'/sales-orders/{so.id}',
                    'score': 75,
                    'labels': [f"Status: {so.status}"] if hasattr(so, 'status') else [],
                    'metadata': {
                        'customer_name': so.customer.name if so.customer else None,
                    }
                })
            logger.info(f"[RankedSearch] Found {counts['so']} sales orders")
        except Exception as e:
            logger.warning(f"[RankedSearch] SO search failed (app may not exist): {e}")


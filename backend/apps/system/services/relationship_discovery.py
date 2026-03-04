"""
Fuzzy Relationship Discovery Service

Discovers relationships between business entities even when foreign keys are NULL.
Uses fuzzy matching on email domains, tax IDs, short names, and other metadata.
"""
import logging
from typing import List, Dict, Any, Optional
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.apps import apps

logger = logging.getLogger(__name__)


class RelationshipDiscoveryService:
    """
    Discovers entity relationships using fuzzy matching when direct FKs don't exist.
    
    Example: Find all orders/invoices/emails for a customer even if customer_id is NULL,
    by matching email domain, tax ID, company name, etc.
    """
    
    def __init__(self, tenant):
        """
        Initialize service for a specific tenant.
        
        Args:
            tenant: Tenant instance for scoping queries
        """
        self.tenant = tenant
        
    def discover_related_entities(
        self,
        entity_type: str,
        entity_id: int,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Discover all related entities using fuzzy logic.
        
        Args:
            entity_type: Type of source entity ('customer', 'product', 'order', etc.)
            entity_id: ID of source entity
            max_results: Maximum number of fuzzy results to return
            
        Returns:
            List of related entities with metadata
        """
        results = []
        
        try:
            # Get source entity
            entity = self._get_entity(entity_type, entity_id)
            if not entity:
                logger.warning(f'Entity not found: {entity_type} #{entity_id}')
                return []
            
            # Run fuzzy discovery based on entity type
            if entity_type.lower() == 'customer':
                results.extend(self._find_by_email_domain(entity, max_results=max_results))
                results.extend(self._find_by_tax_id(entity, max_results=max_results))
                results.extend(self._find_by_name(entity, max_results=max_results))
                
            elif entity_type.lower() == 'product':
                results.extend(self._find_by_sku(entity, max_results=max_results))
                results.extend(self._find_by_name(entity, max_results=max_results))
                
            elif entity_type.lower() == 'order':
                results.extend(self._find_by_reference_number(entity, max_results=max_results))
                
            # Deduplicate and sort by relevance
            results = self._deduplicate_results(results)
            results = sorted(results, key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            return results[:max_results]
            
        except Exception as e:
            logger.error(f'Fuzzy discovery failed for {entity_type} #{entity_id}: {str(e)}', exc_info=True)
            return []
    
    def _get_entity(self, entity_type: str, entity_id: int):
        """Get entity by type and ID."""
        model_map = {
            'customer': 'customers.Customer',
            'product': 'products.Product',
            'order': 'orders.Order',
            'invoice': 'invoices.Invoice',
        }
        
        model_path = model_map.get(entity_type.lower())
        if not model_path:
            return None
            
        try:
            app_label, model_name = model_path.split('.')
            model = apps.get_model(app_label, model_name)
            return model.objects.filter(tenant=self.tenant, id=entity_id).first()
        except (LookupError, ValueError):
            return None
    
    def _find_by_email_domain(self, customer, max_results: int = 20) -> List[Dict[str, Any]]:
        """
        Find entities matching customer's email domain.
        
        Example: customer@company.com → find all emails/orders from *@company.com
        """
        results = []
        
        # Extract email domain
        email = getattr(customer, 'email', None) or getattr(customer, 'contact_email', None)
        if not email or '@' not in email:
            return []
        
        domain = email.split('@')[1].lower()
        
        # Search EmailLog model (if exists)
        try:
            EmailLog = apps.get_model('integrations', 'EmailLog')
            emails = EmailLog.objects.filter(
                tenant=self.tenant,
                sender__icontains=f'@{domain}'
            )[:max_results]
            
            for email_log in emails:
                results.append({
                    'id': str(email_log.id),
                    'type': 'email',
                    'name': email_log.subject or 'Untitled Email',
                    'subtitle': f'From: {email_log.sender}',
                    'metadata': {
                        'date': email_log.received_at.isoformat() if hasattr(email_log, 'received_at') else None,
                        'match_type': 'email_domain',
                        'domain': domain
                    },
                    'relevance_score': 0.9
                })
        except LookupError:
            pass  # EmailLog model doesn't exist
        
        # Search Order model for email matches
        try:
            Order = apps.get_model('orders', 'Order')
            orders = Order.objects.filter(
                tenant=self.tenant,
                customer_email__icontains=f'@{domain}'
            )[:max_results]
            
            for order in orders:
                results.append({
                    'id': str(order.id),
                    'type': 'order',
                    'name': f'Order #{order.order_number}' if hasattr(order, 'order_number') else f'Order #{order.id}',
                    'subtitle': f'Email: {order.customer_email}',
                    'metadata': {
                        'match_type': 'email_domain',
                        'domain': domain
                    },
                    'relevance_score': 0.85
                })
        except LookupError:
            pass
        
        return results
    
    def _find_by_tax_id(self, customer, max_results: int = 20) -> List[Dict[str, Any]]:
        """
        Find entities matching customer's tax ID or business number.
        """
        results = []
        
        tax_id = getattr(customer, 'tax_id', None) or getattr(customer, 'business_number', None)
        if not tax_id:
            return []
        
        tax_id_clean = str(tax_id).strip()
        
        # Search invoices by tax ID
        try:
            Invoice = apps.get_model('invoices', 'Invoice')
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                customer_tax_id=tax_id_clean
            )[:max_results]
            
            for invoice in invoices:
                results.append({
                    'id': str(invoice.id),
                    'type': 'invoice',
                    'name': f'Invoice #{invoice.invoice_number}' if hasattr(invoice, 'invoice_number') else f'Invoice #{invoice.id}',
                    'subtitle': f'Tax ID: {tax_id_clean}',
                    'metadata': {
                        'match_type': 'tax_id',
                        'tax_id': tax_id_clean
                    },
                    'relevance_score': 0.95  # High confidence - tax IDs are unique
                })
        except LookupError:
            pass
        
        return results
    
    def _find_by_name(self, entity, max_results: int = 20) -> List[Dict[str, Any]]:
        """
        Find entities matching name or company name.
        Uses case-insensitive contains search.
        """
        results = []
        
        name = getattr(entity, 'name', None) or getattr(entity, 'company_name', None)
        if not name or len(name) < 3:  # Avoid matching too-short names
            return []
        
        name_clean = str(name).strip()
        
        # Search orders by customer name
        try:
            Order = apps.get_model('orders', 'Order')
            orders = Order.objects.filter(
                tenant=self.tenant,
                customer_name__icontains=name_clean
            )[:max_results]
            
            for order in orders:
                results.append({
                    'id': str(order.id),
                    'type': 'order',
                    'name': f'Order #{order.order_number}' if hasattr(order, 'order_number') else f'Order #{order.id}',
                    'subtitle': f'Customer: {order.customer_name}',
                    'metadata': {
                        'match_type': 'name',
                        'name': name_clean
                    },
                    'relevance_score': 0.7  # Medium confidence - names can be generic
                })
        except LookupError:
            pass
        
        return results
    
    def _find_by_sku(self, product, max_results: int = 20) -> List[Dict[str, Any]]:
        """Find order line items matching product SKU."""
        results = []
        
        sku = getattr(product, 'sku', None)
        if not sku:
            return []
        
        sku_clean = str(sku).strip()
        
        try:
            OrderLineItem = apps.get_model('orders', 'OrderLineItem')
            line_items = OrderLineItem.objects.filter(
                tenant=self.tenant,
                product_sku=sku_clean
            ).select_related('order')[:max_results]
            
            for item in line_items:
                results.append({
                    'id': str(item.order.id),
                    'type': 'order',
                    'name': f'Order #{item.order.order_number}' if hasattr(item.order, 'order_number') else f'Order #{item.order.id}',
                    'subtitle': f'SKU: {sku_clean}',
                    'metadata': {
                        'match_type': 'sku',
                        'sku': sku_clean
                    },
                    'relevance_score': 0.9
                })
        except LookupError:
            pass
        
        return results
    
    def _find_by_reference_number(self, order, max_results: int = 20) -> List[Dict[str, Any]]:
        """Find related entities by order reference number."""
        results = []
        
        ref_number = getattr(order, 'reference_number', None) or getattr(order, 'order_number', None)
        if not ref_number:
            return []
        
        ref_clean = str(ref_number).strip()
        
        # Search invoices by order reference
        try:
            Invoice = apps.get_model('invoices', 'Invoice')
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                order_reference=ref_clean
            )[:max_results]
            
            for invoice in invoices:
                results.append({
                    'id': str(invoice.id),
                    'type': 'invoice',
                    'name': f'Invoice #{invoice.invoice_number}' if hasattr(invoice, 'invoice_number') else f'Invoice #{invoice.id}',
                    'subtitle': f'Order: {ref_clean}',
                    'metadata': {
                        'match_type': 'reference_number',
                        'reference': ref_clean
                    },
                    'relevance_score': 0.95
                })
        except LookupError:
            pass
        
        return results
    
    def _deduplicate_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate entities (same type + id)."""
        seen = set()
        deduplicated = []
        
        for result in results:
            key = (result['type'], result['id'])
            if key not in seen:
                seen.add(key)
                deduplicated.append(result)
        
        return deduplicated

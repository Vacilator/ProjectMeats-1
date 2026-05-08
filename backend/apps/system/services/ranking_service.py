"""
Entity Ranking Service

Provides intelligent scoring and ranking for search results and entity lists.

Scoring Factors:
- Recency (0-40 points): When was this entity last interacted with?
- Relevance (0-30 points): How well does it match the query?
- Value (0-20 points): Is this a high-value entity?
- Activity (0-10 points): How frequently is this entity used?

Total Score: 0-100 points

Created: 2026-02-23 - Cockpit Phase 2A Smart Rankings
"""

from datetime import timedelta
from typing import Any, Dict, List, Optional

from django.db.models import Sum
from django.utils import timezone


class EntityRanking:
    """Calculate ranking scores for entities across the system"""

    @staticmethod
    def score_recency(last_activity_date: Optional[timezone.datetime]) -> int:
        """
        Score based on last interaction date.

        Args:
            last_activity_date: Last interaction datetime

        Returns:
            Score from 0-40 points
        """
        if not last_activity_date:
            return 0

        days_ago = (timezone.now() - last_activity_date).days

        if days_ago == 0:
            return 40  # Today
        elif days_ago <= 7:
            return 35  # This week
        elif days_ago <= 30:
            return 25  # This month
        elif days_ago <= 90:
            return 15  # Last 3 months
        else:
            return max(0, 10 - (days_ago // 90))  # Older, decreasing

    @staticmethod
    def score_relevance(query: str, entity_name: str, entity_fields: Optional[Dict[str, str]] = None) -> int:
        """
        Score based on query match quality.

        Args:
            query: Search query string
            entity_name: Primary entity name/title
            entity_fields: Additional fields to check (optional)

        Returns:
            Score from 0-30 points
        """
        if not query:
            return 15  # No query, all equally relevant

        query_lower = query.lower()
        name_lower = entity_name.lower()

        # Exact match
        if query_lower == name_lower:
            return 30

        # Starts with query
        if name_lower.startswith(query_lower):
            return 25

        # Contains query in name
        if query_lower in name_lower:
            return 20

        # Match in other fields
        if entity_fields:
            for field_value in entity_fields.values():
                if field_value and query_lower in str(field_value).lower():
                    return 15

        # Fuzzy match (word boundaries)
        words = name_lower.split()
        for word in words:
            if word.startswith(query_lower):
                return 12

        return 5  # Weak or no match

    @staticmethod
    def score_value_customer(customer) -> int:
        """
        Score customer based on value/importance.

        Args:
            customer: Customer model instance

        Returns:
            Score from 0-20 points
        """
        try:
            # Calculate total order value
            total_orders = customer.sales_orders.aggregate(total=Sum("total_amount"))["total"] or 0

            if total_orders > 100000:
                return 20  # High-value customer
            elif total_orders > 50000:
                return 15
            elif total_orders > 10000:
                return 10
            elif total_orders > 1000:
                return 6
            else:
                return 3  # Low-value but still a customer

        except Exception:
            return 5  # Default if calculation fails

    @staticmethod
    def score_value_supplier(supplier) -> int:
        """
        Score supplier based on value/importance.

        Args:
            supplier: Supplier model instance

        Returns:
            Score from 0-20 points
        """
        try:
            # Calculate total purchase order value
            total_purchases = supplier.purchase_orders.aggregate(total=Sum("total_amount"))["total"] or 0

            if total_purchases > 100000:
                return 20  # High-value supplier
            elif total_purchases > 50000:
                return 15
            elif total_purchases > 10000:
                return 10
            elif total_purchases > 1000:
                return 6
            else:
                return 3

        except Exception:
            return 5

    @staticmethod
    def score_value(entity_type: str, entity: Any) -> int:
        """
        Score entity based on type-specific value metrics.

        Args:
            entity_type: Type of entity ('customer', 'supplier', etc.)
            entity: Entity model instance

        Returns:
            Score from 0-20 points
        """
        if entity_type == "customer":
            return EntityRanking.score_value_customer(entity)
        elif entity_type == "supplier":
            return EntityRanking.score_value_supplier(entity)
        elif entity_type == "product":
            # Product value based on usage/sales
            return 10  # Default for now
        else:
            return 10  # Default for unknown types

    @staticmethod
    def score_activity_customer(customer) -> int:
        """
        Score customer based on interaction frequency.

        Args:
            customer: Customer model instance

        Returns:
            Score from 0-10 points
        """
        try:
            ninety_days_ago = timezone.now() - timedelta(days=90)

            # Count all interactions in last 90 days
            activity_count = (
                customer.sales_orders.filter(created_at__gte=ninety_days_ago).count()
                + customer.inquiries.filter(created_at__gte=ninety_days_ago).count()
            )

            # Check for call logs if available
            if hasattr(customer, "call_logs"):
                activity_count += customer.call_logs.filter(created_at__gte=ninety_days_ago).count()

            if activity_count > 20:
                return 10  # Very active
            elif activity_count > 10:
                return 8
            elif activity_count > 5:
                return 5
            elif activity_count > 0:
                return 3
            else:
                return 1  # No recent activity

        except Exception:
            return 5

    @staticmethod
    def score_activity(entity_type: str, entity: Any) -> int:
        """
        Score entity based on type-specific activity metrics.

        Args:
            entity_type: Type of entity
            entity: Entity model instance

        Returns:
            Score from 0-10 points
        """
        if entity_type == "customer":
            return EntityRanking.score_activity_customer(entity)
        elif entity_type == "supplier":
            # Similar logic for suppliers
            return EntityRanking.score_activity_customer(entity)  # Reuse for now
        else:
            return 5  # Default

    @staticmethod
    def calculate_total_score(
        query: str, entity_type: str, entity: Any, last_activity_date: Optional[timezone.datetime] = None
    ) -> int:
        """
        Calculate total ranking score for an entity.

        Args:
            query: Search query
            entity_type: Type of entity
            entity: Entity model instance
            last_activity_date: Optional override for last activity

        Returns:
            Total score (0-100)
        """
        # Get entity name
        entity_name = str(entity)

        # Get last activity date
        if last_activity_date is None:
            last_activity_date = getattr(entity, "updated_at", None) or getattr(entity, "created_at", None)

        # Calculate component scores
        recency_score = EntityRanking.score_recency(last_activity_date)
        relevance_score = EntityRanking.score_relevance(query, entity_name)
        value_score = EntityRanking.score_value(entity_type, entity)
        activity_score = EntityRanking.score_activity(entity_type, entity)

        total_score = recency_score + relevance_score + value_score + activity_score

        return min(100, max(0, total_score))  # Clamp to 0-100


class EntityLabels:
    """Generate contextual labels for entity display"""

    @staticmethod
    def get_labels(entity_type: str, entity: Any) -> List[Dict[str, str]]:
        """
        Generate smart labels for UI display.

        Args:
            entity_type: Type of entity
            entity: Entity model instance

        Returns:
            List of label dicts with 'text' and 'color' keys
        """
        labels = []

        try:
            if entity_type == "customer":
                labels.extend(EntityLabels._customer_labels(entity))
            elif entity_type == "supplier":
                labels.extend(EntityLabels._supplier_labels(entity))
            elif entity_type == "product":
                labels.extend(EntityLabels._product_labels(entity))
        except Exception:
            # Fail gracefully - don't break rendering if labels fail
            pass

        return labels

    @staticmethod
    def _customer_labels(customer) -> List[Dict[str, str]]:
        """Generate labels for customer entities"""
        labels = []

        # Recency label
        last_activity = getattr(customer, "updated_at", None)
        if last_activity:
            days_ago = (timezone.now() - last_activity).days
            if days_ago == 0:
                labels.append({"text": "Active today", "color": "success"})
            elif days_ago <= 3:
                labels.append({"text": f"{days_ago}d ago", "color": "info"})
            elif days_ago <= 30:
                labels.append({"text": f"{days_ago}d ago", "color": "warning"})
            elif days_ago > 90:
                labels.append({"text": "Inactive", "color": "error"})

        # Value label
        try:
            total_value = customer.sales_orders.aggregate(total=Sum("total_amount"))["total"] or 0
            if total_value > 100000:
                labels.append({"text": "High-value", "color": "success"})
            elif total_value > 50000:
                labels.append({"text": "Medium-value", "color": "info"})
        except Exception:
            pass

        # Activity label
        try:
            open_inquiries = customer.inquiries.filter(status="open").count()
            if open_inquiries > 0:
                labels.append({"text": f"{open_inquiries} open", "color": "warning"})
        except Exception:
            pass

        return labels

    @staticmethod
    def _supplier_labels(supplier) -> List[Dict[str, str]]:
        """Generate labels for supplier entities"""
        labels = []

        # Similar to customer labels
        try:
            active_pos = supplier.purchase_orders.filter(status__in=["pending", "confirmed"]).count()
            if active_pos > 0:
                labels.append({"text": f"{active_pos} active POs", "color": "info"})
        except Exception:
            pass

        return labels

    @staticmethod
    def _product_labels(product) -> List[Dict[str, str]]:
        """Generate labels for product entities"""
        labels = []

        # Stock status
        try:
            if hasattr(product, "stock_level"):
                if product.stock_level == 0:
                    labels.append({"text": "Out of stock", "color": "error"})
                elif product.stock_level < 10:
                    labels.append({"text": "Low stock", "color": "warning"})
        except Exception:
            pass

        return labels

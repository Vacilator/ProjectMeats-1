"""
Product validation logic.

Prevents "Zombie Products" by enforcing referential integrity between
Product.protein_type and SystemChoiceItem values in the 'protein_type' choice list.

This ensures:
1. Only valid protein types from SystemChoiceList can be assigned
2. Data contract consistency across all tiers (System, Tenant, WorkForm)
3. Cascade filtering reliability (no mismatched slugs)

Phase 3: Data Architecture - Validation Layer
"""
from django.core.exceptions import ValidationError
from typing import Optional, List


class ProductValidator:
    """
    Validates Product fields against SystemChoiceList constraints.
    
    Usage:
        # In Product model
        from apps.system.validators.product_validators import ProductValidator
        
        def clean(self):
            ProductValidator.validate_protein_type(self.protein_type)
    """
    
    @staticmethod
    def get_valid_protein_types() -> List[str]:
        """
        Fetch all valid protein_type values from SystemChoiceList.
        
        Returns:
            List of valid lowercase protein type slugs (e.g., ['beef', 'pork', 'poultry'])
        """
        from apps.system.models import SystemChoiceList, SystemChoiceItem
        
        try:
            choice_list = SystemChoiceList.objects.get(slug='protein_type')
            # Only active, system-level (tenant=None) items
            valid_items = SystemChoiceItem.objects.filter(
                choice_list=choice_list,
                is_active=True,
                tenant__isnull=True  # System-level only
            ).values_list('value', flat=True)
            
            return list(valid_items)
        except SystemChoiceList.DoesNotExist:
            # If choice list doesn't exist yet, allow any value (during migrations)
            return []
    
    @staticmethod
    def validate_protein_type(value: Optional[str]) -> None:
        """
        Validate that protein_type matches a valid SystemChoiceItem.
        
        Args:
            value: Protein type slug (e.g., 'beef', 'pork')
        
        Raises:
            ValidationError: If value is not in valid choices
        """
        # Allow blank/empty values
        if not value:
            return
        
        # Normalize to lowercase for comparison
        normalized_value = value.lower().strip()
        
        # Get valid choices
        valid_choices = ProductValidator.get_valid_protein_types()
        
        # Skip validation if choice list not initialized (e.g., during initial migrations)
        if not valid_choices:
            return
        
        # Check if value is valid
        if normalized_value not in valid_choices:
            raise ValidationError(
                f"Invalid protein_type '{value}'. Must be one of: {', '.join(valid_choices)}. "
                f"Protein types are defined in SystemChoiceList 'protein_type'. "
                f"To add new types, use seed_system_choices.py or Django Admin."
            )
    
    @staticmethod
    def validate_category(value: Optional[str]) -> None:
        """
        Validate that category is one of the allowed choices.
        
        Args:
            value: Category value (e.g., 'BEEF', 'PORK')
        
        Raises:
            ValidationError: If value is not in ProductCategoryChoices
        
        Note: This validator is less critical since category uses Django's
        built-in choices validation. Kept for consistency.
        """
        if not value:
            return
        
        from apps.system.models.product import ProductCategoryChoices
        
        valid_categories = [choice[0] for choice in ProductCategoryChoices.choices]
        
        if value not in valid_categories:
            raise ValidationError(
                f"Invalid category '{value}'. Must be one of: {', '.join(valid_categories)}"
            )


# Convenience functions for use in forms/serializers
def validate_protein_type(value: str) -> None:
    """Shortcut for ProductValidator.validate_protein_type()"""
    ProductValidator.validate_protein_type(value)


def validate_category(value: str) -> None:
    """Shortcut for ProductValidator.validate_category()"""
    ProductValidator.validate_category(value)

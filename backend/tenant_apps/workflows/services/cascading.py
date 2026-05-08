"""
Cascading Field Service (Phase 2.3: Entity Cascading)

Provides filtering logic for dependent fields based on parent field selections.
Example: When "Beef" is selected in protein_type, only beef cuts appear in the cuts dropdown.
"""
from typing import Any, Dict, List

from tenant_apps.workflows.models import TenantFormField


class CascadingFieldService:
    """
    Service for handling cascading field dependencies.

    Workflow:
    1. Frontend selects parent field value (e.g., protein_type = "Beef")
    2. Frontend calls /api/v1/forms/{id}/fields/{field_id}/options/?parent_value=Beef
    3. Service filters queryset based on cascade_filter_key
    4. Returns filtered options as JSON
    """

    @staticmethod
    def get_cascaded_options(field: TenantFormField, parent_value: Any, tenant_id: str) -> List[Dict[str, Any]]:
        """
        Get filtered options for a cascading field based on parent value.

        Args:
            field: TenantFormField with cascade_enabled=True
            parent_value: Value selected in parent field
            tenant_id: Current tenant UUID

        Returns:
            List of option dicts with keys: value, label

        Example:
            Parent field: protein_type (select from ["Beef", "Chicken", "Pork"])
            Child field: product_cuts (cascade_filter_key="type_of_protein")
            parent_value: "Beef"

            Returns: [
                {"value": "ribeye", "label": "Ribeye Steak"},
                {"value": "sirloin", "label": "Sirloin"},
                ...only beef products...
            ]
        """
        if not field.cascade_enabled or not field.cascade_parent_field:
            raise ValueError(f"Field {field.field_key} does not have cascading enabled")

        if not field.cascade_filter_key:
            raise ValueError(f"Field {field.field_key} missing cascade_filter_key")

        # Determine the entity model being filtered
        entity_type = field.form_entity.entity_type

        # Import the model dynamically
        model_class = CascadingFieldService._get_model_class(entity_type)

        # Build filter query
        filter_kwargs = {"tenant_id": tenant_id, field.cascade_filter_key: parent_value}

        # Query filtered options
        queryset = model_class.objects.filter(**filter_kwargs)

        # Extract options based on field type
        options = []
        for obj in queryset[:100]:  # Limit to 100 options for performance
            options.append({"value": str(obj.id) if hasattr(obj, "id") else str(obj.pk), "label": str(obj)})

        return options

    @staticmethod
    def _get_model_class(entity_type: str):
        """
        Dynamically import model class from entity_type string.

        Args:
            entity_type: Snake-case model name (e.g., 'product', 'supplier', 'purchase_order')

        Returns:
            Django model class

        Raises:
            ImportError: If model not found
        """
        # Map entity_type to app.model path
        entity_to_app = {
            "product": "tenant_apps.products.models",
            "supplier": "tenant_apps.suppliers.models",
            "customer": "tenant_apps.customers.models",
            "purchase_order": "tenant_apps.purchase_orders.models",
            "sales_order": "tenant_apps.sales_orders.models",
            "invoice": "tenant_apps.invoices.models",
        }

        if entity_type not in entity_to_app:
            raise ImportError(f"Unknown entity_type: {entity_type}")

        # Import model
        module_path = entity_to_app[entity_type]
        module = __import__(module_path, fromlist=[""])

        from apps.core.utils.naming import snake_to_pascal

        # Convert snake_case to PascalCase (e.g., purchase_order -> PurchaseOrder)
        model_name = snake_to_pascal(entity_type)

        if not hasattr(module, model_name):
            raise ImportError(f"Model {model_name} not found in {module_path}")

        return getattr(module, model_name)

    @staticmethod
    def validate_cascade_configuration(field: TenantFormField) -> Dict[str, Any]:
        """
        Validate cascading configuration for a field.

        Args:
            field: TenantFormField to validate

        Returns:
            Dict with keys: valid (bool), errors (list of str)
        """
        errors = []

        if field.cascade_enabled:
            if not field.cascade_parent_field:
                errors.append("cascade_parent_field is required when cascade_enabled=True")

            if not field.cascade_filter_key:
                errors.append("cascade_filter_key is required when cascade_enabled=True")

            # Check for circular dependencies
            visited = set()
            current = field
            while current and current.cascade_parent_field:
                if current.id in visited:
                    errors.append(f"Circular cascade dependency detected for field {field.field_key}")
                    break
                visited.add(current.id)
                current = current.cascade_parent_field

            # Validate filter key exists in model
            try:
                model_class = CascadingFieldService._get_model_class(field.form_entity.entity_type)
                if not hasattr(model_class, field.cascade_filter_key):
                    errors.append(
                        f"Filter key '{field.cascade_filter_key}' does not exist in "
                        f"{field.form_entity.entity_type} model"
                    )
            except ImportError as e:
                errors.append(str(e))

        return {"valid": len(errors) == 0, "errors": errors}

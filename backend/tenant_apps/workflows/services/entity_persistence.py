"""
Entity Persistence Service.

Handles the creation of actual entity records from form submission data.
This service maps form field values to Django model instances for each
entity type (Supplier, Customer, PurchaseOrder, etc.).

Architecture:
- Each entity type has its own model class
- Field mappings are defined per entity type
- Foreign key relationships are resolved using step-to-step references
- All entity creation happens within a database transaction
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from django.db import transaction
from django.apps import apps
from django.contrib.auth.models import User

from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


# =============================================================================
# ENTITY MODEL REGISTRY
# =============================================================================

# Maps entity_type strings to (app_label, model_name) tuples
ENTITY_MODEL_REGISTRY: Dict[str, Tuple[str, str]] = {
    'supplier': ('suppliers', 'Supplier'),
    'customer': ('customers', 'Customer'),
    'purchase_order': ('purchase_orders', 'PurchaseOrder'),
    'sales_order': ('sales_orders', 'SalesOrder'),
    'invoice': ('invoices', 'Invoice'),
    'plant': ('plants', 'Plant'),
    'location': ('locations', 'Location'),
    'contact': ('contacts', 'Contact'),
    'carrier': ('carriers', 'Carrier'),
    'product': ('products', 'Product'),
    'inquiry': ('inquiries', 'Inquiry'),
    'fulfillment': ('fulfillments', 'Fulfillment'),
}

# Fields that are auto-generated or should be skipped during creation
SKIP_FIELDS = {
    'id', 'pk', 'tenant', 'tenant_id',
    'created_at', 'updated_at', 'created_by', 'updated_by',
    'created_on', 'modified_on', 'modified_by',
    '__created_at', '__updated_at', '__created_by', '__updated_by', '__id',
}

# Fields that reference other steps (foreign key placeholders)
STEP_REFERENCE_SUFFIX = '_step_ref'


# =============================================================================
# ENTITY PERSISTENCE SERVICE
# =============================================================================

class EntityPersistenceService:
    """
    Service for creating entity records from form submission data.
    
    Usage:
        service = EntityPersistenceService(submission, user=request.user)
        created_entities = service.persist_all()
    """
    
    def __init__(self, submission, user: Optional[User] = None):
        """
        Initialize with a FormSubmission instance.
        
        Args:
            submission: FormSubmission instance with data and step info
            user: Optional user who is submitting (for created_by tracking)
        """
        self.submission = submission
        self.tenant = submission.tenant
        self.form_data = submission.data or {}
        self.user = user or submission.created_by
        
        # Cache of created entities: { step_id: entity_instance }
        self.created_entities: Dict[str, Any] = {}
        
        # Errors encountered during persistence
        self.errors: List[str] = []
    
    def get_model_class(self, entity_type: str):
        """
        Get the Django model class for an entity type.
        
        Args:
            entity_type: String like 'supplier', 'customer', etc.
            
        Returns:
            Model class or None if not found
        """
        if entity_type not in ENTITY_MODEL_REGISTRY:
            logger.warning(f"Unknown entity type: {entity_type}")
            return None
        
        app_label, model_name = ENTITY_MODEL_REGISTRY[entity_type]
        try:
            return apps.get_model(app_label, model_name)
        except LookupError:
            logger.error(f"Model not found: {app_label}.{model_name}")
            return None
    
    def resolve_foreign_key(self, field_key: str, value: Any, step_data: Dict) -> Any:
        """
        Resolve a foreign key value.
        
        Handles:
        1. Step references: value is a step_id pointing to an entity created earlier
        2. Entity IDs: value is a UUID of an existing entity
        3. None/empty: returns None
        
        Args:
            field_key: The field key (e.g., 'supplier_id', 'customer_step_ref')
            value: The value from form data
            step_data: The full step data for context
            
        Returns:
            Resolved entity instance or None
        """
        if not value:
            return None
        
        # Check if this is a step reference (from a previous step in the same form)
        step_ref_key = f"{field_key.replace('_id', '')}{STEP_REFERENCE_SUFFIX}"
        if step_ref_key in step_data and step_data[step_ref_key]:
            referenced_step_id = step_data[step_ref_key]
            if referenced_step_id in self.created_entities:
                return self.created_entities[referenced_step_id]
            logger.warning(f"Step reference {referenced_step_id} not found in created entities")
            return None
        
        # If it looks like a step ID (UUID format), check created entities
        if isinstance(value, str) and len(value) == 36:
            if value in self.created_entities:
                return self.created_entities[value]
        
        # Otherwise, try to resolve as an existing entity ID
        # Extract entity type from field key (e.g., supplier_id -> supplier)
        if field_key.endswith('_id'):
            entity_type = field_key[:-3]  # Remove '_id'
            model_class = self.get_model_class(entity_type)
            if model_class:
                try:
                    return model_class.objects.get(
                        pk=value,
                        tenant=self.tenant
                    )
                except model_class.DoesNotExist:
                    logger.warning(f"Entity not found: {entity_type} with ID {value}")
                except Exception as e:
                    logger.error(f"Error resolving FK {field_key}={value}: {e}")
        
        return None
    
    def prepare_entity_data(
        self, 
        entity_type: str, 
        step_data: Dict[str, Any],
        model_class
    ) -> Dict[str, Any]:
        """
        Prepare data for entity creation.
        
        Maps form field values to model fields, resolves foreign keys,
        and filters out skip fields.
        
        Args:
            entity_type: The entity type string
            step_data: Form data for this step: { field_key: value }
            model_class: The Django model class
            
        Returns:
            Dict of field_name: value ready for model creation
        """
        entity_data = {
            'tenant': self.tenant
        }
        
        # Add created_by if the model supports it and we have a user
        model_field_names = {f.name for f in model_class._meta.get_fields()}
        if 'created_by' in model_field_names and self.user:
            entity_data['created_by'] = self.user
        
        for field_key, value in step_data.items():
            # Skip internal/auto fields
            if field_key in SKIP_FIELDS or field_key.startswith('__'):
                continue
            
            # Skip step reference markers (handled separately)
            if field_key.endswith(STEP_REFERENCE_SUFFIX):
                continue
            
            # Handle foreign key fields
            if field_key.endswith('_id'):
                resolved = self.resolve_foreign_key(field_key, value, step_data)
                if resolved is not None:
                    # Use the field name without _id suffix for the model
                    fk_field_name = field_key[:-3]
                    if fk_field_name in model_field_names:
                        entity_data[fk_field_name] = resolved
                continue
            
            # Regular field - check if it exists on the model
            if field_key in model_field_names:
                # Handle empty strings for non-text fields
                if value == '' or value is None:
                    # Let the model handle defaults
                    continue
                
                # Handle array fields (lists)
                field_obj = model_class._meta.get_field(field_key)
                if hasattr(field_obj, 'base_field'):  # ArrayField
                    if isinstance(value, str):
                        # Try to parse as comma-separated
                        value = [v.strip() for v in value.split(',') if v.strip()]
                    elif not isinstance(value, list):
                        value = [value] if value else []
                
                entity_data[field_key] = value
        
        return entity_data
    
    def create_entity(self, step) -> Optional[Any]:
        """
        Create an entity record for a single form step.
        
        Args:
            step: TenantFormEntity instance
            
        Returns:
            Created entity instance or None on failure
        """
        step_id = str(step.id)
        entity_type = step.entity_type
        
        # Get step data from form submission
        step_data = self.form_data.get(step_id, {})
        
        if not step_data:
            logger.info(f"No data for step {step_id} ({entity_type}), skipping")
            return None
        
        # Get the model class
        model_class = self.get_model_class(entity_type)
        if not model_class:
            self.errors.append(f"Unknown entity type: {entity_type}")
            return None
        
        # Prepare entity data
        entity_data = self.prepare_entity_data(entity_type, step_data, model_class)
        
        try:
            # Create the entity
            entity = model_class.objects.create(**entity_data)
            
            # Cache for FK resolution in subsequent steps
            self.created_entities[step_id] = entity
            
            logger.info(f"Created {entity_type} with ID {entity.pk} from step {step_id}")
            return entity
            
        except Exception as e:
            error_msg = f"Failed to create {entity_type} from step {step_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.errors.append(error_msg)
            return None
    
    @transaction.atomic
    def persist_all(self) -> Dict[str, Any]:
        """
        Create all entity records from the form submission.
        
        Processes steps in order so that foreign key references
        between steps can be resolved.
        
        All entity creation happens within a database transaction.
        If any entity fails to create, all entities are rolled back.
        
        Returns:
            Dict with:
                - success: bool (True only if ALL entities created successfully)
                - created_entities: { step_id: { entity_type, entity_id } }
                - errors: list of error messages
                - partial: bool (True if some but not all entities created)
        """
        result = {
            'success': True,
            'created_entities': {},
            'errors': [],
            'partial': False
        }
        
        # Get form steps in order
        steps = self.submission.form.entities.all().order_by('order')
        
        if not steps.exists():
            result['errors'].append("No steps found in form")
            result['success'] = False
            return result
        
        steps_with_data = 0
        entities_created = 0
        
        # Create entities in step order (important for FK resolution)
        for step in steps:
            step_id = str(step.id)
            step_data = self.form_data.get(step_id, {})
            
            # Count steps that have data
            if step_data:
                steps_with_data += 1
            
            entity = self.create_entity(step)
            
            if entity:
                entities_created += 1
                result['created_entities'][step_id] = {
                    'entity_type': step.entity_type,
                    'entity_id': str(entity.pk),
                    'step_name': step.step_name or step.entity_type,
                }
        
        # Check for errors
        if self.errors:
            result['errors'] = self.errors
            result['success'] = False
            
            # If some entities were created but not all, mark as partial
            if entities_created > 0 and entities_created < steps_with_data:
                result['partial'] = True
                # Transaction will rollback on error, so no partial state
        
        # Update submission with created entity references
        if result['success'] and result['created_entities']:
            self._update_submission_with_entities(result['created_entities'])
        
        return result
    
    def _update_submission_with_entities(self, created_entities: Dict):
        """
        Update the submission record with references to created entities.
        
        Stores the mapping in submission.data under '__created_entities__' key.
        """
        try:
            if not self.submission.data:
                self.submission.data = {}
            
            self.submission.data['__created_entities__'] = created_entities
            self.submission.save(update_fields=['data', 'updated_at'])
        except Exception as e:
            logger.error(f"Failed to update submission with entity refs: {e}")


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

def persist_form_submission(submission, user: Optional[User] = None) -> Dict[str, Any]:
    """
    Convenience function to persist form submission data to entity records.
    
    Args:
        submission: FormSubmission instance
        user: Optional user who is submitting
        
    Returns:
        Result dict with success, created_entities, errors
    """
    service = EntityPersistenceService(submission, user=user)
    return service.persist_all()

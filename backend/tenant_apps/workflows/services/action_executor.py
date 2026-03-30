"""
Action Executor Service.

Phase 5 Part 2 - Executes workflow actions (email, CRUD, documents, notifications).

Handlers:
- send_email: Email with template variables
- create_record: Create entity record with field mappings
- update_record: Update entity record fields
- generate_pdf: PDF generation (stub for now)
- sign_document: Document signing workflow (stub)
- upload_document: Upload to storage (stub)
- store_document: Archive document (stub)
- send_notification: In-app notifications
"""
import logging
import re
from typing import Dict, Any, Optional
from django.core.mail import send_mail
from django.conf import settings
from django.apps import apps

from apps.tenants.email_utils import is_sendgrid_quota_exceeded

logger = logging.getLogger(__name__)


class ActionExecutor:
    """Executes workflow actions with context variable resolution."""
    
    def __init__(self, tenant, context: Dict[str, Any]):
        """
        Initialize executor.
        
        Args:
            tenant: Tenant instance for isolation
            context: Execution context with variables
        """
        self.tenant = tenant
        self.context = context
        
    def execute(self, action_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an action based on type.
        
        Args:
            action_type: Type of action
            config: Action configuration
        
        Returns:
            dict: Execution result
        """
        handlers = {
            'email': self.send_email,
            'send_email': self.send_email,
            'create_record': self.create_record,
            'update_record': self.update_record,
            'generate_pdf': self.generate_pdf,
            'sign_document': self.sign_document,
            'upload_document': self.upload_document,
            'store_document': self.store_document,
            'send_notification': self.send_notification,
        }
        
        handler = handlers.get(action_type)
        if not handler:
            logger.warning(f"Unknown action type: {action_type}")
            return {'success': False, 'error': f'Unknown action type: {action_type}'}
        
        try:
            return handler(config)
        except Exception as e:
            logger.exception(f"Error executing action {action_type}: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def send_email(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send email with template variable resolution.
        
        Config:
            to: Email address or {{variable}}
            subject: Email subject with {{variables}}
            body: Email body with {{variables}}
            cc: Optional CC addresses
            bcc: Optional BCC addresses
        """
        try:
            # Resolve template variables
            to_email = self._resolve_template(config.get('to', ''))
            subject = self._resolve_template(config.get('subject', ''))
            body = self._resolve_template(config.get('body', ''))
            
            if not to_email or not subject:
                return {'success': False, 'error': 'Missing required fields: to, subject'}
            
            # Send email
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[to_email],
                fail_silently=False,
            )
            
            logger.info(f"Email sent to {to_email}: {subject}")
            
            return {
                'success': True,
                'to': to_email,
                'subject': subject,
            }
            
        except Exception as e:
            if is_sendgrid_quota_exceeded(e):
                logger.critical(
                    "🚨 SendGrid quota exceeded — workflow action email to %s NOT sent. "
                    "Please upgrade the SendGrid plan or wait for the quota to reset. "
                    "Error: %s",
                    to_email,
                    e,
                )
            else:
                logger.exception(f"Error sending email: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def create_record(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new entity record.
        
        Config:
            entity_type: Type of entity (customer, supplier, etc.)
            field_mappings: Dict of field -> value/{{variable}}
        """
        try:
            entity_type = config.get('entity_type')
            field_mappings = config.get('field_mappings', {})
            
            if not entity_type:
                return {'success': False, 'error': 'Missing entity_type'}
            
            # Get model class
            model = self._get_model_for_entity(entity_type)
            if not model:
                return {'success': False, 'error': f'Unknown entity type: {entity_type}'}
            
            # Resolve field values
            data = {'tenant': self.tenant}
            for field_name, value_template in field_mappings.items():
                if isinstance(value_template, str):
                    data[field_name] = self._resolve_template(value_template)
                else:
                    data[field_name] = value_template
            
            # Create record
            instance = model.objects.create(**data)
            
            logger.info(f"Created {entity_type} record: {instance.id}")
            
            return {
                'success': True,
                'entity_type': entity_type,
                'entity_id': instance.id,
                'data': data,
            }
            
        except Exception as e:
            logger.exception(f"Error creating record: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def update_record(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing entity record.
        
        Config:
            entity_type: Type of entity
            entity_id: ID of record or {{variable}}
            field_updates: Dict of field -> new value/{{variable}}
        """
        try:
            entity_type = config.get('entity_type')
            entity_id_template = config.get('entity_id')
            field_updates = config.get('field_updates', {})
            
            if not entity_type or not entity_id_template:
                return {'success': False, 'error': 'Missing entity_type or entity_id'}
            
            # Resolve entity ID
            entity_id = self._resolve_template(str(entity_id_template))
            
            # Get model and instance
            model = self._get_model_for_entity(entity_type)
            if not model:
                return {'success': False, 'error': f'Unknown entity type: {entity_type}'}
            
            instance = model.objects.get(id=entity_id, tenant=self.tenant)
            
            # Update fields
            updated_fields = {}
            for field_name, value_template in field_updates.items():
                if isinstance(value_template, str):
                    value = self._resolve_template(value_template)
                else:
                    value = value_template
                
                setattr(instance, field_name, value)
                updated_fields[field_name] = value
            
            instance.save()
            
            logger.info(f"Updated {entity_type} record {entity_id}: {updated_fields}")
            
            return {
                'success': True,
                'entity_type': entity_type,
                'entity_id': instance.id,
                'updated_fields': updated_fields,
            }
            
        except model.DoesNotExist:
            return {'success': False, 'error': f'{entity_type} record not found'}
        except Exception as e:
            logger.exception(f"Error updating record: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def generate_pdf(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate PDF document (stub - requires pdf-lib integration).
        
        Config:
            template: PDF template name
            data: Data to populate template
            filename: Output filename
        """
        logger.warning("generate_pdf not fully implemented - stub only")
        
        return {
            'success': True,
            'action': 'generate_pdf',
            'stub': True,
            'message': 'PDF generation stub - requires pdf-lib implementation',
        }
    
    def sign_document(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Initiate document signing workflow (stub).
        
        Config:
            document_id: Document to sign
            signers: List of signer emails
            deadline: Optional signing deadline
        """
        logger.warning("sign_document not fully implemented - stub only")
        
        return {
            'success': True,
            'action': 'sign_document',
            'stub': True,
            'message': 'Document signing stub - requires e-signature integration',
        }
    
    def upload_document(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Upload document to storage (stub).
        
        Config:
            file_path: Path to file
            storage_type: Storage backend
            folder: Destination folder
        """
        logger.warning("upload_document not fully implemented - stub only")
        
        return {
            'success': True,
            'action': 'upload_document',
            'stub': True,
            'message': 'Document upload stub - requires storage integration',
        }
    
    def store_document(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store/archive document (stub).
        
        Config:
            document_id: Document to archive
            retention_policy: Retention settings
        """
        logger.warning("store_document not fully implemented - stub only")
        
        return {
            'success': True,
            'action': 'store_document',
            'stub': True,
            'message': 'Document storage stub - requires archive system',
        }
    
    def send_notification(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send in-app notification.
        
        Config:
            user_id: User to notify or {{variable}}
            title: Notification title
            message: Notification message
            link: Optional link
        """
        try:
            user_id_template = config.get('user_id')
            title = self._resolve_template(config.get('title', ''))
            message = self._resolve_template(config.get('message', ''))
            
            if not user_id_template or not title:
                return {'success': False, 'error': 'Missing user_id or title'}
            
            user_id = self._resolve_template(str(user_id_template))
            
            # Create notification (assuming a Notification model exists)
            # For now, just log it
            logger.info(f"Notification for user {user_id}: {title}")
            
            return {
                'success': True,
                'user_id': user_id,
                'title': title,
                'message': message,
            }
            
        except Exception as e:
            logger.exception(f"Error sending notification: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def _resolve_template(self, template: str) -> str:
        """
        Resolve template variables like {{entity.name}}.
        
        Args:
            template: String with {{variable}} placeholders
        
        Returns:
            str: Resolved string
        """
        if not isinstance(template, str):
            return template
        
        # Find all {{variable}} patterns
        pattern = r'\{\{([^}]+)\}\}'
        matches = re.findall(pattern, template)
        
        result = template
        for var_path in matches:
            var_path = var_path.strip()
            value = self._get_nested_value(self.context, var_path)
            result = result.replace(f'{{{{{var_path}}}}}', str(value))
        
        return result
    
    def _get_nested_value(self, data: Dict, path: str) -> Any:
        """
        Get nested dictionary value by dot-separated path.
        
        Args:
            data: Dictionary to traverse
            path: Dot-separated path (e.g., 'entity.customer.email')
        
        Returns:
            Value at path or empty string
        """
        keys = path.split('.')
        current = data
        
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return ''
        
        return current
    
    def _get_model_for_entity(self, entity_type: str):
        """
        Get Django model class for entity type.
        
        Args:
            entity_type: Entity type string
        
        Returns:
            Model class or None
        """
        model_map = {
            'supplier': ('suppliers', 'Supplier'),
            'customer': ('customers', 'Customer'),
            'purchase_order': ('purchase_orders', 'PurchaseOrder'),
            'sales_order': ('sales_orders', 'SalesOrder'),
            'invoice': ('invoices', 'Invoice'),
            'product': ('system', 'Product'),
        }
        
        if entity_type not in model_map:
            return None
        
        app_label, model_name = model_map[entity_type]
        
        try:
            if app_label == 'system':
                return apps.get_model('system', model_name)

            return apps.get_model(f'tenant_apps.{app_label}', model_name)
        except LookupError:
            logger.error(f"Model not found: {app_label}.{model_name}")
            return None

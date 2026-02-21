"""
Action Executor Service

Phase 5 Part 2: Backend Integration
Executes workflow actions (email, record operations, documents, etc.)

Created: 2026-02-21
"""
import logging
from typing import Any, Dict
from django.core.mail import send_mail
from django.conf import settings
from django.apps import apps
from django.db import transaction

logger = logging.getLogger(__name__)


class ActionExecutor:
    """
    Executes workflow actions based on type and configuration.
    
    Phase 5 Part 2: Action Execution Engine
    Handles various action types with proper error handling and logging.
    """
    
    def execute(self, action_type: str, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an action based on its type.
        
        Args:
            action_type (str): Type of action ('email', 'create_record', etc.)
            config (dict): Action configuration
            context (dict): Execution context with available data
            
        Returns:
            dict: Execution result with success status and optional data
        """
        handlers = {
            'email': self.send_email,
            'create_record': self.create_record,
            'update_record': self.update_record,
            'generate_pdf': self.generate_pdf,
            'sign_document': self.sign_document,
            'upload_document': self.upload_document,
            'store_document': self.store_document,
            'notification': self.send_notification,
        }
        
        handler = handlers.get(action_type)
        if not handler:
            return {
                'success': False,
                'error': f'Unknown action type: {action_type}'
            }
        
        try:
            return handler(config, context)
        except Exception as e:
            logger.exception(f'[ActionExecutor] Failed to execute {action_type}: {e}')
            return {
                'success': False,
                'error': str(e)
            }
    
    # =========================================================================
    # EMAIL ACTIONS
    # =========================================================================
    
    def send_email(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send an email.
        
        Config keys:
            - to: Recipient email address or field reference
            - subject: Email subject (supports template variables)
            - body: Email body (supports template variables)
            - from_email: Sender email (optional)
            
        Returns:
            dict: Success status and message ID
        """
        # Resolve recipient
        to_email = self._resolve_value(config.get('to'), context)
        if not to_email:
            return {'success': False, 'error': 'No recipient email specified'}
        
        # Resolve subject and body
        subject = self._resolve_template(config.get('subject', 'Workflow Notification'), context)
        body = self._resolve_template(config.get('body', ''), context)
        from_email = config.get('from_email', settings.DEFAULT_FROM_EMAIL)
        
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[to_email],
                fail_silently=False
            )
            
            logger.info(f'[Email] Sent to {to_email}: {subject}')
            
            return {
                'success': True,
                'to': to_email,
                'subject': subject
            }
            
        except Exception as e:
            logger.error(f'[Email] Failed to send to {to_email}: {e}')
            return {
                'success': False,
                'error': str(e)
            }
    
    # =========================================================================
    # RECORD OPERATIONS
    # =========================================================================
    
    def create_record(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new record in the database.
        
        Config keys:
            - entity_type: Model name (e.g., 'customer', 'supplier')
            - field_mappings: Dict mapping field names to values or context references
            - tenant: Tenant reference (required for multi-tenancy)
            
        Returns:
            dict: Success status and created record ID
        """
        entity_type = config.get('entity_type')
        if not entity_type:
            return {'success': False, 'error': 'No entity_type specified'}
        
        # Get model
        model = self._get_model(entity_type)
        if not model:
            return {'success': False, 'error': f'Unknown entity type: {entity_type}'}
        
        # Build field values
        field_mappings = config.get('field_mappings', {})
        field_values = {}
        
        for field_name, value_config in field_mappings.items():
            field_values[field_name] = self._resolve_value(value_config, context)
        
        # Add tenant if model has tenant field
        if hasattr(model, 'tenant') and 'tenant' in context:
            field_values['tenant'] = context['tenant']
        
        try:
            with transaction.atomic():
                instance = model.objects.create(**field_values)
                
            logger.info(f'[CreateRecord] Created {entity_type} record: {instance.id}')
            
            return {
                'success': True,
                'entity_type': entity_type,
                'record_id': str(instance.id)
            }
            
        except Exception as e:
            logger.error(f'[CreateRecord] Failed to create {entity_type}: {e}')
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_record(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing record.
        
        Config keys:
            - entity_type: Model name
            - record_id: ID of record to update (or context reference)
            - field_mappings: Dict mapping field names to new values
            
        Returns:
            dict: Success status and updated record ID
        """
        entity_type = config.get('entity_type')
        record_id = self._resolve_value(config.get('record_id'), context)
        
        if not entity_type or not record_id:
            return {'success': False, 'error': 'Missing entity_type or record_id'}
        
        # Get model
        model = self._get_model(entity_type)
        if not model:
            return {'success': False, 'error': f'Unknown entity type: {entity_type}'}
        
        try:
            instance = model.objects.get(id=record_id)
            
            # Build field values
            field_mappings = config.get('field_mappings', {})
            update_fields = []
            
            for field_name, value_config in field_mappings.items():
                value = self._resolve_value(value_config, context)
                setattr(instance, field_name, value)
                update_fields.append(field_name)
            
            if update_fields:
                instance.save(update_fields=update_fields)
            
            logger.info(f'[UpdateRecord] Updated {entity_type} record: {record_id}')
            
            return {
                'success': True,
                'entity_type': entity_type,
                'record_id': str(record_id),
                'updated_fields': update_fields
            }
            
        except model.DoesNotExist:
            return {'success': False, 'error': f'Record not found: {record_id}'}
        except Exception as e:
            logger.error(f'[UpdateRecord] Failed to update {entity_type} {record_id}: {e}')
            return {'success': False, 'error': str(e)}
    
    # =========================================================================
    # DOCUMENT ACTIONS
    # =========================================================================
    
    def generate_pdf(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a PDF document.
        
        Phase 5 Part 2: Document Generation
        Uses template and field mappings to create PDF.
        
        Config keys:
            - template_source: 'library', 'upload', or 'url'
            - template_id: Template reference
            - output_format: 'pdf', 'docx', or 'html'
            - field_mappings: Data to populate template
            
        Returns:
            dict: Success status and document URL
        """
        # TODO: Integrate with pdf-lib or reportlab
        # For now, stub implementation
        
        template_source = config.get('template_source')
        output_format = config.get('output_format', 'pdf')
        
        logger.info(f'[GeneratePDF] Would generate {output_format} from {template_source}')
        
        return {
            'success': True,
            'document_url': '/media/generated/document.pdf',
            'format': output_format,
            'message': 'PDF generation not yet implemented (stub)'
        }
    
    def sign_document(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send document for e-signature.
        
        Config keys:
            - provider: 'docusign', 'hellosign', or 'adobe'
            - document_url: Document to sign
            - signers: List of signer emails
            - deadline: Signature deadline
            
        Returns:
            dict: Success status and envelope ID
        """
        provider = config.get('provider', 'docusign')
        signers = config.get('signers', [])
        
        logger.info(f'[SignDocument] Would send to {provider} for {len(signers)} signer(s)')
        
        return {
            'success': True,
            'provider': provider,
            'envelope_id': 'stub-envelope-123',
            'message': 'Document signature not yet implemented (stub)'
        }
    
    def upload_document(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Upload document to cloud storage.
        
        Config keys:
            - provider: 's3', 'gcs', 'azure', 'dropbox', 'onedrive'
            - folder_path: Destination folder
            - file_name: Name for uploaded file
            - document_url: Local document URL
            
        Returns:
            dict: Success status and cloud URL
        """
        provider = config.get('provider', 's3')
        folder_path = config.get('folder_path', '/')
        
        logger.info(f'[UploadDocument] Would upload to {provider}:{folder_path}')
        
        return {
            'success': True,
            'provider': provider,
            'cloud_url': f'{provider}://{folder_path}/document.pdf',
            'message': 'Document upload not yet implemented (stub)'
        }
    
    def store_document(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store document metadata in database.
        
        Config keys:
            - category: Document category
            - tags: List of tags
            - entity_type: Related entity type
            - entity_id: Related entity ID
            
        Returns:
            dict: Success status and document ID
        """
        category = config.get('category')
        tags = config.get('tags', [])
        
        logger.info(f'[StoreDocument] Would store with category={category}, tags={tags}')
        
        return {
            'success': True,
            'document_id': 'stub-doc-123',
            'message': 'Document storage not yet implemented (stub)'
        }
    
    def send_notification(self, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send in-app notification.
        
        Config keys:
            - user_id: Recipient user ID or context reference
            - title: Notification title
            - message: Notification message
            - type: Notification type ('info', 'success', 'warning', 'error')
            
        Returns:
            dict: Success status and notification ID
        """
        user_id = self._resolve_value(config.get('user_id'), context)
        title = self._resolve_template(config.get('title', 'Notification'), context)
        message = self._resolve_template(config.get('message', ''), context)
        
        # TODO: Create notification record in database
        
        logger.info(f'[Notification] Would notify user {user_id}: {title}')
        
        return {
            'success': True,
            'user_id': user_id,
            'title': title,
            'message': 'In-app notifications not yet implemented (stub)'
        }
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    def _get_model(self, entity_type: str):
        """
        Get Django model by entity type.
        
        Maps entity types to app_label.ModelName.
        """
        # Mapping of entity types to models
        model_map = {
            'customer': ('accounts', 'Customer'),
            'supplier': ('accounts', 'Supplier'),
            'purchase_order': ('procurement', 'PurchaseOrder'),
            'sales_order': ('sales', 'SalesOrder'),
            'invoice': ('invoicing', 'Invoice'),
            'product': ('inventory', 'Product'),
        }
        
        app_label, model_name = model_map.get(entity_type, (None, None))
        if not app_label:
            return None
        
        try:
            return apps.get_model(app_label, model_name)
        except LookupError:
            return None
    
    def _resolve_value(self, value_config, context: Dict[str, Any]) -> Any:
        """
        Resolve a value from config or context reference.
        
        Args:
            value_config: Either a literal value or a dict with 'source' key
            context: Execution context to look up values from
            
        Returns:
            Resolved value
        """
        if isinstance(value_config, dict):
            source = value_config.get('source')
            if source:
                # Context reference (e.g., "entity.customer.email")
                return self._get_nested_value(context, source)
        
        # Literal value
        return value_config
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """
        Get nested value from dict using dot notation path.
        
        Example: _get_nested_value(context, 'entity.customer.email')
        """
        parts = path.split('.')
        value = data
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        
        return value
    
    def _resolve_template(self, template: str, context: Dict[str, Any]) -> str:
        """
        Resolve template string with context variables.
        
        Supports {{variable}} syntax.
        
        Example: "Hello {{customer.name}}" with context={'customer': {'name': 'John'}}
        Returns: "Hello John"
        """
        import re
        
        def replace_var(match):
            var_path = match.group(1).strip()
            value = self._get_nested_value(context, var_path)
            return str(value) if value is not None else ''
        
        return re.sub(r'\{\{([^}]+)\}\}', replace_var, template)

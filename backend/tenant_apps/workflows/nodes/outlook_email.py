"""
OutlookEmailNode - Send emails via Microsoft Outlook.

This node sends emails using the tenant's connected Microsoft account.
Supports template variables from workflow context.
"""
import logging
import re
from typing import Dict, Any, List
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class OutlookEmailNode:
    """
    Workflow node for sending emails via Microsoft Outlook.
    
    Required config:
        - to: List of recipient email addresses (supports template variables)
        - subject: Email subject (supports template variables)
        - body: Email body (supports template variables)
        
    Optional config:
        - cc: List of CC email addresses
        - bcc: List of BCC email addresses
        - body_html: HTML version of email body
        - importance: 'low', 'normal', or 'high'
    """
    
    NODE_TYPE = 'outlook_email'
    
    def __init__(self, node_id: str, config: Dict[str, Any]):
        """
        Initialize email node.
        
        Args:
            node_id: Unique node identifier
            config: Node configuration with email parameters
        """
        self.node_id = node_id
        self.config = config
        self.validate_config()
    
    def validate_config(self):
        """Validate node configuration."""
        required_fields = ['to', 'subject', 'body']
        for field in required_fields:
            if field not in self.config:
                raise ValueError(f"Missing required field: {field}")
        
        # Validate 'to' is a list
        if not isinstance(self.config['to'], list):
            raise ValueError("'to' must be a list of email addresses")
        
        # Validate optional lists
        for field in ['cc', 'bcc']:
            if field in self.config and not isinstance(self.config[field], list):
                raise ValueError(f"'{field}' must be a list of email addresses")
        
        # Validate importance level
        if 'importance' in self.config:
            valid_levels = ['low', 'normal', 'high']
            if self.config['importance'] not in valid_levels:
                raise ValueError(f"'importance' must be one of: {', '.join(valid_levels)}")
    
    @staticmethod
    def validate_email_addresses(addresses: List[str]) -> List[str]:
        """
        Validate a list of email addresses.
        
        Args:
            addresses: List of email addresses to validate
            
        Returns:
            List of validated email addresses
            
        Raises:
            ValidationError: If any address is invalid
        """
        validated = []
        for addr in addresses:
            addr = addr.strip()
            if not addr:
                continue
            
            try:
                validate_email(addr)
                validated.append(addr)
            except ValidationError:
                raise ValidationError(f"Invalid email address: {addr}")
        
        return validated
    
    @staticmethod
    def render_template(template: str, context: Dict[str, Any]) -> str:
        """
        Render template with context variables.
        
        Supports {{variable}} syntax for simple variable substitution.
        
        Args:
            template: Template string with {{variable}} placeholders
            context: Dict of variables to substitute
            
        Returns:
            Rendered string with variables replaced
        """
        def replace_var(match):
            var_name = match.group(1).strip()
            # Support nested access with dot notation
            parts = var_name.split('.')
            value = context
            
            for part in parts:
                if isinstance(value, dict):
                    value = value.get(part, '')
                else:
                    value = ''
                    break
            
            return str(value) if value is not None else ''
        
        # Replace {{variable}} with context values
        return re.sub(r'\{\{([^}]+)\}\}', replace_var, template)
    
    def execute(self, context: Dict[str, Any], tenant_id: int) -> Dict[str, Any]:
        """
        Execute email node - send email via Microsoft Outlook.
        
        Args:
            context: Workflow execution context with variables
            tenant_id: Tenant ID for retrieving OAuth credentials
            
        Returns:
            Dict with execution result:
                - status: 'success' or 'error'
                - message: Result message
                - data: Additional data (message_id, etc.)
        """
        try:
            # Import here to avoid circular dependency
            from apps.integrations.models import ExternalAuthProvider
            from apps.integrations.providers import MicrosoftGraphProvider
            from apps.integrations.providers.base import EmailParams, TokenExpiredError
            
            # Get tenant's Microsoft auth provider
            try:
                auth_provider = ExternalAuthProvider.objects.get(
                    tenant_id=tenant_id,
                    provider_type='microsoft',
                    is_active=True
                )
            except ExternalAuthProvider.DoesNotExist:
                return {
                    'status': 'error',
                    'message': 'Microsoft account not connected. Please connect in Settings > Integrations.',
                    'node_id': self.node_id,
                }
            
            # Refresh token if needed
            if auth_provider.is_token_expired():
                logger.info(f"Refreshing expired token for tenant {tenant_id}")
                auth_provider.refresh_if_needed()
            
            # Get decrypted access token
            access_token = auth_provider.get_decrypted_token('access')
            
            # Render email template with context
            to_addresses = [
                self.render_template(addr, context) 
                for addr in self.config['to']
            ]
            subject = self.render_template(self.config['subject'], context)
            body = self.render_template(self.config['body'], context)
            
            # Build email parameters
            email_params: EmailParams = {
                'to': self.validate_email_addresses(to_addresses),
                'subject': subject,
                'body': body,
            }
            
            # Add optional fields
            if 'cc' in self.config:
                cc_addresses = [
                    self.render_template(addr, context) 
                    for addr in self.config['cc']
                ]
                email_params['cc'] = self.validate_email_addresses(cc_addresses)
            
            if 'bcc' in self.config:
                bcc_addresses = [
                    self.render_template(addr, context) 
                    for addr in self.config['bcc']
                ]
                email_params['bcc'] = self.validate_email_addresses(bcc_addresses)
            
            if 'body_html' in self.config:
                email_params['body_html'] = self.render_template(
                    self.config['body_html'], 
                    context
                )
            
            if 'importance' in self.config:
                email_params['importance'] = self.config['importance']
            
            # Send email via Microsoft Graph
            provider = MicrosoftGraphProvider(tenant_id)
            result = provider.send_email(access_token, email_params)
            
            logger.info(
                f"Email sent successfully via node {self.node_id}: "
                f"to={email_params['to']}, subject={subject}"
            )
            
            return {
                'status': 'success',
                'message': 'Email sent successfully',
                'node_id': self.node_id,
                'data': {
                    'provider': 'microsoft',
                    'to': email_params['to'],
                    'subject': subject,
                    **result,
                }
            }
            
        except TokenExpiredError:
            logger.error(f"Token expired for tenant {tenant_id} in node {self.node_id}")
            return {
                'status': 'error',
                'message': 'Email authentication expired. Please reconnect in Settings > Integrations.',
                'node_id': self.node_id,
            }
        
        except ValidationError as e:
            logger.error(f"Email validation error in node {self.node_id}: {str(e)}")
            return {
                'status': 'error',
                'message': f'Email validation error: {str(e)}',
                'node_id': self.node_id,
            }
        
        except Exception as e:
            logger.error(f"Error executing email node {self.node_id}: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': f'Failed to send email: {str(e)}',
                'node_id': self.node_id,
            }

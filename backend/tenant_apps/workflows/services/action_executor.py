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
import base64
import logging
import re
from typing import Any, Dict

from django.apps import apps
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from tenant_apps.contacts.services import resolve_supplier_contact_route

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
            "email": self.send_email,
            "send_email": self.send_email,
            "create_record": self.create_record,
            "update_record": self.update_record,
            "generate_pdf": self.generate_pdf,
            "sign_document": self.sign_document,
            "upload_document": self.upload_document,
            "store_document": self.store_document,
            "send_notification": self.send_notification,
            "generate_sales_order": self._e2e_generate_sales_order,
            "bid_selection": self._e2e_bid_selection,
            "check_bids": self._e2e_check_bids,
            "create_purchase_order": self._e2e_create_purchase_order,
            "resolve_contacts": self._e2e_resolve_contacts,
            "resolve_rfq_contacts_for_send": self._e2e_resolve_rfq_send,
            "bid_selection_with_contacts": self._e2e_bid_selection_contacts,
            "prefill_po_contacts": self._e2e_prefill_po_contacts,
        }

        handler = handlers.get(action_type)
        if not handler:
            logger.warning(f"Unknown action type: {action_type}")
            return {"success": False, "error": f"Unknown action type: {action_type}"}

        try:
            return handler(config)
        except Exception as e:
            logger.exception(f"Error executing action {action_type}: {str(e)}")
            return {"success": False, "error": str(e)}

    def send_email(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send email with template variable resolution.

        Config:
            to: Email address or {{variable}}
            subject: Email subject with {{variables}}
            body: Email body with {{variables}}
            cc: Optional CC addresses
            bcc: Optional BCC addresses
            recipient_strategy: Optional opt-in supplier routing strategy
        """
        try:
            recipients, routing_metadata, attachments = self._resolve_email_routing(config)
            subject = self._resolve_template(config.get("subject", ""))
            body = self._resolve_template(config.get("body", ""))

            cc = self._resolve_email_list(config.get("cc", []))
            bcc = self._resolve_email_list(config.get("bcc", []))

            if not recipients or not subject:
                return {"success": False, "error": "Missing required fields: to, subject"}

            message = EmailMultiAlternatives(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=recipients,
                cc=cc,
                bcc=bcc,
            )
            for attachment in attachments:
                message.attach(
                    attachment["name"],
                    base64.b64decode(attachment["content_base64"]),
                    attachment.get("content_type", "application/octet-stream"),
                )
            message.send(fail_silently=False)

            logger.info("Email sent to %s: %s", ", ".join(recipients), subject)

            return {
                "success": True,
                "to": recipients,
                "subject": subject,
                "routing": routing_metadata,
                "attachment_count": len(attachments),
            }

        except Exception as e:
            if is_sendgrid_quota_exceeded(e):
                logger.critical(
                    "🚨 SendGrid quota exceeded — workflow action email to %s NOT sent. "
                    "Please upgrade the SendGrid plan or wait for the quota to reset. "
                    "Error: %s",
                    ", ".join(recipients) if "recipients" in locals() else "",
                    e,
                )
            else:
                logger.exception(f"Error sending email: {str(e)}")
            return {"success": False, "error": str(e)}

    def _resolve_email_routing(self, config: Dict[str, Any]) -> tuple[list[str], dict[str, Any], list[dict[str, str]]]:
        strategy = str(config.get("recipient_strategy") or "").strip().lower()
        if strategy != "supplier_plant_contact":
            return self._resolve_email_list(config.get("to", "")), {}, []

        supplier_id = self._resolve_config_id(config.get("supplier_id"))
        inquiry_id = self._resolve_config_id(config.get("inquiry_id"))
        if not supplier_id:
            return [], {}, []

        Supplier = apps.get_model("suppliers", "Supplier")
        Inquiry = apps.get_model("inquiries", "Inquiry")

        supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
        inquiry = (
            Inquiry.objects.select_related("requested_master_product", "requested_master_product__system_product")
            .prefetch_related("products__product")
            .filter(id=inquiry_id, tenant=self.tenant)
            .first()
            if inquiry_id
            else None
        )

        if supplier is None:
            return [], {}, []

        focus = str(config.get("email_focus") or "").strip().lower() or "pricing"
        if focus == "auto" and inquiry is not None:
            shipping_type = str(getattr(inquiry, "shipping_type", "")).strip().lower()
            focus = "logistics" if shipping_type == "supplier_delivering" else "pricing"

        resolution = resolve_supplier_contact_route(
            tenant=self.tenant,
            supplier=supplier,
            inquiry=inquiry,
            focus=focus,
        )
        attachments = (
            [attachment.as_email_payload() for attachment in resolution.attachments]
            if config.get("include_responsibility_attachment", True)
            else []
        )
        recipients = [resolution.recipient_email] if resolution.recipient_email else []
        return recipients, resolution.as_dict(), attachments

    def _resolve_email_list(self, raw_value: Any) -> list[str]:
        values: list[str] = []
        if isinstance(raw_value, list):
            candidates = raw_value
        elif isinstance(raw_value, str):
            candidates = [item.strip() for item in raw_value.split(",")]
        else:
            candidates = [raw_value]

        for candidate in candidates:
            if isinstance(candidate, str):
                resolved = self._resolve_template(candidate).strip()
            else:
                resolved = str(candidate or "").strip()
            if resolved and resolved not in values:
                values.append(resolved)
        return values

    def _resolve_config_id(self, raw_value: Any) -> int | None:
        if raw_value in (None, ""):
            return None
        resolved = (
            self._resolve_template(str(raw_value)).strip() if isinstance(raw_value, str) else str(raw_value).strip()
        )
        if not resolved:
            return None
        try:
            return int(resolved)
        except (TypeError, ValueError):
            return None

    def create_record(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new entity record.

        Config:
            entity_type: Type of entity (customer, supplier, etc.)
            field_mappings: Dict of field -> value/{{variable}}
        """
        try:
            entity_type = config.get("entity_type")
            field_mappings = config.get("field_mappings", {})

            if not entity_type:
                return {"success": False, "error": "Missing entity_type"}

            # Get model class
            model = self._get_model_for_entity(entity_type)
            if not model:
                return {"success": False, "error": f"Unknown entity type: {entity_type}"}

            # Resolve field values
            data = {"tenant": self.tenant}
            for field_name, value_template in field_mappings.items():
                if isinstance(value_template, str):
                    data[field_name] = self._resolve_template(value_template)
                else:
                    data[field_name] = value_template

            # Create record
            instance = model.objects.create(**data)

            logger.info(f"Created {entity_type} record: {instance.id}")

            return {
                "success": True,
                "entity_type": entity_type,
                "entity_id": instance.id,
                "data": data,
            }

        except Exception as e:
            logger.exception(f"Error creating record: {str(e)}")
            return {"success": False, "error": str(e)}

    def update_record(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing entity record.

        Config:
            entity_type: Type of entity
            entity_id: ID of record or {{variable}}
            field_updates: Dict of field -> new value/{{variable}}
        """
        try:
            entity_type = config.get("entity_type")
            entity_id_template = config.get("entity_id")
            field_updates = config.get("field_updates", {})

            if not entity_type or not entity_id_template:
                return {"success": False, "error": "Missing entity_type or entity_id"}

            if entity_type in {"purchase_order", "purchaseorder"} and "status" in field_updates:
                return {
                    "success": False,
                    "error": "PurchaseOrder status updates must use the explicit transition-status action.",
                }

            # Resolve entity ID
            entity_id = self._resolve_template(str(entity_id_template))

            # Get model and instance
            model = self._get_model_for_entity(entity_type)
            if not model:
                return {"success": False, "error": f"Unknown entity type: {entity_type}"}

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
                "success": True,
                "entity_type": entity_type,
                "entity_id": instance.id,
                "updated_fields": updated_fields,
            }

        except model.DoesNotExist:
            return {"success": False, "error": f"{entity_type} record not found"}
        except Exception as e:
            logger.exception(f"Error updating record: {str(e)}")
            return {"success": False, "error": str(e)}

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
            "success": True,
            "action": "generate_pdf",
            "stub": True,
            "message": "PDF generation stub - requires pdf-lib implementation",
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
            "success": True,
            "action": "sign_document",
            "stub": True,
            "message": "Document signing stub - requires e-signature integration",
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
            "success": True,
            "action": "upload_document",
            "stub": True,
            "message": "Document upload stub - requires storage integration",
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
            "success": True,
            "action": "store_document",
            "stub": True,
            "message": "Document storage stub - requires archive system",
        }

    def send_notification(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Send an in-app notification.

        This action is used by BOTH execution engines:
        - TenantWorkflow (automation rules)
        - TenantWorkForm (FlowEditor graphs)

        Config (supported shapes):
            title: Notification title (supports {{variables}})
            message: Notification message (supports {{variables}})
            action_url/link: Optional link
            notification_type: Optional; defaults to "workflow_trigger"
            priority: Optional; defaults to "normal"

            Recipients:
              - user_id: single user id (supports {{variables}})
              - user_ids/users: list of user ids (supports {{variables}} per entry)

        If recipients are not provided (common for WorkForms today), we fall back to the
        actor that started the execution (inferred via context.execution_id).

        Security/tenant-safety:
        - Recipient must be an ACTIVE member of this tenant (or a superuser) to avoid
          cross-tenant notification leakage.
        - Respects UserNotificationPreferences (master toggle + in_app channel).
        """

        try:
            from django.contrib.auth import get_user_model

            from tenant_apps.workflows.models import (
                DeliveryChannel,
                NotificationPriority,
                NotificationType,
                TenantWorkFormExecution,
                UserNotification,
                UserNotificationPreferences,
            )

            from apps.tenants.models import TenantUser

            UserModel = get_user_model()

            title = self._resolve_template(config.get("title", ""))
            message = self._resolve_template(config.get("message", ""))
            action_url = self._resolve_template(config.get("action_url") or config.get("link") or "")

            if not title:
                return {"success": False, "error": "Missing title"}

            notification_type = str(config.get("notification_type") or NotificationType.WORKFLOW_TRIGGER.value)
            allowed_types = {str(nt.value) for nt in NotificationType}
            if notification_type not in allowed_types:
                notification_type = NotificationType.SYSTEM.value

            priority = str(config.get("priority") or NotificationPriority.NORMAL.value)
            allowed_priorities = {str(p.value) for p in NotificationPriority}
            if priority not in allowed_priorities:
                priority = NotificationPriority.NORMAL.value

            # Resolve recipients
            recipients: list[int] = []

            def _coerce_user_id(value: Any) -> int | None:
                if value is None:
                    return None
                try:
                    return int(str(value).strip())
                except Exception:
                    return None

            raw_user_ids = config.get("user_ids") or config.get("users")
            if isinstance(raw_user_ids, list):
                for row in raw_user_ids:
                    resolved = self._resolve_template(str(row)) if isinstance(row, str) else row
                    coerced = _coerce_user_id(resolved)
                    if coerced is not None:
                        recipients.append(coerced)

            raw_user_id = config.get("user_id")
            if raw_user_id is not None:
                resolved = self._resolve_template(str(raw_user_id)) if isinstance(raw_user_id, str) else raw_user_id
                coerced = _coerce_user_id(resolved)
                if coerced is not None:
                    recipients.append(coerced)

            # WorkForms fallback: infer the actor from the execution.
            if not recipients:
                execution_id = self.context.get("execution_id")
                if not execution_id and isinstance(self.context.get("variables"), dict):
                    execution_id = self.context["variables"].get("execution_id")

                if execution_id:
                    execution = (
                        TenantWorkFormExecution.objects.select_related("started_by")
                        .filter(id=str(execution_id), tenant=self.tenant)
                        .first()
                    )
                    if execution and execution.started_by_id:
                        recipients = [int(execution.started_by_id)]

            if not recipients:
                return {
                    "success": False,
                    "error": "No recipients resolved (provide user_id/user_ids or run within a WorkForm execution context)",
                }

            created: list[str] = []
            skipped: list[dict[str, Any]] = []

            # Deduplicate while preserving order
            seen = set()
            recipients = [r for r in recipients if not (r in seen or seen.add(r))]

            for user_id in recipients:
                user = UserModel.objects.filter(id=user_id).first()
                if not user:
                    return {"success": False, "error": f"Recipient user not found: {user_id}"}

                is_member = TenantUser.objects.filter(tenant=self.tenant, user=user, is_active=True).exists()
                if not is_member and not getattr(user, "is_superuser", False):
                    return {"success": False, "error": "Recipient is not an active member of this tenant"}

                prefs, _created = UserNotificationPreferences.objects.get_or_create(
                    user=user,
                    tenant=self.tenant,
                    defaults={"type_preferences": UserNotificationPreferences.get_defaults()},
                )

                if not prefs.should_notify(notification_type, DeliveryChannel.IN_APP.value):
                    skipped.append({"user_id": user_id, "reason": "disabled_by_preferences"})
                    continue

                n = UserNotification.objects.create(
                    tenant=self.tenant,
                    user=user,
                    notification_type=notification_type,
                    title=title,
                    message=message or "",
                    priority=priority,
                    action_url=action_url,
                    metadata={
                        "source": "workflow_action",
                        "notification_type": notification_type,
                        "execution_id": str(self.context.get("execution_id") or ""),
                    },
                )
                created.append(str(n.id))

            return {
                "success": True,
                "notification_type": notification_type,
                "priority": priority,
                "created_ids": created,
                "skipped": skipped,
                "title": title,
                "message": message,
                "action_url": action_url,
            }

        except Exception as e:
            logger.exception(f"Error sending notification: {str(e)}")
            return {"success": False, "error": str(e)}

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
        pattern = r"\{\{([^}]+)\}\}"
        matches = re.findall(pattern, template)

        result = template
        for var_path in matches:
            var_path = var_path.strip()
            value = self._get_nested_value(self.context, var_path)
            result = result.replace(f"{{{{{var_path}}}}}", str(value))

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
        keys = path.split(".")
        current = data

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return ""

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
            "supplier": ("suppliers", "Supplier"),
            "customer": ("customers", "Customer"),
            "purchase_order": ("purchase_orders", "PurchaseOrder"),
            "sales_order": ("sales_orders", "SalesOrder"),
            "invoice": ("invoices", "Invoice"),
            "product": ("system", "Product"),
        }

        if entity_type not in model_map:
            return None

        app_label, model_name = model_map[entity_type]

        try:
            if app_label == "system":
                return apps.get_model("system", model_name)

            return apps.get_model(f"tenant_apps.{app_label}", model_name)
        except LookupError:
            logger.error(f"Model not found: {app_label}.{model_name}")
            return None

    # ─── E2E Process Executor Delegation ────────────────────────────────

    def _get_e2e_executors(self):
        from tenant_apps.workflows.services.e2e_executors import E2EProcessExecutors

        return E2EProcessExecutors(self.tenant, self.context)

    def _e2e_generate_sales_order(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().generate_sales_order(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_bid_selection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().bid_selection(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_check_bids(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().check_bids(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_create_purchase_order(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().create_purchase_order(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_resolve_contacts(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().resolve_contacts(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_resolve_rfq_send(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().resolve_rfq_contacts_for_send(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_bid_selection_contacts(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().bid_selection_with_contacts(config)
        return {"success": result.success, "error": result.error, **result.data}

    def _e2e_prefill_po_contacts(self, config: Dict[str, Any]) -> Dict[str, Any]:
        result = self._get_e2e_executors().prefill_po_contacts(config)
        return {"success": result.success, "error": result.error, **result.data}

"""
Celery task chain for end-to-end email-to-entity auto-processing.

Pipeline chains:
  - PO:      EmailLog → PO draft → SO → Fulfillment → Invoice
  - Contact: EmailLog → Contact record
  - Company: EmailLog → Customer record

Each step is idempotent, emits telemetry via structured logging,
and respects tenant RLS isolation.

AUTO-21.1 – Phase 21: Full End-to-End Automation
"""

import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from celery import chain, shared_task

from apps.integrations.models import EmailLog
from apps.tenants.models import Tenant
from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)

# Confidence threshold: emails below this require human review
AUTO_PROCESS_CONFIDENCE_THRESHOLD = 0.98


def _log_pipeline_event(tenant_id: str, email_log_id: int, step: str, status: str, payload: dict | None = None):
    """Emit a structured log entry for pipeline telemetry.

    Uses Python logging with structured data rather than ExecutionEventLog
    (which requires a WorkForm execution context we don't have here).
    """
    logger.info(
        "auto_pipeline.%s tenant=%s email_log=%s status=%s payload=%s",
        step,
        tenant_id,
        email_log_id,
        status,
        payload or {},
    )


@shared_task(
    name="integrations.auto_process_approved_emails",
    bind=True,
    max_retries=2,
    soft_time_limit=120,
    time_limit=180,
)
def auto_process_approved_emails(self):
    """Sweep for high-confidence parsed emails and trigger the auto pipeline.

    Runs periodically (every 5 minutes via Celery Beat).
    Picks up EmailLog entries with status='draft_created' and confidence >= threshold.
    """
    try:
        tenant_ids = list(Tenant.objects.filter(is_active=True).values_list("id", flat=True))
        dispatched = 0

        for tenant_id in tenant_ids:
            tid = str(tenant_id)
            with tenant_rls(tid):
                candidates = list(
                    EmailLog.objects.filter(
                        tenant_id=tenant_id,
                        status="draft_created",
                    )
                    .exclude(
                        extracted_data__isnull=True,
                    )
                    .values_list("id", "extracted_data")
                )

            for email_log_id, extracted_data in candidates:
                confidence = 0.0
                if isinstance(extracted_data, dict):
                    try:
                        confidence = float(extracted_data.get("confidence", 0.0))
                    except (TypeError, ValueError):
                        confidence = 0.0

                if confidence < AUTO_PROCESS_CONFIDENCE_THRESHOLD:
                    _log_pipeline_event(
                        tid,
                        email_log_id,
                        "skip_low_confidence",
                        "info",
                        {"confidence": confidence, "threshold": AUTO_PROCESS_CONFIDENCE_THRESHOLD},
                    )
                    continue

                draft_type = ""
                if isinstance(extracted_data, dict):
                    draft_type = extracted_data.get("draft_type", "")

                if draft_type not in ("purchase_order", "contact", "company"):
                    _log_pipeline_event(
                        tid,
                        email_log_id,
                        "skip_unsupported_type",
                        "info",
                        {"draft_type": draft_type},
                    )
                    continue

                # Dispatch the appropriate pipeline chain
                if draft_type == "purchase_order":
                    pipeline = chain(
                        create_purchase_order_from_email.s(email_log_id, tid),
                        generate_sales_order_from_po.s(tid),
                        trigger_fulfillment.s(tid),
                        generate_invoice_from_so.s(tid),
                    )
                elif draft_type == "contact":
                    pipeline = chain(
                        create_contact_from_email.s(email_log_id, tid),
                    )
                elif draft_type == "company":
                    pipeline = chain(
                        create_company_from_email.s(email_log_id, tid),
                    )
                else:
                    continue

                try:
                    pipeline.apply_async()
                except Exception as dispatch_err:
                    logger.error(
                        "Failed to dispatch %s pipeline for email %s (tenant %s): %s",
                        draft_type, email_log_id, tid, dispatch_err,
                        exc_info=True,
                    )
                    _log_pipeline_event(
                        tid, email_log_id, "dispatch_failed", "error",
                        {"draft_type": draft_type, "error": str(dispatch_err)},
                    )
                    continue
                dispatched += 1

                _log_pipeline_event(
                    tid,
                    email_log_id,
                    "pipeline_dispatched",
                    "started",
                    {"confidence": confidence},
                )

        logger.info("Auto pipeline sweep complete: dispatched=%s", dispatched)
        return {"success": True, "dispatched": dispatched}

    except Exception as e:
        logger.error("Auto pipeline sweep failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


@shared_task(
    name="integrations.create_purchase_order_from_email",
    bind=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=90,
)
def create_purchase_order_from_email(self, email_log_id: int, tenant_id: str):
    """Create a PurchaseOrder from a parsed EmailLog entry.

    Idempotent: if the EmailLog already has related_order_id, returns it.
    Returns the PO id for the next step in the chain.
    """
    from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
    from tenant_apps.suppliers.models import Supplier

    try:
        with tenant_rls(tenant_id):
            email_log = EmailLog.objects.get(id=email_log_id, tenant_id=tenant_id)

            # Idempotent check
            if email_log.related_order_id and email_log.status == "order_created":
                _log_pipeline_event(
                    tenant_id,
                    email_log_id,
                    "create_po",
                    "skipped",
                    {"reason": "already_created", "order_id": email_log.related_order_id},
                )
                return email_log.related_order_id

            extracted = email_log.extracted_data or {}

            # Resolve or stub supplier
            supplier = None
            contact_company = extracted.get("contact_company", "").strip()
            if contact_company:
                supplier = Supplier.objects.filter(
                    tenant_id=tenant_id,
                    company_name__iexact=contact_company,
                ).first()

                if not supplier:
                    supplier = Supplier.objects.create(
                        tenant_id=tenant_id,
                        company_name=contact_company,
                        notes="Auto-created by email pipeline",
                    )
                    _log_pipeline_event(
                        tenant_id,
                        email_log_id,
                        "auto_create_supplier",
                        "success",
                        {"supplier_id": supplier.id, "name": contact_company},
                    )

            tenant = Tenant.objects.get(id=tenant_id)

            with transaction.atomic():
                order_number = PurchaseOrder.generate_next_order_number(tenant)
                po = PurchaseOrder(
                    tenant_id=tenant_id,
                    order_number=order_number,
                    our_purchase_order_num=order_number,
                    status=PurchaseOrderStatus.DRAFT,
                    supplier=supplier,
                    item_description=extracted.get("requested_product_name", ""),
                    notes=f"Auto-created from email: {email_log.subject}",
                    special_instructions=extracted.get("summary", ""),
                )

                # Populate optional fields from extracted data
                quantity = extracted.get("requested_quantity", "")
                if quantity:
                    try:
                        po.quantity = Decimal(str(quantity))
                    except (ValueError, ArithmeticError) as qty_err:
                        logger.warning(
                            "Invalid quantity '%s' for email %s: %s",
                            quantity, email_log_id, qty_err,
                        )

                po.save()

                email_log.mark_as_completed(
                    extracted_data=extracted,
                    order_id=po.id,
                )

            _log_pipeline_event(
                tenant_id,
                email_log_id,
                "create_po",
                "success",
                {"po_id": po.id, "order_number": order_number},
            )
            return po.id

    except EmailLog.DoesNotExist:
        _log_pipeline_event(tenant_id, email_log_id, "create_po", "failed", {"reason": "email_not_found"})
        return None

    except Exception as e:
        _log_pipeline_event(tenant_id, email_log_id, "create_po", "failed", {"error": str(e)})
        logger.error("create_purchase_order_from_email failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30 * (2**self.request.retries))


@shared_task(
    name="integrations.generate_sales_order_from_po",
    bind=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=90,
)
def generate_sales_order_from_po(self, po_id: int | None, tenant_id: str):
    """Generate a draft SalesOrder linked to the PurchaseOrder.

    Idempotent: checks if an SO already exists for this PO via Inquiry linkage.
    Returns the SO id for the next step.
    """
    from tenant_apps.purchase_orders.models import PurchaseOrder
    from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

    if po_id is None:
        logger.warning("generate_sales_order_from_po: no PO id provided, skipping")
        return None

    try:
        with tenant_rls(tenant_id):
            po = PurchaseOrder.objects.get(id=po_id, tenant_id=tenant_id)

            # Check if SO already linked via inquiry
            from tenant_apps.inquiries.models import Inquiry

            existing_inquiry = (
                Inquiry.objects.filter(
                    tenant_id=tenant_id,
                    supplier_purchase_order=po,
                )
                .select_related("sales_order")
                .first()
            )

            if existing_inquiry and existing_inquiry.sales_order:
                _log_pipeline_event(
                    tenant_id,
                    po_id,
                    "generate_so",
                    "skipped",
                    {"reason": "already_exists", "so_id": existing_inquiry.sales_order.id},
                )
                return existing_inquiry.sales_order.id

            Tenant.objects.get(id=tenant_id)  # validate tenant exists

            with transaction.atomic():
                # Generate SO number
                last_so = (
                    SalesOrder.objects.filter(
                        tenant_id=tenant_id,
                    )
                    .order_by("-id")
                    .first()
                )
                so_num = f"SO-{(last_so.id + 1) if last_so else 1:06d}"

                so = SalesOrder(
                    tenant_id=tenant_id,
                    our_sales_order_num=so_num,
                    status=SalesOrderStatus.DRAFT,
                    supplier=po.supplier,
                    item_description=po.item_description,
                    notes=f"Auto-generated from PO {po.order_number}",
                    date_time_stamp=timezone.now(),
                )

                # Copy over fields from PO
                if hasattr(po, "quantity") and po.quantity:
                    so.quantity = po.quantity
                if hasattr(po, "total_weight") and po.total_weight:
                    so.total_weight = po.total_weight
                if hasattr(po, "total_amount") and po.total_amount:
                    so.total_amount = po.total_amount

                so.save()

                # Create or update Inquiry for lineage tracking
                if existing_inquiry:
                    existing_inquiry.sales_order = so
                    existing_inquiry.save(update_fields=["sales_order"])
                else:
                    Inquiry.objects.create(
                        tenant_id=tenant_id,
                        status="in_progress",
                        source_type="email",
                        entity_type="supplier",
                        supplier=po.supplier,
                        supplier_purchase_order=po,
                        sales_order=so,
                        notes=f"Auto-created lineage: PO {po.order_number} → SO {so_num}",
                    )

            _log_pipeline_event(
                tenant_id,
                po_id,
                "generate_so",
                "success",
                {"so_id": so.id, "so_num": so_num, "po_order_number": po.order_number},
            )
            return so.id

    except PurchaseOrder.DoesNotExist:
        _log_pipeline_event(tenant_id, po_id, "generate_so", "failed", {"reason": "po_not_found"})
        return None

    except Exception as e:
        _log_pipeline_event(tenant_id, po_id, "generate_so", "failed", {"error": str(e)})
        logger.error("generate_sales_order_from_po failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30 * (2**self.request.retries))


@shared_task(
    name="integrations.trigger_fulfillment",
    bind=True,
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def trigger_fulfillment(self, so_id: int | None, tenant_id: str):
    """Mark the SalesOrder as confirmed and log the fulfillment trigger.

    This is the terminal step in the auto pipeline. Full fulfillment
    orchestration (carrier assignment, tracking, invoicing) runs as
    separate processes triggered by status changes.

    Idempotent: skips if SO is already confirmed or beyond.
    """
    from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

    if so_id is None:
        logger.warning("trigger_fulfillment: no SO id provided, skipping")
        return None

    TERMINAL_STATUSES = {
        SalesOrderStatus.CONFIRMED,
        SalesOrderStatus.SENT,
        SalesOrderStatus.IN_TRANSIT,
        SalesOrderStatus.DELIVERED,
        SalesOrderStatus.INVOICED,
    }

    try:
        with tenant_rls(tenant_id):
            so = SalesOrder.objects.get(id=so_id, tenant_id=tenant_id)

            if so.status in TERMINAL_STATUSES:
                _log_pipeline_event(
                    tenant_id,
                    so_id,
                    "trigger_fulfillment",
                    "skipped",
                    {"reason": "already_beyond_draft", "status": so.status},
                )
                return {"so_id": so_id, "status": so.status, "action": "none"}

            so.status = SalesOrderStatus.CONFIRMED
            so.save(update_fields=["status"])

            _log_pipeline_event(
                tenant_id,
                so_id,
                "trigger_fulfillment",
                "success",
                {"so_id": so_id, "new_status": SalesOrderStatus.CONFIRMED},
            )

            return {
                "so_id": so_id,
                "status": SalesOrderStatus.CONFIRMED,
                "action": "confirmed",
                "pipeline": "complete",
            }

    except SalesOrder.DoesNotExist:
        _log_pipeline_event(tenant_id, so_id, "trigger_fulfillment", "failed", {"reason": "so_not_found"})
        return None

    except Exception as e:
        _log_pipeline_event(tenant_id, so_id, "trigger_fulfillment", "failed", {"error": str(e)})
        logger.error("trigger_fulfillment failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30 * (2**self.request.retries))


@shared_task(
    name="integrations.generate_invoice_from_so",
    bind=True,
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def generate_invoice_from_so(self, fulfillment_result: dict | None, tenant_id: str):
    """Generate a draft invoice from a confirmed Sales Order.

    Terminal step in the zero-touch pipeline. Creates a draft invoice
    linked to the SO. The invoice remains in 'draft' status for
    finance team review.

    Idempotent: checks existing invoices for the SO before creating.
    """
    from tenant_apps.invoices.models import Invoice
    from tenant_apps.invoices.services.invoice_generation import generate_invoice_number
    from tenant_apps.sales_orders.models import SalesOrder

    if not fulfillment_result or not isinstance(fulfillment_result, dict):
        logger.warning("generate_invoice_from_so: no fulfillment result, skipping")
        return None

    so_id = fulfillment_result.get("so_id")
    if not so_id:
        logger.warning("generate_invoice_from_so: no so_id in fulfillment result, skipping")
        return None

    try:
        with tenant_rls(tenant_id):
            so = SalesOrder.objects.get(id=so_id, tenant_id=tenant_id)

            # Idempotent: check if an invoice already exists for this SO
            existing = Invoice.objects.filter(
                tenant_id=tenant_id,
                sales_order=so,
            ).first()
            if existing:
                _log_pipeline_event(
                    tenant_id,
                    so_id,
                    "generate_invoice",
                    "skipped",
                    {"reason": "already_exists", "invoice_id": existing.id},
                )
                return {"invoice_id": existing.id, "action": "none"}

            # Resolve customer — SO may link through supplier/inquiry
            customer = getattr(so, "customer", None)
            if not customer:
                # Try to find customer through inquiry lineage
                from tenant_apps.inquiries.models import Inquiry

                inquiry = Inquiry.objects.filter(
                    tenant_id=tenant_id,
                    sales_order=so,
                ).select_related("customer").first()
                if inquiry:
                    customer = inquiry.customer

            if not customer:
                _log_pipeline_event(
                    tenant_id,
                    so_id,
                    "generate_invoice",
                    "skipped",
                    {"reason": "no_customer", "so_number": so.our_sales_order_num},
                )
                logger.info(
                    "Skipping invoice generation for SO %s: no customer linked",
                    so.our_sales_order_num,
                )
                return {"so_id": so_id, "action": "skipped", "reason": "no_customer"}

            # Generate invoice number
            last_invoice = (
                Invoice.objects.filter(tenant_id=tenant_id)
                .order_by("-id")
                .first()
            )
            sequence = (last_invoice.id + 1) if last_invoice else 1
            invoice_number = generate_invoice_number(tenant_id, sequence)

            with transaction.atomic():
                invoice = Invoice(
                    tenant_id=tenant_id,
                    invoice_number=invoice_number,
                    customer=customer,
                    sales_order=so,
                    our_sales_order_num=so.our_sales_order_num or "",
                    description_of_product_item=getattr(so, "item_description", "") or "",
                    status="draft",
                    notes=f"Auto-generated from SO {so.our_sales_order_num} via zero-touch pipeline",
                )

                if hasattr(so, "quantity") and so.quantity:
                    invoice.quantity = so.quantity
                if hasattr(so, "total_weight") and so.total_weight:
                    invoice.total_weight = so.total_weight
                if hasattr(so, "total_amount") and so.total_amount:
                    invoice.total_amount = so.total_amount
                    invoice.outstanding_amount = so.total_amount

                invoice.save()

            _log_pipeline_event(
                tenant_id,
                so_id,
                "generate_invoice",
                "success",
                {
                    "invoice_id": invoice.id,
                    "invoice_number": invoice_number,
                    "so_number": so.our_sales_order_num,
                    "customer_id": customer.id,
                },
            )

            return {
                "invoice_id": invoice.id,
                "invoice_number": invoice_number,
                "so_id": so_id,
                "action": "created",
                "pipeline": "complete_with_invoice",
            }

    except SalesOrder.DoesNotExist:
        _log_pipeline_event(tenant_id, so_id, "generate_invoice", "failed", {"reason": "so_not_found"})
        return None

    except Exception as e:
        _log_pipeline_event(tenant_id, so_id, "generate_invoice", "failed", {"error": str(e)})
        logger.error("generate_invoice_from_so failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30 * (2**self.request.retries))


@shared_task(
    name="integrations.create_contact_from_email",
    bind=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=90,
)
def create_contact_from_email(self, email_log_id: int, tenant_id: str):
    """Create a Contact from a parsed EmailLog entry.

    Idempotent: if the EmailLog already has status 'order_created', returns early.
    """
    from tenant_apps.contacts.models import Contact

    try:
        with tenant_rls(tenant_id):
            email_log = EmailLog.objects.get(id=email_log_id, tenant_id=tenant_id)

            if email_log.status == "order_created":
                _log_pipeline_event(tenant_id, email_log_id, "create_contact", "skipped", {"reason": "already_created"})
                return None

            extracted = email_log.extracted_data or {}
            contact_name = extracted.get("contact_name", "").strip()
            if not contact_name:
                _log_pipeline_event(tenant_id, email_log_id, "create_contact", "skipped", {"reason": "no_name"})
                return None

            # Split name into first/last
            parts = contact_name.split(None, 1)
            first_name = parts[0] if parts else contact_name
            last_name = parts[1] if len(parts) > 1 else ""

            # Check for existing contact by name
            existing = Contact.objects.filter(
                tenant_id=tenant_id,
                first_name__iexact=first_name,
                last_name__iexact=last_name,
            ).first()

            if existing:
                _log_pipeline_event(tenant_id, email_log_id, "create_contact", "skipped", {"reason": "duplicate", "contact_id": existing.id})
                email_log.mark_as_completed(extracted_data=extracted)
                return existing.id

            with transaction.atomic():
                contact = Contact(
                    tenant_id=tenant_id,
                    first_name=first_name,
                    last_name=last_name,
                    email=extracted.get("sender_email", ""),
                    company=extracted.get("contact_company", ""),
                    notes=f"Auto-created from email: {email_log.subject}",
                )
                contact.save()

                email_log.mark_as_completed(extracted_data=extracted)

            _log_pipeline_event(tenant_id, email_log_id, "create_contact", "success", {"contact_id": contact.id, "name": contact_name})
            return contact.id

    except EmailLog.DoesNotExist:
        _log_pipeline_event(tenant_id, email_log_id, "create_contact", "failed", {"reason": "email_not_found"})
        return None

    except Exception as e:
        _log_pipeline_event(tenant_id, email_log_id, "create_contact", "failed", {"error": str(e)})
        logger.error("create_contact_from_email failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30 * (2**self.request.retries))


@shared_task(
    name="integrations.create_company_from_email",
    bind=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=90,
)
def create_company_from_email(self, email_log_id: int, tenant_id: str):
    """Create a Customer (company) from a parsed EmailLog entry.

    Idempotent: if the EmailLog already has status 'order_created', returns early.
    """
    from tenant_apps.customers.models import Customer

    try:
        with tenant_rls(tenant_id):
            email_log = EmailLog.objects.get(id=email_log_id, tenant_id=tenant_id)

            if email_log.status == "order_created":
                _log_pipeline_event(tenant_id, email_log_id, "create_company", "skipped", {"reason": "already_created"})
                return None

            extracted = email_log.extracted_data or {}
            company_name = extracted.get("contact_company", "").strip()
            if not company_name:
                _log_pipeline_event(tenant_id, email_log_id, "create_company", "skipped", {"reason": "no_company_name"})
                return None

            # Check for existing customer by company name
            existing = Customer.objects.filter(
                tenant_id=tenant_id,
                name__iexact=company_name,
            ).first()

            if existing:
                _log_pipeline_event(tenant_id, email_log_id, "create_company", "skipped", {"reason": "duplicate", "customer_id": existing.id})
                email_log.mark_as_completed(extracted_data=extracted)
                return existing.id

            with transaction.atomic():
                customer = Customer(
                    tenant_id=tenant_id,
                    name=company_name,
                    email=extracted.get("sender_email", ""),
                    notes=f"Auto-created from email: {email_log.subject}",
                )
                customer.save()

                email_log.mark_as_completed(extracted_data=extracted)

            _log_pipeline_event(tenant_id, email_log_id, "create_company", "success", {"customer_id": customer.id, "name": company_name})
            return customer.id

    except EmailLog.DoesNotExist:
        _log_pipeline_event(tenant_id, email_log_id, "create_company", "failed", {"reason": "email_not_found"})
        return None

    except Exception as e:
        _log_pipeline_event(tenant_id, email_log_id, "create_company", "failed", {"error": str(e)})
        logger.error("create_company_from_email failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30 * (2**self.request.retries))

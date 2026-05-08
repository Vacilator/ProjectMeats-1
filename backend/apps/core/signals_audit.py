"""Audit trail signals for critical tenant-aware models."""

from __future__ import annotations

from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from apps.core.models import TenantAuditEvent
from apps.core.services.audit_trails import model_field_diff
from apps.core.utils.audit_context import get_audit_context

_TRACKED_MODELS = [
    ("carriers", "Carrier"),
    ("purchase_orders", "PurchaseOrder"),
    ("purchase_orders", "CarrierPurchaseOrder"),
    ("sales_orders", "SalesOrder"),
    ("invoices", "Invoice"),
    ("suppliers", "Supplier"),
    ("plants", "Plant"),
    ("customers", "Customer"),
    ("locations", "Location"),
    ("contacts", "Contact"),
    ("inquiries", "Inquiry"),
    ("fulfillments", "Fulfillment"),
    ("products", "MasterProduct"),
    ("ai_assistant", "CommunicationLog"),
]

_IGNORE_FIELDS = {
    "id",
    "pk",
    "tenant",
    "tenant_id",
    "custom_data",
    "created_at",
    "updated_at",
    "created_on",
    "modified_on",
    "deleted_at",
    "is_deleted",
}


def _tracked_instances():
    out = []
    for app_label, model_name in _TRACKED_MODELS:
        try:
            out.append(apps.get_model(app_label, model_name))
        except Exception:
            continue
    return tuple(out)


_TRACKED = _tracked_instances()


def _resolve_entity_name(instance):
    for attr in (
        "name",
        "subject",
        "order_number",
        "our_purchase_order_num",
        "our_sales_order_num",
        "invoice_number",
        "our_carrier_po_num",
        "inquiry_number",
        "display_name",
    ):
        value = getattr(instance, attr, None)
        if value:
            return str(value)[:255]

    first_name = str(getattr(instance, "first_name", "") or "").strip()
    last_name = str(getattr(instance, "last_name", "") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name:
        return full_name[:255]

    return ""


@receiver(pre_save)
def audit_pre_save(sender, instance, **kwargs):
    if sender not in _TRACKED:
        return
    if not getattr(instance, "pk", None):
        return

    try:
        before = sender.objects.filter(pk=instance.pk).first()
        setattr(instance, "_audit_before", before)
    except Exception:
        setattr(instance, "_audit_before", None)


@receiver(post_save)
def audit_post_save(sender, instance, created, **kwargs):
    if sender not in _TRACKED:
        return

    tenant = getattr(instance, "tenant", None)
    if tenant is None:
        return

    ctx = get_audit_context()
    actor = ctx.user if getattr(ctx.user, "is_authenticated", False) else None
    actor_email = getattr(actor, "email", "") if actor else ""

    content_type = ContentType.objects.get_for_model(sender)

    entity_name = _resolve_entity_name(instance)

    if created:
        TenantAuditEvent.objects.create(
            tenant=tenant,
            content_type=content_type,
            object_id=str(instance.pk),
            entity_type=sender.__name__,
            entity_name=entity_name,
            action=TenantAuditEvent.Action.CREATE,
            changed_fields=None,
            snapshot_before=None,
            snapshot_after=None,
            actor=actor,
            actor_email=actor_email,
            ip_address=ctx.ip_address,
            user_agent=ctx.user_agent or "",
        )
        return

    before = getattr(instance, "_audit_before", None)
    diffs = model_field_diff(before=before, after=instance, ignore_fields=_IGNORE_FIELDS)
    if not diffs:
        return

    TenantAuditEvent.objects.create(
        tenant=tenant,
        content_type=content_type,
        object_id=str(instance.pk),
        entity_type=sender.__name__,
        entity_name=entity_name,
        action=TenantAuditEvent.Action.UPDATE,
        changed_fields=diffs,
        snapshot_before=None,
        snapshot_after=None,
        actor=actor,
        actor_email=actor_email,
        ip_address=ctx.ip_address,
        user_agent=ctx.user_agent or "",
    )


@receiver(pre_delete)
def audit_pre_delete(sender, instance, **kwargs):
    if sender not in _TRACKED:
        return

    tenant = getattr(instance, "tenant", None)
    if tenant is None:
        return

    ctx = get_audit_context()
    actor = ctx.user if getattr(ctx.user, "is_authenticated", False) else None
    actor_email = getattr(actor, "email", "") if actor else ""

    content_type = ContentType.objects.get_for_model(sender)

    TenantAuditEvent.objects.create(
        tenant=tenant,
        content_type=content_type,
        object_id=str(instance.pk),
        entity_type=sender.__name__,
        entity_name=str(instance)[:255],
        action=TenantAuditEvent.Action.DELETE,
        changed_fields=None,
        snapshot_before=None,
        snapshot_after=None,
        actor=actor,
        actor_email=actor_email,
        ip_address=ctx.ip_address,
        user_agent=ctx.user_agent or "",
    )

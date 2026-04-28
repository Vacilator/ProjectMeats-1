"""Signals for Deal Desk workflows."""
from __future__ import annotations

from datetime import datetime, time, timedelta

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from tenant_apps.fulfillments.models import Fulfillment, FulfillmentStatusChoices

from .models import Deal, DealActionItem, DealActionItemPriority, DealActionItemStatus, DealStatus


def _normalize_milestones(fulfillment: Fulfillment) -> dict[str, bool]:
    raw = fulfillment.document_milestones if isinstance(fulfillment.document_milestones, dict) else {}
    return {
        "proforma_requested": bool(raw.get("proforma_requested")),
        "proforma_received": bool(raw.get("proforma_received")),
        "bol_requested": bool(raw.get("bol_requested")),
        "bol_received": bool(raw.get("bol_received")),
        "coa_received": bool(raw.get("coa_received")),
        "coa_sent": bool(raw.get("coa_sent")),
    }


@receiver(pre_save, sender=Fulfillment)
def capture_previous_fulfillment_status(sender, instance: Fulfillment, **kwargs):
    """Store the previous status on the instance for post-save processing."""
    if not instance.pk:
        instance._previous_status = None
        return

    previous = Fulfillment.objects.filter(pk=instance.pk).only("status").first()
    instance._previous_status = previous.status if previous else None


@receiver(post_save, sender=Fulfillment)
def sync_deal_milestone_action_items(sender, instance: Fulfillment, created: bool, **kwargs):
    """Create or resolve deal reminders when fulfillment state changes."""
    deal = Deal.objects.filter(fulfillment=instance).select_related("assigned_trader").first()
    if not deal:
        return

    milestones = _normalize_milestones(instance)
    needs_document_follow_up = not (milestones["bol_received"] and milestones["coa_received"])
    transitioned_to_in_transit = (
        instance.status == FulfillmentStatusChoices.SHIPPED
        and getattr(instance, "_previous_status", None) != FulfillmentStatusChoices.SHIPPED
    )

    reminder_qs = DealActionItem.objects.for_tenant(deal.tenant).filter(
        deal=deal,
        fulfillment=instance,
        milestone_key="transit_documents",
        status=DealActionItemStatus.OPEN,
    )
    reminder = reminder_qs.first()

    if instance.status == FulfillmentStatusChoices.SHIPPED:
        if deal.status != DealStatus.IN_TRANSIT:
            deal.status = DealStatus.IN_TRANSIT
            deal.save(update_fields=["status", "modified_on"])

        if needs_document_follow_up and reminder is None and (transitioned_to_in_transit or created):
            due_date = timezone.now() + timedelta(days=1)
            if instance.expected_delivery:
                due_date = timezone.make_aware(
                    datetime.combine(instance.expected_delivery, time.min),
                    timezone.get_current_timezone(),
                )

            DealActionItem.objects.get_or_create(
                tenant=deal.tenant,
                deal=deal,
                fulfillment=instance,
                milestone_key="transit_documents",
                status=DealActionItemStatus.OPEN,
                defaults={
                    "assigned_user": deal.assigned_trader or instance.shipped_by or instance.created_by,
                    "title": f"Collect BOL / COA for {deal.deal_number}",
                    "description": "Load is in transit. Confirm BOL and COA receipt before delivery closes.",
                    "priority": DealActionItemPriority.HIGH,
                    "due_date": due_date,
                },
            )
        elif not needs_document_follow_up and reminder is not None:
            reminder.mark_completed()

    if instance.status == FulfillmentStatusChoices.DELIVERED and deal.status != DealStatus.DELIVERED:
        deal.status = DealStatus.DELIVERED
        deal.save(update_fields=["status", "modified_on"])

    if instance.status == FulfillmentStatusChoices.COMPLETED and deal.status != DealStatus.COMPLETED:
        deal.status = DealStatus.COMPLETED
        deal.save(update_fields=["status", "modified_on"])

    if instance.status == FulfillmentStatusChoices.CANCELLED and deal.status != DealStatus.CANCELLED:
        deal.status = DealStatus.CANCELLED
        deal.save(update_fields=["status", "modified_on"])

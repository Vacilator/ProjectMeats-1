"""
Auto Follow-up Service for Inquiries

Automatically schedules follow-up calls when inquiry status changes to 'quoted'.
"""
from datetime import timedelta
from django.utils import timezone


def create_followup_call(inquiry, created_by=None, delay_days=3):
    """
    Create a follow-up scheduled call for a quoted inquiry.
    
    Args:
        inquiry: The Inquiry instance that was just quoted
        created_by: User who should own the follow-up call
        delay_days: Number of days in the future to schedule the call (default: 3)
    
    Returns:
        ScheduledCall instance if created, None otherwise
    """
    from tenant_apps.cockpit.models import ScheduledCall
    
    # Don't create if inquiry doesn't have an entity
    if not inquiry.supplier_id and not inquiry.customer_id:
        return None
    
    # Schedule for delay_days in the future at 10:00 AM
    scheduled_time = timezone.now() + timedelta(days=delay_days)
    scheduled_time = scheduled_time.replace(hour=10, minute=0, second=0, microsecond=0)
    
    # Build title and description
    title = f"Follow up on quote {inquiry.inquiry_number}"
    description = (
        f"Follow up call for quoted inquiry.\n\n"
        f"Inquiry: {inquiry.inquiry_number}\n"
        f"Contact: {inquiry.contact_name or 'N/A'}\n"
        f"Products: {inquiry.products.count()} items\n"
    )
    
    if inquiry.valid_until:
        description += f"Quote valid until: {inquiry.valid_until}\n"
    
    if inquiry.notes:
        description += f"\nNotes: {inquiry.notes[:200]}{'...' if len(inquiry.notes) > 200 else ''}"
    
    # Create the scheduled call
    call = ScheduledCall.objects.create(
        tenant=inquiry.tenant,
        entity_type=inquiry.entity_type,
        entity_id=inquiry.supplier_id if inquiry.entity_type == 'supplier' else inquiry.customer_id,
        title=title,
        description=description,
        scheduled_for=scheduled_time,
        duration_minutes=15,  # Default 15 min follow-up
        is_completed=False,
        created_by=created_by,
    )
    
    return call

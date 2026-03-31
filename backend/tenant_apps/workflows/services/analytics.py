"""
Form Analytics Service

Provides analytics and insights for form submissions.
Calculates completion rates, timing metrics, and identifies problem areas.
"""

from datetime import timedelta
from typing import Dict, Any, List, Optional
from django.db.models import Count, Avg, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from ..models import (
    TenantForm, FormSubmission, FormSubmissionEvent,
    FormSubmissionStatus, FormSubmissionEventType
)


def get_form_analytics(
    form: TenantForm,
    days: int = 30,
    include_events: bool = True
) -> Dict[str, Any]:
    """
    Get comprehensive analytics for a specific form.
    
    Args:
        form: The TenantForm to analyze
        days: Number of days to look back
        include_events: Whether to include event-level metrics
        
    Returns:
        Dictionary containing form analytics
    """
    cutoff = timezone.now() - timedelta(days=days)
    
    # Base queryset
    submissions = FormSubmission.objects.filter(
        form=form,
        created_at__gte=cutoff
    )
    
    # Count by status
    status_counts = dict(submissions.values('status').annotate(
        count=Count('id')
    ).values_list('status', 'count'))
    
    total = sum(status_counts.values())
    completed = status_counts.get(FormSubmissionStatus.COMPLETED, 0)
    in_progress = status_counts.get(FormSubmissionStatus.IN_PROGRESS, 0)
    draft = status_counts.get(FormSubmissionStatus.DRAFT, 0)
    
    # Completion rate
    completion_rate = (completed / total * 100) if total > 0 else 0
    
    # Average completion time (for completed submissions)
    avg_completion = submissions.filter(
        status=FormSubmissionStatus.COMPLETED,
        completed_at__isnull=False
    ).annotate(
        duration=F('completed_at') - F('created_at')
    ).aggregate(
        avg_duration=Avg('duration')
    )['avg_duration']
    
    avg_completion_seconds = avg_completion.total_seconds() if avg_completion else None
    
    # Submissions over time
    submissions_by_day = list(submissions.annotate(
        date=TruncDate('created_at')
    ).values('date').annotate(
        count=Count('id'),
        completed=Count('id', filter=Q(status=FormSubmissionStatus.COMPLETED))
    ).order_by('date'))
    
    analytics = {
        'form_id': str(form.id),
        'form_name': form.name,
        'period_days': days,
        'summary': {
            'total_submissions': total,
            'completed': completed,
            'in_progress': in_progress,
            'draft': draft,
            'completion_rate': round(completion_rate, 1),
            'avg_completion_seconds': round(avg_completion_seconds) if avg_completion_seconds else None,
            'avg_completion_display': _format_duration(avg_completion_seconds) if avg_completion_seconds else None,
        },
        'submissions_by_day': [
            {
                'date': item['date'].isoformat() if item['date'] else None,
                'total': item['count'],
                'completed': item['completed'],
            }
            for item in submissions_by_day
        ],
    }
    
    # Add event-level metrics if requested
    if include_events:
        events = FormSubmissionEvent.objects.filter(
            submission__form=form,
            created_at__gte=cutoff
        )
        
        # Step drop-off analysis
        step_metrics = _get_step_metrics(form, events, submissions)
        analytics['step_metrics'] = step_metrics
        
        # Field error frequency
        field_errors = list(events.filter(
            event_type=FormSubmissionEventType.FIELD_ERROR
        ).values('field_key').annotate(
            error_count=Count('id')
        ).order_by('-error_count')[:10])
        
        analytics['field_errors'] = [
            {'field': item['field_key'], 'errors': item['error_count']}
            for item in field_errors
        ]
        
        # Validation error types
        validation_errors = events.filter(
            event_type=FormSubmissionEventType.VALIDATION_ERROR
        ).count()
        analytics['validation_error_count'] = validation_errors
    
    return analytics


def _get_step_metrics(form: TenantForm, events, submissions) -> List[Dict[str, Any]]:
    """Calculate metrics for each step in the form."""
    steps = form.entities.all().order_by('order')
    
    step_metrics = []
    for step in steps:
        # Count how many times this step was entered
        entered = events.filter(
            event_type=FormSubmissionEventType.STEP_ENTERED,
            step_id=step.id
        ).count()
        
        # Count how many times this step was completed
        completed = events.filter(
            event_type=FormSubmissionEventType.STEP_COMPLETED,
            step_id=step.id
        ).count()
        
        # Average time spent on this step
        step_times = events.filter(
            event_type=FormSubmissionEventType.STEP_COMPLETED,
            step_id=step.id,
            duration_ms__isnull=False
        ).aggregate(avg_time=Avg('duration_ms'))['avg_time']
        
        drop_off = (1 - completed / entered) * 100 if entered > 0 else 0
        
        step_metrics.append({
            'step_id': str(step.id),
            'step_name': step.step_name or step.entity_type,
            'order': step.order,
            'entered': entered,
            'completed': completed,
            'drop_off_rate': round(drop_off, 1),
            'avg_time_seconds': round(step_times / 1000) if step_times else None,
        })
    
    return step_metrics


def get_tenant_form_summary(tenant, days: int = 30) -> Dict[str, Any]:
    """
    Get summary analytics for all forms in a tenant.
    
    Args:
        tenant: The tenant to analyze
        days: Number of days to look back
        
    Returns:
        Dictionary containing tenant-wide form analytics
    """
    cutoff = timezone.now() - timedelta(days=days)
    
    # All forms for the tenant
    forms = TenantForm.objects.filter(tenant=tenant)
    
    # Submission stats per form
    form_stats = []
    total_submissions = 0
    total_completed = 0
    
    for form in forms:
        submissions = FormSubmission.objects.filter(
            form=form,
            created_at__gte=cutoff
        )
        total = submissions.count()
        completed = submissions.filter(status=FormSubmissionStatus.COMPLETED).count()
        
        if total > 0:
            form_stats.append({
                'form_id': str(form.id),
                'form_name': form.name,
                'total': total,
                'completed': completed,
                'completion_rate': round(completed / total * 100, 1),
            })
            total_submissions += total
            total_completed += completed
    
    # Sort by usage
    form_stats.sort(key=lambda x: x['total'], reverse=True)
    
    return {
        'tenant_id': str(tenant.id),
        'period_days': days,
        'total_forms': forms.count(),
        'total_submissions': total_submissions,
        'total_completed': total_completed,
        'overall_completion_rate': round(
            total_completed / total_submissions * 100 if total_submissions > 0 else 0, 1
        ),
        'forms': form_stats[:10],  # Top 10 most used forms
    }


def record_form_event(
    submission: FormSubmission,
    event_type: str,
    step_id: Optional[str] = None,
    field_key: str = '',
    metadata: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[int] = None
) -> FormSubmissionEvent:
    """
    Record a form analytics event.
    
    Args:
        submission: The form submission
        event_type: Type of event (from FormSubmissionEventType)
        step_id: Optional step UUID
        field_key: Optional field key
        metadata: Optional additional data
        duration_ms: Optional duration in milliseconds
        
    Returns:
        Created FormSubmissionEvent
    """
    import uuid as uuid_module
    
    step_uuid = None
    if step_id:
        try:
            step_uuid = uuid_module.UUID(step_id)
        except ValueError:
            pass
    
    return FormSubmissionEvent.objects.create(
        submission=submission,
        event_type=event_type,
        step_id=step_uuid,
        field_key=field_key,
        metadata=metadata or {},
        duration_ms=duration_ms
    )


def _format_duration(seconds: float) -> str:
    """Format seconds into human-readable duration."""
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s" if secs else f"{minutes}m"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m" if minutes else f"{hours}h"

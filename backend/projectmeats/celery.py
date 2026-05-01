"""
Celery application configuration for ProjectMeats.

This module sets up the Celery task queue for background jobs like:
- Email polling (every 5 minutes)
- Scheduled workflow execution
- Async notification delivery
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projectmeats.settings.development')

# Create Celery app
app = Celery('projectmeats')

# Load config from Django settings (namespace='CELERY')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

# Configure periodic tasks
app.conf.beat_schedule = {
    'sync-tenant-emails-every-5-minutes': {
        'task': 'integrations.sync_tenant_emails',
        'schedule': 300.0,  # 5 minutes in seconds
        'options': {
            'expires': 240.0,  # Task expires if not run within 4 minutes
            'queue': 'pm.ops',
            'routing_key': 'pm.ops',
        },
    },
    'compile-rlhf-data-weekly': {
        'task': 'ai_assistant.compile_rlhf_data',
        'schedule': crontab(minute=0, hour=3, day_of_week='sun'),
        'args': (7, 5000),
        'options': {
            'expires': 3600.0,
            'queue': 'pm.ai',
            'routing_key': 'pm.ai',
        },
    },
    'ai-watchdog-daily': {
        'task': 'ai_assistant.run_daily_watchdog',
        'schedule': crontab(minute=0, hour=6),
        'args': (3,),
        'options': {
            'expires': 3600.0,
            'queue': 'pm.ai',
            'routing_key': 'pm.ai',
        },
    },
}

# Set timezone for scheduled tasks
app.conf.timezone = 'UTC'


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working."""
    print(f'Request: {self.request!r}')

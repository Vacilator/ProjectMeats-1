"""Celery application configuration for ProjectMeats."""

import logging
import os

from celery import Celery
from celery.schedules import crontab

# Set default Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "projectmeats.settings.development")

# Create Celery app
app = Celery("projectmeats")

# Load config from Django settings (namespace='CELERY')
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

# Configure periodic tasks
app.conf.beat_schedule = {
    "sync-tenant-emails-every-15-minutes": {
        "task": "integrations.sync_tenant_emails",
        "schedule": 900.0,  # 15 minutes in seconds
        "options": {
            "expires": 840.0,  # Task expires if not run within 14 minutes
            "queue": "pm.ops",
            "routing_key": "pm.ops",
        },
    },
    "compile-rlhf-data-weekly": {
        "task": "ai_assistant.compile_rlhf_data",
        "schedule": crontab(minute=0, hour=3, day_of_week="sun"),
        "args": (7, 5000),
        "options": {
            "expires": 3600.0,
            "queue": "pm.ai",
            "routing_key": "pm.ai",
        },
    },
    "ai-watchdog-daily": {
        "task": "ai_assistant.run_daily_watchdog",
        "schedule": crontab(minute=0, hour=6),
        "args": (3,),
        "options": {
            "expires": 3600.0,
            "queue": "pm.ai",
            "routing_key": "pm.ai",
        },
    },
    "audit-data-governance-daily": {
        "task": "system.audit_data_governance_posture",
        "schedule": crontab(minute=30, hour=5),
        "args": (30,),
        "options": {
            "expires": 3600.0,
            "queue": "pm.ops",
            "routing_key": "pm.ops",
        },
    },
    "trade-saga-sweep-every-5-minutes": {
        "task": "trade.process_unprocessed_events",
        "schedule": 300.0,  # 5 minutes
        "options": {
            "expires": 240.0,
            "queue": "pm.trade",
            "routing_key": "pm.trade",
        },
    },
    "auto-pipeline-sweep-every-5-minutes": {
        "task": "integrations.auto_process_approved_emails",
        "schedule": 300.0,  # 5 minutes
        "options": {
            "expires": 240.0,
            "queue": "pm.ops",
            "routing_key": "pm.ops",
        },
    },
    "ai-inbox-sync-every-15-minutes": {
        "task": "ai_assistant.run_ai_inbox_watchdog",
        "schedule": 900.0,  # 15 minutes
        "options": {
            "expires": 840.0,
            "queue": "pm.ai",
            "routing_key": "pm.ai",
        },
    },
}

# Set timezone for scheduled tasks
app.conf.timezone = "UTC"

logger = logging.getLogger(__name__)


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working."""
    logger.info(
        "Celery debug task invoked",
        extra={
            "task_name": getattr(self, "name", "unknown"),
            "task_id": getattr(self.request, "id", None),
            "retries": getattr(self.request, "retries", None),
            "delivery_info": getattr(self.request, "delivery_info", None),
        },
    )

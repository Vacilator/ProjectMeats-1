from django.conf import settings
from django.test import SimpleTestCase

from projectmeats.celery import app


class CeleryQueueContractTests(SimpleTestCase):
    def test_named_queues_and_defaults_are_explicit(self):
        queue_names = {queue.name for queue in settings.CELERY_TASK_QUEUES}

        self.assertEqual(settings.CELERY_TASK_DEFAULT_QUEUE, 'pm.ops')
        self.assertEqual(settings.CELERY_TASK_DEFAULT_ROUTING_KEY, 'pm.ops')
        self.assertFalse(settings.CELERY_TASK_CREATE_MISSING_QUEUES)
        self.assertEqual(settings.CELERY_WORKER_PREFETCH_MULTIPLIER, 1)
        self.assertSetEqual(queue_names, {'pm.ops', 'pm.email', 'pm.workforms', 'pm.ai', 'pm.etl'})

    def test_task_routes_match_workload_classes(self):
        routes = settings.CELERY_TASK_ROUTES

        self.assertEqual(routes['integrations.sync_tenant_emails']['queue'], 'pm.ops')
        self.assertEqual(routes['integrations.sync_email_provider_inbox']['queue'], 'pm.email')
        self.assertEqual(routes['tenant_integrations.dispatch_webhook_payload']['queue'], 'pm.email')
        self.assertEqual(routes['system.execute_workform_*']['queue'], 'pm.workforms')
        self.assertEqual(routes['system.continue_workform_after_parallel']['queue'], 'pm.workforms')
        self.assertEqual(routes['workflows.execute_*']['queue'], 'pm.workforms')
        self.assertEqual(routes['workflows.generate_ai_template_suggestions']['queue'], 'pm.ai')
        self.assertEqual(routes['ai_assistant.*']['queue'], 'pm.ai')

    def test_worker_envelopes_and_thresholds_are_documented_in_settings(self):
        self.assertEqual(
            settings.CELERY_WORKER_ENVELOPES['pm-worker-realtime']['queues'],
            ('pm.email', 'pm.ops'),
        )
        self.assertEqual(
            settings.CELERY_WORKER_ENVELOPES['pm-worker-workforms']['autoscale_min'],
            2,
        )
        self.assertEqual(
            settings.CELERY_WORKER_ENVELOPES['pm-worker-workforms']['autoscale_max'],
            4,
        )
        self.assertEqual(settings.CELERY_WORKER_ENVELOPES['pm-worker-etl']['concurrency'], 1)
        self.assertEqual(settings.CELERY_QUEUE_SATURATION_THRESHOLDS['pm.workforms']['warn_backlog'], 20)
        self.assertEqual(settings.CELERY_QUEUE_SATURATION_THRESHOLDS['pm.ai']['critical_backlog'], 10)

    def test_beat_schedule_dispatches_to_explicit_queues(self):
        beat_schedule = app.conf.beat_schedule

        self.assertEqual(
            beat_schedule['sync-tenant-emails-every-5-minutes']['options']['queue'],
            'pm.ops',
        )
        self.assertEqual(
            beat_schedule['compile-rlhf-data-weekly']['options']['queue'],
            'pm.ai',
        )
        self.assertEqual(
            beat_schedule['ai-watchdog-daily']['options']['queue'],
            'pm.ai',
        )

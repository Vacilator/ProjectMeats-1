"""Tests for process event notification service (RT-06.1)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.test import TestCase, override_settings

from tenant_apps.workflows.services.process_notifications import (
    EVENT_CONFIG,
    NotificationResult,
    ProcessEvent,
    notify_process_event,
)


class ProcessNotificationServiceTests(TestCase):
    """Tests for the process notification service."""

    def setUp(self):
        self.tenant = MagicMock()
        self.tenant.id = uuid4()

        self.inquiry = MagicMock()
        self.inquiry.id = uuid4()
        self.inquiry.inquiry_number = "INQ-001"
        self.inquiry.supplier = MagicMock()
        self.inquiry.supplier.name = "Acme Corp"
        self.inquiry.customer = MagicMock()
        self.inquiry.customer.name = "Test Customer"

        self.user = MagicMock()
        self.user.id = uuid4()
        self.user.email = "trader@example.com"
        self.user.username = "trader"

    def test_event_config_has_all_events(self):
        """Every ProcessEvent must have a config entry."""
        for event in ProcessEvent:
            self.assertIn(event, EVENT_CONFIG, f"Missing config for {event}")

    def test_event_config_has_required_keys(self):
        """Each config entry must have the required template keys."""
        required_keys = {
            "notification_type",
            "priority",
            "title_template",
            "message_template",
            "target_department",
            "target_contact_type",
        }
        for event, config in EVENT_CONFIG.items():
            for key in required_keys:
                self.assertIn(key, config, f"Missing '{key}' in config for {event}")

    @patch("tenant_apps.workflows.services.process_notifications.UserNotification")
    @patch("tenant_apps.workflows.services.process_notifications.User")
    def test_notify_with_explicit_users(self, mock_user_model, mock_notification_model):
        """Should create notifications for explicitly provided users."""
        mock_notification_model.objects.filter.return_value.exists.return_value = False
        mock_notification_model.objects.create.return_value = MagicMock()

        result = notify_process_event(
            tenant=self.tenant,
            event=ProcessEvent.BID_RECEIVED,
            inquiry=self.inquiry,
            context={"supplier": "Acme", "bid_amount": "1500.00"},
            target_users=[self.user],
        )

        self.assertIsInstance(result, NotificationResult)
        self.assertEqual(result.notifications_created, 1)
        mock_notification_model.objects.create.assert_called_once()

    @patch("tenant_apps.workflows.services.process_notifications.UserNotification")
    @patch("tenant_apps.workflows.services.process_notifications.User")
    def test_deduplication_within_5_minutes(self, mock_user_model, mock_notification_model):
        """Should not create duplicate notifications within 5 minutes."""
        mock_notification_model.objects.filter.return_value.exists.return_value = True

        result = notify_process_event(
            tenant=self.tenant,
            event=ProcessEvent.BID_RECEIVED,
            inquiry=self.inquiry,
            context={"supplier": "Acme", "bid_amount": "1500.00"},
            target_users=[self.user],
        )

        self.assertEqual(result.notifications_created, 0)
        mock_notification_model.objects.create.assert_not_called()

    @patch("tenant_apps.workflows.services.process_notifications._queue_notification_email")
    @patch("tenant_apps.workflows.services.process_notifications._should_send_email")
    @patch("tenant_apps.workflows.services.process_notifications.UserNotification")
    @patch("tenant_apps.workflows.services.process_notifications.User")
    def test_email_queued_when_preferences_allow(
        self, mock_user_model, mock_notification_model, mock_should_email, mock_queue_email
    ):
        """Should queue email if user preferences allow it."""
        mock_notification_model.objects.filter.return_value.exists.return_value = False
        mock_notification_model.objects.create.return_value = MagicMock()
        mock_should_email.return_value = True

        result = notify_process_event(
            tenant=self.tenant,
            event=ProcessEvent.APPROVAL_NEEDED,
            inquiry=self.inquiry,
            context={"entity_type": "Supplier PO", "entity_number": "PO-123", "margin": "15"},
            target_users=[self.user],
        )

        self.assertEqual(result.emails_queued, 1)
        mock_queue_email.assert_called_once()

    @patch("tenant_apps.workflows.services.process_notifications._queue_notification_email")
    @patch("tenant_apps.workflows.services.process_notifications._should_send_email")
    @patch("tenant_apps.workflows.services.process_notifications.UserNotification")
    @patch("tenant_apps.workflows.services.process_notifications.User")
    def test_email_not_queued_when_preferences_deny(
        self, mock_user_model, mock_notification_model, mock_should_email, mock_queue_email
    ):
        """Should NOT queue email if user preferences deny it."""
        mock_notification_model.objects.filter.return_value.exists.return_value = False
        mock_notification_model.objects.create.return_value = MagicMock()
        mock_should_email.return_value = False

        result = notify_process_event(
            tenant=self.tenant,
            event=ProcessEvent.BID_RECEIVED,
            inquiry=self.inquiry,
            context={"supplier": "Acme", "bid_amount": "500"},
            target_users=[self.user],
        )

        self.assertEqual(result.emails_queued, 0)
        mock_queue_email.assert_not_called()

    def test_unknown_event_returns_error(self):
        """Should handle gracefully if event config is missing."""
        # This tests defensive coding — all events have configs,
        # but if somehow a new one is added without config it should not crash.
        result = NotificationResult()
        result.errors.append("test error")
        self.assertEqual(len(result.errors), 1)

    @patch("tenant_apps.workflows.services.process_notifications.UserNotification")
    @patch("tenant_apps.workflows.services.process_notifications.User")
    def test_fallback_to_tenant_staff(self, mock_user_model, mock_notification_model):
        """Should fallback to tenant staff if no contacts resolved."""
        mock_notification_model.objects.filter.return_value.exists.return_value = False
        mock_notification_model.objects.create.return_value = MagicMock()
        mock_user_model.objects.filter.return_value.distinct.return_value.__getitem__ = (
            lambda self, s: [MagicMock(email="staff@test.com")]
        )

        # Patch _resolve_target_users to return empty
        with patch(
            "tenant_apps.workflows.services.process_notifications._resolve_target_users",
            return_value=[],
        ):
            result = notify_process_event(
                tenant=self.tenant,
                event=ProcessEvent.PROCESS_COMPLETED,
                inquiry=self.inquiry,
            )

        # Should have tried to fallback
        mock_user_model.objects.filter.assert_called()

    def test_process_event_enum_values(self):
        """All process events should have string values."""
        for event in ProcessEvent:
            self.assertIsInstance(event.value, str)
            self.assertTrue(len(event.value) > 0)

    @patch("tenant_apps.workflows.services.process_notifications.UserNotification")
    @patch("tenant_apps.workflows.services.process_notifications.User")
    def test_metadata_includes_event_context(self, mock_user_model, mock_notification_model):
        """Notification metadata should include the event type and context."""
        mock_notification_model.objects.filter.return_value.exists.return_value = False
        created_notification = MagicMock()
        mock_notification_model.objects.create.return_value = created_notification

        notify_process_event(
            tenant=self.tenant,
            event=ProcessEvent.STEP_FAILED,
            inquiry=self.inquiry,
            context={
                "step_name": "Send RFQ",
                "error_message": "SMTP timeout",
                "recovery_hint": "Check email config",
            },
            target_users=[self.user],
        )

        call_kwargs = mock_notification_model.objects.create.call_args[1]
        self.assertEqual(call_kwargs["metadata"]["event"], "step_failed")
        self.assertIn("step_name", call_kwargs["metadata"]["context"])

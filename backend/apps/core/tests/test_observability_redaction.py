import io
import logging

from django.test import SimpleTestCase

from apps.core.utils.redaction import (
    RedactingFormatter,
    RedactingLogFilter,
    sentry_before_breadcrumb,
    sentry_before_send,
    sentry_before_send_transaction,
    sanitize_data,
)


class ObservabilityRedactionTests(SimpleTestCase):
    def test_sanitize_data_redacts_nested_pii_and_tokens(self):
        payload = {
            "email": "alice@example.com",
            "phone": "+1 415-555-2671",
            "authorization": "Bearer secret-token",
            "metadata": {
                "request_id": "req-123",
                "status_code": 500,
                "note": "Contact alice@example.com at +1 415-555-2671",
            },
        }

        sanitized = sanitize_data(payload)

        self.assertEqual(sanitized["email"], "[REDACTED:EMAIL]")
        self.assertEqual(sanitized["phone"], "[REDACTED:PHONE]")
        self.assertEqual(sanitized["authorization"], "[REDACTED:TOKEN]")
        self.assertEqual(sanitized["metadata"]["request_id"], "req-123")
        self.assertEqual(sanitized["metadata"]["status_code"], 500)
        self.assertNotIn("alice@example.com", sanitized["metadata"]["note"])
        self.assertNotIn("+1 415-555-2671", sanitized["metadata"]["note"])

    def test_logging_filter_and_formatter_redact_messages_and_tracebacks(self):
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.addFilter(RedactingLogFilter())
        handler.setFormatter(RedactingFormatter("{levelname} {message}", style="{"))

        logger = logging.getLogger("tests.observability.redaction")
        logger.handlers = [handler]
        logger.setLevel(logging.ERROR)
        logger.propagate = False

        try:
            raise ValueError("bad token Bearer secret-token for alice@example.com")
        except ValueError:
            logger.error(
                "Invite send failed for %s",
                "alice@example.com",
                extra={"authorization": "Bearer secret-token"},
                exc_info=True,
            )

        rendered = stream.getvalue()
        self.assertIn("Invite send failed", rendered)
        self.assertIn("ValueError", rendered)
        self.assertNotIn("alice@example.com", rendered)
        self.assertNotIn("secret-token", rendered)

    def test_sentry_processors_redact_events_breadcrumbs_and_transactions(self):
        event = {
            "message": "Failed for alice@example.com",
            "request": {
                "headers": {"Authorization": "Bearer secret-token"},
                "data": {"email": "alice@example.com"},
            },
            "user": {"id": "1", "email": "alice@example.com"},
            "extra": {"phone": "+1 415-555-2671"},
        }
        breadcrumb = {
            "message": "Authorization=Bearer secret-token",
            "data": {"email": "alice@example.com"},
        }
        transaction = {
            "transaction": "POST /api/v1/integrations/webhook/?token=secret-token",
            "contexts": {"request": {"headers": {"Cookie": "sessionid=abc123"}}},
        }

        sanitized_event = sentry_before_send(event, None)
        sanitized_breadcrumb = sentry_before_breadcrumb(breadcrumb, None)
        sanitized_transaction = sentry_before_send_transaction(transaction, None)

        self.assertIsNotNone(sanitized_event)
        self.assertNotIn("alice@example.com", str(sanitized_event))
        self.assertNotIn("secret-token", str(sanitized_event))
        self.assertEqual(sanitized_event["user"]["id"], "1")
        self.assertNotIn("alice@example.com", str(sanitized_breadcrumb))
        self.assertNotIn("secret-token", str(sanitized_breadcrumb))
        self.assertNotIn("secret-token", str(sanitized_transaction))

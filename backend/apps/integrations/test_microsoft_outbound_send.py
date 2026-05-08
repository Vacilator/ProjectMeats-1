import os
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

import requests

from apps.integrations.providers.base import EmailProviderError
from apps.integrations.providers.microsoft import MicrosoftGraphProvider


class MicrosoftGraphOutboundSendTests(SimpleTestCase):
    def _response(self, *, status: int = 200, payload: dict | None = None, text: str = "") -> Mock:
        response = Mock()
        response.status_code = status
        response.json.return_value = payload or {}
        response.text = text
        if status >= 400:
            response.raise_for_status.side_effect = requests.HTTPError(response=response)
        else:
            response.raise_for_status.return_value = None
        return response

    @patch.dict(os.environ, {"MICROSOFT_CLIENT_ID": "client-id", "MICROSOFT_CLIENT_SECRET": "secret"}, clear=False)
    @patch("requests.post")
    def test_send_email_returns_provider_metadata_from_graph_draft(self, mock_post):
        mock_post.side_effect = [
            self._response(
                payload={
                    "id": "draft-123",
                    "conversationId": "thread-456",
                    "internetMessageId": "<message@example.com>",
                    "webLink": "https://outlook.example.com/message/draft-123",
                }
            ),
            self._response(status=202),
        ]

        provider = MicrosoftGraphProvider(tenant_id=1)
        result = provider.send_email(
            "access-token",
            {
                "to": ["supplier@example.com"],
                "subject": "RFQ",
                "body": "Quote request",
                "reply_to": "planner@example.com",
                "headers": {"X-ProjectMeats-Inquiry-RFQ": "rfq-key-123"},
            },
        )

        self.assertEqual(result["status"], "sent")
        self.assertEqual(result["provider_message_id"], "draft-123")
        self.assertEqual(result["provider_thread_id"], "thread-456")
        self.assertEqual(result["provider_internet_message_id"], "<message@example.com>")

        create_call = mock_post.call_args_list[0]
        self.assertIn("/me/messages", create_call.args[0])
        self.assertEqual(
            create_call.kwargs["json"]["internetMessageHeaders"][0],
            {"name": "X-ProjectMeats-Inquiry-RFQ", "value": "rfq-key-123"},
        )
        self.assertEqual(
            create_call.kwargs["json"]["replyTo"][0]["emailAddress"]["address"],
            "planner@example.com",
        )
        send_call = mock_post.call_args_list[1]
        self.assertIn("/me/messages/draft-123/send", send_call.args[0])

    @patch.dict(os.environ, {"MICROSOFT_CLIENT_ID": "client-id", "MICROSOFT_CLIENT_SECRET": "secret"}, clear=False)
    @patch("requests.post")
    def test_send_email_normalizes_http_failures(self, mock_post):
        mock_post.return_value = self._response(status=500, text="boom")
        provider = MicrosoftGraphProvider(tenant_id=1)

        with self.assertRaisesMessage(EmailProviderError, "Failed to send email: boom"):
            provider.send_email(
                "access-token",
                {
                    "to": ["supplier@example.com"],
                    "subject": "RFQ",
                    "body": "Quote request",
                },
            )

import json
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
from tenant_apps.ai_assistant.swarm.router import SwarmOrchestrator

from apps.tenants.models import Tenant


class SwarmRouterToolLoopTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="router-user", password="pass123")
        self.tenant = Tenant.objects.create(
            name="Router Tenant",
            slug="router-tenant",
            contact_email="router@example.com",
            created_by=self.user,
        )

    @patch("openai.OpenAI")
    @patch.object(ToolExecutor, "execute")
    @override_settings(OPENAI_API_KEY="test-openai-key")
    def test_non_retryable_tool_error_forces_clarifying_prompt(self, execute_mock, openai_mock):
        execute_mock.return_value = json.dumps(
            {
                "ok": False,
                "tool": "fetch_emails",
                "error": {
                    "code": "MISSING_DATE_RANGE",
                    "message": "Need a date range before searching archived mail.",
                    "hint": "Ask the user which date range to search.",
                    "retryable": False,
                },
            }
        )

        first_completion = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content="",
                        tool_calls=[
                            SimpleNamespace(
                                id="tc-1",
                                type="function",
                                function=SimpleNamespace(name="fetch_emails", arguments='{"folder":"archive"}'),
                            )
                        ],
                    )
                )
            ]
        )
        second_completion = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content="What date range should I search in archived mail?",
                        tool_calls=None,
                    )
                )
            ]
        )

        client = openai_mock.return_value
        client.chat.completions.create.side_effect = [first_completion, second_completion]

        result = SwarmOrchestrator(tenant_id=str(self.tenant.id)).run_tool_loop(
            user_message="Find the archived invoice email.",
            tenant=self.tenant,
            user=self.user,
        )

        second_messages = client.chat.completions.create.call_args_list[1].kwargs["messages"]

        self.assertEqual(result["response"], "What date range should I search in archived mail?")
        self.assertTrue(
            any(
                msg.get("role") == "system"
                and "Do not retry this tool" in str(msg.get("content"))
                and "Need a date range before searching archived mail." in str(msg.get("content"))
                for msg in second_messages
            )
        )

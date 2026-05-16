from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import signing
from django.core.cache import cache
from django.test import override_settings
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from integrations.views.oauth import OAuthAuthorizeView, OAuthCallbackView
from tenant_apps.ai_assistant.models import AIFeedbackLog

from apps.integrations import urls as app_integrations_urls
from apps.integrations.models import EmailLog, ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser


class EmailSyncTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

        ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type="microsoft",
            is_active=True,
            connected_email="test@tenant.com",
            token_expiry=timezone.now() + timedelta(days=1),
        )

        # Use session auth so AuthenticationMiddleware marks request.user as authenticated
        # before TenantMiddleware runs.
        self.client.force_login(self.user)

    @patch("tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id")
    def test_sync_emails_soft_fails_on_exception(self, poll_tenant_by_id):
        poll_tenant_by_id.side_effect = RuntimeError("boom")

        resp = self.client.post(
            "/api/v1/integrations/email/sync/",
            {},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("ok"), False)
        self.assertEqual(resp.data.get("code"), "sync_exception")
        self.assertEqual(resp.data.get("failure", {}).get("code"), "EMAIL_SYNC_FAILED")
        self.assertEqual(resp.data.get("failure", {}).get("category"), "processing")
        self.assertFalse(resp.data.get("failure", {}).get("retryable"))

        # Must not leak raw exception strings to callers (security + UX stability)
        self.assertNotIn("boom", resp.data.get("error", ""))
        self.assertEqual(resp.data.get("details", {}).get("type"), "RuntimeError")

    @patch("apps.integrations.tasks.sync_single_tenant.apply_async")
    def test_auto_sync_queues_single_tenant_sync(self, apply_async):
        apply_async.return_value = SimpleNamespace(id="task-123")

        resp = self.client.post(
            "/api/v1/integrations/email/auto-sync/",
            {"source": "login"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(resp.data.get("ok"), True)
        self.assertEqual(resp.data.get("accepted"), True)
        self.assertEqual(resp.data.get("source"), "login")
        self.assertEqual(resp.data.get("task_id"), "task-123")
        self.assertEqual(resp.data.get("progress", {}).get("phase"), "queued")
        apply_async.assert_called_once_with(args=[str(self.tenant.id)])

    def test_auto_sync_not_connected_returns_reconnect_action(self):
        ExternalAuthProvider.objects.filter(tenant=self.tenant, provider_type="microsoft").update(is_active=False)

        resp = self.client.post(
            "/api/v1/integrations/email/auto-sync/",
            {"source": "manual"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("accepted"))
        self.assertEqual(resp.data.get("action", {}).get("type"), "reconnect_outlook")
        self.assertIn("/api/v1/integrations/oauth/authorize/", resp.data.get("action", {}).get("url", ""))

    @patch("tenant_apps.integrations.services.email_ingestion.EmailIngestionService")
    @patch("apps.integrations.tasks.sync_single_tenant.apply_async")
    def test_auto_sync_schedule_failure_returns_retry_action(self, apply_async, mock_ingestion_cls):
        apply_async.side_effect = RuntimeError("queue unavailable")
        mock_ingestion_cls.return_value.poll_tenant_by_id.side_effect = RuntimeError("sync also failed")

        resp = self.client.post(
            "/api/v1/integrations/email/auto-sync/",
            {"source": "manual"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("accepted"))
        self.assertEqual(resp.data.get("action", {}).get("type"), "retry_sync")

    @patch("apps.integrations.views.AsyncResult")
    def test_auto_sync_status_returns_task_state(self, async_result_cls):
        cache.set("integrations.email_auto_sync.tenant:task-123", str(self.tenant.id), timeout=60)
        async_result_cls.return_value = SimpleNamespace(
            state="SUCCESS",
            ready=lambda: True,
            successful=lambda: True,
            failed=lambda: False,
            result={
                "tenant_id": str(self.tenant.id),
                "success": True,
                "stats": {"emails_saved": 1},
            },
        )

        resp = self.client.get(
            "/api/v1/integrations/email/auto-sync/task-123/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("task_id"), "task-123")
        self.assertEqual(resp.data.get("state"), "SUCCESS")
        self.assertEqual(resp.data.get("ready"), True)
        self.assertEqual(resp.data.get("successful"), True)
        self.assertEqual(resp.data.get("result", {}).get("tenant_id"), str(self.tenant.id))

    @patch("apps.integrations.views.AsyncResult")
    def test_auto_sync_status_returns_inflight_progress(self, async_result_cls):
        cache.set("integrations.email_auto_sync.tenant:task-progress", str(self.tenant.id), timeout=60)
        async_result_cls.return_value = SimpleNamespace(
            state="PROGRESS",
            ready=lambda: False,
            successful=lambda: False,
            failed=lambda: False,
            info={
                "tenant_id": str(self.tenant.id),
                "progress": {
                    "phase": "refreshing_ai_inbox",
                    "percent": 80,
                    "summary": "Refreshing AI Inbox summaries…",
                },
            },
            result=None,
        )

        resp = self.client.get(
            "/api/v1/integrations/email/auto-sync/task-progress/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("progress", {}).get("phase"), "refreshing_ai_inbox")
        self.assertEqual(resp.data.get("progress", {}).get("percent"), 80)

    @patch("apps.integrations.views.AsyncResult")
    def test_auto_sync_status_rejects_cross_tenant_inflight_task(self, async_result_cls):
        other_user = User.objects.create_user(username="otheruser", password="testpass123")
        other_tenant = Tenant.objects.create(
            name="Other Tenant",
            slug="other-tenant",
            contact_email="other@example.com",
            created_by=other_user,
        )
        cache.set("integrations.email_auto_sync.tenant:task-foreign", str(other_tenant.id), timeout=60)
        async_result_cls.return_value = SimpleNamespace(
            state="PROGRESS",
            ready=lambda: False,
            successful=lambda: False,
            failed=lambda: False,
            info=None,
            result=None,
        )

        resp = self.client.get(
            "/api/v1/integrations/email/auto-sync/task-foreign/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    @patch("apps.integrations.views.AsyncResult")
    def test_auto_sync_status_marks_semantic_failure_as_failed(self, async_result_cls):
        cache.set("integrations.email_auto_sync.tenant:task-failed", str(self.tenant.id), timeout=60)
        async_result_cls.return_value = SimpleNamespace(
            state="SUCCESS",
            ready=lambda: True,
            successful=lambda: True,
            failed=lambda: False,
            info=None,
            result={
                "tenant_id": str(self.tenant.id),
                "success": False,
                "summary": "Microsoft Graph timed out while syncing email.",
                "action": {"type": "retry_sync", "label": "Retry Sync"},
                "failure": {
                    "code": "GRAPH_TIMEOUT",
                    "category": "network",
                    "retryable": True,
                    "state": "retryable_failure",
                    "message": "Microsoft Graph timed out while syncing email.",
                    "provider": "microsoft",
                },
            },
        )

        resp = self.client.get(
            "/api/v1/integrations/email/auto-sync/task-failed/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("successful"))
        self.assertTrue(resp.data.get("failed"))
        self.assertEqual(resp.data.get("result", {}).get("action", {}).get("type"), "retry_sync")

    def test_auto_sync_soft_fails_when_not_connected(self):
        ExternalAuthProvider.objects.filter(tenant=self.tenant, provider_type="microsoft").update(is_active=False)

        resp = self.client.post(
            "/api/v1/integrations/email/auto-sync/",
            {"source": "interval"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("ok"), False)
        self.assertEqual(resp.data.get("accepted"), False)
        self.assertEqual(resp.data.get("code"), "not_connected")
        self.assertEqual(resp.data.get("source"), "interval")

    def test_sync_emails_returns_not_connected_payload(self):
        ExternalAuthProvider.objects.filter(tenant=self.tenant, provider_type="microsoft").update(is_active=False)

        resp = self.client.post(
            "/api/v1/integrations/email/sync/",
            {},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("ok"))
        self.assertEqual(resp.data.get("code"), "not_connected")
        self.assertEqual(resp.data.get("error_code"), "not_connected")
        self.assertEqual(resp.data.get("action", {}).get("type"), "reconnect_outlook")
        self.assertIn("hint", resp.data)
        self.assertEqual(resp.data.get("cta", {}).get("url"), "/settings/email-integrations")
        self.assertEqual(resp.data.get("failure", {}).get("code"), "OUTLOOK_NOT_CONNECTED")
        self.assertEqual(resp.data.get("failure", {}).get("category"), "auth")
        self.assertFalse(resp.data.get("failure", {}).get("retryable"))

    @patch("tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id")
    def test_sync_emails_soft_fails_when_graph_returns_zero_scanned_with_errors(self, poll_tenant_by_id):
        poll_tenant_by_id.return_value = {
            "errors": 1,
            "emails_scanned": 0,
            "errors_detail": ["Token invalid/expired"],
            "emails_matched": 0,
            "emails_fetched": 0,
            "emails_saved": 0,
            "emails_skipped": 0,
            "failure": {
                "code": "OUTLOOK_CONNECTION_EXPIRED",
                "legacy_error_code": "token_invalid",
                "category": "auth",
                "state": "non_retryable_failure",
                "retryable": False,
                "message": "Your Outlook connection has expired.",
                "hint": "Reconnect Outlook in Settings → Email Integrations.",
                "provider": "microsoft",
                "stage": "sync_validate",
            },
        }

        resp = self.client.post(
            "/api/v1/integrations/email/sync/",
            {},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("ok"), False)
        self.assertEqual(resp.data.get("code"), "sync_failed")
        self.assertEqual(resp.data.get("error"), "Your Outlook connection has expired.")
        self.assertEqual(resp.data.get("error_code"), "token_invalid")
        self.assertEqual(resp.data.get("cta", {}).get("url"), "/settings/email-integrations")
        self.assertEqual(resp.data.get("failure", {}).get("code"), "OUTLOOK_CONNECTION_EXPIRED")
        self.assertEqual(resp.data.get("failure", {}).get("category"), "auth")
        self.assertFalse(resp.data.get("failure", {}).get("retryable"))

    @patch("tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id")
    def test_sync_emails_exposes_retryable_network_failure_contract(self, poll_tenant_by_id):
        poll_tenant_by_id.return_value = {
            "errors": 1,
            "emails_scanned": 0,
            "failure": {
                "code": "GRAPH_TIMEOUT",
                "legacy_error_code": "graph_timeout",
                "category": "network",
                "state": "retryable_failure",
                "retryable": True,
                "message": "Microsoft Graph timed out while syncing email.",
                "hint": "Retry the sync. If the problem persists, narrow the request or try again shortly.",
                "provider": "microsoft",
                "stage": "sync_fetch",
            },
        }

        resp = self.client.post(
            "/api/v1/integrations/email/sync/",
            {},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("failure", {}).get("code"), "GRAPH_TIMEOUT")
        self.assertEqual(resp.data.get("failure", {}).get("category"), "network")
        self.assertTrue(resp.data.get("failure", {}).get("retryable"))
        self.assertEqual(resp.data.get("error_code"), "graph_timeout")

    @patch("tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id")
    def test_sync_emails_soft_fails_for_reconnect_cases(self, poll_tenant_by_id):
        for legacy_code, canonical_code in (
            ("decryption_failed", "DECRYPTION_FAILED"),
            ("token_refresh_failed", "OUTLOOK_TOKEN_REFRESH_FAILED"),
            ("token_missing", "OUTLOOK_ACCESS_TOKEN_MISSING"),
        ):
            with self.subTest(legacy_code=legacy_code):
                poll_tenant_by_id.return_value = {
                    "errors": 1,
                    "emails_scanned": 0,
                    "error_code": legacy_code,
                    "errors_detail": ["sample detail"],
                }

                resp = self.client.post(
                    "/api/v1/integrations/email/sync/",
                    {},
                    format="json",
                    HTTP_X_TENANT_ID=str(self.tenant.id),
                )

                self.assertEqual(resp.status_code, status.HTTP_200_OK)
                self.assertEqual(resp.data.get("failure", {}).get("code"), canonical_code)
                self.assertFalse(resp.data.get("failure", {}).get("retryable"))
                self.assertEqual(resp.data.get("error_code"), legacy_code)
                self.assertEqual(resp.data.get("cta", {}).get("url"), "/settings/email-integrations")

    @patch("apps.integrations.tasks.classify_email_async.apply_async")
    @patch("apps.integrations.ai_classification.classify_ingested_email")
    @patch("tenant_apps.inquiries.services.parse_supplier_quote_reply", return_value=None)
    def test_new_email_creates_action_required_feedback_log(self, _parse_mock, classify_mock, _apply_async_mock):
        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type="microsoft")
        classify_mock.return_value = {
            "document_type": "purchase_order",
            "draft_type": "purchase_order",
            "order_number": "PO-123",
            "confidence_score": 0.42,
            "actionable": False,
        }

        email = EmailLog.objects.create(
            tenant=self.tenant,
            provider=provider,
            message_id="message-1",
            subject="Purchase Order 123",
            sender_email="buyer@example.com",
            received_at=timezone.now(),
            body_text="Please book PO-123.",
        )

        # Run the async classification task synchronously
        from apps.integrations.tasks import classify_email_async

        classify_email_async.apply(args=[str(email.pk), str(email.tenant_id)])

        email.refresh_from_db()
        self.assertEqual(email.status, "action_required")
        self.assertEqual(email.extracted_data, classify_mock.return_value)

        feedback = AIFeedbackLog.objects.get(tenant=self.tenant)
        self.assertEqual(feedback.document_type, "purchase_order")
        self.assertAlmostEqual(feedback.confidence_score, 0.42)
        self.assertIsNone(feedback.resolved_by)
        self.assertEqual(feedback.original_extracted_data.get("order_number"), "PO-123")

    def test_oauth_status_returns_active_connection(self):
        resp = self.client.get(
            "/api/v1/integrations/oauth/status/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("count"), 1)
        self.assertEqual(resp.data.get("connections", [])[0].get("provider"), "microsoft")

    def test_email_logs_include_structured_failure_metadata(self):
        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type="microsoft")
        email = EmailLog.objects.create(
            tenant=self.tenant,
            provider=provider,
            message_id="message-failed",
            subject="Failed email",
            sender_email="buyer@example.com",
            received_at=timezone.now(),
            body_text="broken",
        )
        email.mark_as_failed(
            failure={
                "code": "DECRYPTION_FAILED",
                "legacy_error_code": "decryption_failed",
                "category": "decrypt",
                "state": "non_retryable_failure",
                "retryable": False,
                "message": "Your Outlook connection needs to be refreshed for security reasons.",
                "hint": "Reconnect Outlook in Settings → Email Integrations.",
                "provider": "microsoft",
                "stage": "sync_decrypt",
            }
        )

        resp = self.client.get(
            "/api/v1/integrations/email/logs/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["emails"][0]["failure"]["code"], "DECRYPTION_FAILED")
        self.assertEqual(resp.data["emails"][0]["failure"]["category"], "decrypt")
        self.assertEqual(resp.data["emails"][0]["failure"]["state"], "non_retryable_failure")

    def test_oauth_status_refreshes_expired_connection_before_reporting(self):
        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type="microsoft")
        provider.token_expiry = timezone.now() - timedelta(minutes=1)
        provider.set_encrypted_token("access", "stale-access")
        provider.set_encrypted_token("refresh", "refresh-token")
        provider.save()

        def _refresh(provider_row):
            provider_row.token_expiry = timezone.now() + timedelta(hours=1)
            provider_row.set_encrypted_token("access", "fresh-access")
            provider_row.save()
            return True

        with patch.object(
            ExternalAuthProvider, "refresh_if_needed", autospec=True, side_effect=_refresh
        ) as refresh_mock:
            resp = self.client.get(
                "/api/v1/integrations/oauth/status/",
                HTTP_X_TENANT_ID=str(self.tenant.id),
            )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("connections", [])[0].get("is_expired"))
        refresh_mock.assert_called_once()

    def test_oauth_disconnect_marks_provider_inactive(self):
        resp = self.client.post(
            "/api/v1/integrations/oauth/disconnect/",
            {"provider": "microsoft"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("provider"), "microsoft")

        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type="microsoft")
        self.assertFalse(provider.is_active)


class IntegrationsOAuthRouteTests(APITestCase):
    def test_public_oauth_routes_resolve_to_canonical_views(self):
        authorize_match = resolve("/api/v1/integrations/oauth/authorize/")
        callback_match = resolve("/api/v1/integrations/oauth/callback/microsoft/")

        self.assertIs(authorize_match.func.view_class, OAuthAuthorizeView)
        self.assertIs(callback_match.func.view_class, OAuthCallbackView)

    def test_app_integrations_urlconf_legacy_oauth_aliases_point_to_canonical_views(self):
        oauth_patterns = {
            str(pattern.pattern): getattr(getattr(pattern, "callback", None), "view_class", None)
            for pattern in app_integrations_urls.urlpatterns
            if str(pattern.pattern).startswith("oauth/")
        }

        self.assertIs(oauth_patterns.get("oauth/authorize/"), OAuthAuthorizeView)
        self.assertIs(oauth_patterns.get("oauth/callback/<str:provider_type>/"), OAuthCallbackView)


class IntegrationsOAuthCallbackPublicTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_oauth_callback_allows_anonymous(self):
        resp = self.client.get("/api/v1/integrations/oauth/callback/microsoft/?error=access_denied")
        self.assertEqual(resp.status_code, 302)

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_CLASSES": [
                "rest_framework.throttling.AnonRateThrottle",
                "rest_framework.throttling.UserRateThrottle",
            ],
            "DEFAULT_THROTTLE_RATES": {
                "anon": "1/minute",
                "user": "1/minute",
            },
        }
    )
    def test_oauth_callback_is_exempt_from_global_throttles(self):
        first = self.client.get("/api/v1/integrations/oauth/callback/microsoft/?error=access_denied")
        second = self.client.get("/api/v1/integrations/oauth/callback/microsoft/?error=access_denied")

        self.assertEqual(first.status_code, 302)
        self.assertEqual(second.status_code, 302)


class IntegrationsOAuthSecurityTests(APITestCase):
    OAUTH_STATE_SALT = "pm.integrations.oauth.state"

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="oauth-user", password="pass123")
        self.tenant = Tenant.objects.create(
            name="OAuth Tenant",
            slug="oauth-tenant",
            contact_email="oauth@example.com",
            created_by=self.user,
        )

    def test_oauth_authorize_requires_auth(self):
        resp = self.client.get("/api/v1/integrations/oauth/authorize/?provider=microsoft")
        self.assertIn(resp.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_oauth_callback_denies_when_user_not_in_tenant(self):
        state = signing.dumps(
            {
                "tenant_id": str(self.tenant.id),
                "user_id": str(self.user.id),
                "provider": "microsoft",
                "nonce": "n",
            },
            salt=self.OAUTH_STATE_SALT,
        )

        session = self.client.session
        session["oauth_state_microsoft"] = state
        session["oauth_tenant_microsoft"] = str(self.tenant.id)
        session["oauth_nonce_microsoft"] = "n"
        session.save()

        with patch("integrations.views.oauth.MicrosoftGraphProvider") as mocked_provider:
            resp = self.client.get(f"/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}")

        self.assertEqual(resp.status_code, 302)
        self.assertIn("error=permission_denied", resp["Location"])
        self.assertFalse(ExternalAuthProvider.objects.filter(tenant=self.tenant, provider_type="microsoft").exists())
        mocked_provider.assert_not_called()

    def test_oauth_callback_rejects_tenant_header_mismatch(self):
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)

        state = signing.dumps(
            {
                "tenant_id": str(self.tenant.id),
                "user_id": str(self.user.id),
                "provider": "microsoft",
                "nonce": "n",
            },
            salt=self.OAUTH_STATE_SALT,
        )

        session = self.client.session
        session["oauth_state_microsoft"] = state
        session["oauth_tenant_microsoft"] = str(self.tenant.id)
        session["oauth_nonce_microsoft"] = "n"
        session.save()

        with patch("integrations.views.oauth.MicrosoftGraphProvider") as mocked_provider:
            resp = self.client.get(
                f"/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}",
                HTTP_X_TENANT_ID="00000000-0000-0000-0000-000000000000",
            )

        self.assertEqual(resp.status_code, 302)
        self.assertIn("error=tenant_mismatch", resp["Location"])
        mocked_provider.assert_not_called()

    def test_oauth_callback_rejects_replayed_state(self):
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)

        state = signing.dumps(
            {
                "tenant_id": str(self.tenant.id),
                "user_id": str(self.user.id),
                "provider": "microsoft",
                "nonce": "n",
            },
            salt=self.OAUTH_STATE_SALT,
        )

        token_response = SimpleNamespace(access_token="access", refresh_token="refresh", expires_in=3600)
        user_info = {"email": "connected@example.com", "name": "Connected User"}
        mocked_instance = SimpleNamespace(
            exchange_code=lambda code, redirect_uri: token_response,
            get_user_info=lambda access_token: user_info,
        )

        session = self.client.session
        session["oauth_state_microsoft"] = state
        session["oauth_tenant_microsoft"] = str(self.tenant.id)
        session["oauth_nonce_microsoft"] = "n"
        session.save()

        with patch("integrations.views.oauth.MicrosoftGraphProvider", return_value=mocked_instance):
            resp1 = self.client.get(f"/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}")

        self.assertEqual(resp1.status_code, 302)
        self.assertIn("success=connected", resp1["Location"])

        # Simulate a second attempt where an attacker replays the same state but the browser/session
        # still presents it (e.g., cookie re-send). Nonce consumption must fail closed.
        session = self.client.session
        session["oauth_state_microsoft"] = state
        session["oauth_tenant_microsoft"] = str(self.tenant.id)
        # Note: oauth_nonce_microsoft is intentionally NOT set. The nonce was already consumed
        # by the first callback and must fail closed on replay.
        session.save()

        with patch("integrations.views.oauth.MicrosoftGraphProvider") as mocked_provider:
            resp2 = self.client.get(f"/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}")

        self.assertEqual(resp2.status_code, 302)
        self.assertIn("error=replayed_state", resp2["Location"])
        mocked_provider.assert_not_called()

    def test_oauth_callback_persists_tokens_for_member(self):
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)

        state = signing.dumps(
            {
                "tenant_id": str(self.tenant.id),
                "user_id": str(self.user.id),
                "provider": "microsoft",
                "nonce": "n",
            },
            salt=self.OAUTH_STATE_SALT,
        )

        session = self.client.session
        session["oauth_state_microsoft"] = state
        session["oauth_tenant_microsoft"] = str(self.tenant.id)
        session["oauth_nonce_microsoft"] = "n"
        session.save()

        token_response = SimpleNamespace(access_token="access", refresh_token="refresh", expires_in=3600)
        user_info = {"email": "connected@example.com", "name": "Connected User"}

        mocked_instance = SimpleNamespace(
            exchange_code=lambda code, redirect_uri: token_response,
            get_user_info=lambda access_token: user_info,
        )

        with patch("integrations.views.oauth.MicrosoftGraphProvider", return_value=mocked_instance):
            resp = self.client.get(f"/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}")

        self.assertEqual(resp.status_code, 302)
        self.assertIn("success=connected", resp["Location"])

        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type="microsoft")
        self.assertTrue(provider.is_active)
        self.assertEqual(provider.connected_email, "connected@example.com")

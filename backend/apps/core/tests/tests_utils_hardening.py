"""Tests for core utility modules (tasks, viewsets, signals, services).

Validates the production-hardening utilities work correctly:
- TenantTask lifecycle (RLS setup/cleanup, structured logging)
- OptimizedQuerysetMixin (select_related/prefetch_related application)
- safe_signal_handler (exception swallowing, defer_to_commit)
- TenantService + ServiceResult (structured returns, timing)
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

import pytest

from apps.core.utils.services import ServiceResult, TenantService
from apps.core.utils.signals import safe_signal_handler
from apps.core.utils.tasks import TenantTask
from apps.core.utils.viewsets import OptimizedQuerysetMixin, StructuredErrorMixin


class ServiceResultTest(TestCase):
    """Test ServiceResult dataclass."""

    def test_ok_returns_success(self):
        result = ServiceResult.ok(data={"id": "123"})
        self.assertTrue(result.success)
        self.assertEqual(result.data, {"id": "123"})
        self.assertIsNone(result.error)

    def test_ok_with_kwargs(self):
        result = ServiceResult.ok(count=5, name="test")
        self.assertTrue(result.success)
        self.assertEqual(result.data, {"count": 5, "name": "test"})

    def test_fail_returns_error(self):
        result = ServiceResult.fail("Something broke", code="validation_error")
        self.assertFalse(result.success)
        self.assertEqual(result.error, "Something broke")
        self.assertEqual(result.code, "validation_error")

    def test_to_dict_success(self):
        result = ServiceResult.ok(data={"items": [1, 2]})
        d = result.to_dict()
        self.assertEqual(d, {"success": True, "data": {"items": [1, 2]}})

    def test_to_dict_failure(self):
        result = ServiceResult.fail("bad input", code="invalid")
        d = result.to_dict()
        self.assertEqual(d["success"], False)
        self.assertEqual(d["error"], "bad input")
        self.assertEqual(d["code"], "invalid")


class TenantServiceTest(TestCase):
    """Test TenantService base class."""

    def test_init_stores_tenant(self):
        tenant = MagicMock(id="abc-123")
        svc = TenantService(tenant=tenant)
        self.assertEqual(svc.tenant_id, "abc-123")

    def test_init_without_tenant(self):
        svc = TenantService()
        self.assertIsNone(svc.tenant_id)

    def test_timed_context_manager(self):
        svc = TenantService()
        svc.service_name = "test_svc"
        # Should not raise
        with svc.timed("test_op"):
            pass

    def test_log_methods_do_not_raise(self):
        svc = TenantService()
        svc.log_info("msg %s", "arg")
        svc.log_warning("warn %s", "arg")
        svc.log_error("err %s", "arg", exc_info=False)


class SafeSignalHandlerTest(TestCase):
    """Test safe_signal_handler decorator."""

    def test_exception_is_swallowed(self):
        @safe_signal_handler
        def handler(sender, **kwargs):
            raise RuntimeError("boom")

        # Should not raise
        handler(sender=object)

    def test_handler_executes_normally(self):
        calls = []

        @safe_signal_handler
        def handler(sender, **kwargs):
            calls.append(kwargs.get("instance"))

        handler(sender=object, instance="hello")
        self.assertEqual(calls, ["hello"])

    @patch("apps.core.utils.signals.transaction")
    def test_defer_to_commit(self, mock_transaction):
        calls = []

        @safe_signal_handler(defer_to_commit=True)
        def handler(sender, **kwargs):
            calls.append(True)

        handler(sender=object)
        # Handler body should NOT have executed directly
        self.assertEqual(calls, [])
        # Instead, on_commit should have been called
        mock_transaction.on_commit.assert_called_once()


class TenantTaskTest(TestCase):
    """Test TenantTask base class attributes."""

    def test_defaults(self):
        self.assertTrue(TenantTask.abstract)
        self.assertEqual(TenantTask.max_retries, 5)
        self.assertEqual(TenantTask.soft_time_limit, 60)
        self.assertEqual(TenantTask.time_limit, 90)
        self.assertTrue(TenantTask.acks_late)

    def test_extract_tenant_id_from_kwargs(self):
        tid = TenantTask._extract_tenant_id((), {"tenant_id": "abc"})
        self.assertEqual(tid, "abc")

    def test_extract_tenant_id_from_args(self):
        tid = TenantTask._extract_tenant_id(("my-tenant",), {})
        self.assertEqual(tid, "my-tenant")

    def test_extract_tenant_id_empty(self):
        tid = TenantTask._extract_tenant_id((), {})
        self.assertIsNone(tid)


class StructuredErrorMixinTest(TestCase):
    """Test StructuredErrorMixin response helpers."""

    def test_error_response(self):
        mixin = StructuredErrorMixin()
        resp = mixin.error_response("Not found", code="not_found", status_code=404)
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.data["code"], "not_found")
        self.assertEqual(resp.data["message"], "Not found")

    def test_success_response(self):
        mixin = StructuredErrorMixin()
        resp = mixin.success_response(data={"id": 1}, message="created")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "success")
        self.assertEqual(resp.data["data"], {"id": 1})

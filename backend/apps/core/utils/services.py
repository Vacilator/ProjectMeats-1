"""Base service utilities for production-grade backend services.

Provides:
- TenantService: Base class for tenant-scoped service logic with
  structured logging, timing, and error normalization.
- ServiceResult: Standardized return type for service methods.
- timed_operation: Context manager for measuring and logging operation duration.

Usage:
    from apps.core.utils.services import TenantService, ServiceResult

    class MyService(TenantService):
        service_name = 'my_service'

        def do_thing(self, item_id: str) -> ServiceResult:
            with self.timed('do_thing'):
                ...
                return ServiceResult.ok(data={'id': item_id})
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Generator

logger = logging.getLogger(__name__)


@dataclass
class ServiceResult:
    """Standardized service method return value."""

    success: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    code: str = "ok"

    @classmethod
    def ok(cls, data: dict[str, Any] | None = None, **kwargs: Any) -> "ServiceResult":
        return cls(success=True, data=data or kwargs)

    @classmethod
    def fail(cls, error: str, code: str = "error", data: dict[str, Any] | None = None) -> "ServiceResult":
        return cls(success=False, error=error, code=code, data=data or {})

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"success": self.success}
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        if self.code != "ok":
            result["code"] = self.code
        return result


class TenantService:
    """Base class for tenant-scoped service logic.

    Provides structured logging and timing utilities. Subclass and set
    `service_name` for consistent log prefixes.

    Example:
        class ProposalService(TenantService):
            service_name = 'proposals'

            def __init__(self, tenant):
                super().__init__(tenant)

            def generate(self) -> ServiceResult:
                with self.timed('generate'):
                    ...
    """

    service_name: str = "service"

    def __init__(self, tenant: Any = None):
        self.tenant = tenant
        self.tenant_id = str(getattr(tenant, "id", "")) if tenant else None
        self._logger = logging.getLogger(f"{__name__}.{self.service_name}")

    @contextmanager
    def timed(self, operation: str) -> Generator[None, None, None]:
        """Context manager that logs operation duration."""
        start = time.monotonic()
        self._logger.debug(
            "[%s:%s] started tenant=%s",
            self.service_name,
            operation,
            self.tenant_id or "N/A",
        )
        try:
            yield
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000
            self._logger.info(
                "[%s:%s] completed tenant=%s elapsed=%.0fms",
                self.service_name,
                operation,
                self.tenant_id or "N/A",
                elapsed_ms,
            )

    def log_info(self, message: str, *args: Any) -> None:
        self._logger.info(f"[{self.service_name}] {message}", *args)

    def log_warning(self, message: str, *args: Any) -> None:
        self._logger.warning(f"[{self.service_name}] {message}", *args)

    def log_error(self, message: str, *args: Any, exc_info: bool = False) -> None:
        self._logger.error(f"[{self.service_name}] {message}", *args, exc_info=exc_info)

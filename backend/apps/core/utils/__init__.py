"""Core shared utilities."""

# Scaling & observability (Phase 10)
from .caching import TenantCacheMixin, cached_queryset, invalidate_tenant_cache, tenant_cache_key  # noqa: F401
from .circuit_breaker import CircuitBreaker, CircuitOpenError, circuit_breaker  # noqa: F401
from .correlation import (  # noqa: F401
    CorrelationIdFilter,
    CorrelationIdMiddleware,
    clear_correlation_id,
    extract_correlation_from_task,
    get_correlation_id,
    propagate_correlation_to_task_headers,
    set_correlation_id,
)
from .logging import capture_exception, sentry_scope  # noqa: F401
from .metrics import metrics  # noqa: F401
from .services import ServiceResult, TenantService  # noqa: F401
from .signals import safe_signal_handler  # noqa: F401
from .tasks import TenantTask, tenant_task  # noqa: F401
from .unsupervised import ExecutionDecision, UnsupervisedPolicy, execution_guard  # noqa: F401
from .viewsets import OptimizedQuerysetMixin, QueryPerformanceLoggingMixin, StructuredErrorMixin  # noqa: F401

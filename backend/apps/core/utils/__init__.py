"""Core shared utilities."""

from .logging import capture_exception, sentry_scope  # noqa: F401
from .services import ServiceResult, TenantService  # noqa: F401
from .signals import safe_signal_handler  # noqa: F401
from .tasks import TenantTask, tenant_task  # noqa: F401
from .viewsets import (  # noqa: F401
    OptimizedQuerysetMixin,
    QueryPerformanceLoggingMixin,
    StructuredErrorMixin,
)

# Scaling & observability (Phase 10)
from .caching import (  # noqa: F401
    TenantCacheMixin,
    cached_queryset,
    invalidate_tenant_cache,
    tenant_cache_key,
)
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
from .metrics import metrics  # noqa: F401
from .unsupervised import (  # noqa: F401
    ExecutionDecision,
    UnsupervisedPolicy,
    execution_guard,
)

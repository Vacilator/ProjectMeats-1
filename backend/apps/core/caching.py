"""
Caching & Parallelization Service (Phase 8)

Redis-based caching with parallel task execution.
"""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Dict, List

from django.core.cache import cache


class CacheService:
    """
    Advanced caching strategies with Redis.

    Phase 8.1: Query Result Caching
    Phase 8.3: Edge Caching Strategies
    """

    DEFAULT_TTL = 300  # 5 minutes
    QUERY_CACHE_TTL = 600  # 10 minutes
    STATIC_CACHE_TTL = 3600  # 1 hour

    @staticmethod
    def cache_query_result(cache_key: str, query_func: Callable, ttl: int = QUERY_CACHE_TTL) -> Any:
        """
        Cache expensive query results.

        Args:
            cache_key: Unique cache key
            query_func: Function that executes query
            ttl: Time-to-live in seconds

        Returns:
            Query result (cached or fresh)
        """
        # Try cache first
        cached = cache.get(cache_key)
        if cached is not None:
            return json.loads(cached)

        # Execute query
        result = query_func()

        # Cache result
        cache.set(cache_key, json.dumps(result, default=str), ttl)

        return result

    @staticmethod
    def generate_cache_key(*args, **kwargs) -> str:
        """
        Generate deterministic cache key from arguments.

        Example:
            key = CacheService.generate_cache_key(
                'products', tenant_id='123', filter='beef'
            )
            # Returns: "products:md5hash"
        """
        key_parts = [str(arg) for arg in args]
        key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
        key_str = ":".join(key_parts)

        # Hash for consistent length
        hash_suffix = hashlib.md5(key_str.encode()).hexdigest()[:8]

        return f"{args[0] if args else 'cache'}:{hash_suffix}"

    @staticmethod
    def invalidate_pattern(pattern: str) -> int:
        """
        Invalidate all keys matching pattern.

        Args:
            pattern: Cache key pattern (e.g., "products:*")

        Returns:
            Number of keys deleted
        """
        # Note: Requires Redis SCAN, not available via Django cache API
        # For production, use django-redis backend
        return 0


class ParallelExecutor:
    """
    Parallel task execution service.

    Phase 8.4: Parallel Task Execution
    """

    MAX_WORKERS = 10

    @staticmethod
    def execute_parallel(tasks: List[Callable], max_workers: int = MAX_WORKERS) -> List[Any]:
        """
        Execute multiple tasks in parallel.

        Args:
            tasks: List of callables to execute
            max_workers: Max parallel threads

        Returns:
            List of results in order of task completion

        Example:
            tasks = [
                lambda: fetch_products(),
                lambda: fetch_suppliers(),
                lambda: fetch_customers()
            ]
            results = ParallelExecutor.execute_parallel(tasks)
        """
        results = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(task): i for i, task in enumerate(tasks)}

            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    results.append({"error": str(e)})

        return results

    @staticmethod
    def execute_parallel_with_cache(
        tasks: List[tuple], max_workers: int = MAX_WORKERS  # (cache_key, callable)
    ) -> Dict[str, Any]:
        """
        Execute tasks in parallel with caching.

        Args:
            tasks: List of (cache_key, callable) tuples
            max_workers: Max parallel threads

        Returns:
            Dict mapping cache_key to result
        """
        results = {}
        uncached_tasks = []

        # Check cache for each task
        for cache_key, task in tasks:
            cached = cache.get(cache_key)
            if cached is not None:
                results[cache_key] = json.loads(cached)
            else:
                uncached_tasks.append((cache_key, task))

        # Execute uncached tasks in parallel
        if uncached_tasks:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(task): cache_key for cache_key, task in uncached_tasks}

                for future in as_completed(futures):
                    cache_key = futures[future]
                    try:
                        result = future.result()
                        results[cache_key] = result

                        # Cache result
                        cache.set(cache_key, json.dumps(result, default=str), CacheService.QUERY_CACHE_TTL)
                    except Exception as e:
                        results[cache_key] = {"error": str(e)}

        return results

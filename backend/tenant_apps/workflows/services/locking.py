from __future__ import annotations

"""
Workflow Node Locking Service (Phase 7.3: Real-Time Collaboration)

Uses atomic Redis primitives in non-dev runtimes to prevent concurrent multi-node
lock corruption while preserving an explicit local fallback for dev/test.
"""

import json
import threading
import time
from copy import deepcopy
from functools import lru_cache
from typing import Any

from django.conf import settings

from redis import Redis
from redis.exceptions import RedisError

_LOCAL_LOCKS: dict[str, threading.Lock] = {}
_LOCAL_LOCKS_GUARD = threading.Lock()
_LOCAL_LOCK_STATE: dict[str, dict[str, Any]] = {}


class WorkflowLockManager:
    """
    Distributed locking for workflow nodes.

    Features:
    - 60-second TTL with auto-renewal via heartbeat
    - Lock ownership tracking (user_id)
    - Graceful owner-only lock release
    """

    LOCK_TTL = 60  # seconds

    _REDIS_ACQUIRE_SCRIPT = """
    if redis.call("EXISTS", KEYS[1]) == 0 then
      redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[3])
      redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
      return 1
    end
    return 0
    """

    _REDIS_RENEW_SCRIPT = """
    if redis.call("GET", KEYS[1]) ~= ARGV[1] then
      return 0
    end
    redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[3])
    redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
    return 1
    """

    _REDIS_RELEASE_SCRIPT = """
    if redis.call("GET", KEYS[1]) ~= ARGV[1] then
      return 0
    end
    redis.call("DEL", KEYS[1], KEYS[2])
    return 1
    """

    @staticmethod
    def _lock_key(tenant_id: str, workflow_id: str, node_id: str) -> str:
        return f"workflow_lock:{tenant_id}:{workflow_id}:{node_id}"

    @staticmethod
    def _owner_key(lock_key: str) -> str:
        return f"{lock_key}:owner"

    @staticmethod
    def _data_key(lock_key: str) -> str:
        return f"{lock_key}:data"

    @staticmethod
    def _serialize_lock_data(lock_data: dict[str, Any]) -> str:
        return json.dumps(lock_data, sort_keys=True)

    @staticmethod
    def _deserialize_lock_data(value: Any) -> dict[str, Any] | None:
        if value is None:
            return None

        if isinstance(value, bytes):
            value = value.decode("utf-8")

        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                return None

        return value if isinstance(value, dict) else None

    @staticmethod
    def _build_lock_data(
        workflow_id: str,
        node_id: str,
        user_id: str,
        user_name: str | None = None,
        *,
        acquired_at: float | None = None,
    ) -> dict[str, Any]:
        current_time = time.time()
        return {
            "user_id": user_id,
            "user_name": user_name or "User",
            "workflow_id": workflow_id,
            "node_id": node_id,
            "acquired_at": acquired_at if acquired_at is not None else current_time,
            "expires_at": current_time + WorkflowLockManager.LOCK_TTL,
        }

    @staticmethod
    def _success_response(user_id: str, lock_data: dict[str, Any]) -> dict[str, Any]:
        return {
            "locked": True,
            "owner": user_id,
            "expires_at": lock_data["expires_at"],
        }

    @staticmethod
    def _conflict_response(
        existing_lock: dict[str, Any] | None,
        *,
        retryable: bool = False,
    ) -> dict[str, Any]:
        response: dict[str, Any] = {
            "locked": False,
            "owner": (existing_lock or {}).get("user_id"),
            "owner_name": (existing_lock or {}).get("user_name", "Another user"),
            "expires_at": (existing_lock or {}).get("expires_at"),
        }
        if retryable:
            response["retryable"] = True
        return response

    @staticmethod
    def _local_mutex(lock_key: str) -> threading.Lock:
        owner_key = WorkflowLockManager._owner_key(lock_key)
        with _LOCAL_LOCKS_GUARD:
            return _LOCAL_LOCKS.setdefault(owner_key, threading.Lock())

    @staticmethod
    @lru_cache(maxsize=4)
    def _redis_client_for_url(redis_url: str) -> Redis:
        return Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )

    @classmethod
    def _get_redis_client(cls) -> Redis | None:
        redis_url = getattr(settings, "REDIS_BACKEND_URL", None)
        if not redis_url:
            return None
        return cls._redis_client_for_url(redis_url)

    @classmethod
    def _read_lock_data(cls, lock_key: str) -> dict[str, Any] | None:
        owner_key = cls._owner_key(lock_key)
        data_key = cls._data_key(lock_key)
        redis_client = cls._get_redis_client()

        if redis_client is not None:
            try:
                lock_data = cls._deserialize_lock_data(redis_client.get(data_key))
                if lock_data is not None:
                    return lock_data

                owner = redis_client.get(owner_key)
                if owner:
                    return {"user_id": owner}
                return None
            except RedisError:
                return None

        with cls._local_mutex(lock_key):
            lock_data = _LOCAL_LOCK_STATE.get(lock_key)
            return deepcopy(lock_data) if lock_data is not None else None

    @classmethod
    def _try_acquire_atomic(
        cls,
        lock_key: str,
        user_id: str,
        lock_data: dict[str, Any],
    ) -> bool | None:
        owner_key = cls._owner_key(lock_key)
        data_key = cls._data_key(lock_key)
        redis_client = cls._get_redis_client()

        if redis_client is not None:
            try:
                return bool(
                    redis_client.eval(
                        cls._REDIS_ACQUIRE_SCRIPT,
                        2,
                        owner_key,
                        data_key,
                        user_id,
                        cls._serialize_lock_data(lock_data),
                        cls.LOCK_TTL,
                    )
                )
            except RedisError:
                return None

        with cls._local_mutex(lock_key):
            if lock_key not in _LOCAL_LOCK_STATE:
                _LOCAL_LOCK_STATE[lock_key] = deepcopy(lock_data)
                return True
            return False

    @classmethod
    def _renew_if_owned(
        cls,
        lock_key: str,
        user_id: str,
        lock_data: dict[str, Any],
    ) -> bool | None:
        owner_key = cls._owner_key(lock_key)
        data_key = cls._data_key(lock_key)
        redis_client = cls._get_redis_client()

        if redis_client is not None:
            try:
                return bool(
                    redis_client.eval(
                        cls._REDIS_RENEW_SCRIPT,
                        2,
                        owner_key,
                        data_key,
                        user_id,
                        cls._serialize_lock_data(lock_data),
                        cls.LOCK_TTL,
                    )
                )
            except RedisError:
                return None

        with cls._local_mutex(lock_key):
            existing_lock = _LOCAL_LOCK_STATE.get(lock_key)
            if not existing_lock or existing_lock.get("user_id") != user_id:
                return False
            _LOCAL_LOCK_STATE[lock_key] = deepcopy(lock_data)
            return True

    @classmethod
    def _release_if_owned(cls, lock_key: str, user_id: str) -> bool | None:
        owner_key = cls._owner_key(lock_key)
        data_key = cls._data_key(lock_key)
        redis_client = cls._get_redis_client()

        if redis_client is not None:
            try:
                return bool(
                    redis_client.eval(
                        cls._REDIS_RELEASE_SCRIPT,
                        2,
                        owner_key,
                        data_key,
                        user_id,
                    )
                )
            except RedisError:
                return None

        with cls._local_mutex(lock_key):
            existing_lock = _LOCAL_LOCK_STATE.get(lock_key)
            if existing_lock is None:
                return True
            if existing_lock.get("user_id") != user_id:
                return False
            _LOCAL_LOCK_STATE.pop(lock_key, None)
            return True

    @classmethod
    def acquire_node_lock(
        cls,
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str,
        user_name: str | None = None,
    ) -> dict[str, Any]:
        """
        Acquire lock on a workflow node.

        Returns:
            {
                'locked': True/False,
                'owner': user_id if locked by this user,
                'owner_name': 'John Doe' if locked by another user,
                'expires_at': timestamp
            }
        """
        lock_key = cls._lock_key(tenant_id, workflow_id, node_id)
        lock_data = cls._build_lock_data(
            workflow_id=workflow_id,
            node_id=node_id,
            user_id=user_id,
            user_name=user_name,
        )

        acquired = cls._try_acquire_atomic(lock_key, user_id, lock_data)
        if acquired is True:
            return cls._success_response(user_id, lock_data)

        existing_lock = cls._read_lock_data(lock_key)
        if acquired is None:
            return cls._conflict_response(existing_lock, retryable=True)

        if existing_lock and existing_lock.get("user_id") == user_id:
            renewed_lock = cls._build_lock_data(
                workflow_id=workflow_id,
                node_id=node_id,
                user_id=user_id,
                user_name=existing_lock.get("user_name") or user_name,
                acquired_at=existing_lock.get("acquired_at"),
            )
            renewed = cls._renew_if_owned(lock_key, user_id, renewed_lock)
            if renewed is True:
                return cls._success_response(user_id, renewed_lock)
            if renewed is None:
                return cls._conflict_response(existing_lock, retryable=True)

            existing_lock = cls._read_lock_data(lock_key)

        if existing_lock is None:
            retried = cls._try_acquire_atomic(lock_key, user_id, lock_data)
            if retried is True:
                return cls._success_response(user_id, lock_data)
            if retried is None:
                return cls._conflict_response(None, retryable=True)
            existing_lock = cls._read_lock_data(lock_key)

        return cls._conflict_response(existing_lock)

    @classmethod
    def release_node_lock(
        cls,
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str,
    ) -> bool:
        """
        Release lock on a workflow node.

        Returns:
            True if lock was released, False if not owned by user
        """
        lock_key = cls._lock_key(tenant_id, workflow_id, node_id)
        released = cls._release_if_owned(lock_key, user_id)
        return bool(released)

    @classmethod
    def renew_lock(
        cls,
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str,
    ) -> bool:
        """
        Renew lock TTL (called by heartbeat).

        Returns:
            True if renewed, False if not owned
        """
        lock_key = cls._lock_key(tenant_id, workflow_id, node_id)
        existing_lock = cls._read_lock_data(lock_key)
        if not existing_lock or existing_lock.get("user_id") != user_id:
            return False

        renewed_lock = cls._build_lock_data(
            workflow_id=workflow_id,
            node_id=node_id,
            user_id=user_id,
            user_name=existing_lock.get("user_name"),
            acquired_at=existing_lock.get("acquired_at"),
        )
        renewed = cls._renew_if_owned(lock_key, user_id, renewed_lock)
        return bool(renewed)

    @staticmethod
    def get_workflow_locks(tenant_id: str, workflow_id: str) -> list:
        """
        Get all active locks for a workflow.

        Returns:
            List of locked node IDs with owner info
        """
        # Note: This requires Redis SCAN which isn't directly available here.
        # For production, consider storing a workflow-level lock index.
        return []

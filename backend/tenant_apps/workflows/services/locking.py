"""
Workflow Node Locking Service (Phase 7.3: Real-Time Collaboration)

Distributed locking using cache-backed atomic primitives to prevent concurrent edits.
"""
import time

from django.core.cache import cache


class WorkflowLockManager:
    """
    Redis-based distributed locking for workflow nodes.
    
    Features:
    - 60-second TTL with auto-renewal via heartbeat
    - Lock ownership tracking (user_id)
    - Graceful lock release
    """
    
    LOCK_TTL = 60  # seconds
    OPERATION_GUARD_TTL = 5  # seconds
    OPERATION_GUARD_RETRIES = 5
    OPERATION_GUARD_RETRY_DELAY_SECONDS = 0.01

    @staticmethod
    def _lock_key(tenant_id: str, workflow_id: str, node_id: str) -> str:
        return f"workflow_lock:{tenant_id}:{workflow_id}:{node_id}"

    @staticmethod
    def _guard_key(lock_key: str) -> str:
        return f"{lock_key}:guard"

    @staticmethod
    def _acquire_guard(lock_key: str) -> bool:
        guard_key = WorkflowLockManager._guard_key(lock_key)
        for _ in range(WorkflowLockManager.OPERATION_GUARD_RETRIES):
            if cache.add(guard_key, "1", WorkflowLockManager.OPERATION_GUARD_TTL):
                return True
            time.sleep(WorkflowLockManager.OPERATION_GUARD_RETRY_DELAY_SECONDS)
        return False

    @staticmethod
    def _release_guard(lock_key: str) -> None:
        cache.delete(WorkflowLockManager._guard_key(lock_key))

    @staticmethod
    def _build_lock_data(
        workflow_id: str,
        node_id: str,
        user_id: str,
        user_name: str | None = None,
        *,
        acquired_at: float | None = None,
    ) -> dict:
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
    def _success_response(user_id: str, lock_data: dict) -> dict:
        return {
            "locked": True,
            "owner": user_id,
            "expires_at": lock_data["expires_at"],
        }
    
    @staticmethod
    def acquire_node_lock(
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str,
        user_name: str | None = None,
    ) -> dict:
        """
        Acquire lock on a workflow node.
        
        Args:
            tenant_id: UUID of tenant
            workflow_id: UUID of workflow
            node_id: ID of node to lock
            user_id: ID of user requesting lock
            
        Returns:
            {
                'locked': True/False,
                'owner': user_id if locked by this user,
                'owner_name': 'John Doe' if locked by another user,
                'expires_at': timestamp
            }
        """
        lock_key = WorkflowLockManager._lock_key(tenant_id, workflow_id, node_id)
        lock_data = WorkflowLockManager._build_lock_data(
            workflow_id=workflow_id,
            node_id=node_id,
            user_id=user_id,
            user_name=user_name,
        )

        if not WorkflowLockManager._acquire_guard(lock_key):
            existing_lock = cache.get(lock_key)
            return {
                "locked": False,
                "owner": (existing_lock or {}).get("user_id"),
                "owner_name": (existing_lock or {}).get("user_name", "Another user"),
                "expires_at": (existing_lock or {}).get("expires_at"),
                "retryable": True,
            }

        try:
            if cache.add(lock_key, lock_data, WorkflowLockManager.LOCK_TTL):
                return WorkflowLockManager._success_response(user_id, lock_data)

            existing_lock = cache.get(lock_key)
            if not existing_lock and cache.add(lock_key, lock_data, WorkflowLockManager.LOCK_TTL):
                return WorkflowLockManager._success_response(user_id, lock_data)

            if existing_lock and existing_lock["user_id"] == user_id:
                if cache.touch(lock_key, WorkflowLockManager.LOCK_TTL):
                    renewed_lock = WorkflowLockManager._build_lock_data(
                        workflow_id=workflow_id,
                        node_id=node_id,
                        user_id=user_id,
                        user_name=existing_lock.get("user_name") or user_name,
                        acquired_at=existing_lock.get("acquired_at"),
                    )
                    cache.set(lock_key, renewed_lock, WorkflowLockManager.LOCK_TTL)
                    return WorkflowLockManager._success_response(user_id, renewed_lock)

                if cache.add(lock_key, lock_data, WorkflowLockManager.LOCK_TTL):
                    return WorkflowLockManager._success_response(user_id, lock_data)

            return {
                "locked": False,
                "owner": existing_lock["user_id"] if existing_lock else None,
                "owner_name": (existing_lock or {}).get("user_name", "Another user"),
                "expires_at": (existing_lock or {}).get("expires_at"),
            }
        finally:
            WorkflowLockManager._release_guard(lock_key)
    
    @staticmethod
    def release_node_lock(
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str
    ) -> bool:
        """
        Release lock on a workflow node.
        
        Args:
            tenant_id: UUID of tenant
            workflow_id: UUID of workflow
            node_id: ID of node to unlock
            user_id: ID of user releasing lock
            
        Returns:
            True if lock was released, False if not owned by user
        """
        lock_key = WorkflowLockManager._lock_key(tenant_id, workflow_id, node_id)
        
        if not WorkflowLockManager._acquire_guard(lock_key):
            return False

        try:
            existing_lock = cache.get(lock_key)
            if not existing_lock:
                return True  # No lock exists
            
            if existing_lock['user_id'] != user_id:
                return False  # Not the owner
            
            cache.delete(lock_key)
            return True
        finally:
            WorkflowLockManager._release_guard(lock_key)
    
    @staticmethod
    def renew_lock(
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str
    ) -> bool:
        """
        Renew lock TTL (called by heartbeat).
        
        Args:
            tenant_id, workflow_id, node_id, user_id: Lock identifiers
            
        Returns:
            True if renewed, False if not owned
        """
        lock_key = WorkflowLockManager._lock_key(tenant_id, workflow_id, node_id)
        
        if not WorkflowLockManager._acquire_guard(lock_key):
            return False

        try:
            existing_lock = cache.get(lock_key)
            if not existing_lock or existing_lock['user_id'] != user_id:
                return False
            
            if not cache.touch(lock_key, WorkflowLockManager.LOCK_TTL):
                return False

            renewed_lock = WorkflowLockManager._build_lock_data(
                workflow_id=workflow_id,
                node_id=node_id,
                user_id=user_id,
                user_name=existing_lock.get("user_name"),
                acquired_at=existing_lock.get("acquired_at"),
            )
            cache.set(lock_key, renewed_lock, WorkflowLockManager.LOCK_TTL)
            return True
        finally:
            WorkflowLockManager._release_guard(lock_key)
    
    @staticmethod
    def get_workflow_locks(tenant_id: str, workflow_id: str) -> list:
        """
        Get all active locks for a workflow.
        
        Returns:
            List of locked node IDs with owner info
        """
        # Note: This requires Redis SCAN which isn't directly available via Django cache
        # For production, consider storing workflow-level lock index
        return []

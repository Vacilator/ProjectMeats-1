"""
Workflow Node Locking Service (Phase 7.3: Real-Time Collaboration)

Distributed locking using Redis to prevent concurrent edits.
"""
from django.core.cache import cache
import time


class WorkflowLockManager:
    """
    Redis-based distributed locking for workflow nodes.
    
    Features:
    - 60-second TTL with auto-renewal via heartbeat
    - Lock ownership tracking (user_id)
    - Graceful lock release
    """
    
    LOCK_TTL = 60  # seconds
    
    @staticmethod
    def acquire_node_lock(
        tenant_id: str,
        workflow_id: str,
        node_id: str,
        user_id: str
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
        lock_key = f"workflow_lock:{tenant_id}:{workflow_id}:{node_id}"
        
        # Check existing lock
        existing_lock = cache.get(lock_key)
        if existing_lock:
            if existing_lock['user_id'] == user_id:
                # Renew own lock
                cache.set(lock_key, existing_lock, WorkflowLockManager.LOCK_TTL)
                return {
                    'locked': True,
                    'owner': user_id,
                    'expires_at': time.time() + WorkflowLockManager.LOCK_TTL
                }
            else:
                # Locked by someone else
                return {
                    'locked': False,
                    'owner': existing_lock['user_id'],
                    'owner_name': existing_lock.get('user_name', 'Another user'),
                    'expires_at': existing_lock['expires_at']
                }
        
        # Acquire new lock
        lock_data = {
            'user_id': user_id,
            'user_name': 'User',  # TODO: Lookup from User model
            'workflow_id': workflow_id,
            'node_id': node_id,
            'acquired_at': time.time(),
            'expires_at': time.time() + WorkflowLockManager.LOCK_TTL
        }
        
        cache.set(lock_key, lock_data, WorkflowLockManager.LOCK_TTL)
        
        return {
            'locked': True,
            'owner': user_id,
            'expires_at': lock_data['expires_at']
        }
    
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
        lock_key = f"workflow_lock:{tenant_id}:{workflow_id}:{node_id}"
        
        existing_lock = cache.get(lock_key)
        if not existing_lock:
            return True  # No lock exists
        
        if existing_lock['user_id'] != user_id:
            return False  # Not the owner
        
        cache.delete(lock_key)
        return True
    
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
        lock_key = f"workflow_lock:{tenant_id}:{workflow_id}:{node_id}"
        
        existing_lock = cache.get(lock_key)
        if not existing_lock or existing_lock['user_id'] != user_id:
            return False
        
        existing_lock['expires_at'] = time.time() + WorkflowLockManager.LOCK_TTL
        cache.set(lock_key, existing_lock, WorkflowLockManager.LOCK_TTL)
        return True
    
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

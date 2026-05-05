from __future__ import annotations

import copy
import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.test import SimpleTestCase

from tenant_apps.workflows.services import locking
from tenant_apps.workflows.services.locking import WorkflowLockManager


class _AtomicRedisFake:
    def __init__(self):
        self._store: dict[str, str] = {}
        self._lock = threading.Lock()

    def eval(self, script: str, numkeys: int, *args):
        assert numkeys == 2
        with self._lock:
            if script == WorkflowLockManager._REDIS_ACQUIRE_SCRIPT:
                owner_key, data_key, owner, payload, _ttl = args
                if owner_key in self._store:
                    return 0
                self._store[owner_key] = owner
                self._store[data_key] = payload
                return 1

            if script == WorkflowLockManager._REDIS_RENEW_SCRIPT:
                owner_key, data_key, owner, payload, _ttl = args
                if self._store.get(owner_key) != owner:
                    return 0
                self._store[owner_key] = owner
                self._store[data_key] = payload
                return 1

            if script == WorkflowLockManager._REDIS_RELEASE_SCRIPT:
                owner_key, data_key, owner = args
                if self._store.get(owner_key) != owner:
                    return 0
                self._store.pop(owner_key, None)
                self._store.pop(data_key, None)
                return 1

            raise AssertionError("Unexpected Redis script")

    def get(self, key: str):
        with self._lock:
            value = self._store.get(key)
            return copy.deepcopy(value) if value is not None else None


class WorkflowLockManagerTests(SimpleTestCase):
    tenant_id = "tenant-1"
    workflow_id = "workflow-1"
    node_id = "node-1"

    def setUp(self):
        super().setUp()
        locking._LOCAL_LOCK_STATE.clear()
        locking._LOCAL_LOCKS.clear()

    def test_redis_contenders_for_same_node_have_single_winner(self):
        fake_redis = _AtomicRedisFake()
        start_barrier = threading.Barrier(2)

        def contender(user_id: str, user_name: str) -> dict:
            start_barrier.wait()
            return WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id=user_id,
                user_name=user_name,
            )

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=fake_redis), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            with ThreadPoolExecutor(max_workers=2) as executor:
                first_future = executor.submit(contender, "user-a", "User A")
                second_future = executor.submit(contender, "user-b", "User B")
                results = [first_future.result(), second_future.result()]

        winners = [result for result in results if result["locked"]]
        losers = [result for result in results if not result["locked"]]

        self.assertEqual(len(winners), 1)
        self.assertEqual(len(losers), 1)
        self.assertEqual(losers[0]["owner"], winners[0]["owner"])
        self.assertIn(losers[0]["owner_name"], {"User A", "User B"})

    def test_same_user_reacquire_refreshes_ttl_without_changing_owner(self):
        fake_redis = _AtomicRedisFake()

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=fake_redis), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=fake_redis), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=150.0
        ):
            renewed = WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        self.assertTrue(renewed["locked"])
        self.assertEqual(renewed["owner"], "user-a")
        self.assertEqual(renewed["expires_at"], 210.0)

    def test_acquire_retries_once_when_owner_write_loses_race_but_lock_is_missing(self):
        with patch(
            "tenant_apps.workflows.services.locking.WorkflowLockManager._try_acquire_atomic",
            side_effect=[False, True],
        ), patch(
            "tenant_apps.workflows.services.locking.WorkflowLockManager._read_lock_data",
            return_value=None,
        ), patch("tenant_apps.workflows.services.locking.time.time", return_value=100.0):
            acquired = WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        self.assertTrue(acquired["locked"])
        self.assertEqual(acquired["owner"], "user-a")

    def test_lock_backend_unavailable_returns_retryable_response(self):
        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._try_acquire_atomic", return_value=None), patch(
            "tenant_apps.workflows.services.locking.WorkflowLockManager._read_lock_data",
            return_value={"user_id": "user-a", "user_name": "User A", "expires_at": 160.0},
        ):
            result = WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-b",
                user_name="User B",
            )

        self.assertFalse(result["locked"])
        self.assertEqual(result["owner"], "user-a")
        self.assertTrue(result["retryable"])

    def test_tenant_scoping_prevents_collisions_for_same_workflow_and_node_ids(self):
        fake_redis = _AtomicRedisFake()

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=fake_redis), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            tenant_a_result = WorkflowLockManager.acquire_node_lock(
                tenant_id="tenant-a",
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )
            tenant_b_result = WorkflowLockManager.acquire_node_lock(
                tenant_id="tenant-b",
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-b",
                user_name="User B",
            )

        self.assertTrue(tenant_a_result["locked"])
        self.assertTrue(tenant_b_result["locked"])
        self.assertNotEqual(tenant_a_result["owner"], tenant_b_result["owner"])

    def test_non_owner_cannot_release_or_renew_lock(self):
        fake_redis = _AtomicRedisFake()

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=fake_redis), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=fake_redis), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=120.0
        ):
            self.assertFalse(
                WorkflowLockManager.release_node_lock(
                    tenant_id=self.tenant_id,
                    workflow_id=self.workflow_id,
                    node_id=self.node_id,
                    user_id="user-b",
                )
            )
            self.assertFalse(
                WorkflowLockManager.renew_lock(
                    tenant_id=self.tenant_id,
                    workflow_id=self.workflow_id,
                    node_id=self.node_id,
                    user_id="user-b",
                )
            )

    def test_owner_can_release_and_renew_lock(self):
        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=None), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        with patch("tenant_apps.workflows.services.locking.WorkflowLockManager._get_redis_client", return_value=None), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=120.0
        ):
            self.assertTrue(
                WorkflowLockManager.renew_lock(
                    tenant_id=self.tenant_id,
                    workflow_id=self.workflow_id,
                    node_id=self.node_id,
                    user_id="user-a",
                )
            )
            self.assertTrue(
                WorkflowLockManager.release_node_lock(
                    tenant_id=self.tenant_id,
                    workflow_id=self.workflow_id,
                    node_id=self.node_id,
                    user_id="user-a",
                )
            )

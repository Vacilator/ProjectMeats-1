from __future__ import annotations

import copy
import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.test import SimpleTestCase

from tenant_apps.workflows.services.locking import WorkflowLockManager


class _AtomicCacheFake:
    def __init__(self, forced_add_results: dict[str, list[bool]] | None = None):
        self._store: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._forced_add_results = {key: list(values) for key, values in (forced_add_results or {}).items()}
        self.touch_calls = 0
        self.set_calls = 0

    def add(self, key: str, value: dict, timeout: int) -> bool:
        with self._lock:
            forced_results = self._forced_add_results.get(key)
            if forced_results:
                forced_result = forced_results.pop(0)
                if forced_result:
                    self._store[key] = copy.deepcopy(value)
                return forced_result

            if key in self._store:
                return False

            self._store[key] = copy.deepcopy(value)
            return True

    def get(self, key: str):
        with self._lock:
            value = self._store.get(key)
            return copy.deepcopy(value) if value is not None else None

    def set(self, key: str, value: dict, timeout: int) -> None:
        with self._lock:
            self.set_calls += 1
            self._store[key] = copy.deepcopy(value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def touch(self, key: str, timeout: int) -> bool:
        with self._lock:
            self.touch_calls += 1
            return key in self._store


class WorkflowLockManagerTests(SimpleTestCase):
    tenant_id = "tenant-1"
    workflow_id = "workflow-1"
    node_id = "node-1"

    def test_two_contenders_for_same_node_have_single_winner(self):
        fake_cache = _AtomicCacheFake()
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

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
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
        fake_cache = _AtomicCacheFake()

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
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
        self.assertEqual(fake_cache.touch_calls, 1)
        self.assertEqual(fake_cache.set_calls, 1)

    def test_acquire_retries_once_when_add_reports_contention_but_lock_is_missing(self):
        lock_key = WorkflowLockManager._lock_key(self.tenant_id, self.workflow_id, self.node_id)
        fake_cache = _AtomicCacheFake(forced_add_results={lock_key: [False, True]})

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            acquired = WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        self.assertTrue(acquired["locked"])
        self.assertEqual(acquired["owner"], "user-a")

    def test_guard_contention_returns_retryable_response_without_claiming_renewal(self):
        fake_cache = _AtomicCacheFake()
        lock_key = WorkflowLockManager._lock_key(self.tenant_id, self.workflow_id, self.node_id)
        fake_cache._store[lock_key] = {
            "user_id": "user-a",
            "user_name": "User A",
            "workflow_id": self.workflow_id,
            "node_id": self.node_id,
            "acquired_at": 100.0,
            "expires_at": 160.0,
        }
        fake_cache._store[WorkflowLockManager._guard_key(lock_key)] = "1"

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=150.0
        ), patch("tenant_apps.workflows.services.locking.WorkflowLockManager.OPERATION_GUARD_RETRY_DELAY_SECONDS", 0), patch(
            "tenant_apps.workflows.services.locking.WorkflowLockManager.OPERATION_GUARD_RETRIES", 1
        ):
            result = WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        self.assertFalse(result["locked"])
        self.assertEqual(result["owner"], "user-a")
        self.assertTrue(result["retryable"])

    def test_tenant_scoping_prevents_collisions_for_same_workflow_and_node_ids(self):
        fake_cache = _AtomicCacheFake()

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
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
        fake_cache = _AtomicCacheFake()

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
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
        fake_cache = _AtomicCacheFake()

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
            "tenant_apps.workflows.services.locking.time.time", return_value=100.0
        ):
            WorkflowLockManager.acquire_node_lock(
                tenant_id=self.tenant_id,
                workflow_id=self.workflow_id,
                node_id=self.node_id,
                user_id="user-a",
                user_name="User A",
            )

        with patch("tenant_apps.workflows.services.locking.cache", new=fake_cache), patch(
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
            self.assertEqual(fake_cache.touch_calls, 1)
            self.assertEqual(fake_cache.set_calls, 1)
            self.assertTrue(
                WorkflowLockManager.release_node_lock(
                    tenant_id=self.tenant_id,
                    workflow_id=self.workflow_id,
                    node_id=self.node_id,
                    user_id="user-a",
                )
            )

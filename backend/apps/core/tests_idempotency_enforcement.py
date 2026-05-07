"""Tests for idempotency enforcement (CTE-07.2).

Covers: enforce_idempotency programmatic API, duplicate detection,
race condition handling, operation key generation, and error recovery.
"""

import uuid
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.utils import timezone

from apps.core.models import IdempotencyKey
from apps.core.services.idempotency_enforcement import (
    enforce_idempotency,
    generate_operation_key,
    _serialize_result,
)
from apps.tenants.models import Tenant


class EnforceIdempotencyTests(TestCase):
    """Tests for the enforce_idempotency function."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Idempotency Test",
            slug="idem-test",
            schema_name="idem_test",
        )

    def test_first_call_creates_and_returns_created(self):
        """First call with a new key should invoke creator_fn and return 'created'."""
        result = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:create_po:email_123",
            creator_fn=lambda: {"id": "42", "status": "draft"},
        )
        self.assertEqual(result["status"], "created")
        self.assertEqual(result["result"]["id"], "42")

    def test_duplicate_call_returns_cached(self):
        """Second call with same key should return 'duplicate' without calling creator_fn."""
        call_count = {"n": 0}

        def creator():
            call_count["n"] += 1
            return {"id": "99"}

        # First call
        result1 = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:dup_check",
            creator_fn=creator,
        )
        self.assertEqual(result1["status"], "created")
        self.assertEqual(call_count["n"], 1)

        # Second call — same key
        result2 = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:dup_check",
            creator_fn=creator,
        )
        self.assertEqual(result2["status"], "duplicate")
        self.assertEqual(call_count["n"], 1)  # NOT called again

    def test_different_keys_both_succeed(self):
        """Different operation keys should both create."""
        result1 = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:op_a",
            creator_fn=lambda: {"id": "a"},
        )
        result2 = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:op_b",
            creator_fn=lambda: {"id": "b"},
        )
        self.assertEqual(result1["status"], "created")
        self.assertEqual(result2["status"], "created")

    def test_different_tenants_same_key_both_succeed(self):
        """Same key for different tenants should both create."""
        other_tenant = Tenant.objects.create(
            name="Other", slug="other-idem", schema_name="other_idem"
        )

        result1 = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:shared_key",
            creator_fn=lambda: {"id": "1"},
        )
        result2 = enforce_idempotency(
            tenant_id=str(other_tenant.pk),
            operation_key="test:shared_key",
            creator_fn=lambda: {"id": "2"},
        )
        self.assertEqual(result1["status"], "created")
        self.assertEqual(result2["status"], "created")

    def test_creator_failure_releases_key(self):
        """If creator_fn raises, the key should be released for retry."""
        # First attempt fails
        with self.assertRaises(ValueError):
            enforce_idempotency(
                tenant_id=str(self.tenant.pk),
                operation_key="test:retry_key",
                creator_fn=lambda: (_ for _ in ()).throw(ValueError("boom")),
            )

        # Key should be released — second attempt should work
        result = enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:retry_key",
            creator_fn=lambda: {"id": "recovered"},
        )
        self.assertEqual(result["status"], "created")
        self.assertEqual(result["result"]["id"], "recovered")

    def test_cached_result_stored_in_db(self):
        """Successful creation should store result in IdempotencyKey.response_body."""
        enforce_idempotency(
            tenant_id=str(self.tenant.pk),
            operation_key="test:check_cache",
            creator_fn=lambda: {"id": "cached_val", "name": "Test"},
        )

        record = IdempotencyKey.objects.get(
            tenant=self.tenant, idempotency_key="test:check_cache"
        )
        self.assertEqual(record.response_status, 201)
        self.assertEqual(record.response_body["id"], "cached_val")
        self.assertIsNone(record.locked_until)  # Lock released


class GenerateOperationKeyTests(TestCase):
    """Tests for generate_operation_key."""

    def test_deterministic_output(self):
        """Same inputs should always produce same key."""
        key1 = generate_operation_key(
            source="ai_inbox",
            entity_type="PurchaseOrder",
            fingerprint="email_123:PO-9001",
        )
        key2 = generate_operation_key(
            source="ai_inbox",
            entity_type="PurchaseOrder",
            fingerprint="email_123:PO-9001",
        )
        self.assertEqual(key1, key2)

    def test_different_fingerprints_different_keys(self):
        """Different fingerprints should produce different keys."""
        key1 = generate_operation_key(
            source="webhook", entity_type="Inquiry", fingerprint="a"
        )
        key2 = generate_operation_key(
            source="webhook", entity_type="Inquiry", fingerprint="b"
        )
        self.assertNotEqual(key1, key2)

    def test_format_includes_source_and_type(self):
        """Key should include source and entity_type prefix."""
        key = generate_operation_key(
            source="ai_inbox",
            entity_type="PurchaseOrder",
            fingerprint="test",
        )
        self.assertTrue(key.startswith("ai_inbox:PurchaseOrder:"))


class SerializeResultTests(TestCase):
    """Tests for _serialize_result helper."""

    def test_dict_passthrough(self):
        """Dicts should pass through unchanged."""
        result = _serialize_result({"id": "1", "name": "test"})
        self.assertEqual(result, {"id": "1", "name": "test"})

    def test_none_returns_none(self):
        """None should return None."""
        self.assertIsNone(_serialize_result(None))

    def test_model_instance_serialized(self):
        """Objects with pk should serialize to {id, type}."""

        class FakeModel:
            pk = "uuid-123"

        result = _serialize_result(FakeModel())
        self.assertEqual(result["id"], "uuid-123")
        self.assertEqual(result["type"], "FakeModel")

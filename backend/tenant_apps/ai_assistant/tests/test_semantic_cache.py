import unittest
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

if "tenant_apps.ai_assistant" not in settings.INSTALLED_APPS:
    raise unittest.SkipTest("tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings")

from tenant_apps.ai_assistant.services.semantic_cache import (
    build_context_signature,
    lookup_cached_response,
    store_cached_response,
)


@override_settings(
    AI_SEMANTIC_CACHE_ENABLED=True,
    AI_SEMANTIC_CACHE_TTL_SECONDS=3600,
    AI_SEMANTIC_CACHE_SIMILARITY_THRESHOLD=0.95,
    AI_SEMANTIC_CACHE_MAX_ENTRIES=10,
)
class SemanticCacheServiceTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.context_signature = build_context_signature(history=[], context={"scope": "pricing"})

    def tearDown(self):
        cache.clear()

    @patch("tenant_apps.ai_assistant.services.semantic_cache._embed_texts")
    def test_store_and_lookup_hit_for_same_tenant(self, mock_embed_texts):
        mock_embed_texts.side_effect = [
            [[1.0, 0.0, 0.0]],
            [[0.99, 0.01, 0.0]],
        ]

        store_cached_response(
            tenant_id="tenant-a",
            user_message="Show me pricing",
            response_text="Here is the cached pricing summary.",
            context_signature=self.context_signature,
            model_name="gpt-4o-mini",
        )
        hit = lookup_cached_response(
            tenant_id="tenant-a",
            user_message="Show me price summary",
            context_signature=self.context_signature,
        )

        self.assertIsNotNone(hit)
        self.assertEqual(hit.response_text, "Here is the cached pricing summary.")
        self.assertGreaterEqual(hit.similarity, 0.95)

    @patch("tenant_apps.ai_assistant.services.semantic_cache._embed_texts")
    def test_lookup_respects_tenant_isolation(self, mock_embed_texts):
        mock_embed_texts.side_effect = [
            [[1.0, 0.0, 0.0]],
            [[1.0, 0.0, 0.0]],
        ]

        store_cached_response(
            tenant_id="tenant-a",
            user_message="Show me pricing",
            response_text="Tenant A summary.",
            context_signature=self.context_signature,
            model_name="gpt-4o-mini",
        )
        hit = lookup_cached_response(
            tenant_id="tenant-b",
            user_message="Show me pricing",
            context_signature=self.context_signature,
        )

        self.assertIsNone(hit)

    @patch("tenant_apps.ai_assistant.services.semantic_cache._embed_texts")
    def test_lookup_enforces_similarity_threshold(self, mock_embed_texts):
        mock_embed_texts.side_effect = [
            [[1.0, 0.0, 0.0]],
            [[0.2, 0.8, 0.0]],
        ]

        store_cached_response(
            tenant_id="tenant-a",
            user_message="Show me pricing",
            response_text="Tenant A summary.",
            context_signature=self.context_signature,
            model_name="gpt-4o-mini",
        )
        hit = lookup_cached_response(
            tenant_id="tenant-a",
            user_message="Completely different question",
            context_signature=self.context_signature,
        )

        self.assertIsNone(hit)

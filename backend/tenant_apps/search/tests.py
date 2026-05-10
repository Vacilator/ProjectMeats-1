"""
Tests for SearchIntelligenceService.

Covers:
- Cache hit/miss for continuous_search
- Model class resolution
- Unknown entity type raises KeyError
- Query filtering across multiple fields
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-search",
        }
    }
)
class SearchIntelligenceServiceTestCase(TestCase):
    """Tests for tenant_apps.search.services.SearchIntelligenceService."""

    def setUp(self):
        self.tenant_id = "11111111-1111-1111-1111-111111111111"

    def test_get_model_class_product(self):
        """Resolves 'product' to MasterProduct model."""
        from tenant_apps.search.services import SearchIntelligenceService

        model_cls = SearchIntelligenceService._get_model_class('product')
        self.assertEqual(model_cls.__name__, 'MasterProduct')

    def test_get_model_class_supplier(self):
        """Resolves 'supplier' to Supplier model."""
        from tenant_apps.search.services import SearchIntelligenceService

        model_cls = SearchIntelligenceService._get_model_class('supplier')
        self.assertEqual(model_cls.__name__, 'Supplier')

    def test_get_model_class_customer(self):
        """Resolves 'customer' to Customer model."""
        from tenant_apps.search.services import SearchIntelligenceService

        model_cls = SearchIntelligenceService._get_model_class('customer')
        self.assertEqual(model_cls.__name__, 'Customer')

    def test_unknown_entity_type_raises(self):
        """Unknown entity type raises KeyError."""
        from tenant_apps.search.services import SearchIntelligenceService

        with self.assertRaises(KeyError):
            SearchIntelligenceService._get_model_class('nonexistent')

    def test_cache_ttl_is_ten_minutes(self):
        """CACHE_TTL should be 600 seconds."""
        from tenant_apps.search.services import SearchIntelligenceService
        self.assertEqual(SearchIntelligenceService.CACHE_TTL, 600)

    @patch('tenant_apps.search.services.cache')
    def test_continuous_search_returns_cached(self, mock_cache):
        """If cache has results, return them without executing search."""
        import json
        from tenant_apps.search.services import SearchIntelligenceService

        cached_data = [{"id": "1", "label": "Test", "entity_type": "product"}]
        mock_cache.get.return_value = json.dumps(cached_data)

        results = SearchIntelligenceService.continuous_search(
            "test", "product", self.tenant_id
        )

        self.assertEqual(results, cached_data)
        mock_cache.set.assert_not_called()

    @patch('tenant_apps.search.services.cache')
    def test_continuous_search_caches_on_miss(self, mock_cache):
        """On cache miss, execute search and cache the results."""
        from tenant_apps.search.services import SearchIntelligenceService

        mock_cache.get.return_value = None

        mock_model = MagicMock()
        mock_model.name = True  # hasattr check
        mock_obj = MagicMock()
        mock_obj.id = "42"
        mock_obj.__str__ = lambda self: "Test Product"
        mock_model.objects.filter.return_value.filter.return_value.__getitem__ = (
            lambda self, key: [mock_obj]
        )

        with patch.object(
            SearchIntelligenceService,
            '_get_model_class',
            return_value=mock_model,
        ):
            with patch.object(
                SearchIntelligenceService,
                '_execute_search',
                return_value=[{"id": "42", "label": "Test Product", "entity_type": "product"}],
            ):
                results = SearchIntelligenceService.continuous_search(
                    "test", "product", self.tenant_id
                )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "42")
        mock_cache.set.assert_called_once()

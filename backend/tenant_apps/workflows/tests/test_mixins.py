"""
Unit tests for Query Optimization Mixins

Tests caching and query optimization utilities.
"""
import unittest
from unittest.mock import Mock
from tenant_apps.workflows.mixins import (
    QueryOptimizationMixin,
    CachingMixin
)


class TestQueryOptimizationMixin(unittest.TestCase):
    """Test QueryOptimizationMixin."""
    
    def test_mixin_attributes(self):
        """Test mixin has expected attributes."""
        mixin = QueryOptimizationMixin()
        
        self.assertTrue(hasattr(mixin, 'select_related_fields'))
        self.assertTrue(hasattr(mixin, 'prefetch_related_fields'))
        self.assertEqual(mixin.select_related_fields, [])
        self.assertEqual(mixin.prefetch_related_fields, [])


class TestCachingMixin(unittest.TestCase):
    """Test CachingMixin caching logic."""
    
    def test_cache_key_generation_list(self):
        """Test cache key generation for list views."""
        mixin = CachingMixin()
        mixin.cache_key_prefix = 'test'
        
        # Mock request with tenant
        request = Mock()
        request.META = {'QUERY_STRING': 'page=1'}
        mock_tenant = Mock()
        mock_tenant.id = 'tenant-123'
        request.tenant = mock_tenant
        
        cache_key = mixin._get_cache_key(request, 'list')
        
        self.assertIn('test', cache_key)
        self.assertIn('tenant-123', cache_key)
        self.assertIn('list', cache_key)
    
    def test_cache_key_generation_retrieve(self):
        """Test cache key generation for retrieve views."""
        mixin = CachingMixin()
        mixin.cache_key_prefix = 'test'
        
        request = Mock()
        request.META = {}
        mock_tenant = Mock()
        mock_tenant.id = 'tenant-456'
        request.tenant = mock_tenant
        
        cache_key = mixin._get_cache_key(request, 'retrieve', obj_id=123)
        
        self.assertIn('test', cache_key)
        self.assertIn('tenant-456', cache_key)
        self.assertIn('retrieve', cache_key)
        self.assertIn('123', cache_key)
    
    def test_should_use_cache_get_request(self):
        """Test caching enabled for GET requests."""
        mixin = CachingMixin()
        mixin.cache_enabled = True
        
        request = Mock()
        request.method = 'GET'
        request.query_params = {}
        
        self.assertTrue(mixin._should_use_cache(request))
    
    def test_should_not_use_cache_post_request(self):
        """Test caching disabled for POST requests."""
        mixin = CachingMixin()
        mixin.cache_enabled = True
        
        request = Mock()
        request.method = 'POST'
        
        self.assertFalse(mixin._should_use_cache(request))
    
    def test_should_not_use_cache_when_disabled(self):
        """Test caching respects enabled flag."""
        mixin = CachingMixin()
        mixin.cache_enabled = False
        
        request = Mock()
        request.method = 'GET'
        
        self.assertFalse(mixin._should_use_cache(request))
    
    def test_should_not_use_cache_with_no_cache_param(self):
        """Test caching respects no_cache query param."""
        mixin = CachingMixin()
        mixin.cache_enabled = True
        
        request = Mock()
        request.method = 'GET'
        request.query_params = {'no_cache': 'true'}
        
        self.assertFalse(mixin._should_use_cache(request))
    
    def test_cache_timeout_configuration(self):
        """Test cache timeout can be configured."""
        mixin = CachingMixin()
        mixin.cache_timeout = 600  # 10 minutes
        
        self.assertEqual(mixin.cache_timeout, 600)


if __name__ == '__main__':
    unittest.main()

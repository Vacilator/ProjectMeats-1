"""
Tests for system app models.
"""
from decimal import Decimal
from django.test import TestCase
from apps.system.models import Product, ProductCategoryChoices


class ProductModelTest(TestCase):
    """Test the system-wide Product model."""
    
    def setUp(self):
        """Create test products."""
        self.product = Product.objects.create(
            product_code='BEEF-RIBEYE-001',
            name='Choice Ribeye Steak',
            description='USDA Choice ribeye steak, boneless',
            category=ProductCategoryChoices.BEEF,
            protein_type='BEEF',
            fresh_or_frozen='FRESH',
            package_type='VACUUM_SEALED',
            unit_weight=Decimal('12.00'),
            uom='LB',
            namp_code='112A',
            is_active=True,
        )
    
    def test_product_creation(self):
        """Test that a product can be created with all fields."""
        self.assertEqual(self.product.product_code, 'BEEF-RIBEYE-001')
        self.assertEqual(self.product.name, 'Choice Ribeye Steak')
        self.assertEqual(self.product.category, ProductCategoryChoices.BEEF)
        self.assertTrue(self.product.is_active)
    
    def test_product_str(self):
        """Test string representation."""
        self.assertEqual(str(self.product), 'BEEF-RIBEYE-001 - Choice Ribeye Steak')
    
    def test_product_unique_code(self):
        """Test that product_code must be unique."""
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Product.objects.create(
                product_code='BEEF-RIBEYE-001',  # Duplicate
                name='Another Ribeye',
            )
    
    def test_display_name_with_name(self):
        """Test display_name returns name when available."""
        self.assertEqual(self.product.display_name, 'Choice Ribeye Steak')
    
    def test_display_name_without_name(self):
        """Test display_name returns product_code when name is empty."""
        product = Product.objects.create(
            product_code='PORK-001',
            name='',
        )
        self.assertEqual(product.display_name, 'PORK-001')
    
    def test_is_fresh_property(self):
        """Test is_fresh property."""
        self.assertTrue(self.product.is_fresh)
        self.assertFalse(self.product.is_frozen)
    
    def test_is_frozen_property(self):
        """Test is_frozen property."""
        frozen_product = Product.objects.create(
            product_code='BEEF-FROZEN-001',
            name='Frozen Ground Beef',
            fresh_or_frozen='FROZEN',
        )
        self.assertTrue(frozen_product.is_frozen)
        self.assertFalse(frozen_product.is_fresh)
    
    def test_is_fresh_frozen_case_insensitive(self):
        """Test that is_fresh and is_frozen are case-insensitive."""
        product = Product.objects.create(
            product_code='TEST-001',
            name='Test Product',
            fresh_or_frozen='fresh',  # lowercase
        )
        self.assertTrue(product.is_fresh)
        self.assertFalse(product.is_frozen)
    
    def test_uuid_primary_key(self):
        """Test that primary key is a UUID."""
        import uuid
        self.assertIsInstance(self.product.id, uuid.UUID)
    
    def test_default_values(self):
        """Test default field values."""
        product = Product.objects.create(
            product_code='DEFAULT-001',
            name='Default Test',
        )
        self.assertEqual(product.category, ProductCategoryChoices.OTHER)
        self.assertEqual(product.uom, 'LB')
        self.assertTrue(product.is_active)
        self.assertFalse(product.tested_product)
    
    def test_legacy_id_tracking(self):
        """Test legacy_tenant_product_id field for migration tracking."""
        product = Product.objects.create(
            product_code='LEGACY-001',
            name='Legacy Product',
            legacy_tenant_product_id=12345,
        )
        self.assertEqual(product.legacy_tenant_product_id, 12345)
    
    def test_ordering(self):
        """Test default ordering by product_code."""
        Product.objects.create(product_code='ZZZ-001', name='Last')
        Product.objects.create(product_code='AAA-001', name='First')
        
        products = list(Product.objects.values_list('product_code', flat=True))
        self.assertEqual(products[0], 'AAA-001')
        self.assertIn('ZZZ-001', products)
    
    def test_category_choices(self):
        """Test all category choices are valid."""
        for choice in ProductCategoryChoices:
            product = Product.objects.create(
                product_code=f'CAT-{choice.value}',
                name=f'{choice.label} Product',
                category=choice,
            )
            self.assertEqual(product.category, choice)
    
    def test_timestamp_fields(self):
        """Test auto-populated timestamp fields."""
        self.assertIsNotNone(self.product.created_at)
        self.assertIsNotNone(self.product.updated_at)
    
    def test_nullable_unit_weight(self):
        """Test unit_weight can be null."""
        product = Product.objects.create(
            product_code='NO-WEIGHT-001',
            name='No Weight Product',
            unit_weight=None,
        )
        self.assertIsNone(product.unit_weight)


class ProductCategoryChoicesTest(TestCase):
    """Test the ProductCategoryChoices enum."""
    
    def test_all_categories_exist(self):
        """Test all expected categories exist."""
        expected = ['BEEF', 'PORK', 'POULTRY', 'SEAFOOD', 'LAMB', 'VEAL', 'GAME', 'OTHER']
        actual = [c.value for c in ProductCategoryChoices]
        for cat in expected:
            self.assertIn(cat, actual)
    
    def test_category_labels(self):
        """Test category labels are human-readable."""
        self.assertEqual(ProductCategoryChoices.BEEF.label, 'Beef')
        self.assertEqual(ProductCategoryChoices.SEAFOOD.label, 'Seafood')

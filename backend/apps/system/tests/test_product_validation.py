"""
Tests for Product validation logic.

Verifies that "Zombie Product" prevention works:
- Products can only be created with valid protein_type values
- Invalid protein types are rejected at both model and API layers
- Data contract consistency is maintained across all tiers

Phase 3: Data Architecture - Validation Layer Tests
"""
from django.test import TestCase
from django.core.exceptions import ValidationError
from apps.system.models import Product, SystemChoiceList, SystemChoiceItem


class ProductValidationTest(TestCase):
    """Test suite for Product validation against SystemChoiceList."""
    
    @classmethod
    def setUpTestData(cls):
        """Set up test data once for all tests."""
        # Create protein_type choice list (may already be seeded by migrations)
        cls.protein_choice_list, _created = SystemChoiceList.objects.get_or_create(
            slug='protein_type',
            defaults={
                'name': 'Protein Type',
                'description': 'Types of protein for products',
                'model_field_path': 'system.Product.protein_type',
                'is_extensible': False,
            },
        )

        # Ensure valid protein types exist
        SystemChoiceItem.objects.update_or_create(
            choice_list=cls.protein_choice_list,
            value='beef',
            defaults={'label': 'Beef', 'order': 1, 'is_active': True},
        )
        SystemChoiceItem.objects.update_or_create(
            choice_list=cls.protein_choice_list,
            value='pork',
            defaults={'label': 'Pork', 'order': 2, 'is_active': True},
        )
        SystemChoiceItem.objects.update_or_create(
            choice_list=cls.protein_choice_list,
            value='poultry',
            defaults={'label': 'Poultry', 'order': 3, 'is_active': True},
        )
    
    def test_valid_protein_type_passes(self):
        """Test that valid protein_type values are accepted."""
        product = Product(
            product_code='TEST-BEEF-001',
            name='Test Beef Product',
            protein_type='beef',
            category='BEEF',
        )
        
        # Should not raise ValidationError
        try:
            product.save()
            self.assertTrue(True)
        except ValidationError:
            self.fail("Valid protein_type 'beef' was rejected")
    
    def test_invalid_protein_type_fails(self):
        """Test that invalid protein_type values are rejected."""
        product = Product(
            product_code='TEST-INVALID-001',
            name='Test Invalid Product',
            protein_type='invalid_protein',  # Not in SystemChoiceList
            category='OTHER',
        )
        
        # Should raise ValidationError
        with self.assertRaises(ValidationError) as context:
            product.save()
        
        self.assertIn('Invalid protein_type', str(context.exception))
        self.assertIn('invalid_protein', str(context.exception))
    
    def test_uppercase_protein_type_normalized(self):
        """Test that UPPERCASE protein_type is normalized to lowercase."""
        product = Product(
            product_code='TEST-PORK-001',
            name='Test Pork Product',
            protein_type='PORK',  # Uppercase
            category='PORK',
        )
        
        # Should normalize to lowercase and pass
        product.save()
        product.refresh_from_db()
        
        self.assertEqual(product.protein_type, 'pork')  # Normalized
    
    def test_mixed_case_protein_type_normalized(self):
        """Test that MixedCase protein_type is normalized to lowercase."""
        product = Product(
            product_code='TEST-POULTRY-001',
            name='Test Poultry Product',
            protein_type='PoUlTrY',  # Mixed case
            category='POULTRY',
        )
        
        # Should normalize to lowercase and pass
        product.save()
        product.refresh_from_db()
        
        self.assertEqual(product.protein_type, 'poultry')  # Normalized
    
    def test_blank_protein_type_allowed(self):
        """Test that blank protein_type is allowed."""
        product = Product(
            product_code='TEST-BLANK-001',
            name='Test Product Without Protein Type',
            protein_type='',  # Blank
            category='OTHER',
        )
        
        # Should not raise ValidationError
        try:
            product.save()
            self.assertTrue(True)
        except ValidationError:
            self.fail("Blank protein_type was rejected")
    
    def test_whitespace_protein_type_normalized(self):
        """Test that protein_type with whitespace is normalized."""
        product = Product(
            product_code='TEST-BEEF-002',
            name='Test Beef Product 2',
            protein_type='  beef  ',  # Whitespace
            category='BEEF',
        )
        
        # Should trim whitespace and pass
        product.save()
        product.refresh_from_db()
        
        self.assertEqual(product.protein_type, 'beef')  # Trimmed
    
    def test_inactive_protein_type_fails(self):
        """Test that inactive protein_type values are rejected."""
        # Create inactive choice (may already exist if seeded)
        SystemChoiceItem.objects.update_or_create(
            choice_list=self.protein_choice_list,
            value='lamb',
            defaults={'label': 'Lamb', 'order': 4, 'is_active': False},
        )
        
        product = Product(
            product_code='TEST-LAMB-001',
            name='Test Lamb Product',
            protein_type='lamb',  # Inactive in choice list
            category='LAMB',
        )
        
        # Should raise ValidationError
        with self.assertRaises(ValidationError) as context:
            product.save()
        
        self.assertIn('Invalid protein_type', str(context.exception))
    
    def test_cascade_filtering_data_contract(self):
        """
        Test that cascade filtering data contract is maintained.
        
        This ensures that:
        1. Choice Engine resolves protein types (e.g., 'beef')
        2. Product model stores matching lowercase slugs
        3. API filtering works consistently
        """
        # Create products with valid protein types
        Product.objects.bulk_create([
            Product(
                product_code='CASCADE-BEEF-001',
                name='Beef Ribeye',
                protein_type='beef',
                category='BEEF',
            ),
            Product(
                product_code='CASCADE-PORK-001',
                name='Pork Chop',
                protein_type='pork',
                category='PORK',
            ),
            Product(
                product_code='CASCADE-POULTRY-001',
                name='Chicken Breast',
                protein_type='poultry',
                category='POULTRY',
            ),
        ])
        
        # Verify products can be filtered by protein_type
        beef_products = Product.objects.filter(protein_type='beef')
        self.assertEqual(beef_products.count(), 1)
        self.assertEqual(beef_products.first().product_code, 'CASCADE-BEEF-001')
        
        pork_products = Product.objects.filter(protein_type='pork')
        self.assertEqual(pork_products.count(), 1)
        
        poultry_products = Product.objects.filter(protein_type='poultry')
        self.assertEqual(poultry_products.count(), 1)
    
    def test_error_message_helpful(self):
        """Test that validation error messages are helpful."""
        product = Product(
            product_code='TEST-ERROR-001',
            name='Test Error Message',
            protein_type='chicken',  # Close to 'poultry' but wrong
            category='POULTRY',
        )
        
        with self.assertRaises(ValidationError) as context:
            product.save()
        
        error_message = str(context.exception)
        
        # Error should mention valid choices
        self.assertIn('beef', error_message)
        self.assertIn('pork', error_message)
        self.assertIn('poultry', error_message)
        
        # Error should mention SystemChoiceList
        self.assertIn('SystemChoiceList', error_message)

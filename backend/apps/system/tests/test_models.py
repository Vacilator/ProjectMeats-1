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
            product_code="BEEF-RIBEYE-001",
            name="Choice Ribeye Steak",
            description="USDA Choice ribeye steak, boneless",
            category=ProductCategoryChoices.BEEF,
            protein_type="BEEF",
            fresh_or_frozen="FRESH",
            package_type="VACUUM_SEALED",
            unit_weight=Decimal("12.00"),
            uom="LB",
            namp_code="112A",
            is_active=True,
        )

    def test_product_creation(self):
        """Test that a product can be created with all fields."""
        self.assertEqual(self.product.product_code, "BEEF-RIBEYE-001")
        self.assertEqual(self.product.name, "Choice Ribeye Steak")
        self.assertEqual(self.product.category, ProductCategoryChoices.BEEF)
        self.assertTrue(self.product.is_active)

    def test_product_str(self):
        """Test string representation."""
        self.assertEqual(str(self.product), "BEEF-RIBEYE-001 - Choice Ribeye Steak")

    def test_product_unique_code(self):
        """Test that product_code must be unique.

        Note: Product.save() calls full_clean(), so duplicates raise ValidationError
        (not IntegrityError).
        """
        from django.core.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            Product.objects.create(
                product_code="BEEF-RIBEYE-001",  # Duplicate
                name="Another Ribeye",
            )

    def test_display_name_with_name(self):
        """Test display_name returns name when available."""
        self.assertEqual(self.product.display_name, "Choice Ribeye Steak")

    def test_display_name_without_name(self):
        """Test display_name falls back to product_code when name is falsy.

        We validate the property behavior without persisting an invalid blank name.
        """
        product = Product(product_code="PORK-001", name="")
        self.assertEqual(product.display_name, "PORK-001")

    def test_is_fresh_property(self):
        """Test is_fresh property."""
        self.assertTrue(self.product.is_fresh)
        self.assertFalse(self.product.is_frozen)

    def test_is_frozen_property(self):
        """Test is_frozen property."""
        frozen_product = Product.objects.create(
            product_code="BEEF-FROZEN-001",
            name="Frozen Ground Beef",
            fresh_or_frozen="FROZEN",
        )
        self.assertTrue(frozen_product.is_frozen)
        self.assertFalse(frozen_product.is_fresh)

    def test_is_fresh_frozen_case_insensitive(self):
        """Test that is_fresh and is_frozen are case-insensitive."""
        product = Product.objects.create(
            product_code="TEST-001",
            name="Test Product",
            fresh_or_frozen="fresh",  # lowercase
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
            product_code="DEFAULT-001",
            name="Default Test",
        )
        self.assertEqual(product.category, ProductCategoryChoices.OTHER)
        self.assertEqual(product.uom, "LB")
        self.assertTrue(product.is_active)
        self.assertFalse(product.tested_product)

    def test_legacy_id_tracking(self):
        """Test legacy_tenant_product_id field for migration tracking."""
        product = Product.objects.create(
            product_code="LEGACY-001",
            name="Legacy Product",
            legacy_tenant_product_id=12345,
        )
        self.assertEqual(product.legacy_tenant_product_id, 12345)

    def test_ordering(self):
        """Test default ordering by product_code."""
        Product.objects.create(product_code="ZZZ-001", name="Last")
        Product.objects.create(product_code="AAA-001", name="First")

        products = list(Product.objects.values_list("product_code", flat=True))
        self.assertEqual(products[0], "AAA-001")
        self.assertIn("ZZZ-001", products)

    def test_category_choices(self):
        """Test all category choices are valid."""
        for choice in ProductCategoryChoices:
            product = Product.objects.create(
                product_code=f"CAT-{choice.value}",
                name=f"{choice.label} Product",
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
            product_code="NO-WEIGHT-001",
            name="No Weight Product",
            unit_weight=None,
        )
        self.assertIsNone(product.unit_weight)


class ProductCategoryChoicesTest(TestCase):
    """Test the ProductCategoryChoices enum."""

    def test_all_categories_exist(self):
        """Test all expected categories exist."""
        expected = ["BEEF", "PORK", "POULTRY", "SEAFOOD", "LAMB", "VEAL", "GAME", "OTHER"]
        actual = [c.value for c in ProductCategoryChoices]
        for cat in expected:
            self.assertIn(cat, actual)

    def test_category_labels(self):
        """Test category labels are human-readable."""
        self.assertEqual(ProductCategoryChoices.BEEF.label, "Beef")
        self.assertEqual(ProductCategoryChoices.SEAFOOD.label, "Seafood")


class TenantProductPreferenceTest(TestCase):
    """Test the TenantProductPreference model."""

    def setUp(self):
        """Create test data."""
        from apps.tenants.models import Tenant

        # Create tenant
        self.tenant = Tenant.objects.create(
            name="Test Meat Company",
            slug="test-meat",
        )

        # Create product
        self.product = Product.objects.create(
            product_code="BEEF-RIBEYE-001",
            name="Choice Ribeye Steak",
            category=ProductCategoryChoices.BEEF,
        )

        # Import here to avoid circular imports
        from apps.system.models import TenantProductPreference

        self.TenantProductPreference = TenantProductPreference

        # Create preference
        self.preference = TenantProductPreference.objects.create(
            tenant=self.tenant,
            product=self.product,
            display_name="Premium Ribeye",
            internal_code="RIB-001",
            default_price=Decimal("25.99"),
            default_cost=Decimal("18.50"),
            is_active=True,
        )

    def test_preference_creation(self):
        """Test that a preference can be created."""
        self.assertEqual(self.preference.tenant, self.tenant)
        self.assertEqual(self.preference.product, self.product)
        self.assertEqual(self.preference.display_name, "Premium Ribeye")

    def test_preference_str(self):
        """Test string representation uses display_name."""
        self.assertEqual(str(self.preference), "Test Meat Company: Premium Ribeye")

    def test_preference_str_without_display_name(self):
        """Test string representation falls back to product.name."""
        self.preference.display_name = ""
        self.preference.save()
        self.assertEqual(str(self.preference), "Test Meat Company: Choice Ribeye Steak")

    def test_effective_name_with_override(self):
        """Test effective_name returns display_name when set."""
        self.assertEqual(self.preference.effective_name, "Premium Ribeye")

    def test_effective_name_fallback(self):
        """Test effective_name returns product.name when display_name is empty."""
        self.preference.display_name = ""
        self.assertEqual(self.preference.effective_name, "Choice Ribeye Steak")

    def test_effective_code_with_override(self):
        """Test effective_code returns internal_code when set."""
        self.assertEqual(self.preference.effective_code, "RIB-001")

    def test_effective_code_fallback(self):
        """Test effective_code returns product.product_code when internal_code is empty."""
        self.preference.internal_code = ""
        self.assertEqual(self.preference.effective_code, "BEEF-RIBEYE-001")

    def test_unique_tenant_product_constraint(self):
        """Test that tenant+product must be unique."""
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            self.TenantProductPreference.objects.create(
                tenant=self.tenant,
                product=self.product,  # Duplicate
            )

    def test_uuid_primary_key(self):
        """Test that primary key is a UUID."""
        import uuid

        self.assertIsInstance(self.preference.id, uuid.UUID)

    def test_default_values(self):
        """Test default field values."""
        product2 = Product.objects.create(
            product_code="PORK-001",
            name="Pork Loin",
        )
        preference = self.TenantProductPreference.objects.create(
            tenant=self.tenant,
            product=product2,
        )
        self.assertTrue(preference.is_active)
        self.assertFalse(preference.is_favorite)
        self.assertEqual(preference.sort_order, 0)
        self.assertEqual(preference.display_name, "")

    def test_pricing_fields(self):
        """Test pricing fields."""
        self.assertEqual(self.preference.default_price, Decimal("25.99"))
        self.assertEqual(self.preference.default_cost, Decimal("18.50"))

    def test_get_price_for_customer(self):
        """Test get_price_for_customer returns default_price."""
        self.assertEqual(self.preference.get_price_for_customer(), Decimal("25.99"))

    def test_timestamp_fields(self):
        """Test auto-populated timestamp fields."""
        self.assertIsNotNone(self.preference.created_at)
        self.assertIsNotNone(self.preference.updated_at)


class TierBasedPermissionTest(TestCase):
    """Test tier-based permission enforcement in admin."""

    def setUp(self):
        """Set up test data with system and tenant items."""
        from django.contrib.auth.models import User

        from apps.system.models import SystemChoiceItem, SystemChoiceList
        from apps.tenants.models import Tenant

        # Create users
        self.superuser = User.objects.create_superuser(
            username="superadmin", email="super@test.com", password="superpass123"
        )
        self.staff_user = User.objects.create_user(
            username="staffuser",
            email="staff@test.com",
            password="staffpass123",
            is_staff=True,
        )

        # Create tenant for tenant-specific items
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@tenant.com",
            created_by=self.superuser,
        )

        # Create a choice list
        self.choice_list = SystemChoiceList.objects.create(
            slug="test-permissions-list",
            name="Test Permissions List",
            is_extensible=True,
        )

        # Create system-level item (tenant=None)
        self.system_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="system_value",
            label="System Item",
            tenant=None,  # System-level
        )

        # Create tenant-specific item
        self.tenant_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="tenant_value",
            label="Tenant Item",
            tenant=self.tenant,  # Tenant-level
        )

    def test_system_item_is_system_defined(self):
        """Test is_system_defined property for system items."""
        self.assertTrue(self.system_item.is_system_defined)
        self.assertFalse(self.tenant_item.is_system_defined)

    def test_superuser_can_modify_system_item(self):
        """Test that superuser can modify system-level items."""
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory

        from apps.system.admin import SystemChoiceItemAdmin
        from apps.system.models import SystemChoiceItem

        admin = SystemChoiceItemAdmin(SystemChoiceItem, AdminSite())
        factory = RequestFactory()
        request = factory.get("/")
        request.user = self.superuser

        # Superuser should have change permission for system items
        self.assertTrue(admin.has_change_permission(request, self.system_item))
        self.assertTrue(admin.has_delete_permission(request, self.system_item))

    def test_staff_cannot_modify_system_item(self):
        """Test that staff user cannot modify system-level items."""
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory

        from apps.system.admin import SystemChoiceItemAdmin
        from apps.system.models import SystemChoiceItem

        admin = SystemChoiceItemAdmin(SystemChoiceItem, AdminSite())
        factory = RequestFactory()
        request = factory.get("/")
        request.user = self.staff_user

        # Staff should NOT have change permission for system items
        self.assertFalse(admin.has_change_permission(request, self.system_item))
        self.assertFalse(admin.has_delete_permission(request, self.system_item))

    def test_staff_can_modify_tenant_item(self):
        """Test that staff user with permission can modify tenant-specific items."""
        from django.contrib.admin.sites import AdminSite
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType
        from django.test import RequestFactory

        from apps.system.admin import SystemChoiceItemAdmin
        from apps.system.models import SystemChoiceItem

        # Grant staff user change and delete permissions
        content_type = ContentType.objects.get_for_model(SystemChoiceItem)
        change_permission = Permission.objects.get(
            codename="change_systemchoiceitem",
            content_type=content_type,
        )
        delete_permission = Permission.objects.get(
            codename="delete_systemchoiceitem",
            content_type=content_type,
        )
        self.staff_user.user_permissions.add(change_permission, delete_permission)

        admin = SystemChoiceItemAdmin(SystemChoiceItem, AdminSite())
        factory = RequestFactory()
        request = factory.get("/")
        request.user = self.staff_user

        # Staff should have change permission for tenant items
        self.assertTrue(admin.has_change_permission(request, self.tenant_item))
        self.assertTrue(admin.has_delete_permission(request, self.tenant_item))

    def test_non_extensible_list_requires_superuser(self):
        """Test that non-extensible lists require superuser to modify."""
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory

        from apps.system.admin import SystemChoiceListAdmin
        from apps.system.models import SystemChoiceList

        # Create a non-extensible list
        locked_list = SystemChoiceList.objects.create(
            slug="locked-list",
            name="Locked System List",
            is_extensible=False,  # System-only
        )

        admin = SystemChoiceListAdmin(SystemChoiceList, AdminSite())
        factory = RequestFactory()

        # Superuser request
        super_request = factory.get("/")
        super_request.user = self.superuser

        # Staff request
        staff_request = factory.get("/")
        staff_request.user = self.staff_user

        # Superuser should have change permission
        self.assertTrue(admin.has_change_permission(super_request, locked_list))

        # Staff should NOT have change permission for non-extensible lists
        self.assertFalse(admin.has_change_permission(staff_request, locked_list))

    def test_extensible_list_allows_staff_modification(self):
        """Test that extensible lists can be modified by staff with permission."""
        from django.contrib.admin.sites import AdminSite
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType
        from django.test import RequestFactory

        from apps.system.admin import SystemChoiceListAdmin
        from apps.system.models import SystemChoiceList

        # Grant staff user change permission on SystemChoiceList
        content_type = ContentType.objects.get_for_model(SystemChoiceList)
        change_permission = Permission.objects.get(
            codename="change_systemchoicelist",
            content_type=content_type,
        )
        self.staff_user.user_permissions.add(change_permission)

        admin = SystemChoiceListAdmin(SystemChoiceList, AdminSite())
        factory = RequestFactory()
        request = factory.get("/")
        request.user = self.staff_user

        # Extensible list should allow staff modification
        self.assertTrue(admin.has_change_permission(request, self.choice_list))


class ConfigResolverTest(TestCase):
    """Test the ConfigResolver service for cascading configuration resolution."""

    def setUp(self):
        """Create test data for config resolution."""
        from django.contrib.auth.models import User

        from apps.system.models import SystemChoiceItem, SystemChoiceList, SystemFieldSchema, TenantConfig
        from apps.tenants.models import Tenant

        # Create test user
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="testpass123")

        # Create tenant
        self.tenant = Tenant.objects.create(
            name="Config Test Tenant",
            slug="config-test",
            contact_email="config@test.com",
            created_by=self.user,
        )

        # Create a choice list with system items
        self.choice_list = SystemChoiceList.objects.create(
            slug="test-proteins",
            name="Test Proteins",
            description="Protein types for testing",
            is_extensible=True,
            is_reorderable=True,
        )

        # Create system-level items
        SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="BEEF",
            label="Beef",
            order=1,
            is_default=True,
            tenant=None,
        )
        SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="PORK",
            label="Pork",
            order=2,
            tenant=None,
        )
        SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="CHICKEN",
            label="Chicken",
            order=3,
            tenant=None,
        )

        # Create tenant-specific custom item
        self.tenant_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="WAGYU",
            label="Wagyu Beef",
            order=10,
            tenant=self.tenant,
        )

        # Create inactive item
        self.inactive_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="LAMB",
            label="Lamb",
            order=4,
            is_active=False,
            tenant=None,
        )

        # Create a field schema
        self.field_schema = SystemFieldSchema.objects.create(
            field_path="products.product.protein_type",
            field_type="SELECT",
            label="Protein Type",
            help_text="Select the type of protein",
            is_required=True,
            default_value="BEEF",
            choice_list=self.choice_list,
        )

        # Create tenant config
        self.tenant_config = TenantConfig.objects.create(
            tenant=self.tenant,
            key="ui.theme.primary_color",
            value="#ff5733",
            category="UI",
            description="Primary theme color",
            updated_by=self.user,
        )

    def test_config_resolver_initialization(self):
        """Test ConfigResolver can be initialized with or without tenant."""
        from apps.system.services.config_resolver import ConfigResolver

        # Without tenant
        resolver = ConfigResolver()
        self.assertIsNone(resolver.tenant)
        self.assertIsNone(resolver.tenant_id)

        # With tenant
        resolver = ConfigResolver(tenant=self.tenant)
        self.assertEqual(resolver.tenant, self.tenant)
        self.assertEqual(resolver.tenant_id, self.tenant.id)

    def test_get_tenant_config_value(self):
        """Test getting a tenant-specific config value."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver(tenant=self.tenant)
        value = resolver.get("ui.theme.primary_color")
        self.assertEqual(value, "#ff5733")

    def test_get_config_with_default(self):
        """Test getting config with fallback default."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver(tenant=self.tenant)

        # Non-existent key should return default
        value = resolver.get("non.existent.key", default="default_value")
        self.assertEqual(value, "default_value")

    def test_get_config_without_tenant(self):
        """Test getting config without tenant context uses default."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()
        value = resolver.get("ui.theme.primary_color", default="#667eea")
        self.assertEqual(value, "#667eea")  # Returns default, not tenant value

    def test_get_choices_system_only(self):
        """Test getting system-level choices only."""
        from apps.system.services.config_resolver import ConfigResolver

        # Without tenant - should only get system items
        resolver = ConfigResolver()
        choices = resolver.get_choices("test-proteins")

        # Should have 3 active system items (not tenant item or inactive)
        self.assertEqual(len(choices), 3)
        values = [c["value"] for c in choices]
        self.assertIn("BEEF", values)
        self.assertIn("PORK", values)
        self.assertIn("CHICKEN", values)
        self.assertNotIn("WAGYU", values)  # Tenant item
        self.assertNotIn("LAMB", values)  # Inactive

    def test_get_choices_with_tenant_custom(self):
        """Test getting choices with tenant custom items."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver(tenant=self.tenant)
        choices = resolver.get_choices("test-proteins")

        # Should have 4 items (3 system + 1 tenant custom)
        self.assertEqual(len(choices), 4)
        values = [c["value"] for c in choices]
        self.assertIn("WAGYU", values)  # Tenant custom item

    def test_get_choices_include_inactive(self):
        """Test getting choices including inactive items."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()
        choices = resolver.get_choices("test-proteins", include_inactive=True)

        # Should have 4 items (3 active + 1 inactive)
        self.assertEqual(len(choices), 4)
        values = [c["value"] for c in choices]
        self.assertIn("LAMB", values)  # Inactive item

    def test_get_choices_respects_order(self):
        """Test that choices are returned in correct order."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()
        choices = resolver.get_choices("test-proteins")

        # Items should be ordered by 'order' field
        self.assertEqual(choices[0]["value"], "BEEF")  # order=1
        self.assertEqual(choices[1]["value"], "PORK")  # order=2
        self.assertEqual(choices[2]["value"], "CHICKEN")  # order=3

    def test_get_choices_marks_default(self):
        """Test that default item is marked."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()
        choices = resolver.get_choices("test-proteins")

        beef_choice = next(c for c in choices if c["value"] == "BEEF")
        pork_choice = next(c for c in choices if c["value"] == "PORK")

        self.assertTrue(beef_choice["is_default"])
        self.assertFalse(pork_choice["is_default"])

    def test_get_choices_marks_system(self):
        """Test that system vs tenant items are properly marked."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver(tenant=self.tenant)
        choices = resolver.get_choices("test-proteins")

        beef_choice = next(c for c in choices if c["value"] == "BEEF")
        wagyu_choice = next(c for c in choices if c["value"] == "WAGYU")

        self.assertTrue(beef_choice["is_system"])
        self.assertFalse(wagyu_choice["is_system"])

    def test_get_field_schema(self):
        """Test getting field schema configuration."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()
        schema = resolver.get_field_schema("products.product.protein_type")

        self.assertIsNotNone(schema)
        self.assertEqual(schema["field_path"], "products.product.protein_type")
        self.assertEqual(schema["field_type"], "SELECT")
        self.assertEqual(schema["label"], "Protein Type")
        self.assertEqual(schema["default_value"], "BEEF")
        self.assertTrue(schema["is_required"])
        self.assertEqual(schema["choice_list_slug"], "test-proteins")

    def test_get_field_schema_not_found(self):
        """Test getting non-existent field schema returns None."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()
        schema = resolver.get_field_schema("non.existent.field")
        self.assertIsNone(schema)

    def test_get_all_tenant_configs(self):
        """Test getting all configs for a tenant."""
        from apps.system.models import TenantConfig
        from apps.system.services.config_resolver import ConfigResolver

        # Add another config
        TenantConfig.objects.create(
            tenant=self.tenant,
            key="ui.theme.secondary_color",
            value="#333333",
            category="UI",
            updated_by=self.user,
        )

        resolver = ConfigResolver(tenant=self.tenant)
        configs = resolver.get_all_tenant_configs()

        self.assertEqual(len(configs), 2)
        self.assertEqual(configs["ui.theme.primary_color"], "#ff5733")
        self.assertEqual(configs["ui.theme.secondary_color"], "#333333")

    def test_get_all_tenant_configs_by_category(self):
        """Test getting configs filtered by category."""
        from apps.system.models import TenantConfig
        from apps.system.services.config_resolver import ConfigResolver

        # Add config in different category
        TenantConfig.objects.create(
            tenant=self.tenant,
            key="notifications.email.enabled",
            value=True,
            category="NOTIFICATIONS",
            updated_by=self.user,
        )

        resolver = ConfigResolver(tenant=self.tenant)
        configs = resolver.get_all_tenant_configs(category="UI")

        self.assertEqual(len(configs), 1)
        self.assertIn("ui.theme.primary_color", configs)
        self.assertNotIn("notifications.email.enabled", configs)

    def test_set_tenant_config(self):
        """Test setting a tenant config value."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver(tenant=self.tenant)

        # Set new config
        config = resolver.set_tenant_config(
            key="new.config.key",
            value="new_value",
            category="OTHER",
            description="A new config",
            user=self.user,
        )

        self.assertEqual(config.key, "new.config.key")
        self.assertEqual(config.value, "new_value")
        self.assertEqual(config.tenant, self.tenant)

        # Verify it's retrievable
        value = resolver.get("new.config.key")
        self.assertEqual(value, "new_value")

    def test_set_tenant_config_update_existing(self):
        """Test updating an existing tenant config."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver(tenant=self.tenant)

        # Update existing config
        config = resolver.set_tenant_config(
            key="ui.theme.primary_color",
            value="#00ff00",
            user=self.user,
        )

        # Should update, not create new
        self.assertEqual(config.value, "#00ff00")

        # Verify the update
        value = resolver.get("ui.theme.primary_color")
        self.assertEqual(value, "#00ff00")

    def test_set_tenant_config_requires_tenant(self):
        """Test that setting config without tenant raises error."""
        from apps.system.services.config_resolver import ConfigResolver

        resolver = ConfigResolver()  # No tenant

        with self.assertRaises(ValueError) as context:
            resolver.set_tenant_config(key="test.key", value="test")

        self.assertIn("tenant context", str(context.exception))

    def test_convenience_function_get_config(self):
        """Test the get_config convenience function."""
        from apps.system.services.config_resolver import get_config

        # With tenant
        value = get_config("ui.theme.primary_color", tenant=self.tenant)
        self.assertEqual(value, "#ff5733")

        # Without tenant (uses default)
        value = get_config("ui.theme.primary_color", tenant=None, default="#000000")
        self.assertEqual(value, "#000000")

    def test_convenience_function_get_choices(self):
        """Test the get_choices convenience function."""
        from apps.system.services.config_resolver import get_choices

        # With tenant
        choices = get_choices("test-proteins", tenant=self.tenant)
        self.assertEqual(len(choices), 4)  # 3 system + 1 tenant

        # Without tenant
        choices = get_choices("test-proteins", tenant=None)
        self.assertEqual(len(choices), 3)  # Only system items

    def test_caching_behavior(self):
        """Test that caching works correctly."""
        from django.core.cache import cache

        from apps.system.services.config_resolver import ConfigResolver

        # Clear cache first
        cache.clear()

        resolver = ConfigResolver(tenant=self.tenant)

        # First call should populate cache
        choices1 = resolver.get_choices("test-proteins")

        # Second call should use cache (same result)
        choices2 = resolver.get_choices("test-proteins")

        self.assertEqual(choices1, choices2)
        self.assertEqual(len(choices1), len(choices2))


class ConfigResolverAPITest(TestCase):
    """Test the Config API endpoints."""

    def setUp(self):
        """Set up API test client and data."""
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient

        from apps.system.models import SystemChoiceItem, SystemChoiceList
        from apps.tenants.models import Tenant

        # Create user
        self.user = User.objects.create_user(username="apiuser", email="api@test.com", password="apipass123")

        # Create tenant
        self.tenant = Tenant.objects.create(
            name="API Test Tenant",
            slug="api-test",
            contact_email="api@test.com",
            created_by=self.user,
        )

        # Create choice list
        self.choice_list = SystemChoiceList.objects.create(
            slug="api-test-list",
            name="API Test List",
            is_extensible=True,
        )

        SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="OPTION_A",
            label="Option A",
            order=1,
            tenant=None,
        )
        SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            value="OPTION_B",
            label="Option B",
            order=2,
            tenant=None,
        )

        # Associate user with tenant so TenantMiddleware will honor X-Tenant-ID
        from apps.tenants.models import TenantUser

        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)

        # Set up client (session auth) so AuthenticationMiddleware runs before TenantMiddleware
        self.client = APIClient()
        self.client.force_login(self.user)

    def test_list_choice_lists(self):
        """Test listing all choice lists."""
        response = self.client.get("/api/v1/system/choice-lists/")
        self.assertEqual(response.status_code, 200)

        # Handle pagination if present, otherwise use data directly
        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data

        # Should return at least our test list
        if isinstance(results, list):
            slugs = [item["slug"] for item in results]
            self.assertIn("api-test-list", slugs)

    def test_get_choice_list_detail(self):
        """Test getting a single choice list by slug."""
        response = self.client.get("/api/v1/system/choice-lists/api-test-list/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slug"], "api-test-list")
        self.assertEqual(response.data["name"], "API Test List")

    def test_get_choice_list_items(self):
        """Test getting items for a choice list."""
        response = self.client.get("/api/v1/system/choice-lists/api-test-list/items/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

        values = [item["value"] for item in response.data]
        self.assertIn("OPTION_A", values)
        self.assertIn("OPTION_B", values)

    def test_config_resolve_endpoint(self):
        """Test the config resolve endpoint."""
        from apps.system.models import TenantConfig

        # Create a tenant config
        TenantConfig.objects.create(
            tenant=self.tenant,
            key="api.test.value",
            value="test_result",
            updated_by=self.user,
        )

        # Make request with tenant header
        response = self.client.get(
            "/api/v1/system/config/resolve/",
            {"key": "api.test.value"},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(response.status_code, 200)

    def test_config_resolve_requires_key(self):
        """Test that resolve endpoint requires key parameter."""
        response = self.client.get("/api/v1/system/config/resolve/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("key", response.data["error"])

    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied."""
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/v1/system/choice-lists/")
        self.assertEqual(response.status_code, 401)

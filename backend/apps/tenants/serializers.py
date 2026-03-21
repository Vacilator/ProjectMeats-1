from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.cache import cache
from PIL import Image
import re
from .models import Tenant, TenantUser, TenantDomain, TenantConfiguration


class TenantSerializer(serializers.ModelSerializer):
    """Serializer for Tenant model with logo upload and color validation."""

    user_count = serializers.SerializerMethodField()
    is_trial_expired = serializers.ReadOnlyField()
    domains = serializers.SerializerMethodField()
    branding = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id",
            "name",
            "slug",
            "schema_name",
            "description",
            "domain",
            "contact_email",
            "contact_phone",
            "address",
            "website",
            "is_active",
            "is_trial",
            "trial_ends_at",
            "user_count",
            "is_trial_expired",
            "created_at",
            "updated_at",
            "settings",
            "logo",
            "domains",
            "branding",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "schema_name"]
        # Enable partial updates (PATCH)
        extra_kwargs = {
            'name': {'required': False},
            'slug': {'required': False},
            'contact_email': {'required': False},
        }

    def get_user_count(self, obj):
        """Get the number of active users for this tenant."""
        return obj.users.filter(is_active=True).count()
    
    def get_domains(self, obj):
        """Get list of domains for this tenant."""
        return [
            {
                "domain": domain.domain,
                "is_primary": domain.is_primary
            }
            for domain in obj.tenant_domains.all()
        ]
    
    def get_branding(self, obj):
        """Get branding information including theme settings."""
        theme_settings = obj.get_theme_settings()
        return {
            "logo_url": theme_settings.get("logo_url"),
            "primary_color_light": theme_settings.get("primary_color_light"),
            "primary_color_dark": theme_settings.get("primary_color_dark"),
        }

    def validate_slug(self, value):
        """Ensure slug is lowercase and unique."""
        if value:
            value = value.lower()
            if (
                Tenant.objects.filter(slug=value)
                .exclude(pk=self.instance.pk if self.instance else None)
                .exists()
            ):
                raise serializers.ValidationError(
                    "A tenant with this slug already exists."
                )
        return value
    
    def validate_logo(self, value):
        """
        Validate logo upload.
        
        Checks:
        - File type (JPEG, PNG, WebP only)
        - File size (max 5MB)
        - Image validity (can be opened by Pillow)
        - Image dimensions (reasonable size)
        
        Args:
            value: The uploaded file object
        
        Returns:
            The validated file object
        
        Raises:
            ValidationError: If validation fails
        """
        if not value:
            return value
        
        # Check file size (5MB max)
        max_size = 5 * 1024 * 1024  # 5MB in bytes
        if value.size > max_size:
            raise serializers.ValidationError(
                f"Logo file size must be less than 5MB. Current size: {value.size / 1024 / 1024:.2f}MB"
            )
        
        # Check file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                f"Invalid file type: {value.content_type}. Allowed types: JPEG, PNG, WebP"
            )
        
        # Validate image can be opened and processed
        try:
            image = Image.open(value)
            image.verify()  # Verify it's a valid image
            
            # Re-open for dimension check (verify() closes the file)
            value.seek(0)
            image = Image.open(value)
            
            # Check dimensions (max 4000x4000)
            max_dimension = 4000
            if image.width > max_dimension or image.height > max_dimension:
                raise serializers.ValidationError(
                    f"Image dimensions too large. Max: {max_dimension}x{max_dimension}px, "
                    f"Actual: {image.width}x{image.height}px"
                )
            
            # Reset file pointer for actual save
            value.seek(0)
            
        except Exception as e:
            raise serializers.ValidationError(
                f"Invalid image file. Error: {str(e)}"
            )
        
        return value
    
    def validate_settings(self, value):
        """
        Validate settings JSON field, especially theme colors.
        
        Checks:
        - Hex color format (#RRGGBB)
        - Valid color values
        
        Args:
            value: The settings dictionary
        
        Returns:
            The validated settings dictionary
        """
        if not value:
            return value
        
        # Validate theme colors if present
        theme = value.get('theme', {})
        hex_pattern = re.compile(r'^#[0-9A-Fa-f]{6}$')
        
        for color_key in ['primary_color', 'primary_color_light', 'primary_color_dark']:
            color_value = theme.get(color_key)
            if color_value and not hex_pattern.match(color_value):
                raise serializers.ValidationError({
                    'theme': {
                        color_key: f"Invalid hex color format: {color_value}. Use format: #RRGGBB (e.g., #3498db)"
                    }
                })
        
        return value
    
    def update(self, instance, validated_data):
        """
        Override update to handle partial updates and cache clearing.
        
        Ensures:
        - Partial updates work correctly (PATCH support)
        - Logo file uploads are processed atomically
        - Settings (colors) are saved atomically
        - Cache is cleared after successful updates
        
        Args:
            instance: The Tenant instance being updated
            validated_data: The validated data from the request
        
        Returns:
            The updated Tenant instance
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📝 TenantSerializer.update() - Updating tenant {instance.id}")
        logger.info(f"Validated data keys: {list(validated_data.keys())}")
        
        # Handle logo file upload separately if present
        logo_file = validated_data.pop('logo', None)
        if logo_file is not None:
            logger.info(f"📤 Processing logo upload: {logo_file.name}")
            # Django's FileField handles the file save automatically
            instance.logo = logo_file
        else:
            request = self.context.get('request')
            remove_logo_raw = getattr(request, 'data', {}).get('remove_logo') if request else None
            if str(remove_logo_raw).lower() in ('1', 'true', 'yes', 'on'):
                logger.info("🗑️  Removing tenant logo")
                instance.logo = None
        
        # Handle settings atomically
        settings = validated_data.pop('settings', None)
        if settings is not None:
            logger.info(f"🎨 Updating settings (theme colors): {settings}")
            # Merge with existing settings if partial update
            if instance.settings:
                # Deep merge settings
                existing_settings = instance.settings.copy()
                for key, value in settings.items():
                    if isinstance(value, dict) and key in existing_settings:
                        existing_settings[key].update(value)
                    else:
                        existing_settings[key] = value
                instance.settings = existing_settings
            else:
                instance.settings = settings
        
        # Handle remaining fields
        for attr, value in validated_data.items():
            logger.info(f"Setting {attr} = {value}")
            setattr(instance, attr, value)
        
        # Save all changes atomically
        instance.save()
        logger.info(f"✅ Tenant {instance.id} saved successfully")
        
        # Clear tenant branding cache
        cache_keys = [
            f'tenant_branding_{instance.id}',
            f'tenant_by_domain_{instance.domain}',
        ]
        for key in cache_keys:
            cache.delete(key)
            logger.info(f"🗑️  Cleared cache: {key}")
        
        return instance


class TenantCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new tenants."""

    owner_email = serializers.EmailField(write_only=True, required=False)
    owner_first_name = serializers.CharField(
        max_length=30, write_only=True, required=False
    )
    owner_last_name = serializers.CharField(
        max_length=30, write_only=True, required=False
    )

    class Meta:
        model = Tenant
        fields = [
            "name",
            "slug",
            "domain",
            "contact_email",
            "contact_phone",
            "is_trial",
            "trial_ends_at",
            "settings",
            "owner_email",
            "owner_first_name",
            "owner_last_name",
        ]

    def create(self, validated_data):
        """Create tenant and optionally create owner user."""
        # Extract owner data
        owner_email = validated_data.pop("owner_email", None)
        owner_first_name = validated_data.pop("owner_first_name", "")
        owner_last_name = validated_data.pop("owner_last_name", "")

        # Create tenant
        validated_data["created_by"] = self.context["request"].user
        tenant = super().create(validated_data)

        # Create or associate owner user
        if owner_email:
            owner_user, created = User.objects.get_or_create(
                email=owner_email,
                defaults={
                    "username": owner_email,
                    "first_name": owner_first_name,
                    "last_name": owner_last_name,
                },
            )
            TenantUser.objects.create(tenant=tenant, user=owner_user, role="owner")

        return tenant


class TenantUserSerializer(serializers.ModelSerializer):
    """Serializer for TenantUser associations."""

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = TenantUser
        fields = [
            "id",
            "tenant",
            "user",
            "role",
            "is_active",
            "username",
            "email",
            "first_name",
            "last_name",
            "tenant_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserTenantSerializer(serializers.ModelSerializer):
    """Serializer to show tenant info from user perspective."""

    tenant_id = serializers.UUIDField(source="tenant.id", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    tenant_slug = serializers.CharField(source="tenant.slug", read_only=True)
    is_trial = serializers.BooleanField(source="tenant.is_trial", read_only=True)

    class Meta:
        model = TenantUser
        fields = [
            "tenant_id",
            "tenant_name",
            "tenant_slug",
            "role",
            "is_active",
            "is_trial",
            "created_at",
        ]


class TenantDomainSerializer(serializers.ModelSerializer):
    """Serializer for TenantDomain model (shared-schema approach)."""
    
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    tenant_slug = serializers.CharField(source="tenant.slug", read_only=True)
    
    class Meta:
        model = TenantDomain
        fields = [
            "id",
            "domain",
            "tenant",
            "tenant_name",
            "tenant_slug",
            "is_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
    
    def validate_domain(self, value):
        """Ensure domain is lowercase and unique."""
        if value:
            value = value.lower()
            if (
                TenantDomain.objects.filter(domain=value)
                .exclude(pk=self.instance.pk if self.instance else None)
                .exists()
            ):
                raise serializers.ValidationError(
                    "A domain with this name already exists."
                )
        return value

# Note: DomainSerializer and ClientSerializer have been removed as Domain and Client
# models are not currently defined in models.py. They were intended for django-tenants
# schema-based multi-tenancy but are not implemented in the current shared-schema approach.
# If schema-based multi-tenancy is needed in the future, these serializers should be
# restored along with the corresponding models.


class TenantConfigurationSerializer(serializers.ModelSerializer):
    """
    Serializer for TenantConfiguration model.
    
    Handles configuration management with type conversion and validation.
    """
    
    typed_value = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantConfiguration
        fields = [
            "id",
            "tenant",
            "category",
            "key",
            "display_name",
            "description",
            "value",
            "typed_value",
            "data_type",
            "default_value",
            "is_system",
            "is_required",
            "created_at",
            "updated_at",
            "updated_by",
            "updated_by_name",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "tenant"]
    
    def get_typed_value(self, obj):
        """Return the value converted to its proper data type."""
        try:
            return obj.get_typed_value()
        except (ValueError, TypeError, KeyError) as e:
            # Return string value if conversion fails
            return obj.value
    
    def get_updated_by_name(self, obj):
        """Get the name of the user who last updated this config."""
        if obj.updated_by:
            return f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip() or obj.updated_by.username
        return None
    
    def validate_value(self, value):
        """Validate value based on data_type."""
        data_type = self.initial_data.get('data_type', 'string')
        
        if data_type == 'boolean':
            if value.lower() not in ('true', 'false', '1', '0', 'yes', 'no'):
                raise serializers.ValidationError(
                    "Boolean value must be 'true', 'false', '1', '0', 'yes', or 'no'"
                )
        elif data_type == 'integer':
            try:
                int(value)
            except ValueError:
                raise serializers.ValidationError("Value must be a valid integer")
        elif data_type == 'float':
            try:
                float(value)
            except ValueError:
                raise serializers.ValidationError("Value must be a valid float")
        elif data_type == 'json':
            import json
            try:
                json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Value must be valid JSON")
        
        return value
    
    def validate(self, attrs):
        """Validate entire configuration object."""
        # Ensure system configs cannot be deleted (enforced in viewset)
        if self.instance and self.instance.is_system:
            if 'is_system' in attrs and not attrs['is_system']:
                raise serializers.ValidationError({
                    'is_system': 'Cannot change system configuration to non-system'
                })
        
        # Ensure required configs have values
        is_required = attrs.get('is_required', self.instance.is_required if self.instance else False)
        value = attrs.get('value', self.instance.value if self.instance else None)
        
        if is_required and not value:
            raise serializers.ValidationError({
                'value': 'Required configuration must have a value'
            })
        
        return attrs
    
    def update(self, instance, validated_data):
        """Override update to set updated_by from request context."""
        request = self.context.get('request')
        if request and request.user:
            validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)

"""
Custom JWT serializers for ProjectMeats multi-tenant authentication.

Wave S1: Security Hardening - JWT Authentication

These serializers extend simplejwt to include tenant information
in the JWT claims, enabling stateless tenant resolution.
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from apps.tenants.models import TenantUser


class TenantAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer that includes tenant claims.
    
    Adds user's tenants and default tenant to JWT claims,
    enabling stateless tenant resolution from the token.
    """
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add user info to claims
        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        
        # Add tenant info to claims
        tenant_users = TenantUser.objects.filter(
            user=user,
            is_active=True
        ).select_related('tenant')
        
        # Store list of tenant IDs the user has access to
        tenant_ids = [str(tu.tenant.id) for tu in tenant_users]
        token['tenant_ids'] = tenant_ids
        
        # Store default tenant (first active tenant)
        if tenant_users.exists():
            default_tenant = tenant_users.first()
            token['default_tenant_id'] = str(default_tenant.tenant.id)
            token['default_tenant_slug'] = default_tenant.tenant.slug
            token['default_tenant_role'] = default_tenant.role
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user info to response (not just token)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
            'is_active': self.user.is_active,
        }
        
        # Add tenant list to response
        tenant_users = TenantUser.objects.filter(
            user=self.user,
            is_active=True
        ).select_related('tenant').values(
            'tenant__id',
            'tenant__name',
            'tenant__slug',
            'role'
        )
        data['tenants'] = list(tenant_users)

        # Include the user's default tenant role in the user object for frontend use
        if tenant_users:
            data['user']['role'] = tenant_users[0]['role']
        
        return data


class TenantAwareTokenObtainPairView(TokenObtainPairView):
    """Token view that uses tenant-aware serializer."""
    serializer_class = TenantAwareTokenObtainPairSerializer

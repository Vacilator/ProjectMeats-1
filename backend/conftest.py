"""
Pytest Configuration for ProjectMeats Backend

Provides fixtures and configuration for running backend tests.
"""
import os
import uuid
import pytest
from django.conf import settings

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projectmeats.settings.development')


@pytest.fixture(scope='session')
def django_db_setup():
    """Configure test database."""
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
        'ATOMIC_REQUESTS': False,
    }


@pytest.fixture
def api_client():
    """Return DRF API test client."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def tenant_owner(django_user_model):
    """Create a tenant owner used by shared test fixtures."""
    unique = uuid.uuid4().hex[:8]
    return django_user_model.objects.create_user(
        username=f'tenant_owner_{unique}',
        email=f'tenant-owner-{unique}@example.com',
        password='testpass123'
    )


@pytest.fixture
def test_tenant(db, tenant_owner):
    """Create a test tenant."""
    from apps.tenants.models import Tenant
    unique = uuid.uuid4().hex[:8]
    return Tenant.objects.create(
        name=f'Test Tenant {unique}',
        slug=f'test-tenant-{unique}',
        contact_email=f'test-tenant-{unique}@example.com',
        is_active=True,
        created_by=tenant_owner,
    )


@pytest.fixture
def tenant(test_tenant):
    """Alias fixture for consistency with common test naming."""
    return test_tenant


@pytest.fixture
def tenant_user(django_user_model, test_tenant):
    """Create a user associated with test tenant."""
    from apps.tenants.models import TenantUser
    unique = uuid.uuid4().hex[:8]
    user = django_user_model.objects.create_user(
        username=f'tenant_user_{unique}',
        email=f'tenant-user-{unique}@example.com',
        password='testpass123'
    )
    TenantUser.objects.create(
        user=user,
        tenant=test_tenant,
        role='admin',
        is_active=True
    )
    return user


@pytest.fixture
def authenticated_client(api_client, tenant_user, test_tenant):
    """Return authenticated API client with tenant membership and header defaults."""
    api_client.force_authenticate(user=tenant_user)
    api_client.defaults['HTTP_X_TENANT_ID'] = str(test_tenant.id)
    return api_client


@pytest.fixture
def authenticated_tenant_client(authenticated_client):
    """Alias shared tenant-aware authenticated client fixture."""
    return authenticated_client


# ============================================================================
# Factory Fixtures (using factory_boy pattern)
# ============================================================================

@pytest.fixture
def supplier_factory(test_tenant):
    """Factory for creating test suppliers."""
    from tenant_apps.suppliers.models import Supplier
    
    def create_supplier(**kwargs):
        defaults = {
            'tenant': test_tenant,
            'name': 'Test Supplier',
            'is_active': True,
        }
        defaults.update(kwargs)
        return Supplier.objects.create(**defaults)
    
    return create_supplier


@pytest.fixture
def customer_factory(test_tenant):
    """Factory for creating test customers."""
    from tenant_apps.customers.models import Customer
    
    def create_customer(**kwargs):
        defaults = {
            'tenant': test_tenant,
            'name': 'Test Customer',
            'is_active': True,
        }
        defaults.update(kwargs)
        return Customer.objects.create(**defaults)
    
    return create_customer


@pytest.fixture
def purchase_order_factory(test_tenant, supplier_factory):
    """Factory for creating test purchase orders."""
    from tenant_apps.purchase_orders.models import PurchaseOrder
    
    def create_po(**kwargs):
        if 'supplier' not in kwargs:
            kwargs['supplier'] = supplier_factory()
        defaults = {
            'tenant': test_tenant,
            'status': 'pending',
        }
        defaults.update(kwargs)
        return PurchaseOrder.objects.create(**defaults)
    
    return create_po

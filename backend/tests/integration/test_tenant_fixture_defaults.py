import pytest

from apps.tenants.models import TenantUser


@pytest.mark.django_db
def test_authenticated_client_sets_tenant_defaults(authenticated_client, tenant_user, test_tenant):
    assert authenticated_client.handler._force_user == tenant_user
    assert authenticated_client.defaults['HTTP_X_TENANT_ID'] == str(test_tenant.id)
    assert TenantUser.objects.filter(
        tenant=test_tenant,
        user=tenant_user,
        is_active=True,
    ).exists()

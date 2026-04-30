"""
Tests for Carriers app models and API behavior.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.urls import reverse
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from tenant_apps.carriers.models import Carrier
from apps.tenants.models import Tenant, TenantUser
from apps.core.models import CarrierTypeChoices


class CarrierModelTest(TestCase):
    """Test cases for Carrier model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

    def test_create_carrier(self):
        """Test creating a carrier."""
        unique_id = uuid.uuid4().hex[:8]
        carrier = Carrier.objects.create(
            name=f"Test Carrier {unique_id}",
            code=f"TC-{unique_id}",
            carrier_type=CarrierTypeChoices.TRUCK,
            mc_number=f"MC-{unique_id}",
            dot_number=f"DOT-{unique_id}",
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier.name, f"Test Carrier {unique_id}")
        self.assertEqual(carrier.code, f"TC-{unique_id}")
        self.assertEqual(carrier.carrier_type, "truck")
        self.assertEqual(carrier.tenant, self.tenant)

    def test_carrier_str_representation(self):
        """Test the string representation of a carrier."""
        unique_id = uuid.uuid4().hex[:8]
        carrier = Carrier.objects.create(
            name=f"Express Shipping {unique_id}",
            code=f"ES-{unique_id}",
            tenant=self.tenant,
        )
        
        self.assertIn(f"ES-{unique_id}", str(carrier))
        self.assertIn("Express Shipping", str(carrier))

    def test_carrier_types(self):
        """Test different carrier types."""
        unique_id = uuid.uuid4().hex[:8]
        
        for carrier_type in [CarrierTypeChoices.TRUCK, CarrierTypeChoices.RAIL, CarrierTypeChoices.AIR]:
            carrier = Carrier.objects.create(
                name=f"Carrier {carrier_type} {unique_id}",
                code=f"C-{carrier_type[:3]}-{unique_id}",
                carrier_type=carrier_type,
                tenant=self.tenant,
            )
            self.assertEqual(carrier.carrier_type, carrier_type)

    def test_carrier_tenant_isolation(self):
        """Test that carriers are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create carrier for first tenant
        carrier1 = Carrier.objects.create(
            name=f"Carrier 1 {unique_id}",
            code=f"C1-{unique_id}",
            tenant=self.tenant,
        )
        
        # Create second tenant
        other_user = User.objects.create_user(
            username=f"otheruser-{unique_id}",
            email=f"other-{unique_id}@example.com",
            password="testpass123"
        )
        other_tenant = Tenant.objects.create(
            name=f"Other Company {unique_id}",
            slug=f"other-company-{unique_id}",
            contact_email=f"admin-{unique_id}@othercompany.com",
            created_by=other_user,
        )
        
        # Create carrier for second tenant
        carrier2 = Carrier.objects.create(
            name=f"Carrier 2 {unique_id}",
            code=f"C2-{unique_id}",
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_carriers = Carrier.objects.for_tenant(self.tenant)
        tenant2_carriers = Carrier.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_carriers.count(), 1)
        self.assertEqual(tenant2_carriers.count(), 1)
        self.assertIn(carrier1, tenant1_carriers)
        self.assertNotIn(carrier2, tenant1_carriers)

    def test_carrier_contact_info(self):
        """Test carrier with contact information."""
        unique_id = uuid.uuid4().hex[:8]
        carrier = Carrier.objects.create(
            name=f"Contact Carrier {unique_id}",
            code=f"CC-{unique_id}",
            contact_person="Jane Dispatcher",
            phone="555-123-4567",
            email=f"dispatch-{unique_id}@carrier.com",
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier.contact_person, "Jane Dispatcher")
        self.assertEqual(carrier.phone, "555-123-4567")
        self.assertTrue(carrier.is_active)

    def test_carrier_insurance_info(self):
        """Test carrier with insurance information."""
        from datetime import date, timedelta
        unique_id = uuid.uuid4().hex[:8]
        expiry_date = date.today() + timedelta(days=365)
        
        carrier = Carrier.objects.create(
            name=f"Insured Carrier {unique_id}",
            code=f"IC-{unique_id}",
            insurance_provider="SafeHaul Insurance",
            insurance_policy_number=f"POL-{unique_id}",
            insurance_expiry=expiry_date,
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier.insurance_provider, "SafeHaul Insurance")
        self.assertEqual(carrier.insurance_expiry, expiry_date)

    def test_carrier_accounting_info(self):
        """Test carrier with accounting information."""
        from apps.core.models import AccountingPaymentTermsChoices, CreditLimitChoices
        unique_id = uuid.uuid4().hex[:8]
        
        carrier = Carrier.objects.create(
            name=f"Account Carrier {unique_id}",
            code=f"AC-{unique_id}",
            my_customer_num_from_carrier=f"CUST-{unique_id}",
            accounting_payment_terms=AccountingPaymentTermsChoices.WIRE,
            credit_limits=CreditLimitChoices.NET_30,
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier.my_customer_num_from_carrier, f"CUST-{unique_id}")
        self.assertEqual(carrier.accounting_payment_terms, AccountingPaymentTermsChoices.WIRE)

    def test_canonical_financial_terms_sync_to_legacy_fields(self):
        """Canonical financial fields remain compatible with legacy aliases."""
        from apps.core.models import AccountingPaymentTermsChoices, CreditLimitChoices

        unique_id = uuid.uuid4().hex[:8]
        carrier = Carrier.objects.create(
            name=f"Canon Carrier {unique_id}",
            code=f"CAN-{unique_id}",
            payment_terms=AccountingPaymentTermsChoices.ACH,
            credit_limit=CreditLimitChoices.NET_15,
            tenant=self.tenant,
        )

        self.assertEqual(carrier.accounting_payment_terms, AccountingPaymentTermsChoices.ACH)
        self.assertEqual(carrier.credit_limits, CreditLimitChoices.NET_15)

    def test_carrier_address(self):
        """Test carrier with full address."""
        unique_id = uuid.uuid4().hex[:8]
        carrier = Carrier.objects.create(
            name=f"Local Carrier {unique_id}",
            code=f"LC-{unique_id}",
            address="123 Trucking Way",
            city="Dallas",
            state="TX",
            zip_code="75001",
            country="USA",
            tenant=self.tenant,
        )
        
        self.assertEqual(carrier.city, "Dallas")
        self.assertEqual(carrier.state, "TX")
        self.assertEqual(carrier.country, "USA")


class CarrierAPITests(APITestCase):
    """High-signal carrier API coverage for tenant resolution on writes."""

    def _jwt_client_for(self, user):
        client = APIClient()
        access = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return client

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"carrieruser-{unique_id}",
            email=f"carrier-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.tenant = Tenant.objects.create(
            name=f"Carrier Tenant {unique_id}",
            slug=f"carrier-tenant-{unique_id}",
            contact_email=f"carrier-admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

    def test_create_carrier_success_with_explicit_tenant(self):
        url = reverse("carrier-list")
        data = {
            "name": "Fast Trucking",
            "code": "FAST-1",
            "carrier_type": CarrierTypeChoices.TRUCK,
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        carrier = Carrier.objects.get()
        self.assertEqual(carrier.tenant, self.tenant)
        self.assertEqual(carrier.created_by, self.user)

    def test_create_carrier_requires_explicit_tenant_when_membership_is_ambiguous(self):
        client = self._jwt_client_for(self.user)
        other_tenant = Tenant.objects.create(
            name=f"Other Carrier Tenant {uuid.uuid4().hex[:8]}",
            slug=f"other-carrier-tenant-{uuid.uuid4().hex[:8]}",
            contact_email=f"other-carrier-{uuid.uuid4().hex[:8]}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=self.user, role="admin")

        url = reverse("carrier-list")
        data = {
            "name": "Ambiguous Trucking",
            "code": "AMBIG-1",
            "carrier_type": CarrierTypeChoices.TRUCK,
        }

        response = client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.content)
        self.assertEqual(Carrier.objects.count(), 0)

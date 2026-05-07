"""
Tests for Cockpit aggregated search functionality.

Verifies multi-tenant search across Customer, Supplier, and PurchaseOrder models.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from apps.tenants.models import Tenant, TenantUser
from apps.core.models import TradeExceptionQueue, TradeEventLog
from apps.core.tests.factories import TradeSessionFactory
from tenant_apps.customers.models import Customer
from tenant_apps.suppliers.models import Supplier
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.plants.models import Plant
from tenant_apps.locations.models import Location
from tenant_apps.contacts.models import Contact
from tenant_apps.inquiries.models import TradeSessionStatus


class CockpitSearchTestCase(TestCase):
    """Test cockpit search API with multi-tenancy."""
    
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Create test tenant with unique identifiers
        unique_id = uuid.uuid4().hex[:8]
        cls.tenant = Tenant.objects.create(
            name=f'Test Cockpit Tenant {unique_id}',
            slug=f'test-cockpit-{unique_id}',
            contact_email=f'test-{unique_id}@example.com',
            is_active=True,
        )
    
    def setUp(self):
        self.client = APIClient()
        
        # Generate unique identifier for this test run
        unique_id = uuid.uuid4().hex[:8]
        
        # Create test user with unique identifiers
        self.user = User.objects.create_user(
            username=f'testuser-{unique_id}',
            password='testpass123',
            email=f'test-{unique_id}@example.com'
        )
        
        # Associate user with tenant
        TenantUser.objects.create(
            user=self.user,
            tenant=self.tenant,
            role='admin',
            is_active=True
        )
        
        # Authenticate (session auth) so TenantMiddleware can resolve X-Tenant-ID.
        self.client.force_login(self.user)

        # Tenant context (shared-schema): API tenant isolation is scoped by X-Tenant-ID.
        self.tenant_header = {'HTTP_X_TENANT_ID': str(self.tenant.id)}

        # Create test data with unique identifiers
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name=f'Acme Corporation {unique_id}',
            contact_person=f'John Doe {unique_id}',
            email=f'john-{unique_id}@acme.com',
            phone='555-1234'
        )
        
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f'Global Supplies {unique_id}',
            contact_person=f'Jane Smith {unique_id}',
            email=f'jane-{unique_id}@global.com',
            phone='555-5678'
        )
        
        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number=f'PO-2024-{unique_id}',
            our_purchase_order_num=f'INT-{unique_id}',
            supplier=self.supplier,
            status='pending',
            order_date='2024-01-01',
            total_amount='1500.00'
        )
    
    def test_search_returns_all_types(self):
        """Test that search returns results from all model types."""
        response = self.client.get('/api/v1/cockpit/slots/', {'q': 'o'}, **self.tenant_header)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should find results containing 'o'
        types = [item['type'] for item in response.data]
        self.assertIn('customer', types)  # Acme Corporatio[n]
        self.assertIn('supplier', types)  # Global Supplies
        self.assertIn('order', types)  # PO-2024-001
    
    def test_search_by_customer_name(self):
        """Test searching for customers by name."""
        response = self.client.get('/api/v1/cockpit/slots/', {'q': 'Acme'}, **self.tenant_header)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        customers = [item for item in response.data if item['type'] == 'customer']
        self.assertEqual(len(customers), 1)
        self.assertIn('Acme Corporation', customers[0]['name'])
        self.assertIn('John Doe', customers[0]['contact_name'])
    
    def test_search_by_order_number(self):
        """Test searching for orders by order number."""
        response = self.client.get('/api/v1/cockpit/slots/', {'q': 'PO-2024'}, **self.tenant_header)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        orders = [item for item in response.data if item['type'] == 'order']
        self.assertEqual(len(orders), 1)
        self.assertIn('PO-2024', orders[0]['order_number'])
        self.assertIn('Global Supplies', orders[0]['supplier_name'])
    
    def test_empty_search_returns_empty(self):
        """Test that empty query returns empty results."""
        response = self.client.get('/api/v1/cockpit/slots/', {'q': ''}, **self.tenant_header)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_search_is_tenant_scoped(self):
        """Regression guard: matching records in other tenants must not appear."""
        unique_id = uuid.uuid4().hex[:8]
        other_tenant = Tenant.objects.create(
            name=f'Other Cockpit Tenant {unique_id}',
            slug=f'other-cockpit-{unique_id}',
            contact_email=f'other-{unique_id}@example.com',
            is_active=True,
        )

        # Create matching data in other tenant
        other_supplier = Supplier.objects.create(
            tenant=other_tenant,
            name=f'Global Supplies OTHER {unique_id}',
            contact_person=f'Jane Smith OTHER {unique_id}',
            email=f'jane-other-{unique_id}@global.com',
            phone='555-9999',
        )
        PurchaseOrder.objects.create(
            tenant=other_tenant,
            order_number=f'PO-OTHER-{unique_id}',
            our_purchase_order_num=f'INT-OTHER-{unique_id}',
            supplier=other_supplier,
            status='pending',
            order_date='2024-01-01',
            total_amount='1500.00',
        )
        Customer.objects.create(
            tenant=other_tenant,
            name=f'Acme Corporation OTHER {unique_id}',
            contact_person=f'John Doe OTHER {unique_id}',
            email=f'john-other-{unique_id}@acme.com',
            phone='555-0000',
        )

        response = self.client.get('/api/v1/cockpit/slots/', {'q': 'OTHER'}, **self.tenant_header)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
    
    def test_no_results_for_nonexistent_query(self):
        """Test that search with no matches returns empty."""
        response = self.client.get('/api/v1/cockpit/slots/', {'q': 'ZZZZZZZZZ'}, **self.tenant_header)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
    
    def test_requires_authentication(self):
        """Test that endpoint requires authentication."""
        self.client.logout()
        response = self.client.get('/api/v1/cockpit/slots/', {'q': 'test'}, **self.tenant_header)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CockpitEntityAIOverviewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        unique_id = uuid.uuid4().hex[:8]
        self.tenant = Tenant.objects.create(
            name=f'Test AI Tenant {unique_id}',
            slug=f'test-ai-{unique_id}',
            contact_email=f'ai-{unique_id}@example.com',
            is_active=True,
        )

        self.user = User.objects.create_user(
            username=f'aiuser-{unique_id}',
            password='testpass123',
            email=f'aiuser-{unique_id}@example.com',
        )

        TenantUser.objects.create(user=self.user, tenant=self.tenant, role='admin', is_active=True)

        self.client.force_login(self.user)
        self.tenant_header = {'HTTP_X_TENANT_ID': str(self.tenant.id)}

        self.supplier = Supplier.objects.create(tenant=self.tenant, name=f'Supplier {unique_id}')
        self.customer = Customer.objects.create(tenant=self.tenant, name=f'Customer {unique_id}')
        self.plant = Plant.objects.create(tenant=self.tenant, name=f'Plant {unique_id}')
        self.location = Location.objects.create(tenant=self.tenant, name=f'Location {unique_id}')
        self.contact = Contact.objects.create(
            tenant=self.tenant,
            first_name='HQ',
            last_name=f'Contact {unique_id}',
            supplier=self.supplier,
        )

    def test_ai_overview_returns_200_for_supported_entities(self):
        # We only assert that the endpoint is stable and tenant-scoped; actual AI generation
        # may be unavailable in CI when OPENAI_API_KEY is not configured.
        for entity_type, entity_id in [
            ('supplier', self.supplier.id),
            ('customer', self.customer.id),
            ('plant', self.plant.id),
            ('location', self.location.id),
            ('contact', self.contact.id),
        ]:
            resp = self.client.get(
                f'/api/v1/cockpit/entities/{entity_type}/{entity_id}/ai-overview/',
                **self.tenant_header,
            )

            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            payload = resp.json()
            self.assertIn('status', payload)
            self.assertIn('summary', payload)


class CockpitTradeExceptionQueueTestCase(TestCase):
    """Intervention dashboard endpoints stay tenant-safe and actionable."""

    def setUp(self):
        self.client = APIClient()
        unique_id = uuid.uuid4().hex[:8]
        self.tenant = Tenant.objects.create(
            name=f"Trade Exception Tenant {unique_id}",
            slug=f"trade-exception-{unique_id}",
            contact_email=f"trade-exception-{unique_id}@example.com",
            is_active=True,
        )
        self.user = User.objects.create_user(
            username=f"trade-operator-{unique_id}",
            password="testpass123",
            email=f"trade-operator-{unique_id}@example.com",
        )
        TenantUser.objects.create(user=self.user, tenant=self.tenant, role="admin", is_active=True)
        self.client.force_login(self.user)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def _create_trade_session(self, *, status_value=TradeSessionStatus.HALTED):
        return TradeSessionFactory(tenant=self.tenant, status=status_value)

    def test_trade_exception_list_defaults_to_active_items(self):
        trade_session = self._create_trade_session()
        active = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="sales_order.dispatch",
            reason_code="EMAIL_DISPATCH_FAILED",
            error_message="SMTP timeout",
            status="open",
        )
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="sales_order.dispatch",
            reason_code="EMAIL_DISPATCH_FAILED",
            error_message="Already resolved",
            status="resolved",
        )

        response = self.client.get("/api/v1/workspace/trade-exceptions/", **self.tenant_header)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        results = payload.get("results", payload)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], active.pk)
        self.assertEqual(results[0]["trade_session"]["trade_id"], trade_session.trade_id)

    def test_trade_exception_list_is_tenant_scoped(self):
        trade_session = self._create_trade_session()
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="rfq.send",
            reason_code="EMAIL_DISPATCH_FAILED",
            error_message="Tenant-visible failure",
            status="open",
        )

        other_tenant = Tenant.objects.create(
            name="Other Trade Exception Tenant",
            slug=f"other-trade-{uuid.uuid4().hex[:8]}",
            contact_email=f"other-trade-{uuid.uuid4().hex[:8]}@example.com",
            is_active=True,
        )
        other_session = TradeSessionFactory(tenant=other_tenant, status=TradeSessionStatus.HALTED)
        TradeExceptionQueue.objects.create(
            tenant=other_tenant,
            trade_session_id=other_session.pk,
            trade_id=other_session.trade_id,
            failed_step="po.generate",
            reason_code="PDF_GENERATION_FAILED",
            error_message="Other tenant failure",
            status="open",
        )

        response = self.client.get("/api/v1/workspace/trade-exceptions/", **self.tenant_header)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        results = payload.get("results", payload)
        self.assertEqual(len(results), 1)
        self.assertNotIn(other_session.trade_id, [row["trade_id"] for row in results])

    def test_trade_exception_detail_includes_recent_events(self):
        trade_session = self._create_trade_session()
        exception = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="rfq.send",
            reason_code="EMAIL_DISPATCH_FAILED",
            error_message="SMTP timeout",
            status="open",
        )
        TradeEventLog.objects.create(
            tenant=self.tenant,
            event_id=str(uuid.uuid4()),
            event_type="supplier_rfq.sent",
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            entity_type="inquiry",
            entity_id=str(trade_session.inquiry_id),
            payload={"status": "sent"},
        )

        response = self.client.get(
            f"/api/v1/workspace/trade-exceptions/{exception.pk}/",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload["id"], exception.pk)
        self.assertEqual(payload["trade_session"]["id"], trade_session.pk)
        self.assertEqual(len(payload["recent_events"]), 1)

    def test_retry_action_updates_status(self):
        trade_session = self._create_trade_session()
        exception = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="rfq.send",
            reason_code="EMAIL_DISPATCH_FAILED",
            error_message="SMTP timeout",
            status="open",
        )

        response = self.client.post(
            f"/api/v1/workspace/trade-exceptions/{exception.pk}/retry/",
            {},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        exception.refresh_from_db()
        self.assertEqual(exception.status, "retrying")
        self.assertEqual(exception.retry_count, 1)

    def test_resolve_action_does_not_resume_while_sibling_exception_is_active(self):
        trade_session = self._create_trade_session()
        primary = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="rfq.send",
            reason_code="EMAIL_DISPATCH_FAILED",
            error_message="SMTP timeout",
            status="open",
        )
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=trade_session.pk,
            trade_id=trade_session.trade_id,
            failed_step="sales_order.generate",
            reason_code="PDF_GENERATION_FAILED",
            error_message="Missing template",
            status="retrying",
        )

        response = self.client.post(
            f"/api/v1/workspace/trade-exceptions/{primary.pk}/resolve/",
            {"resolution_notes": "Operator fixed sender configuration."},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        trade_session.refresh_from_db()
        self.assertEqual(trade_session.status, TradeSessionStatus.HALTED)
        self.assertEqual(response.json()["trade_resumed"], False)
        self.assertIn("resume_blocked_reason", response.json())

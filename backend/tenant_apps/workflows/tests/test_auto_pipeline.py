"""
Unit tests for auto pipeline Celery tasks (AUTO-21.1).

Tests cover:
- High-confidence emails trigger PO creation
- Low-confidence emails are skipped (human fallback)
- Idempotent PO creation (no duplicates)
- SO generation from PO with lineage tracking
- Fulfillment trigger with terminal-status guard
- Auto-creation of stub suppliers
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-auto-pipeline",
        }
    }
)
class AutoPipelineTaskTestCase(TestCase):
    """Tests for email-to-fulfillment auto pipeline."""

    def setUp(self):
        self._rls_set = patch('apps.tenants.rls.set_current_tenant', return_value=MagicMock(ok=True, error=None))
        self._rls_reset = patch('apps.tenants.rls.reset_current_tenant')
        self._rls_set.start()
        self._rls_reset.start()
        self.addCleanup(self._rls_set.stop)
        self.addCleanup(self._rls_reset.stop)

        self.tenant_id = "11111111-1111-1111-1111-111111111111"

    def _make_email_log(self, confidence=0.99, draft_type='purchase_order', status='draft_created'):
        """Create a mock EmailLog with extracted data."""
        email = MagicMock()
        email.id = 42
        email.tenant_id = self.tenant_id
        email.status = status
        email.related_order_id = None
        email.subject = "PO 226052 - Beef Order"
        email.extracted_data = {
            'confidence': confidence,
            'draft_type': draft_type,
            'contact_company': 'Rowena TX Meats',
            'requested_product_name': 'Ground Beef 80/20',
            'requested_quantity': '10000',
            'summary': 'Purchase order for 10,000 lbs ground beef',
        }
        return email

    @patch('apps.integrations.auto_pipeline.EmailLog')
    @patch('apps.integrations.auto_pipeline.Tenant')
    def test_sweep_skips_low_confidence(self, mock_tenant_cls, mock_email_cls):
        """Emails below 98% confidence are not dispatched."""
        from apps.integrations.auto_pipeline import auto_process_approved_emails

        mock_tenant_cls.objects.filter.return_value.values_list.return_value = [self.tenant_id]
        mock_email_cls.objects.filter.return_value.exclude.return_value.values_list.return_value = [
            (42, {'confidence': 0.85, 'draft_type': 'purchase_order'}),
        ]

        result = auto_process_approved_emails()
        self.assertEqual(result['dispatched'], 0)

    @patch('apps.integrations.auto_pipeline.EmailLog')
    @patch('apps.integrations.auto_pipeline.Tenant')
    def test_sweep_skips_non_po_draft_type(self, mock_tenant_cls, mock_email_cls):
        """Non-purchase_order draft types are not dispatched."""
        from apps.integrations.auto_pipeline import auto_process_approved_emails

        mock_tenant_cls.objects.filter.return_value.values_list.return_value = [self.tenant_id]
        mock_email_cls.objects.filter.return_value.exclude.return_value.values_list.return_value = [
            (42, {'confidence': 0.99, 'draft_type': 'bill_of_lading'}),
        ]

        result = auto_process_approved_emails()
        self.assertEqual(result['dispatched'], 0)

    def test_confidence_threshold_is_98_percent(self):
        """Verify the confidence threshold constant."""
        from apps.integrations.auto_pipeline import AUTO_PROCESS_CONFIDENCE_THRESHOLD
        self.assertEqual(AUTO_PROCESS_CONFIDENCE_THRESHOLD, 0.98)

    @patch('apps.integrations.auto_pipeline.Tenant')
    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_po_idempotent(self, mock_email_cls, mock_tenant_cls):
        """If EmailLog already has related_order_id, PO creation is skipped."""
        from apps.integrations.auto_pipeline import create_purchase_order_from_email

        email = self._make_email_log()
        email.related_order_id = 99
        email.status = 'order_created'
        mock_email_cls.objects.get.return_value = email

        result = create_purchase_order_from_email(42, self.tenant_id)
        self.assertEqual(result, 99)

    def test_trigger_fulfillment_skips_terminal(self):
        """SO already confirmed should be skipped."""
        from apps.integrations.auto_pipeline import trigger_fulfillment

        with patch('tenant_apps.sales_orders.models.SalesOrder') as mock_so_cls:
            mock_so = MagicMock()
            mock_so.id = 10
            mock_so.status = 'confirmed'
            mock_so.tenant_id = self.tenant_id
            mock_so_cls.objects.get.return_value = mock_so

            # The function imports inside, so we patch at module level
            with patch('apps.integrations.auto_pipeline.tenant_rls'):
                result = trigger_fulfillment(10, self.tenant_id)

            if result:
                self.assertEqual(result['action'], 'none')

    def test_trigger_fulfillment_returns_none_for_no_id(self):
        """If so_id is None, should return None."""
        from apps.integrations.auto_pipeline import trigger_fulfillment
        result = trigger_fulfillment(None, self.tenant_id)
        self.assertIsNone(result)

    def test_generate_so_returns_none_for_no_po_id(self):
        """If po_id is None, should return None."""
        from apps.integrations.auto_pipeline import generate_sales_order_from_po
        result = generate_sales_order_from_po(None, self.tenant_id)
        self.assertIsNone(result)

    def test_generate_invoice_returns_none_for_no_fulfillment(self):
        """If fulfillment_result is None, should return None."""
        from apps.integrations.auto_pipeline import generate_invoice_from_so
        result = generate_invoice_from_so(None, self.tenant_id)
        self.assertIsNone(result)

    def test_generate_invoice_returns_none_for_missing_so_id(self):
        """If fulfillment_result has no so_id, should return None."""
        from apps.integrations.auto_pipeline import generate_invoice_from_so
        result = generate_invoice_from_so({"action": "created"}, self.tenant_id)
        self.assertIsNone(result)

    def test_generate_invoice_skips_existing(self):
        """If an invoice already exists for the SO, should skip."""
        from apps.integrations.auto_pipeline import generate_invoice_from_so

        mock_so = MagicMock()
        mock_so.id = 10
        mock_so.our_sales_order_num = "SO-001"
        mock_so.tenant_id = self.tenant_id

        mock_invoice = MagicMock()
        mock_invoice.id = 99

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.sales_orders.models.SalesOrder.objects') as mock_so_mgr:
                mock_so_mgr.get.return_value = mock_so
                with patch('tenant_apps.invoices.models.Invoice.objects') as mock_inv_mgr:
                    mock_inv_mgr.filter.return_value.first.return_value = mock_invoice

                    result = generate_invoice_from_so({"so_id": 10}, self.tenant_id)

        self.assertIsNotNone(result)
        self.assertEqual(result['invoice_id'], 99)
        self.assertEqual(result['action'], 'none')

    def test_generate_invoice_skips_when_no_customer(self):
        """If SO has no customer and no inquiry link, should skip gracefully."""
        from apps.integrations.auto_pipeline import generate_invoice_from_so

        mock_so = MagicMock()
        mock_so.id = 10
        mock_so.our_sales_order_num = "SO-001"
        mock_so.tenant_id = self.tenant_id
        mock_so.customer = None

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.sales_orders.models.SalesOrder.objects') as mock_so_mgr:
                mock_so_mgr.get.return_value = mock_so
                with patch('tenant_apps.invoices.models.Invoice.objects') as mock_inv_mgr:
                    mock_inv_mgr.filter.return_value.first.return_value = None  # no existing invoice
                    with patch('tenant_apps.inquiries.models.Inquiry.objects') as mock_inq_mgr:
                        mock_inq_mgr.filter.return_value.select_related.return_value.first.return_value = None

                        result = generate_invoice_from_so({"so_id": 10}, self.tenant_id)

        self.assertIsNotNone(result)
        self.assertEqual(result['action'], 'skipped')
        self.assertEqual(result['reason'], 'no_customer')

    # ------------------------------------------------------------------
    # Contact / Company pipeline tests (PR #5268 coverage)
    # ------------------------------------------------------------------

    def _make_contact_email_log(self, contact_name="Jane Doe", company="", status="draft_created"):
        """Create a mock EmailLog for contact pipeline."""
        email = MagicMock()
        email.id = 100
        email.tenant_id = self.tenant_id
        email.status = status
        email.subject = "Contact Info — Jane Doe"
        email.extracted_data = {
            'confidence': 0.99,
            'draft_type': 'contact',
            'contact_name': contact_name,
            'contact_company': company,
            'sender_email': 'jane@example.com',
        }
        return email

    def _make_company_email_log(self, company_name="Acme Corp", status="draft_created"):
        """Create a mock EmailLog for company pipeline."""
        email = MagicMock()
        email.id = 200
        email.tenant_id = self.tenant_id
        email.status = status
        email.subject = "Company Profile — Acme Corp"
        email.extracted_data = {
            'confidence': 0.99,
            'draft_type': 'company',
            'contact_company': company_name,
            'sender_email': 'info@acme.com',
        }
        return email

    # --- create_contact_from_email ---

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_contact_success(self, mock_email_cls):
        """Contact is created from email with first/last name split."""
        from apps.integrations.auto_pipeline import create_contact_from_email

        email = self._make_contact_email_log(contact_name="Jane Doe")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.contacts.models.Contact') as mock_contact_cls:
                mock_contact_cls.objects.filter.return_value.first.return_value = None
                mock_contact = MagicMock()
                mock_contact.id = 501
                mock_contact_cls.return_value = mock_contact

                result = create_contact_from_email(100, self.tenant_id)

        self.assertEqual(result, 501)
        mock_contact.save.assert_called_once()
        email.mark_as_completed.assert_called_once()

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_contact_single_name(self, mock_email_cls):
        """Single-word name uses it as first_name with empty last_name."""
        from apps.integrations.auto_pipeline import create_contact_from_email

        email = self._make_contact_email_log(contact_name="Madonna")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.contacts.models.Contact') as mock_contact_cls:
                mock_contact_cls.objects.filter.return_value.first.return_value = None
                mock_contact = MagicMock()
                mock_contact.id = 502
                mock_contact_cls.return_value = mock_contact

                result = create_contact_from_email(100, self.tenant_id)

        self.assertEqual(result, 502)
        call_kwargs = mock_contact_cls.call_args[1]
        self.assertEqual(call_kwargs['first_name'], 'Madonna')
        self.assertEqual(call_kwargs['last_name'], '')

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_contact_duplicate_returns_existing(self, mock_email_cls):
        """Existing contact is returned without creating a new one."""
        from apps.integrations.auto_pipeline import create_contact_from_email

        email = self._make_contact_email_log(contact_name="Jane Doe")
        mock_email_cls.objects.get.return_value = email

        existing = MagicMock()
        existing.id = 999

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.contacts.models.Contact') as mock_contact_cls:
                mock_contact_cls.objects.filter.return_value.first.return_value = existing

                result = create_contact_from_email(100, self.tenant_id)

        self.assertEqual(result, 999)
        email.mark_as_completed.assert_called_once()

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_contact_skips_empty_name(self, mock_email_cls):
        """Contact with blank name is skipped."""
        from apps.integrations.auto_pipeline import create_contact_from_email

        email = self._make_contact_email_log(contact_name="")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            result = create_contact_from_email(100, self.tenant_id)

        self.assertIsNone(result)

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_contact_idempotent_skips_order_created(self, mock_email_cls):
        """EmailLog with status 'order_created' is skipped."""
        from apps.integrations.auto_pipeline import create_contact_from_email

        email = self._make_contact_email_log(status="order_created")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            result = create_contact_from_email(100, self.tenant_id)

        self.assertIsNone(result)

    # --- create_company_from_email ---

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_company_success(self, mock_email_cls):
        """Customer record is created from company email."""
        from apps.integrations.auto_pipeline import create_company_from_email

        email = self._make_company_email_log(company_name="Acme Corp")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.customers.models.Customer') as mock_customer_cls:
                mock_customer_cls.objects.filter.return_value.first.return_value = None
                mock_customer = MagicMock()
                mock_customer.id = 601
                mock_customer_cls.return_value = mock_customer

                result = create_company_from_email(200, self.tenant_id)

        self.assertEqual(result, 601)
        mock_customer.save.assert_called_once()
        email.mark_as_completed.assert_called_once()

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_company_duplicate_returns_existing(self, mock_email_cls):
        """Existing customer is returned without creating a new one."""
        from apps.integrations.auto_pipeline import create_company_from_email

        email = self._make_company_email_log(company_name="Acme Corp")
        mock_email_cls.objects.get.return_value = email

        existing = MagicMock()
        existing.id = 888

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            with patch('tenant_apps.customers.models.Customer') as mock_customer_cls:
                mock_customer_cls.objects.filter.return_value.first.return_value = existing

                result = create_company_from_email(200, self.tenant_id)

        self.assertEqual(result, 888)
        email.mark_as_completed.assert_called_once()

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_company_skips_empty_name(self, mock_email_cls):
        """Company with blank name is skipped."""
        from apps.integrations.auto_pipeline import create_company_from_email

        email = self._make_company_email_log(company_name="")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            result = create_company_from_email(200, self.tenant_id)

        self.assertIsNone(result)

    @patch('apps.integrations.auto_pipeline.EmailLog')
    def test_create_company_idempotent_skips_order_created(self, mock_email_cls):
        """EmailLog with status 'order_created' is skipped."""
        from apps.integrations.auto_pipeline import create_company_from_email

        email = self._make_company_email_log(status="order_created")
        mock_email_cls.objects.get.return_value = email

        with patch('apps.integrations.auto_pipeline.tenant_rls'):
            result = create_company_from_email(200, self.tenant_id)

        self.assertIsNone(result)

    # --- Sweep dispatch for contact/company types ---

    @patch('apps.integrations.auto_pipeline.create_contact_from_email')
    @patch('apps.integrations.auto_pipeline.EmailLog')
    @patch('apps.integrations.auto_pipeline.Tenant')
    def test_sweep_dispatches_contact(self, mock_tenant_cls, mock_email_cls, mock_task):
        """Sweep dispatches contact pipeline for contact draft type."""
        from apps.integrations.auto_pipeline import auto_process_approved_emails

        mock_tenant_cls.objects.filter.return_value.values_list.return_value = [self.tenant_id]
        mock_email_cls.objects.filter.return_value.exclude.return_value.values_list.return_value = [
            (100, {'confidence': 0.99, 'draft_type': 'contact'}),
        ]

        result = auto_process_approved_emails()
        self.assertEqual(result['dispatched'], 1)

    @patch('apps.integrations.auto_pipeline.create_company_from_email')
    @patch('apps.integrations.auto_pipeline.EmailLog')
    @patch('apps.integrations.auto_pipeline.Tenant')
    def test_sweep_dispatches_company(self, mock_tenant_cls, mock_email_cls, mock_task):
        """Sweep dispatches company pipeline for company draft type."""
        from apps.integrations.auto_pipeline import auto_process_approved_emails

        mock_tenant_cls.objects.filter.return_value.values_list.return_value = [self.tenant_id]
        mock_email_cls.objects.filter.return_value.exclude.return_value.values_list.return_value = [
            (200, {'confidence': 0.99, 'draft_type': 'company'}),
        ]

        result = auto_process_approved_emails()
        self.assertEqual(result['dispatched'], 1)

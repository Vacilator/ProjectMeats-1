from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from unittest.mock import patch

from apps.integrations.inquiry_drafts import upsert_inquiry_draft_from_email
from apps.integrations.models import EmailLog, EmailReviewDraft, ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser
from apps.system.models import Product
from tenant_apps.inquiries.models import Inquiry, InquiryEntityTypeChoices, InquirySourceChoices
from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem
from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.ai_assistant.tasks.watchdog import sync_ai_feedback_queue_for_tenant
from tenant_apps.workflows.models import UserNotification


class EmailReviewDraftSignalTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='draft-owner', password='pass123')
        self.tenant = Tenant.objects.create(
            name='Draft Tenant',
            slug='draft-tenant',
            contact_email='draft@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)
        self.provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            is_active=True,
            connected_email='ops@example.com',
            token_expiry=timezone.now(),
        )
        self.provider.set_encrypted_token('access', 'access-token')
        self.provider.set_encrypted_token('refresh', 'refresh-token')
        self.provider.save()

    @patch('apps.integrations.signals.classify_ingested_email')
    def test_actionable_email_creates_review_draft_and_notification(self, classify_ingested_email):
        classify_ingested_email.return_value = {
            'category': 'Purchase Order',
            'draft_type': 'purchase_order',
            'confidence': 0.91,
            'summary': 'Potential PO from accounting@nameats.com',
            'rationale': 'Contains PO terms and line-item request language.',
            'actionable': True,
        }

        email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id='graph-message-1',
            thread_id='thread-1',
            subject='PO for ribeye delivery',
            sender_email='accounting@nameats.com',
            sender_name='Accounting',
            received_at=timezone.now(),
            body_text='Please confirm PO 12345 for ribeye delivery.',
            body_html='',
            has_attachments=True,
            attachment_count=1,
            status='logged',
        )

        email_log.refresh_from_db()
        draft = EmailReviewDraft.objects.get(email_log=email_log)
        notification = UserNotification.objects.get(tenant=self.tenant, user=self.user)

        self.assertEqual(email_log.status, 'draft_created')
        self.assertEqual(draft.draft_type, 'purchase_order')
        self.assertEqual(notification.entity_id, draft.id)
        self.assertEqual(notification.action_url, f'/my-tasks?tab=ai-review&draft={draft.id}')

    @patch('apps.integrations.signals.classify_ingested_email')
    def test_demand_email_creates_draft_inquiry_with_lineage(self, classify_ingested_email):
        classify_ingested_email.return_value = {
            'category': 'Purchase Order',
            'draft_type': 'purchase_order',
            'confidence': 0.91,
            'summary': 'Customer is requesting boneless ribeye.',
            'rationale': 'Inbound demand language with requested quantity and delivery timeline.',
            'actionable': True,
            'inquiry_candidate': True,
            'contact_name': 'Alex Buyer',
            'contact_company': 'North Meats',
            'requested_product_name': 'Boneless Ribeye',
            'requested_protein': 'Beef',
            'requested_quantity': '40000',
            'requested_uom': 'lbs',
        }

        email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id='graph-message-inquiry-1',
            thread_id='thread-inquiry-1',
            subject='Need boneless ribeye for next week',
            sender_email='buyer@northmeats.com',
            sender_name='Alex Buyer',
            received_at=timezone.now(),
            body_text='Please quote 40,000 lbs boneless ribeye for next week.',
            body_html='',
            has_attachments=False,
            attachment_count=0,
            status='logged',
        )

        email_log.refresh_from_db()
        inquiry = Inquiry.objects.get(tenant=self.tenant, source_email=email_log)
        draft = EmailReviewDraft.objects.get(email_log=email_log)

        self.assertEqual(inquiry.status, Inquiry._meta.get_field('status').default)
        self.assertEqual(inquiry.source_type, InquirySourceChoices.EMAIL)
        self.assertEqual(inquiry.entity_type, InquiryEntityTypeChoices.CUSTOMER)
        self.assertEqual(inquiry.contact_name, 'Alex Buyer')
        self.assertEqual(inquiry.contact_email, 'buyer@northmeats.com')
        self.assertEqual(inquiry.contact_company, 'North Meats')
        self.assertEqual(inquiry.requested_protein, 'Beef')
        self.assertEqual(inquiry.route_decision, 'BROKER')
        self.assertEqual(inquiry.source_email_message_id, 'graph-message-inquiry-1')
        self.assertEqual(inquiry.source_email_thread_id, 'thread-inquiry-1')
        self.assertEqual(
            inquiry.custom_data['email_intake']['requested_product_name'],
            'Boneless Ribeye',
        )
        self.assertEqual(email_log.extracted_data['inquiry_id'], str(inquiry.id))
        self.assertEqual(draft.extracted_payload['inquiry_number'], inquiry.inquiry_number)

    @patch('apps.integrations.signals.classify_ingested_email')
    def test_bol_email_does_not_create_inquiry_draft(self, classify_ingested_email):
        classify_ingested_email.return_value = {
            'category': 'BOL',
            'draft_type': 'bill_of_lading',
            'confidence': 0.88,
            'summary': 'Carrier sent a signed BOL.',
            'rationale': 'Shipping document only; no inbound demand request.',
            'actionable': True,
            'inquiry_candidate': False,
            'contact_name': '',
            'contact_company': '',
            'requested_product_name': '',
            'requested_protein': '',
            'requested_quantity': '',
            'requested_uom': '',
        }

        email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id='graph-message-bol-1',
            thread_id='thread-bol-1',
            subject='Signed BOL attached',
            sender_email='carrier@example.com',
            sender_name='Carrier Ops',
            received_at=timezone.now(),
            body_text='Attached is the signed BOL.',
            body_html='',
            has_attachments=True,
            attachment_count=1,
            status='logged',
        )

        self.assertFalse(Inquiry.objects.filter(tenant=self.tenant, source_email=email_log).exists())
        self.assertTrue(EmailReviewDraft.objects.filter(email_log=email_log).exists())

    def test_upsert_inquiry_draft_updates_existing_row_without_duplicate(self):
        email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id='graph-message-existing-1',
            thread_id='thread-existing-1',
            subject='Need fresh pork belly',
            sender_email='buyer@repeatcustomer.com',
            sender_name='Repeat Buyer',
            received_at=timezone.now(),
            body_text='Please quote pork belly.',
            body_html='',
            has_attachments=False,
            attachment_count=0,
            status='action_required',
        )
        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            status='pending',
            source_type='email',
            source_email=email_log,
            entity_type='customer',
            contact_email='buyer@repeatcustomer.com',
            notes='Keep my manual note.',
        )
        system_product = Product.objects.create(
            product_code='PORK-BELLY-INQUIRY-DRAFT',
            name='Pork Belly',
            protein_type='pork',
            category='PORK',
        )
        master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein='Pork',
            item_name='Belly',
            type='flat',
            trim='trimmed',
            system_product=system_product,
        )
        supplier = Supplier.objects.create(tenant=self.tenant, name='Repeat Supplier')
        SupplierAvailableItem.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            product=system_product,
            is_active=True,
        )
        inquiry.requested_master_product = master_product
        inquiry.requested_protein = 'Pork'
        inquiry.save(update_fields=['requested_master_product', 'requested_protein'])

        result, created = upsert_inquiry_draft_from_email(
            email_log,
            {
                'category': 'Purchase Order',
                'draft_type': 'purchase_order',
                'confidence': 0.81,
                'summary': 'Repeat buyer needs belly.',
                'rationale': 'Demand request.',
                'actionable': True,
                'inquiry_candidate': True,
                'contact_name': 'Repeat Buyer',
                'contact_company': 'Repeat Customer',
                'requested_product_name': 'Pork Belly',
                'requested_protein': 'Pork',
                'requested_quantity': '12000',
                'requested_uom': 'lbs',
            },
        )

        self.assertFalse(created)
        self.assertEqual(result.id, inquiry.id)
        self.assertEqual(result.status, 'pending')
        self.assertEqual(result.notes, 'Keep my manual note.')
        self.assertEqual(result.requested_protein, 'Pork')
        self.assertEqual(result.route_decision, 'FULFILL')
        self.assertEqual(
            Inquiry.objects.filter(tenant=self.tenant, source_email=email_log).count(),
            1,
        )

    @patch('tenant_apps.ai_assistant.tasks.watchdog.broadcast_ai_inbox_event')
    @patch('apps.integrations.signals.classify_ingested_email')
    def test_watchdog_sync_mirrors_pending_drafts_into_ai_feedback(self, classify_ingested_email, broadcast_ai_inbox_event):
        classify_ingested_email.return_value = {
            'category': 'Purchase Order',
            'draft_type': 'purchase_order',
            'confidence': 0.73,
            'summary': 'Potential PO from accounting@nameats.com',
            'rationale': 'Contains PO terms and line-item request language.',
            'actionable': True,
            'inquiry_candidate': True,
            'contact_name': '',
            'contact_company': '',
            'requested_product_name': '',
            'requested_protein': '',
            'requested_quantity': '',
            'requested_uom': '',
        }

        email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id='graph-message-2',
            thread_id='thread-2',
            subject='PO for striploin delivery',
            sender_email='accounting@nameats.com',
            sender_name='Accounting',
            received_at=timezone.now(),
            body_text='Please confirm PO 54321 for striploin delivery.',
            body_html='',
            has_attachments=True,
            attachment_count=1,
            status='logged',
        )

        draft = EmailReviewDraft.objects.get(email_log=email_log)

        summary = sync_ai_feedback_queue_for_tenant(str(self.tenant.id))

        feedback = AIFeedbackLog.objects.get(tenant=self.tenant, document_id=draft.id)
        self.assertEqual(feedback.document_type, 'purchase_order')
        self.assertEqual(summary['feedback_logs_created'], 1)
        self.assertEqual(summary['unread_count'], 1)
        broadcast_ai_inbox_event.assert_called_once()

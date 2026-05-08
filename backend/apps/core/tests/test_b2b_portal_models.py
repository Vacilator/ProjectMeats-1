"""Regression coverage for the B2B portal grant/document schema."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.core.models import PortalDocumentReference, PortalGrant, PortalGrantDocumentAccess
from apps.core.serializers import (
    PortalDocumentReferencePublicSerializer,
    PortalDocumentReferenceSerializer,
    PortalGrantDocumentAccessSerializer,
    PortalGrantSerializer,
)
from apps.tenants.models import Tenant

User = get_user_model()


class B2BPortalSchemaTest(TestCase):
    """Keep the B2B-01.2 portal schema fail-closed and tenant-explicit."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="portal-owner",
            email="portal-owner@example.com",
            password="portal-pass-123",
        )
        self.tenant = Tenant.objects.create(
            name="Portal Foods",
            slug="portal-foods",
            contact_email="ops@portal-foods.example.com",
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name="Other Foods",
            slug="other-foods",
            contact_email="ops@other-foods.example.com",
            created_by=self.user,
        )

    def _build_grant(self, **overrides):
        grant = PortalGrant(
            tenant=overrides.pop("tenant", self.tenant),
            subject_email=overrides.pop("subject_email", "counterparty@example.com"),
            resource_scope=overrides.pop("resource_scope", {"invoice": ["inv-001"]}),
            document_sources=overrides.pop("document_sources", ["invoice_summary"]),
            expires_at=overrides.pop("expires_at", timezone.now() + timedelta(days=2)),
            created_by=overrides.pop("created_by", self.user),
            max_uses=overrides.pop("max_uses", 1),
            use_count=overrides.pop("use_count", 0),
            status=overrides.pop("status", PortalGrant.Status.ACTIVE),
            revoked_at=overrides.pop("revoked_at", None),
            revoked_by=overrides.pop("revoked_by", None),
            revoked_reason=overrides.pop("revoked_reason", ""),
        )
        raw_token = overrides.pop("raw_token", "portal-secret-token")
        grant.issue_token(raw_token)
        return grant

    def test_portal_grant_hashes_tokens_at_rest(self):
        grant = self._build_grant()
        grant.save()

        self.assertEqual(len(grant.token_hash), 64)
        self.assertNotEqual(grant.token_hash, "portal-secret-token")
        self.assertTrue(grant.token_matches("portal-secret-token"))
        self.assertFalse(grant.token_matches("bad-token"))

    def test_portal_grant_activity_respects_ttl_revocation_and_use_limit(self):
        active_grant = self._build_grant(max_uses=2)
        self.assertTrue(active_grant.is_active)

        expired_grant = self._build_grant(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertTrue(expired_grant.is_expired)
        self.assertFalse(expired_grant.is_active)

        revoked_grant = self._build_grant(revoked_at=timezone.now(), revoked_by=self.user)
        self.assertFalse(revoked_grant.is_active)

        consumed_grant = self._build_grant(max_uses=1, use_count=1)
        self.assertFalse(consumed_grant.is_active)

    def test_mark_accessed_consumes_one_time_grants(self):
        grant = self._build_grant(max_uses=1)

        grant.mark_accessed()

        self.assertEqual(grant.use_count, 1)
        self.assertEqual(grant.status, PortalGrant.Status.CONSUMED)
        self.assertIsNotNone(grant.last_accessed_at)

    def test_portal_grant_serializer_rejects_unknown_scope_and_document_sources(self):
        serializer = PortalGrantSerializer(
            data={
                "subject_email": "counterparty@example.com",
                "resource_scope": {"unknown_entity": ["abc"]},
                "document_sources": ["invoice_summary", "bad_source"],
                "expires_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "created_by": self.user.pk,
                "max_uses": 1,
            },
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("resource_scope", serializer.errors)
        self.assertIn("document_sources", serializer.errors)

    def test_portal_grant_serializer_hashes_token_on_save(self):
        serializer = PortalGrantSerializer(
            data={
                "subject_email": "counterparty@example.com",
                "raw_token": "issued-from-serializer",
                "resource_scope": {"invoice": ["inv-001"]},
                "document_sources": ["invoice_summary"],
                "expires_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "created_by": self.user.pk,
                "max_uses": 1,
            },
            context={"tenant": self.tenant},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        grant = serializer.save()

        self.assertEqual(len(grant.token_hash), 64)
        self.assertTrue(grant.token_matches("issued-from-serializer"))

    def test_portal_grant_serializer_requires_raw_token(self):
        serializer = PortalGrantSerializer(
            data={
                "subject_email": "counterparty@example.com",
                "resource_scope": {"invoice": ["inv-001"]},
                "document_sources": ["invoice_summary"],
                "expires_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "created_by": self.user.pk,
                "max_uses": 1,
            },
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("raw_token", serializer.errors)

    def test_portal_grant_serializer_requires_scope_and_document_sources(self):
        serializer = PortalGrantSerializer(
            data={
                "subject_email": "counterparty@example.com",
                "raw_token": "issued-from-serializer",
                "expires_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "created_by": self.user.pk,
                "max_uses": 1,
            },
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("resource_scope", serializer.errors)
        self.assertIn("document_sources", serializer.errors)

    def test_portal_grant_serializer_rejects_tenant_reparenting(self):
        grant = self._build_grant()
        grant.save()
        serializer = PortalGrantSerializer(
            instance=grant,
            data={"tenant": str(self.other_tenant.id), "max_uses": 2},
            partial=True,
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("tenant", serializer.errors)

    def test_document_reference_serializer_binds_tenant_from_context(self):
        serializer = PortalDocumentReferenceSerializer(
            data={
                "tenant": str(self.other_tenant.id),
                "source_kind": PortalDocumentReference.SourceKind.INVOICE_SUMMARY,
                "source_record_type": "invoice",
                "source_record_id": "inv-001",
                "display_name": "Invoice Summary",
                "metadata": {
                    "document_number": "INV-001",
                    "download": "s3://tenant-private/invoice-001.json",
                },
                "storage_key": "tenants/portal-foods/invoices/invoice-001.json",
            },
            context={"tenant": self.tenant},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        reference = serializer.save(created_by=self.user)

        self.assertEqual(reference.tenant_id, self.tenant.id)
        self.assertEqual(reference.metadata, {"document_number": "INV-001"})

    def test_document_reference_serializer_rejects_tenant_reparenting(self):
        reference = PortalDocumentReference.objects.create(
            tenant=self.tenant,
            source_kind=PortalDocumentReference.SourceKind.INVOICE_PDF,
            source_record_type="invoice",
            source_record_id="inv-001",
            display_name="Invoice 001",
            storage_key="tenants/portal-foods/invoices/invoice-001.pdf",
        )
        serializer = PortalDocumentReferenceSerializer(
            instance=reference,
            data={"tenant": str(self.other_tenant.id), "display_name": "Moved"},
            partial=True,
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("tenant", serializer.errors)

    def test_public_document_serializer_omits_internal_storage_fields(self):
        reference = PortalDocumentReference.objects.create(
            tenant=self.tenant,
            source_kind=PortalDocumentReference.SourceKind.INVOICE_PDF,
            source_record_type="invoice",
            source_record_id="inv-001",
            display_name="Invoice 001",
            original_filename="invoice-001.pdf",
            mime_type="application/pdf",
            byte_size=2048,
            checksum="abc123",
            storage_backend="s3",
            storage_key="tenants/portal-foods/invoices/invoice-001.pdf",
            metadata={
                "document_number": "INV-001",
                "status": "posted",
                "note": "tenants/portal-foods/invoices/invoice-001.pdf",
                "download": "s3://tenant-private/invoice-001.pdf",
                "storage_path": "tenants/portal-foods/invoices/invoice-001.pdf",
            },
            created_by=self.user,
        )

        payload = PortalDocumentReferencePublicSerializer(reference).data

        self.assertIn("display_name", payload)
        self.assertEqual(payload["metadata"], {"document_number": "INV-001", "status": "posted"})
        self.assertNotIn("storage_backend", payload)
        self.assertNotIn("storage_key", payload)
        self.assertNotIn("checksum", payload)

    def test_grant_document_link_rejects_cross_tenant_references(self):
        grant = self._build_grant()
        grant.save()
        reference = PortalDocumentReference.objects.create(
            tenant=self.other_tenant,
            source_kind=PortalDocumentReference.SourceKind.FULFILLMENT_POD,
            source_record_type="fulfillment",
            source_record_id="ful-009",
            display_name="POD 009",
            storage_key="tenants/other-foods/pod-009.pdf",
        )

        with self.assertRaises(ValidationError):
            PortalGrantDocumentAccess.objects.create(
                tenant=self.tenant,
                grant=grant,
                document_reference=reference,
                linked_by=self.user,
            )

    def test_grant_document_access_serializer_rejects_cross_tenant_create(self):
        grant = self._build_grant()
        grant.save()
        reference = PortalDocumentReference.objects.create(
            tenant=self.other_tenant,
            source_kind=PortalDocumentReference.SourceKind.FULFILLMENT_POD,
            source_record_type="fulfillment",
            source_record_id="ful-010",
            display_name="POD 010",
            storage_key="tenants/other-foods/pod-010.pdf",
        )
        serializer = PortalGrantDocumentAccessSerializer(
            data={
                "grant": str(grant.id),
                "document_reference": str(reference.id),
                "sort_order": 0,
            },
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("document_reference", serializer.errors)

    def test_grant_document_access_serializer_uses_none_queryset_without_tenant_context(self):
        serializer = PortalGrantDocumentAccessSerializer()

        self.assertEqual(serializer.fields["grant"].queryset.count(), 0)
        self.assertEqual(serializer.fields["document_reference"].queryset.count(), 0)

    def test_grant_document_access_serializer_rejects_cross_tenant_update(self):
        grant = self._build_grant()
        grant.save()
        safe_reference = PortalDocumentReference.objects.create(
            tenant=self.tenant,
            source_kind=PortalDocumentReference.SourceKind.INVOICE_PDF,
            source_record_type="invoice",
            source_record_id="inv-001",
            display_name="Invoice 001",
            storage_key="tenants/portal-foods/invoices/invoice-001.pdf",
        )
        link = PortalGrantDocumentAccess.objects.create(
            tenant=self.tenant,
            grant=grant,
            document_reference=safe_reference,
            linked_by=self.user,
        )
        other_reference = PortalDocumentReference.objects.create(
            tenant=self.other_tenant,
            source_kind=PortalDocumentReference.SourceKind.FULFILLMENT_BOL,
            source_record_type="fulfillment",
            source_record_id="ful-011",
            display_name="BOL 011",
            storage_key="tenants/other-foods/bol-011.pdf",
        )
        serializer = PortalGrantDocumentAccessSerializer(
            instance=link,
            data={"document_reference": str(other_reference.id)},
            partial=True,
            context={"tenant": self.tenant},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("document_reference", serializer.errors)

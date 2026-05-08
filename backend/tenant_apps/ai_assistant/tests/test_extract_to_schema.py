"""Tests for serializer-backed AI document extraction."""

from __future__ import annotations

import json
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.test import APITestCase

if "tenant_apps.ai_assistant" not in settings.INSTALLED_APPS:
    raise unittest.SkipTest("tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings")

from tenant_apps.ai_assistant.models import AIDocument
from tenant_apps.ai_assistant.services.extract_to_schema import (
    ExtractedSchemaDraft,
    build_json_schema_from_serializer,
    extract_document_to_schema,
)
from tenant_apps.purchase_orders.serializers import PurchaseOrderSerializer
from tenant_apps.suppliers.models import Supplier

from apps.tenants.models import Tenant, TenantUser


def _completion_with_json(payload: dict) -> SimpleNamespace:
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])


class ExtractToSchemaSchemaTests(TestCase):
    def test_build_json_schema_includes_nested_item_enums(self):
        schema = build_json_schema_from_serializer(PurchaseOrderSerializer())

        self.assertEqual(schema["type"], "object")
        self.assertIn("items", schema["properties"])
        items_schema = schema["properties"]["items"]
        self.assertEqual(items_schema["type"], "array")
        protein_schema = items_schema["items"]["properties"]["protein_type"]
        self.assertEqual(protein_schema["type"], "string")
        self.assertIn("Beef", protein_schema["enum"])
        self.assertIn("Chicken", protein_schema["enum"])


class ExtractToSchemaServiceTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"extract-user-{unique}",
            email=f"extract-user-{unique}@example.com",
            password="pw",
        )
        self.tenant = Tenant.objects.create(
            name=f"Extract Tenant {unique}",
            slug=f"extract-tenant-{unique}",
            contact_email=f"extract-{unique}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.supplier = Supplier.objects.create(tenant=self.tenant, name=f"Supplier {unique}")
        self.document = AIDocument.objects.create(
            tenant=self.tenant,
            owner=self.user,
            original_filename="supplier-po.pdf",
            content_type="application/pdf",
            file_size=16,
            file=SimpleUploadedFile("supplier-po.pdf", b"%PDF-1.4\n% test\n", content_type="application/pdf"),
            custom_data={},
        )

    @override_settings(OPENAI_API_KEY="test-openai-key")
    @patch("tenant_apps.ai_assistant.services.extract_to_schema.ToolExecutor._parse_document")
    @patch("openai.OpenAI")
    def test_extract_document_to_schema_returns_validated_payload(
        self,
        mock_openai,
        mock_parse_document,
    ):
        mock_parse_document.return_value = {
            "text": "Purchase Order PO-18132\nVendor: ACME\nQuantity: 40000 lbs",
            "parser": "unstructured",
            "warnings": ["Elements truncated"],
        }
        mock_openai.return_value.chat.completions.create.return_value = _completion_with_json(
            {
                "supplier": str(self.supplier.id),
                "order_date": "2026-04-30",
                "payment_terms": "Wire",
                "items": [
                    {
                        "protein_type": "Beef",
                        "quantity": 40000,
                        "uom": "LBS",
                    }
                ],
            }
        )

        result = extract_document_to_schema(
            document=self.document,
            entity_type="purchase_order",
            tenant=self.tenant,
            user=self.user,
        )

        self.assertEqual(result.entity_type, "purchase_order")
        self.assertEqual(result.parser, "unstructured")
        self.assertEqual(result.data["supplier"], str(self.supplier.id))
        self.assertEqual(result.data["payment_terms"], "Wire")
        self.assertEqual(result.data["items"][0]["protein_type"], "Beef")
        self.assertEqual(result.data["items"][0]["uom"], "LBS")

    @override_settings(OPENAI_API_KEY="test-openai-key")
    @patch("tenant_apps.ai_assistant.services.extract_to_schema.ToolExecutor._parse_document")
    @patch("openai.OpenAI")
    def test_extract_document_to_schema_rejects_invalid_enum_values(
        self,
        mock_openai,
        mock_parse_document,
    ):
        mock_parse_document.return_value = {
            "text": "Purchase Order",
            "parser": "unstructured",
            "warnings": [],
        }
        mock_openai.return_value.chat.completions.create.return_value = _completion_with_json(
            {
                "supplier": str(self.supplier.id),
                "items": [
                    {
                        "protein_type": "Camel",
                        "quantity": 10,
                        "uom": "LBS",
                    }
                ],
            }
        )

        with self.assertRaises(drf_serializers.ValidationError):
            extract_document_to_schema(
                document=self.document,
                entity_type="purchase_order",
                tenant=self.tenant,
                user=self.user,
            )


class ExtractToSchemaApiTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"extract-api-{unique}",
            email=f"extract-api-{unique}@example.com",
            password="pw",
        )
        self.other_user = User.objects.create_user(
            username=f"extract-api-other-{unique}",
            email=f"extract-api-other-{unique}@example.com",
            password="pw",
        )
        self.tenant = Tenant.objects.create(
            name=f"Extract API Tenant {unique}",
            slug=f"extract-api-tenant-{unique}",
            contact_email=f"extract-api-{unique}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.other_user, role="admin", is_active=True)
        self.document = AIDocument.objects.create(
            tenant=self.tenant,
            owner=self.user,
            original_filename="invoice.pdf",
            content_type="application/pdf",
            file_size=16,
            file=SimpleUploadedFile("invoice.pdf", b"%PDF-1.4\n% test\n", content_type="application/pdf"),
            custom_data={},
        )
        self.client.force_login(self.user)

    @patch("tenant_apps.ai_assistant.views.extract_document_to_schema")
    def test_extract_to_schema_endpoint_returns_validated_payload(self, mock_extract):
        mock_extract.return_value = ExtractedSchemaDraft(
            document=self.document,
            entity_type="invoice",
            serializer_name="InvoiceSerializer",
            parser="unstructured",
            model_name="gpt-4o-mini",
            warnings=["Elements truncated"],
            data={
                "customer": "123",
                "items": [{"protein_type": "Beef", "uom": "LBS"}],
            },
        )

        response = self.client.post(
            "/api/v1/ai-assistant/extract-to-schema/",
            data={
                "document_id": str(self.document.id),
                "entity_type": "invoice",
            },
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(response.data["entity_type"], "invoice")
        self.assertEqual(response.data["serializer_name"], "InvoiceSerializer")
        self.assertEqual(response.data["extracted_data"]["items"][0]["protein_type"], "Beef")

    def test_extract_to_schema_endpoint_is_owner_scoped(self):
        self.client.force_login(self.other_user)

        response = self.client.post(
            "/api/v1/ai-assistant/extract-to-schema/",
            data={
                "document_id": str(self.document.id),
                "entity_type": "invoice",
            },
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND, response.content)

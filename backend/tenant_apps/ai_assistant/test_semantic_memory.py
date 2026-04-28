import unittest
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
    raise unittest.SkipTest('tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings')

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.ai_assistant.models import AIDocument, AIDocumentChunk, TenantAIMemory
from tenant_apps.ai_assistant.services.semantic_indexing import index_document_for_semantic_search, sync_memory_embedding
from tenant_apps.ai_assistant.services.tenant_memory_service import find_semantic_context, get_relevant_memories


def _vector(value: float) -> list[float]:
    return [value] * 1536


def _basis_vector(index: int) -> list[float]:
    vector = [0.0] * 1536
    vector[index] = 1.0
    return vector


class SemanticMemoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='semantic-user', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Semantic Tenant',
            slug='semantic-tenant',
            contact_email='semantic@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

    def test_find_semantic_context_ranks_by_vector_distance(self):
        relevant = TenantAIMemory.objects.create(
            tenant=self.tenant,
            key='routing-preference',
            memory_text='Use refrigerated carriers for export shipments.',
            embedding=_basis_vector(0),
            embedding_vector=_basis_vector(0),
        )
        TenantAIMemory.objects.create(
            tenant=self.tenant,
            key='billing-preference',
            memory_text='Send invoices on Fridays.',
            embedding=_basis_vector(1),
            embedding_vector=_basis_vector(1),
        )

        with patch(
            'tenant_apps.ai_assistant.services.tenant_memory_service.generate_embedding',
            return_value=_basis_vector(0),
        ):
            results = find_semantic_context(tenant=self.tenant, query_string='carrier requirements', limit=2)

        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0].id, relevant.id)

    def test_get_relevant_memories_falls_back_to_keyword_overlap(self):
        memory = TenantAIMemory.objects.create(
            tenant=self.tenant,
            key='backorder-policy',
            memory_text='Prioritize backordered beef orders before spot loads.',
            embedding=[],
            embedding_vector=None,
        )

        with patch(
            'tenant_apps.ai_assistant.services.tenant_memory_service.generate_embedding',
            return_value=None,
        ):
            results = get_relevant_memories(tenant=self.tenant, query='backordered beef', limit=5)

        self.assertEqual([row.id for row in results], [memory.id])

    def test_sync_memory_embedding_updates_json_and_vector_fields(self):
        memory = TenantAIMemory.objects.create(
            tenant=self.tenant,
            key='doc-rule',
            memory_text='Always attach the BOL before settlement.',
        )

        with patch(
            'tenant_apps.ai_assistant.services.semantic_indexing.generate_embedding',
            return_value=_vector(0.5),
        ):
            sync_memory_embedding(memory)

        memory.refresh_from_db()
        self.assertEqual(len(memory.embedding), 1536)
        self.assertEqual(len(memory.embedding_vector), 1536)

    def test_index_document_for_semantic_search_creates_chunks(self):
        upload = SimpleUploadedFile(
            'parts.csv',
            b'Part,Status,Cost\nChuck,Backordered,10.50\nRibeye,Available,21.00\n',
            content_type='text/csv',
        )
        document = AIDocument.objects.create(
            tenant=self.tenant,
            owner=self.user,
            file=upload,
            original_filename='parts.csv',
            content_type='text/csv',
            file_size=upload.size,
        )

        with patch(
            'tenant_apps.ai_assistant.services.semantic_indexing.generate_embedding',
            return_value=_vector(0.33),
        ):
            created = index_document_for_semantic_search(document)

        self.assertEqual(created, 1)
        chunk = AIDocumentChunk.objects.get(document=document, chunk_index=0)
        self.assertIn('| Part | Status | Cost |', chunk.content)
        self.assertEqual(len(chunk.embedding_vector), 1536)

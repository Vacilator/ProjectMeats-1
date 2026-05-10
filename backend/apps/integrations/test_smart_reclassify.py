"""Tests for smart reclassification logic in ai_classification.py.

Validates that the post-classification layer correctly reclassifies
emails when the AI's initial category doesn't match the extracted data:
- "Contact Update" without a person name → "Company Update" if company present
- "Company Update" without a company name → "Contact Update" if person present
- Spam/Other with business signals → actionable category
"""

import json
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.integrations.ai_classification import classify_ingested_email


def _mock_openai_response(payload: dict) -> MagicMock:
    """Build a mock OpenAI ChatCompletion response."""
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    completion = MagicMock()
    completion.choices = [choice]
    return completion


class SmartReclassifyTests(TestCase):
    """Post-classification reclassification logic."""

    def _classify(self, ai_payload: dict) -> dict:
        with patch("apps.integrations.ai_classification.get_active_openai_model_id", return_value="gpt-4o-mini"):
            with patch("openai.OpenAI") as mock_cls:
                mock_client = MagicMock()
                mock_cls.return_value = mock_client
                mock_client.chat.completions.create.return_value = _mock_openai_response(ai_payload)
                with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
                    return classify_ingested_email(
                        subject="Test email",
                        sender_email="info@example.com",
                        body_text="Test body",
                        has_attachments=False,
                    )

    def _base_payload(self, **overrides) -> dict:
        base = {
            "category": "Contact Update",
            "confidence": 0.85,
            "summary": "Test summary",
            "rationale": "Test rationale",
            "actionable": True,
            "contact_name": "",
            "contact_company": "Acme Corp",
            "requested_product_name": "",
            "requested_protein": "",
            "requested_quantity": "",
            "requested_uom": "",
            "po_number": "",
            "bol_number": "",
            "total_amount": "",
            "attachment_document_types": [],
            "field_confidence": {
                "contact_name": 0.0,
                "contact_company": 0.9,
                "po_number": 0.0,
                "bol_number": 0.0,
                "total_amount": 0.0,
                "requested_product_name": 0.0,
                "requested_protein": 0.0,
                "requested_quantity": 0.0,
            },
        }
        base.update(overrides)
        return base

    def test_contact_without_name_reclassified_to_company(self):
        """Contact Update + no person name + company → Company Update."""
        payload = self._base_payload(
            category="Contact Update",
            contact_name="",
            contact_company="Acme Corp",
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Company Update")
        self.assertEqual(result["draft_type"], "company")
        self.assertIn("Reclassified", result["rationale"])

    def test_company_without_company_reclassified_to_contact(self):
        """Company Update + person name + no company → Contact Update."""
        payload = self._base_payload(
            category="Company Update",
            contact_name="John Smith",
            contact_company="",
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Contact Update")
        self.assertEqual(result["draft_type"], "contact")
        self.assertIn("Reclassified", result["rationale"])

    def test_contact_with_name_stays_contact(self):
        """Contact Update + person name → stays Contact Update."""
        payload = self._base_payload(
            category="Contact Update",
            contact_name="Jane Doe",
            contact_company="Acme Corp",
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Contact Update")
        self.assertEqual(result["draft_type"], "contact")

    def test_company_with_company_stays_company(self):
        """Company Update + company name → stays Company Update."""
        payload = self._base_payload(
            category="Company Update",
            contact_name="",
            contact_company="Acme Corp",
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Company Update")
        self.assertEqual(result["draft_type"], "company")

    def test_spam_with_company_reclassified_to_company(self):
        """Spam/Other + company name, no person → Company Update."""
        payload = self._base_payload(
            category="Spam/Other",
            contact_name="",
            contact_company="Acme Corp",
            actionable=False,
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Company Update")
        self.assertTrue(result["actionable"])

    def test_spam_with_contact_reclassified_to_contact(self):
        """Spam/Other + person name → Contact Update."""
        payload = self._base_payload(
            category="Spam/Other",
            contact_name="John Smith",
            contact_company="",
            actionable=False,
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Contact Update")

    def test_field_confidence_included_in_result(self):
        """field_confidence from AI is passed through to result."""
        payload = self._base_payload(
            category="Contact Update",
            contact_name="Jane Doe",
        )
        result = self._classify(payload)
        self.assertIn("field_confidence", result)
        self.assertIsInstance(result["field_confidence"], dict)
        self.assertIn("contact_name", result["field_confidence"])

    def test_purchase_order_not_reclassified(self):
        """Purchase Order category is never reclassified."""
        payload = self._base_payload(
            category="Purchase Order",
            contact_name="",
            contact_company="Acme Corp",
        )
        result = self._classify(payload)
        self.assertEqual(result["category"], "Purchase Order")
        self.assertEqual(result["draft_type"], "purchase_order")

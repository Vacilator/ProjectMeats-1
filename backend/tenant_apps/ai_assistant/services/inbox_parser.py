"""AI Inbox Enhanced Parsing Engine (PI-02).

Provides robust PO number extraction, universal form field mapping, and
automatic dependency creation for the AI Inbox pipeline.

Usage:
    from tenant_apps.ai_assistant.services.inbox_parser import (
        InboxParser,
        ParsedTradeDocument,
        extract_po_numbers,
        DependencyAutoCreator,
    )
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from django.apps import apps
from django.db import transaction

logger = logging.getLogger(__name__)


# ─── PO Number Extraction Patterns ─────────────────────────────────────

PO_PATTERNS = [
    # Standard formats: PO#12345, PO-12345, PO 12345
    re.compile(r'\bPO\s*[#:\-]?\s*(\d{4,10})\b', re.IGNORECASE),
    # P.O. format: P.O. 12345
    re.compile(r'\bP\.?\s*O\.?\s*[#:\-]?\s*(\d{4,10})\b', re.IGNORECASE),
    # Purchase Order format: Purchase Order 12345
    re.compile(r'\bPurchase\s+Order\s*[#:\-]?\s*(\d{4,10})\b', re.IGNORECASE),
    # Order number: Order #12345
    re.compile(r'\bOrder\s*[#:\-]\s*(\d{4,10})\b', re.IGNORECASE),
    # Requisition: REQ-12345
    re.compile(r'\bREQ\s*[#:\-]?\s*(\d{4,10})\b', re.IGNORECASE),
    # Alphanumeric: PO-ABC-12345
    re.compile(r'\bPO\s*[#:\-]?\s*([A-Z]{1,4}[\-]?\d{4,10})\b', re.IGNORECASE),
]

# ─── Protein / Product Patterns ─────────────────────────────────────────

PROTEIN_PATTERNS = [
    re.compile(r'\b(beef|pork|chicken|lamb|veal|turkey|seafood|fish|bison)\b', re.IGNORECASE),
    re.compile(r'\b(ribeye|sirloin|tenderloin|chuck|round|loin|breast|thigh|wing)\b', re.IGNORECASE),
    re.compile(r'\b(ground\s+beef|ground\s+pork|ground\s+turkey)\b', re.IGNORECASE),
]

# Weight patterns: 5000 lbs, 2,500 KG, 50000 pounds etc.
WEIGHT_PATTERN = re.compile(
    r'(\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.(\d+))?\s*(lbs?|kg|pounds?|kilograms?|tons?|cwt)\b',
    re.IGNORECASE,
)

# Price patterns: $12.50/lb, $5,000.00, USD 12.50
PRICE_PATTERN = re.compile(
    r'(?:\$|USD\s*)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,4})?)\s*(?:/\s*(lb|kg|cwt|ton|unit))?\b',
    re.IGNORECASE,
)

# Date patterns: 05/15/2026, May 15, 2026, 2026-05-15
DATE_PATTERNS = [
    re.compile(r'\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b'),
    re.compile(r'\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b'),
    re.compile(
        r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})\b',
        re.IGNORECASE,
    ),
]


@dataclass
class ParsedTradeDocument:
    """Result of parsing an email/document for trade data."""

    po_numbers: list[str] = field(default_factory=list)
    proteins: list[str] = field(default_factory=list)
    weights: list[dict] = field(default_factory=list)
    prices: list[dict] = field(default_factory=list)
    dates: list[str] = field(default_factory=list)
    supplier_name: str = ""
    customer_name: str = ""
    sender_email: str = ""
    confidence: float = 0.0
    raw_fields: dict = field(default_factory=dict)

    @property
    def has_po(self) -> bool:
        return len(self.po_numbers) > 0

    @property
    def is_actionable(self) -> bool:
        return self.has_po or (len(self.proteins) > 0 and len(self.weights) > 0)

    def to_form_payload(self) -> dict:
        """Convert parsed data to universal form field payload."""
        payload: dict[str, Any] = {}
        if self.po_numbers:
            payload["po_number"] = self.po_numbers[0]
            payload["all_po_numbers"] = self.po_numbers
        if self.proteins:
            payload["protein_type"] = self.proteins[0]
            payload["all_proteins"] = self.proteins
        if self.weights:
            payload["total_weight"] = self.weights[0].get("amount")
            payload["weight_unit"] = self.weights[0].get("unit", "LBS")
        if self.prices:
            payload["unit_price"] = self.prices[0].get("amount")
            payload["price_per_unit"] = self.prices[0].get("per_unit", "total")
            payload["currency"] = self.prices[0].get("currency", "USD")
        if self.dates:
            payload["ship_date"] = self.dates[0]
        if self.supplier_name:
            payload["supplier_name"] = self.supplier_name
        if self.customer_name:
            payload["customer_name"] = self.customer_name
        payload["confidence"] = self.confidence
        return payload


def extract_po_numbers(text: str) -> list[str]:
    """Extract all PO numbers from text using known patterns."""
    found: list[str] = []
    for pattern in PO_PATTERNS:
        for match in pattern.finditer(text):
            po = match.group(1).strip()
            if po and po not in found:
                found.append(po)
    return found


class InboxParser:
    """Enhanced parsing engine for AI Inbox documents.

    Extracts:
    - PO numbers (multiple formats)
    - Protein/product types
    - Weights and quantities
    - Prices and unit pricing
    - Ship/delivery dates
    - Supplier/customer names from sender context
    """

    def parse(
        self,
        *,
        subject: str = "",
        body: str = "",
        sender_email: str = "",
        sender_name: str = "",
    ) -> ParsedTradeDocument:
        """Parse email content into structured trade document data."""
        full_text = f"{subject}\n{body}"

        result = ParsedTradeDocument(
            po_numbers=extract_po_numbers(full_text),
            proteins=self._extract_proteins(full_text),
            weights=self._extract_weights(full_text),
            prices=self._extract_prices(full_text),
            dates=self._extract_dates(full_text),
            sender_email=sender_email,
            supplier_name=sender_name,
        )

        result.confidence = self._compute_confidence(result)
        return result

    def _extract_proteins(self, text: str) -> list[str]:
        found: list[str] = []
        for pattern in PROTEIN_PATTERNS:
            for match in pattern.finditer(text):
                protein = match.group(0).strip().lower()
                if protein not in found:
                    found.append(protein)
        return found

    def _extract_weights(self, text: str) -> list[dict]:
        results = []
        for match in WEIGHT_PATTERN.finditer(text):
            integer_part = match.group(1).replace(",", "")
            decimal_part = match.group(2) or ""
            unit = match.group(3).upper()
            if unit.startswith("POUND"):
                unit = "LBS"
            elif unit.startswith("KILOGRAM"):
                unit = "KG"
            try:
                amount_str = f"{integer_part}.{decimal_part}" if decimal_part else integer_part
                results.append({"amount": float(amount_str), "unit": unit})
            except (ValueError, TypeError):
                pass
        return results

    def _extract_prices(self, text: str) -> list[dict]:
        results = []
        for match in PRICE_PATTERN.finditer(text):
            amount_str = match.group(1).replace(",", "")
            per_unit = match.group(2) or "total"
            try:
                results.append({"amount": float(amount_str), "per_unit": per_unit.lower(), "currency": "USD"})
            except (ValueError, TypeError):
                pass
        return results

    def _extract_dates(self, text: str) -> list[str]:
        results: list[str] = []
        for pattern in DATE_PATTERNS:
            for match in pattern.finditer(text):
                results.append(match.group(0))
        return results[:5]

    def _compute_confidence(self, result: ParsedTradeDocument) -> float:
        """Compute confidence based on data richness and pattern quality."""
        score = 0.0
        if result.po_numbers:
            score += 0.35
        if result.proteins:
            score += 0.20
        if result.weights:
            score += 0.15
        if result.prices:
            score += 0.15
        if result.dates:
            score += 0.10
        if result.supplier_name:
            score += 0.05
        return min(1.0, score)


class DependencyAutoCreator:
    """Auto-create missing business entities in correct order.

    Creation order: Supplier → Customer → Contact → Plant
    Each step checks if entity exists before creating.
    All creations are marked with auto_created=True in custom_data
    for audit trail.
    """

    def __init__(self, tenant: Any):
        self.tenant = tenant
        self.created: list[dict] = []

    def ensure_dependencies(self, parsed: ParsedTradeDocument) -> list[dict]:
        """Ensure all required dependencies exist, creating if needed.

        Returns list of created entities for audit trail.
        """
        self.created = []

        if parsed.supplier_name:
            self._ensure_supplier(parsed.supplier_name, parsed.sender_email)

        if parsed.customer_name:
            self._ensure_customer(parsed.customer_name)

        return self.created

    def _ensure_supplier(self, name: str, email: str = "") -> Any:
        """Find or create supplier by name."""
        Supplier = apps.get_model("suppliers", "Supplier")

        existing = Supplier.objects.filter(
            tenant=self.tenant,
            company_name__iexact=name.strip(),
        ).first()

        if existing:
            return existing

        with transaction.atomic():
            supplier = Supplier.objects.create(
                tenant=self.tenant,
                company_name=name.strip(),
                email=email,
                status="active",
                custom_data={"auto_created": True, "source": "ai_inbox"},
            )
        self.created.append({"type": "supplier", "id": str(supplier.pk), "name": name})
        logger.info("[AI Inbox] Auto-created Supplier '%s' for tenant=%s", name, self.tenant.pk)

        if email:
            self._ensure_contact(supplier=supplier, email=email, name=name)

        return supplier

    def _ensure_customer(self, name: str) -> Any:
        """Find or create customer by name."""
        Customer = apps.get_model("customers", "Customer")

        existing = Customer.objects.filter(
            tenant=self.tenant,
            company_name__iexact=name.strip(),
        ).first()

        if existing:
            return existing

        with transaction.atomic():
            customer = Customer.objects.create(
                tenant=self.tenant,
                company_name=name.strip(),
                status="active",
                custom_data={"auto_created": True, "source": "ai_inbox"},
            )
        self.created.append({"type": "customer", "id": str(customer.pk), "name": name})
        logger.info("[AI Inbox] Auto-created Customer '%s' for tenant=%s", name, self.tenant.pk)
        return customer

    def _ensure_contact(self, *, supplier: Any, email: str, name: str) -> Any:
        """Find or create contact for a supplier."""
        Contact = apps.get_model("contacts", "Contact")

        existing = Contact.objects.filter(
            tenant=self.tenant,
            supplier=supplier,
            email__iexact=email.strip(),
        ).first()

        if existing:
            return existing

        parts = name.strip().split(" ", 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        with transaction.atomic():
            contact = Contact.objects.create(
                tenant=self.tenant,
                supplier=supplier,
                first_name=first_name,
                last_name=last_name,
                email=email.strip(),
                contact_type="General",
                status="active",
                custom_data={"auto_created": True, "source": "ai_inbox"},
            )
        self.created.append({"type": "contact", "id": str(contact.pk), "email": email})
        logger.info("[AI Inbox] Auto-created Contact '%s' for supplier=%s", email, supplier.pk)
        return contact

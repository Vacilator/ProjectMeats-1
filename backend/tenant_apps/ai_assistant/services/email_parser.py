"""Email parsing engine for PO/form field extraction (RT-02.2).

Extracts structured trade data from inbound emails:
- PO numbers (multiple formats)
- Customer/supplier names and contacts
- Product details, quantities, pricing
- Delivery dates and shipping info

Provides dependency resolver that auto-creates missing entities
(Supplier → Customer → Contact → Plant) in the correct order.

Usage:
    from tenant_apps.ai_assistant.services.email_parser import (
        parse_trade_email,
        resolve_dependencies,
    )

    parsed = parse_trade_email(
        subject="RE: PO 226052 - 40k lbs ground beef",
        body="Please confirm our PO#226052 for 40,000 lbs...",
        sender_email="rowena@txfoods.com",
    )

    entities = resolve_dependencies(tenant=tenant, parsed_data=parsed)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction

logger = logging.getLogger("trade.email_parser")


# ---------------------------------------------------------------------------
# PO Number Extraction Patterns
# ---------------------------------------------------------------------------

PO_NUMBER_PATTERNS = [
    # "PO#226052" or "PO# 226052" or "PO #226052"
    re.compile(r"\bPO\s*#?\s*(\d{4,10})\b", re.IGNORECASE),
    # "Purchase Order 226052" or "Purchase Order #226052"
    re.compile(r"\bPurchase\s+Order\s*#?\s*(\d{4,10})\b", re.IGNORECASE),
    # "Order Number: 226052"
    re.compile(r"\bOrder\s+(?:Number|No|Num)\s*[:#]?\s*(\d{4,10})\b", re.IGNORECASE),
    # "PO-226052" or "PO_226052"
    re.compile(r"\bPO[-_](\d{4,10})\b", re.IGNORECASE),
    # "REF: 226052"
    re.compile(r"\bREF\s*[:#]\s*(\d{4,10})\b", re.IGNORECASE),
]

# Quantity patterns: "40,000 lbs", "40000 lbs", "40k lbs"
QUANTITY_PATTERNS = [
    re.compile(
        r"(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|tons?|cases?|boxes?|pallets?|units?|each|ea)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"(\d+k)\s*(lbs?|pounds?|kg|kilos?)\b",
        re.IGNORECASE,
    ),
]

# Price patterns: "$5.50/lb", "$5.50 per lb"
PRICE_PATTERNS = [
    re.compile(
        r"\$\s*(\d+(?:\.\d{1,4})?)\s*(?:/|per)\s*(lb|pound|kg|kilo|unit|case|box|pallet)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"(\d+(?:\.\d{1,4})?)\s*(?:USD|usd)\s*(?:/|per)\s*(lb|pound|kg)\b",
        re.IGNORECASE,
    ),
]

# Date patterns: "deliver by Jan 15", "delivery date: 01/15/2026"
DATE_PATTERNS = [
    re.compile(
        r"(?:deliver(?:y)?\s+(?:by|date|on)[:\s]*)" r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2}(?:,?\s*\d{4})?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:ship\s+(?:by|date|on)[:\s]*)" r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2}(?:,?\s*\d{4})?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:ETA|arrival|due\s+date)[:\s]*" r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2}(?:,?\s*\d{4})?)",
        re.IGNORECASE,
    ),
]

# Total amount patterns: "$250,000.00", "Total: $250,000", "Amount: USD 250000"
TOTAL_AMOUNT_PATTERNS = [
    re.compile(
        r"(?:total|amount|value|order\s+(?:total|value))[:\s]*\$?\s*" r"(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:USD)?",
        re.IGNORECASE,
    ),
    re.compile(
        r"\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:total|USD)?",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:USD|US\$)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)",
        re.IGNORECASE,
    ),
]

# Customer/buyer patterns: "Customer: ABC Corp", "Buyer: John Smith"
CUSTOMER_PATTERNS = [
    re.compile(r"(?:customer|buyer|sold\s+to|bill\s+to)[:\s]+([A-Z][A-Za-z\s&,.]+?)(?:\n|$|,)", re.IGNORECASE),
    re.compile(r"(?:attention|attn)[:\s]+([A-Z][A-Za-z\s]+?)(?:\n|$|,)", re.IGNORECASE),
]

# Logistics/shipping patterns
LOGISTICS_PATTERNS = [
    re.compile(r"(?:FOB|CIF|CFR|FCA|EXW|DDP|DAP)\s+([A-Za-z\s,]+?)(?:\n|$|\.)", re.IGNORECASE),
    re.compile(
        r"(?:ship\s+(?:from|to)|port\s+of\s+(?:origin|destination)|pickup)[:\s]+([A-Za-z\s,]+?)(?:\n|$|\.)",
        re.IGNORECASE,
    ),
    re.compile(r"(?:warehouse|dock|facility)[:\s]+([A-Za-z0-9\s,]+?)(?:\n|$|\.)", re.IGNORECASE),
]


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------


@dataclass
class ParsedLineItem:
    """A single line item extracted from the email."""

    product_description: str = ""
    quantity: str = ""
    unit_of_measure: str = ""
    unit_price: str = ""
    price_uom: str = ""


@dataclass
class ParsedTradeEmail:
    """Structured data extracted from a trade-related email."""

    # Identifiers
    po_numbers: list[str] = field(default_factory=list)
    reference_numbers: list[str] = field(default_factory=list)

    # Contacts
    sender_email: str = ""
    sender_name: str = ""
    company_name: str = ""
    customer_name: str = ""

    # Line items
    line_items: list[ParsedLineItem] = field(default_factory=list)

    # Financial
    total_amount: str = ""
    currency: str = "USD"

    # Dates
    delivery_date: str = ""
    ship_date: str = ""

    # Logistics
    incoterm: str = ""
    ship_from: str = ""
    ship_to: str = ""

    # Metadata
    confidence: float = 0.0
    raw_subject: str = ""
    extraction_notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dict for JSON storage."""
        return {
            "po_numbers": self.po_numbers,
            "reference_numbers": self.reference_numbers,
            "sender_email": self.sender_email,
            "sender_name": self.sender_name,
            "company_name": self.company_name,
            "customer_name": self.customer_name,
            "line_items": [
                {
                    "product_description": li.product_description,
                    "quantity": li.quantity,
                    "unit_of_measure": li.unit_of_measure,
                    "unit_price": li.unit_price,
                    "price_uom": li.price_uom,
                }
                for li in self.line_items
            ],
            "total_amount": self.total_amount,
            "currency": self.currency,
            "delivery_date": self.delivery_date,
            "ship_date": self.ship_date,
            "incoterm": self.incoterm,
            "ship_from": self.ship_from,
            "ship_to": self.ship_to,
            "confidence": self.confidence,
            "raw_subject": self.raw_subject,
            "extraction_notes": self.extraction_notes,
        }


# ---------------------------------------------------------------------------
# Public API: parse_trade_email
# ---------------------------------------------------------------------------


def parse_trade_email(
    *,
    subject: str = "",
    body: str = "",
    sender_email: str = "",
    sender_name: str = "",
) -> ParsedTradeEmail:
    """Extract structured trade data from an email.

    Uses regex-based extraction for reliability and speed.
    Falls back gracefully when fields cannot be extracted.

    Args:
        subject: Email subject line.
        body: Email body text (plain text preferred).
        sender_email: Sender's email address.
        sender_name: Sender's display name.

    Returns:
        ParsedTradeEmail with all extractable fields populated.
    """
    result = ParsedTradeEmail(
        sender_email=sender_email,
        sender_name=sender_name,
        raw_subject=subject,
    )

    combined_text = f"{subject}\n{body}"
    confidence_score = 0.0

    # Extract PO numbers
    po_numbers = set()
    for pattern in PO_NUMBER_PATTERNS:
        for match in pattern.finditer(combined_text):
            po_numbers.add(match.group(1))

    if po_numbers:
        result.po_numbers = sorted(po_numbers)
        confidence_score += 0.3
        result.extraction_notes.append(f"Found {len(po_numbers)} PO number(s)")

    # Extract company name from sender
    company = _extract_company_from_email(sender_email)
    if company:
        result.company_name = company
        confidence_score += 0.1

    # Refine from sender display name
    if sender_name and not company:
        result.company_name = sender_name
        confidence_score += 0.05

    # Extract quantities and UOMs
    line_items = _extract_line_items(combined_text)
    if line_items:
        result.line_items = line_items
        confidence_score += 0.2
        result.extraction_notes.append(f"Found {len(line_items)} line item(s)")

    # Extract prices
    _enrich_prices(combined_text, result.line_items)

    # Extract dates
    for pattern in DATE_PATTERNS:
        match = pattern.search(combined_text)
        if match:
            date_str = match.group(1).strip()
            if (
                "deliver" in pattern.pattern.lower()
                or "due" in pattern.pattern.lower()
                or "eta" in pattern.pattern.lower()
            ):
                result.delivery_date = date_str
            else:
                result.ship_date = date_str
            confidence_score += 0.1
            break

    # Extract total amount
    best_amount = _extract_total_amount(combined_text)
    if best_amount:
        result.total_amount = best_amount
        confidence_score += 0.15
        result.extraction_notes.append(f"Total amount: ${best_amount}")

    # Extract customer/buyer name
    customer = _extract_customer_name(combined_text)
    if customer:
        result.customer_name = customer
        confidence_score += 0.05
        result.extraction_notes.append(f"Customer: {customer}")

    # Extract logistics (incoterm, ship from/to)
    logistics = _extract_logistics(combined_text)
    if logistics.get("incoterm"):
        result.incoterm = logistics["incoterm"]
        confidence_score += 0.05
    if logistics.get("ship_from"):
        result.ship_from = logistics["ship_from"]
    if logistics.get("ship_to"):
        result.ship_to = logistics["ship_to"]

    # Cap confidence
    result.confidence = min(confidence_score, 1.0)

    logger.info(
        f"Email parsed: {len(result.po_numbers)} POs, {len(result.line_items)} items, "
        f"confidence={result.confidence:.2f}",
        extra={
            "po_numbers": result.po_numbers,
            "sender": sender_email,
            "confidence": result.confidence,
        },
    )

    return result


# ---------------------------------------------------------------------------
# Public API: resolve_dependencies
# ---------------------------------------------------------------------------


@dataclass
class ResolvedEntities:
    """Entities resolved or created from parsed email data."""

    supplier: Any = None
    customer: Any = None
    contact: Any = None
    plant: Any = None
    created: list[str] = field(default_factory=list)
    existing: list[str] = field(default_factory=list)


def resolve_dependencies(
    *,
    tenant,
    parsed_data: ParsedTradeEmail,
    create_missing: bool = True,
) -> ResolvedEntities:
    """Resolve or auto-create missing dependencies from parsed email.

    Creation order (respects FK constraints):
    1. Supplier (from company_name or email domain)
    2. Customer (if different from supplier context)
    3. Contact (linked to supplier, from sender info)
    4. Plant (default plant for supplier if none exists)

    Args:
        tenant: Tenant instance for scoping.
        parsed_data: Output from parse_trade_email.
        create_missing: Whether to create entities that don't exist.

    Returns:
        ResolvedEntities with found/created records.
    """
    result = ResolvedEntities()

    with transaction.atomic():
        # 1. Resolve Supplier
        result.supplier = _resolve_supplier(
            tenant=tenant,
            company_name=parsed_data.company_name,
            email=parsed_data.sender_email,
            create_missing=create_missing,
            result=result,
        )

        # 2. Resolve Customer (buyer/end-customer)
        result.customer = _resolve_customer(
            tenant=tenant,
            customer_name=parsed_data.customer_name,
            create_missing=create_missing,
            result=result,
        )

        # 3. Resolve Contact (linked to supplier if found)
        result.contact = _resolve_contact(
            tenant=tenant,
            email=parsed_data.sender_email,
            name=parsed_data.sender_name,
            supplier=result.supplier,
            create_missing=create_missing,
            result=result,
        )

        # 4. Resolve Plant (if supplier has no plants, create default)
        if result.supplier and create_missing:
            result.plant = _resolve_plant(
                tenant=tenant,
                supplier=result.supplier,
                result=result,
            )

    logger.info(
        f"Dependencies resolved: created={result.created}, existing={result.existing}",
        extra={
            "tenant_id": str(tenant.pk),
            "entities_created": result.created,
            "entities_existing": result.existing,
        },
    )

    return result


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------


def _extract_total_amount(text: str) -> str:
    """Extract the most likely total order amount from text.

    Finds the largest dollar amount that appears in a 'total' context,
    or falls back to the largest standalone dollar amount.
    """
    contextual_amounts: list[str] = []
    standalone_amounts: list[str] = []

    # Contextual patterns (near "total", "amount", "value")
    for pattern in TOTAL_AMOUNT_PATTERNS:
        for match in pattern.finditer(text):
            amount_str = match.group(1).replace(",", "")
            try:
                val = Decimal(amount_str)
                if val > 100:  # Filter trivially small amounts
                    contextual_amounts.append(amount_str)
            except (InvalidOperation, ValueError):
                continue

    if contextual_amounts:
        # Return largest contextual amount (most likely the order total)
        return max(contextual_amounts, key=lambda x: Decimal(x))

    # Fallback: find standalone large dollar amounts
    standalone_pattern = re.compile(r"\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)")
    for match in standalone_pattern.finditer(text):
        amount_str = match.group(1).replace(",", "")
        try:
            val = Decimal(amount_str)
            if val > 1000:  # Only consider amounts > $1000 as potential totals
                standalone_amounts.append(amount_str)
        except (InvalidOperation, ValueError):
            continue

    if standalone_amounts:
        return max(standalone_amounts, key=lambda x: Decimal(x))

    return ""


def _extract_customer_name(text: str) -> str:
    """Extract customer/buyer name from email text."""
    for pattern in CUSTOMER_PATTERNS:
        match = pattern.search(text)
        if match:
            name = match.group(1).strip()
            # Clean up trailing punctuation/whitespace
            name = re.sub(r"[\s,]+$", "", name)
            if len(name) > 2 and len(name) < 100:
                return name
    return ""


def _extract_logistics(text: str) -> dict[str, str]:
    """Extract logistics/shipping information (incoterm, locations)."""
    result: dict[str, str] = {}

    # Incoterms
    incoterm_match = re.search(
        r"\b(FOB|CIF|CFR|FCA|EXW|DDP|DAP|CPT|CIP|FAS)\b",
        text,
        re.IGNORECASE,
    )
    if incoterm_match:
        result["incoterm"] = incoterm_match.group(1).upper()

    # Ship from / ship to
    for pattern in LOGISTICS_PATTERNS:
        match = pattern.search(text)
        if match:
            location = match.group(1).strip()
            location = re.sub(r"[\s,]+$", "", location)
            if len(location) > 2:
                pattern_text = pattern.pattern.lower()
                if "from" in pattern_text or "origin" in pattern_text:
                    result["ship_from"] = location
                elif "to" in pattern_text or "destination" in pattern_text:
                    result["ship_to"] = location
                elif not result.get("ship_from"):
                    result["ship_from"] = location

    return result


def _extract_company_from_email(email: str) -> str:
    """Extract company name from email domain."""
    if not email or "@" not in email:
        return ""

    domain = email.split("@")[1].lower()

    # Skip common providers
    common_domains = {
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "aol.com",
        "icloud.com",
        "mail.com",
        "protonmail.com",
    }
    if domain in common_domains:
        return ""

    # Extract company from domain (e.g., "txfoods.com" → "Txfoods")
    company_part = domain.split(".")[0]
    return company_part.replace("-", " ").replace("_", " ").title()


def _extract_line_items(text: str) -> list[ParsedLineItem]:
    """Extract quantity + UOM line items from text."""
    items: list[ParsedLineItem] = []
    seen_quantities: set[str] = set()

    for pattern in QUANTITY_PATTERNS:
        for match in pattern.finditer(text):
            qty_raw = match.group(1)
            uom = match.group(2).lower()

            # Handle "40k" notation
            if "k" in qty_raw.lower():
                qty_raw = qty_raw.lower().replace("k", "000")

            # Normalize quantity
            qty_clean = qty_raw.replace(",", "")
            if qty_clean in seen_quantities:
                continue
            seen_quantities.add(qty_clean)

            # Try to get surrounding context for product description
            start = max(0, match.start() - 80)
            min(len(text), match.end() + 20)
            context = text[start : match.start()].strip()
            # Take last meaningful words as product hint
            product_hint = " ".join(context.split()[-4:]) if context else ""

            items.append(
                ParsedLineItem(
                    product_description=product_hint,
                    quantity=qty_clean,
                    unit_of_measure=_normalize_uom(uom),
                )
            )

    return items


def _enrich_prices(text: str, items: list[ParsedLineItem]) -> None:
    """Try to match prices to line items."""
    for pattern in PRICE_PATTERNS:
        for match in pattern.finditer(text):
            price = match.group(1)
            price_uom = _normalize_uom(match.group(2))
            # Assign to first item without a price
            for item in items:
                if not item.unit_price:
                    item.unit_price = price
                    item.price_uom = price_uom
                    break


def _normalize_uom(raw: str) -> str:
    """Normalize unit of measure strings."""
    mapping = {
        "lb": "LBS",
        "lbs": "LBS",
        "pound": "LBS",
        "pounds": "LBS",
        "kg": "KG",
        "kilo": "KG",
        "kilos": "KG",
        "ton": "TONS",
        "tons": "TONS",
        "case": "CASES",
        "cases": "CASES",
        "box": "BOXES",
        "boxes": "BOXES",
        "pallet": "PALLETS",
        "pallets": "PALLETS",
        "unit": "UNITS",
        "units": "UNITS",
        "each": "UNITS",
        "ea": "UNITS",
    }
    return mapping.get(raw.lower(), raw.upper())


def _resolve_supplier(*, tenant, company_name: str, email: str, create_missing: bool, result: ResolvedEntities):
    """Find or create supplier by name or email domain."""
    from tenant_apps.suppliers.models import Supplier

    # Try exact name match first
    if company_name:
        supplier = Supplier.objects.filter(tenant=tenant, name__iexact=company_name).first()
        if supplier:
            result.existing.append(f"Supplier:{supplier.name}")
            return supplier

    # Try email domain match
    if email and "@" in email:
        domain = email.split("@")[1].lower()
        supplier = Supplier.objects.filter(tenant=tenant, email__icontains=domain).first()
        if supplier:
            result.existing.append(f"Supplier:{supplier.name}")
            return supplier

    # Create if missing and we have a name
    if create_missing and company_name:
        supplier = Supplier.objects.create(
            tenant=tenant,
            name=company_name,
            email=email or "",
        )
        result.created.append(f"Supplier:{company_name}")
        return supplier

    return None


def _resolve_customer(*, tenant, customer_name: str, create_missing: bool, result: ResolvedEntities):
    """Find or create customer by name."""
    from tenant_apps.customers.models import Customer

    if not customer_name:
        return None

    # Try exact name match
    customer = Customer.objects.filter(tenant=tenant, name__iexact=customer_name).first()
    if customer:
        result.existing.append(f"Customer:{customer.name}")
        return customer

    # Try partial match (company name might be abbreviated)
    customer = Customer.objects.filter(tenant=tenant, name__icontains=customer_name[:10]).first()
    if customer:
        result.existing.append(f"Customer:{customer.name}")
        return customer

    # Create if missing
    if create_missing:
        customer = Customer.objects.create(
            tenant=tenant,
            name=customer_name,
        )
        result.created.append(f"Customer:{customer_name}")
        return customer

    return None


def _resolve_contact(*, tenant, email: str, name: str, supplier, create_missing: bool, result: ResolvedEntities):
    """Find or create contact by email."""
    from tenant_apps.contacts.models import Contact

    if not email:
        return None

    contact = Contact.objects.filter(tenant=tenant, email__iexact=email).first()
    if contact:
        result.existing.append(f"Contact:{contact.email}")
        return contact

    if create_missing and email:
        # Use email local part as name fallback when display name is missing
        resolved_name = name
        if not resolved_name:
            local_part = email.split("@")[0] if "@" in email else email
            # Convert common email patterns to readable names (e.g. john.smith → John Smith)
            resolved_name = local_part.replace(".", " ").replace("_", " ").replace("-", " ").strip()
        first_name, last_name = _split_name(resolved_name)
        contact = Contact.objects.create(
            tenant=tenant,
            first_name=first_name,
            last_name=last_name,
            email=email,
        )
        # Link to supplier if we have one
        if supplier and hasattr(contact, "supplier"):
            try:
                contact.supplier = supplier
                contact.save(update_fields=["supplier"])
            except Exception:
                pass  # supplier FK may not exist on Contact

        result.created.append(f"Contact:{email}")
        return contact

    return None


def _resolve_plant(*, tenant, supplier, result: ResolvedEntities):
    """Ensure supplier has at least one plant."""
    from tenant_apps.plants.models import Plant

    # Check if supplier already has plants
    existing_plant = Plant.objects.filter(tenant=tenant, name__icontains=supplier.name).first()
    if existing_plant:
        result.existing.append(f"Plant:{existing_plant.name}")
        return existing_plant

    # Create default plant
    plant = Plant.objects.create(
        tenant=tenant,
        name=f"{supplier.name} - Main Plant",
    )
    result.created.append(f"Plant:{plant.name}")
    return plant


def _split_name(display_name: str) -> tuple[str, str]:
    """Split display name into first/last.

    When no display name is available, returns empty strings instead of
    placeholder text so callers can decide how to handle the missing data.
    """
    if not display_name:
        return ("", "")

    parts = display_name.strip().split()
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], " ".join(parts[1:]))

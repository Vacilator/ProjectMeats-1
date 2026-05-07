"""Tests for RT-02.2: Email parsing engine and dependency resolver."""

from django.test import TestCase

from apps.core.tests.factories import (
    ContactFactory,
    CustomerFactory,
    PlantFactory,
    SupplierFactory,
    TenantFactory,
)
from tenant_apps.ai_assistant.services.email_parser import (
    ParsedTradeEmail,
    parse_trade_email,
    resolve_dependencies,
)


class PONumberExtractionTest(TestCase):
    """Test PO number extraction from various formats."""

    def test_po_hash_format(self):
        """PO#226052 format (Rowena/TX example)."""
        result = parse_trade_email(
            subject="RE: PO#226052 - 40k lbs ground beef",
            body="Please confirm our PO#226052 for 40,000 lbs ground beef.",
            sender_email="rowena@txfoods.com",
        )
        self.assertIn("226052", result.po_numbers)

    def test_po_space_hash_format(self):
        result = parse_trade_email(
            subject="PO # 998877",
            body="Attached PO # 998877",
            sender_email="buyer@example.com",
        )
        self.assertIn("998877", result.po_numbers)

    def test_purchase_order_format(self):
        result = parse_trade_email(
            subject="Purchase Order 554433",
            body="Please find our Purchase Order 554433 attached.",
            sender_email="procurement@corp.com",
        )
        self.assertIn("554433", result.po_numbers)

    def test_order_number_colon_format(self):
        result = parse_trade_email(
            subject="Order Confirmation",
            body="Order Number: 112233\nPlease process.",
            sender_email="orders@bigco.com",
        )
        self.assertIn("112233", result.po_numbers)

    def test_po_dash_format(self):
        result = parse_trade_email(
            subject="Regarding PO-445566",
            body="See PO-445566 details below",
            sender_email="sales@vendor.com",
        )
        self.assertIn("445566", result.po_numbers)

    def test_multiple_po_numbers(self):
        result = parse_trade_email(
            subject="Multiple orders",
            body="PO#111111 and PO#222222 both need confirmation.",
            sender_email="buyer@co.com",
        )
        self.assertEqual(len(result.po_numbers), 2)
        self.assertIn("111111", result.po_numbers)
        self.assertIn("222222", result.po_numbers)

    def test_no_po_number(self):
        result = parse_trade_email(
            subject="General inquiry",
            body="What are your prices for ground beef?",
            sender_email="curious@random.com",
        )
        self.assertEqual(result.po_numbers, [])

    def test_reference_in_subject(self):
        result = parse_trade_email(
            subject="REF: 778899 - delivery schedule",
            body="Please update the delivery schedule.",
            sender_email="ops@partner.com",
        )
        self.assertIn("778899", result.po_numbers)


class QuantityExtractionTest(TestCase):
    """Test quantity and UOM extraction."""

    def test_comma_separated_lbs(self):
        result = parse_trade_email(
            subject="Order",
            body="We need 40,000 lbs of ground beef ASAP.",
            sender_email="buyer@co.com",
        )
        self.assertEqual(len(result.line_items), 1)
        self.assertEqual(result.line_items[0].quantity, "40000")
        self.assertEqual(result.line_items[0].unit_of_measure, "LBS")

    def test_k_notation(self):
        result = parse_trade_email(
            subject="PO#226052",
            body="40k lbs ground beef, deliver by Jan 15",
            sender_email="rowena@txfoods.com",
        )
        self.assertTrue(len(result.line_items) >= 1)
        # "40k" should become "40000"
        found = any(li.quantity == "40000" for li in result.line_items)
        self.assertTrue(found, f"Expected 40000 in items: {result.line_items}")

    def test_multiple_items(self):
        result = parse_trade_email(
            subject="Order",
            body="20,000 lbs chuck roll and 15,000 lbs brisket.",
            sender_email="buyer@co.com",
        )
        self.assertEqual(len(result.line_items), 2)

    def test_cases_uom(self):
        result = parse_trade_email(
            subject="Order",
            body="Need 500 cases of product #1234.",
            sender_email="buyer@co.com",
        )
        self.assertEqual(len(result.line_items), 1)
        self.assertEqual(result.line_items[0].unit_of_measure, "CASES")


class PriceExtractionTest(TestCase):
    """Test price extraction."""

    def test_dollar_per_lb(self):
        result = parse_trade_email(
            subject="Quote",
            body="We can offer 10,000 lbs at $5.50/lb.",
            sender_email="sales@supplier.com",
        )
        self.assertTrue(len(result.line_items) >= 1)
        self.assertEqual(result.line_items[0].unit_price, "5.50")
        self.assertEqual(result.line_items[0].price_uom, "LBS")

    def test_dollar_per_unit_with_space(self):
        result = parse_trade_email(
            subject="Pricing",
            body="500 cases at $12.99 per case.",
            sender_email="vendor@co.com",
        )
        self.assertEqual(result.line_items[0].unit_price, "12.99")


class CompanyExtractionTest(TestCase):
    """Test company name extraction from email."""

    def test_corporate_domain(self):
        result = parse_trade_email(
            subject="PO",
            body="Order attached",
            sender_email="rowena@txfoods.com",
        )
        self.assertEqual(result.company_name, "Txfoods")

    def test_generic_domain_no_company(self):
        result = parse_trade_email(
            subject="PO",
            body="Order attached",
            sender_email="john@gmail.com",
        )
        self.assertEqual(result.company_name, "")

    def test_display_name_fallback(self):
        result = parse_trade_email(
            subject="PO",
            body="Order attached",
            sender_email="john@gmail.com",
            sender_name="John Smith",
        )
        self.assertEqual(result.company_name, "John Smith")


class ConfidenceScoreTest(TestCase):
    """Test confidence scoring."""

    def test_full_email_high_confidence(self):
        """Rowena/TX example should have high confidence."""
        result = parse_trade_email(
            subject="RE: PO#226052 - 40k lbs ground beef",
            body="Please confirm our PO#226052 for 40,000 lbs ground beef at $5.50/lb. Deliver by Jan 15, 2026.",
            sender_email="rowena@txfoods.com",
            sender_name="Rowena Martinez",
        )
        self.assertGreater(result.confidence, 0.6)
        self.assertIn("226052", result.po_numbers)

    def test_spam_low_confidence(self):
        result = parse_trade_email(
            subject="You won a prize!",
            body="Click here to claim your reward",
            sender_email="spam@random.net",
        )
        self.assertLess(result.confidence, 0.2)


class DateExtractionTest(TestCase):
    """Test delivery date extraction."""

    def test_deliver_by_date(self):
        result = parse_trade_email(
            subject="PO",
            body="Deliver by 01/15/2026",
            sender_email="buyer@co.com",
        )
        self.assertIn("01/15/2026", result.delivery_date)

    def test_delivery_date_colon(self):
        result = parse_trade_email(
            subject="PO",
            body="Delivery date: Jan 15, 2026",
            sender_email="buyer@co.com",
        )
        self.assertTrue(result.delivery_date)


class DependencyResolverTest(TestCase):
    """Test auto-creation of missing dependencies."""

    def setUp(self):
        self.tenant = TenantFactory()

    def test_creates_supplier_from_company_name(self):
        parsed = ParsedTradeEmail(
            sender_email="rowena@txfoods.com",
            company_name="TX Foods",
        )
        result = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        self.assertIsNotNone(result.supplier)
        self.assertIn("Supplier:TX Foods", result.created)

    def test_finds_existing_supplier(self):
        supplier = SupplierFactory(tenant=self.tenant, name="TX Foods")
        parsed = ParsedTradeEmail(
            sender_email="rowena@txfoods.com",
            company_name="TX Foods",
        )
        result = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        self.assertEqual(result.supplier.pk, supplier.pk)
        self.assertIn("Supplier:TX Foods", result.existing)
        self.assertNotIn("Supplier:TX Foods", result.created)

    def test_creates_contact_from_email(self):
        parsed = ParsedTradeEmail(
            sender_email="rowena@txfoods.com",
            sender_name="Rowena Martinez",
            company_name="TX Foods",
        )
        result = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        self.assertIsNotNone(result.contact)
        self.assertEqual(result.contact.email, "rowena@txfoods.com")
        self.assertEqual(result.contact.first_name, "Rowena")

    def test_finds_existing_contact(self):
        contact = ContactFactory(
            tenant=self.tenant,
            email="rowena@txfoods.com",
            first_name="Rowena",
            last_name="Martinez",
        )
        parsed = ParsedTradeEmail(
            sender_email="rowena@txfoods.com",
            sender_name="Rowena Martinez",
        )
        result = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        self.assertEqual(result.contact.pk, contact.pk)
        self.assertIn("Contact:rowena@txfoods.com", result.existing)

    def test_creates_default_plant(self):
        parsed = ParsedTradeEmail(
            sender_email="rowena@txfoods.com",
            company_name="TX Foods",
        )
        result = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        self.assertIsNotNone(result.plant)
        self.assertIn("Plant:", [c.split(":")[0] + ":" for c in result.created if "Plant" in c][0] + "")

    def test_idempotent_on_retry(self):
        """Running resolve twice should not create duplicates."""
        parsed = ParsedTradeEmail(
            sender_email="rowena@txfoods.com",
            company_name="TX Foods",
            sender_name="Rowena Martinez",
        )
        result1 = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        result2 = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        # Second run should find existing entities
        self.assertTrue(len(result2.existing) >= len(result1.created))

    def test_no_create_when_disabled(self):
        parsed = ParsedTradeEmail(
            sender_email="unknown@nowhere.com",
            company_name="New Corp",
        )
        result = resolve_dependencies(
            tenant=self.tenant,
            parsed_data=parsed,
            create_missing=False,
        )
        self.assertIsNone(result.supplier)
        self.assertEqual(result.created, [])


class RowenaTXIntegrationTest(TestCase):
    """Full integration test using the Rowena/TX PO 226052 example."""

    def setUp(self):
        self.tenant = TenantFactory()

    def test_full_parse_and_resolve(self):
        """End-to-end: parse email + resolve deps for Rowena/TX PO 226052."""
        parsed = parse_trade_email(
            subject="RE: PO#226052 - 40k lbs ground beef",
            body=(
                "Hi,\n\n"
                "Please confirm our PO#226052 for 40,000 lbs of 80/20 ground beef "
                "at $5.50/lb. Deliver by 01/15/2026 to our Dallas warehouse.\n\n"
                "Thanks,\nRowena Martinez\nTX Foods Inc."
            ),
            sender_email="rowena@txfoods.com",
            sender_name="Rowena Martinez",
        )

        # Verify extraction
        self.assertIn("226052", parsed.po_numbers)
        self.assertGreater(len(parsed.line_items), 0)
        self.assertEqual(parsed.line_items[0].quantity, "40000")
        self.assertEqual(parsed.line_items[0].unit_of_measure, "LBS")
        self.assertEqual(parsed.line_items[0].unit_price, "5.50")
        self.assertIn("01/15/2026", parsed.delivery_date)
        self.assertGreater(parsed.confidence, 0.6)

        # Resolve dependencies
        entities = resolve_dependencies(tenant=self.tenant, parsed_data=parsed)
        self.assertIsNotNone(entities.supplier)
        self.assertIsNotNone(entities.contact)
        self.assertEqual(entities.contact.email, "rowena@txfoods.com")
        self.assertEqual(entities.contact.first_name, "Rowena")

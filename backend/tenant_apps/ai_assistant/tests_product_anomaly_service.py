from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from tenant_apps.ai_assistant.services.product_anomaly_baseline import (
    build_product_baseline,
    evaluate_product_submission,
)
from tenant_apps.invoices.models import Invoice, InvoiceStatus
from tenant_apps.purchase_orders.models import PurchaseOrderStatus
from tenant_apps.sales_orders.models import SalesOrderStatus

from apps.core.models import WeightUnitChoices
from apps.core.tests.factories import (
    CustomerFactory,
    PurchaseOrderFactory,
    SalesOrderFactory,
    SupplierFactory,
    TenantFactory,
)
from apps.system.models.product import Product


class ProductAnomalyBaselineServiceTests(TestCase):
    def setUp(self):
        self.as_of = timezone.make_aware(datetime(2026, 5, 7, 12, 0, 0))
        self.tenant = TenantFactory()
        self.supplier = SupplierFactory(tenant=self.tenant)
        self.customer = CustomerFactory(tenant=self.tenant)
        self.product = Product.objects.create(
            product_code="BEEF-RIBEYE-001",
            name="Ribeye",
        )

    def _set_created_on(self, model, instance, created_on):
        model.objects.filter(pk=instance.pk).update(created_on=created_on)
        instance.refresh_from_db()
        return instance

    def _create_purchase_order(
        self,
        *,
        tenant,
        supplier,
        days_ago: int,
        status: str = PurchaseOrderStatus.APPROVED,
        total_amount: str = "100.00",
        price_per_unit: str = "10.00",
        total_weight: str = "10.00",
        weight_unit: str = WeightUnitChoices.LBS,
        quantity: int = 10,
    ):
        return PurchaseOrderFactory(
            tenant=tenant,
            supplier=supplier,
            product=self.product,
            order_date=(self.as_of - timedelta(days=days_ago)).date(),
            status=status,
            total_amount=Decimal(total_amount),
            price_per_unit=Decimal(price_per_unit),
            total_weight=Decimal(total_weight),
            weight_unit=weight_unit,
            quantity=quantity,
        )

    def _create_sales_order(self, *, total_amount: str, total_weight: str, quantity: int, days_ago: int):
        order = SalesOrderFactory(
            tenant=self.tenant,
            supplier=self.supplier,
            customer=self.customer,
            product=self.product,
            status=SalesOrderStatus.APPROVED,
            total_amount=Decimal(total_amount),
            total_weight=Decimal(total_weight),
            weight_unit=WeightUnitChoices.LBS,
            quantity=quantity,
        )
        return self._set_created_on(type(order), order, self.as_of - timedelta(days=days_ago))

    def _create_invoice(self, *, total_amount: str, unit_price: str, total_weight: str, quantity: int, days_ago: int):
        invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            product=self.product,
            invoice_number=f"INV-{days_ago}",
            status=InvoiceStatus.APPROVED,
            total_amount=Decimal(total_amount),
            unit_price=Decimal(unit_price),
            total_weight=Decimal(total_weight),
            weight_unit=WeightUnitChoices.LBS,
            quantity=quantity,
        )
        return self._set_created_on(Invoice, invoice, self.as_of - timedelta(days=days_ago))

    def test_build_product_baseline_uses_recent_non_draft_history(self):
        for offset, value in enumerate(("10.00", "12.00", "11.00", "9.00", "13.00"), start=1):
            self._create_purchase_order(
                tenant=self.tenant,
                supplier=self.supplier,
                days_ago=offset,
                price_per_unit=value,
            )

        self._create_purchase_order(
            tenant=self.tenant,
            supplier=self.supplier,
            days_ago=120,
            price_per_unit="99.00",
        )
        self._create_purchase_order(
            tenant=self.tenant,
            supplier=self.supplier,
            days_ago=2,
            status=PurchaseOrderStatus.DRAFT,
            price_per_unit="88.00",
        )

        baseline = build_product_baseline(
            tenant_id=str(self.tenant.id),
            product_id=str(self.product.id),
            field_name="unit_price",
            as_of=self.as_of,
        )

        self.assertEqual(baseline.sample_count, 5)
        self.assertAlmostEqual(baseline.mean, 11.0)
        self.assertEqual(baseline.min_value, 9.0)
        self.assertEqual(baseline.max_value, 13.0)
        self.assertTrue(baseline.is_sufficient)

    def test_build_product_baseline_is_tenant_scoped(self):
        other_tenant = TenantFactory()
        other_supplier = SupplierFactory(tenant=other_tenant)

        for value in ("10.00", "11.00", "12.00", "13.00", "14.00"):
            self._create_purchase_order(
                tenant=self.tenant,
                supplier=self.supplier,
                days_ago=3,
                total_amount=value,
            )
        for value in ("100.00", "110.00", "120.00", "130.00", "140.00"):
            self._create_purchase_order(
                tenant=other_tenant,
                supplier=other_supplier,
                days_ago=3,
                total_amount=value,
            )

        baseline = build_product_baseline(
            tenant_id=str(self.tenant.id),
            product_id=str(self.product.id),
            field_name="total_amount",
            as_of=self.as_of,
        )

        self.assertEqual(baseline.sample_count, 5)
        self.assertAlmostEqual(baseline.mean, 12.0)
        self.assertEqual(baseline.max_value, 14.0)

    def test_weight_baseline_combines_committed_sources_and_filters_kg_rows(self):
        self._create_purchase_order(
            tenant=self.tenant,
            supplier=self.supplier,
            days_ago=4,
            total_weight="10.00",
            quantity=1,
        )
        self._create_purchase_order(
            tenant=self.tenant,
            supplier=self.supplier,
            days_ago=5,
            total_weight="999.00",
            weight_unit=WeightUnitChoices.KG,
            quantity=1,
        )
        self._create_sales_order(total_amount="120.00", total_weight="12.00", quantity=1, days_ago=2)
        self._create_invoice(
            total_amount="140.00",
            unit_price="14.00",
            total_weight="14.00",
            quantity=1,
            days_ago=1,
        )

        baseline = build_product_baseline(
            tenant_id=str(self.tenant.id),
            product_id=str(self.product.id),
            field_name="weight",
            as_of=self.as_of,
        )

        self.assertEqual(baseline.sample_count, 3)
        self.assertAlmostEqual(baseline.mean, 12.0)
        self.assertEqual(baseline.max_value, 14.0)

    def test_evaluate_product_submission_uses_loaded_baselines_in_stable_field_order(self):
        for days_ago, total_amount, unit_price in (
            (5, "100.00", "10.00"),
            (4, "110.00", "11.00"),
            (3, "120.00", "12.00"),
            (2, "130.00", "13.00"),
            (1, "140.00", "14.00"),
        ):
            self._create_purchase_order(
                tenant=self.tenant,
                supplier=self.supplier,
                days_ago=days_ago,
                total_amount=total_amount,
                price_per_unit=unit_price,
            )

        response = evaluate_product_submission(
            tenant_id=str(self.tenant.id),
            product_id=str(self.product.id),
            submitted_fields={
                "unit_price": 25.0,
                "total_amount": 260.0,
            },
            as_of=self.as_of,
        )

        self.assertEqual([result.field_name for result in response.results], ["total_amount", "unit_price"])
        self.assertTrue(response.requires_confirmation)
        self.assertEqual(response.results[0].baseline_context["sample_count"], 5)
        self.assertIn(response.results[0].severity, {"warning", "critical"})

    def test_build_product_baseline_requires_tenant_context(self):
        with self.assertRaises(ValueError):
            build_product_baseline(
                tenant_id="",
                product_id=str(self.product.id),
                field_name="unit_price",
                as_of=self.as_of,
            )

"""E2E Process Runtime Executors (PI-01).

Provides action handlers for the EndToEndInquiryToPOProcess template nodes:
- generate_sales_order: Create draft SO from winning bid
- bid_selection: Evaluate supplier bids using weighted criteria
- check_bids: Poll for new bid responses
- create_purchase_order: Generate supplier PO from customer PO confirmation
- resolve_contacts: Invoke contact resolution for RFQ/PO routing

These executors are registered with ActionExecutor.execute() via action_type mapping.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from django.apps import apps
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("trade")


@dataclass
class BidEvaluation:
    """Result of bid evaluation with weighted scoring."""

    bid_id: str
    supplier_name: str
    price: Decimal
    margin_percent: Decimal
    weighted_score: float
    meets_threshold: bool
    factors: dict = field(default_factory=dict)


@dataclass
class ExecutorResult:
    """Standardized executor return."""

    success: bool
    data: dict = field(default_factory=dict)
    error: str = ""
    telemetry_event: str = ""


class E2EProcessExecutors:
    """Runtime executors for the E2E Inquiry-to-PO process template.

    Designed to be called from ActionExecutor with tenant + context.
    All methods are tenant-safe and emit telemetry events.
    """

    def __init__(self, tenant: Any, context: dict[str, Any]):
        self.tenant = tenant
        self.context = context

    def generate_sales_order(self, config: dict[str, Any]) -> ExecutorResult:
        """Generate a draft Sales Order from the winning bid.

        Uses bid selection output + contact resolution to create SO with
        correct customer/supplier routing.
        """
        try:
            SalesOrder = apps.get_model("sales_orders", "SalesOrder")

            selected_bid = self.context.get("selected_bid", {})
            if not selected_bid:
                return ExecutorResult(
                    success=False,
                    error="No selected bid in context",
                    telemetry_event="e2e_inquiry_to_po.sales_order.no_bid",
                )

            so_config = config.get("salesOrderConfig", {})
            customer_id = self.context.get("customer_id") or selected_bid.get("customer_id")
            inquiry_id = self.context.get("inquiry_id")

            with transaction.atomic():
                so_data = {
                    "tenant": self.tenant,
                    "status": "draft",
                    "inquiry_id": inquiry_id,
                    "custom_data": {
                        "source": "e2e_process",
                        "bid_id": selected_bid.get("id"),
                        "margin_percent": str(selected_bid.get("margin_percent", "0")),
                        "auto_generated": True,
                        "lineage_tracking": so_config.get("lineageTracking", True),
                    },
                }

                if customer_id:
                    so_data["customer_id"] = customer_id

                so = SalesOrder.objects.create(**so_data)

            contact_routing = self._resolve_so_contacts(so_config)

            logger.info(
                "[E2E] Generated Sales Order %s for tenant=%s (bid=%s)",
                so.pk,
                self.tenant.pk,
                selected_bid.get("id"),
            )

            return ExecutorResult(
                success=True,
                data={
                    "sales_order_id": str(so.pk),
                    "status": "draft",
                    "contact_routing": contact_routing,
                    "auto_generated": True,
                },
                telemetry_event="e2e_inquiry_to_po.sales_order.generated",
            )

        except Exception as e:
            logger.exception("[E2E] generate_sales_order failed: %s", e)
            return ExecutorResult(success=False, error=str(e))

    def bid_selection(self, config: dict[str, Any]) -> ExecutorResult:
        """Evaluate received bids using weighted criteria.

        Scoring factors: price (40%), reliability (25%), lead_time (20%), quality (15%).
        Returns the winning bid or empty if no bids meet threshold.
        """
        try:
            bids = self.context.get("received_bids", [])
            if not bids:
                return ExecutorResult(
                    success=False,
                    error="No bids received for evaluation",
                    telemetry_event="e2e_inquiry_to_po.bid.no_bids",
                )

            criteria = config.get("selectionCriteria", {})
            min_margin = Decimal(str(criteria.get("minimumMarginPercent", 5.0)))
            factors_config = criteria.get(
                "factorsWeighted",
                [
                    {"factor": "price", "weight": 0.4},
                    {"factor": "reliability", "weight": 0.25},
                    {"factor": "lead_time", "weight": 0.2},
                    {"factor": "quality_score", "weight": 0.15},
                ],
            )

            evaluations: list[BidEvaluation] = []
            for bid in bids:
                score = self._compute_weighted_score(bid, factors_config)
                margin = Decimal(str(bid.get("margin_percent", 0)))
                evaluations.append(
                    BidEvaluation(
                        bid_id=str(bid.get("id", "")),
                        supplier_name=bid.get("supplier_name", "Unknown"),
                        price=Decimal(str(bid.get("price", 0))),
                        margin_percent=margin,
                        weighted_score=score,
                        meets_threshold=margin >= min_margin,
                        factors={f["factor"]: bid.get(f["factor"], 0) for f in factors_config},
                    )
                )

            # Filter by threshold, then sort by weighted score
            eligible = [e for e in evaluations if e.meets_threshold]
            if not eligible:
                eligible = evaluations  # Fall back to all if none meet threshold

            eligible.sort(key=lambda e: e.weighted_score, reverse=True)
            winner = eligible[0] if eligible else None

            if not winner:
                return ExecutorResult(
                    success=False,
                    error="No eligible bids found",
                    telemetry_event="e2e_inquiry_to_po.bid.no_eligible",
                )

            logger.info(
                "[E2E] Bid selected: %s (score=%.3f, margin=%.2f%%)",
                winner.supplier_name,
                winner.weighted_score,
                winner.margin_percent,
            )

            return ExecutorResult(
                success=True,
                data={
                    "selected_bid_id": winner.bid_id,
                    "supplier_name": winner.supplier_name,
                    "price": str(winner.price),
                    "margin_percent": str(winner.margin_percent),
                    "weighted_score": round(winner.weighted_score, 4),
                    "meets_threshold": winner.meets_threshold,
                    "total_bids_evaluated": len(evaluations),
                    "eligible_bids": len([e for e in evaluations if e.meets_threshold]),
                },
                telemetry_event="e2e_inquiry_to_po.bid.selected",
            )

        except Exception as e:
            logger.exception("[E2E] bid_selection failed: %s", e)
            return ExecutorResult(success=False, error=str(e))

    def check_bids(self, config: dict[str, Any]) -> ExecutorResult:
        """Check for new bid responses from suppliers.

        Polls the Bid/Quotation model for any new entries linked to the
        current trade session.
        """
        try:
            trade_session_id = self.context.get("trade_session_id")
            if not trade_session_id:
                return ExecutorResult(
                    success=True,
                    data={"new_bids": 0, "total_bids": 0},
                    telemetry_event="e2e_inquiry_to_po.bids.checked",
                )

            # Check for bids via inquiry or trade session
            inquiry_id = self.context.get("inquiry_id")
            existing_bid_ids = set(self.context.get("known_bid_ids", []))

            # Query bids (graceful if model doesn't exist yet)
            try:
                Bid = apps.get_model("inquiries", "SupplierBid")
                bids_qs = Bid.objects.filter(
                    tenant=self.tenant,
                    inquiry_id=inquiry_id,
                ).exclude(id__in=existing_bid_ids)
                new_bids = list(bids_qs.values("id", "supplier__company_name", "unit_price", "created_on")[:50])
            except LookupError:
                new_bids = []

            return ExecutorResult(
                success=True,
                data={
                    "new_bids": len(new_bids),
                    "total_bids": len(existing_bid_ids) + len(new_bids),
                    "new_bid_ids": [str(b["id"]) for b in new_bids],
                },
                telemetry_event="e2e_inquiry_to_po.bids.checked",
            )

        except Exception as e:
            logger.exception("[E2E] check_bids failed: %s", e)
            return ExecutorResult(success=False, error=str(e))

    def create_purchase_order(self, config: dict[str, Any]) -> ExecutorResult:
        """Create a supplier Purchase Order from the winning bid.

        Generates PO with pre-populated contact routing from the
        contact resolution service.
        """
        try:
            PurchaseOrder = apps.get_model("purchase_orders", "PurchaseOrder")

            selected_bid = self.context.get("selected_bid", {})
            supplier_id = selected_bid.get("supplier_id") or self.context.get("supplier_id")

            if not supplier_id:
                return ExecutorResult(
                    success=False,
                    error="No supplier_id available for PO creation",
                    telemetry_event="e2e_inquiry_to_po.supplier_po.no_supplier",
                )

            po_config = config.get("purchaseOrderConfig", {})
            contact_routing = self._resolve_po_contacts(po_config)

            with transaction.atomic():
                po_data = {
                    "tenant": self.tenant,
                    "supplier_id": supplier_id,
                    "status": "draft",
                    "custom_data": {
                        "source": "e2e_process",
                        "bid_id": selected_bid.get("id"),
                        "contact_routing": contact_routing,
                        "lineage_tracking": po_config.get("lineageTracking", True),
                        "auto_generated": True,
                    },
                }

                inquiry_id = self.context.get("inquiry_id")
                if inquiry_id:
                    po_data["inquiry_id"] = inquiry_id

                po = PurchaseOrder.objects.create(**po_data)

            logger.info(
                "[E2E] Created Supplier PO %s for tenant=%s (supplier=%s)",
                po.pk,
                self.tenant.pk,
                supplier_id,
            )

            return ExecutorResult(
                success=True,
                data={
                    "purchase_order_id": str(po.pk),
                    "supplier_id": str(supplier_id),
                    "status": "draft",
                    "contact_routing": contact_routing,
                    "auto_generated": True,
                },
                telemetry_event="e2e_inquiry_to_po.supplier_po.created",
            )

        except Exception as e:
            logger.exception("[E2E] create_purchase_order failed: %s", e)
            return ExecutorResult(success=False, error=str(e))

    def resolve_contacts(self, config: dict[str, Any]) -> ExecutorResult:
        """Resolve supplier plant contacts for RFQ/PO routing.

        Uses the contact_resolution service with Plant Contact Type,
        Title, and "Responsible For" multi-selects.
        """
        try:
            from tenant_apps.workflows.services.contact_resolution import (
                resolve_bid_evaluator,
                resolve_po_contact,
                resolve_rfq_recipient,
            )

            supplier_id = self.context.get("current_supplier", {}).get("id") or self.context.get("supplier_id")
            if not supplier_id:
                return ExecutorResult(
                    success=False,
                    error="No supplier in context for contact resolution",
                )

            Supplier = apps.get_model("suppliers", "Supplier")
            supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
            if not supplier:
                return ExecutorResult(success=False, error=f"Supplier {supplier_id} not found")

            resolution_config = config.get("contactResolution", {})
            contact_type = resolution_config.get("plantContactType", "Sales")
            product_context = self.context.get("product_name")

            rfq_contact = resolve_rfq_recipient(
                tenant=self.tenant,
                supplier=supplier,
                preferred_contact_type=contact_type,
                product_context=product_context,
            )

            po_contact = resolve_po_contact(tenant=self.tenant, supplier=supplier)

            resolved = {
                "rfq_recipient": _contact_to_dict(rfq_contact),
                "po_contact": _contact_to_dict(po_contact),
                "resolution_method": rfq_contact.resolution_method if rfq_contact else "none",
            }

            return ExecutorResult(
                success=True,
                data=resolved,
                telemetry_event="e2e_inquiry_to_po.contacts.resolved",
            )

        except Exception as e:
            logger.exception("[E2E] resolve_contacts failed: %s", e)
            return ExecutorResult(success=False, error=str(e))

    # ─── Internal Helpers ───────────────────────────────────────────────

    def _compute_weighted_score(self, bid: dict, factors: list[dict]) -> float:
        """Compute weighted score from bid attributes."""
        score = 0.0
        for factor_cfg in factors:
            factor_name = factor_cfg["factor"]
            weight = float(factor_cfg.get("weight", 0))
            raw_value = bid.get(factor_name, 0)

            # Normalize: lower price = higher score; higher reliability = higher score
            if factor_name == "price":
                # Invert: lower price is better (normalize to 0-1 range)
                max_price = max(float(bid.get("price", 1)) for bid in self.context.get("received_bids", [bid]))
                normalized = 1.0 - (float(raw_value) / max_price) if max_price > 0 else 0.5
            elif factor_name == "lead_time":
                # Invert: shorter lead time is better
                normalized = max(0, 1.0 - float(raw_value) / 30.0)  # 30 days = 0 score
            else:
                # Direct: higher is better (0-100 scale → 0-1)
                normalized = min(1.0, float(raw_value) / 100.0)

            score += normalized * weight

        return score

    def _resolve_so_contacts(self, config: dict) -> dict:
        """Resolve contact routing for Sales Order."""
        from tenant_apps.workflows.services.contact_resolution import resolve_po_contact

        supplier_id = self.context.get("supplier_id")
        if not supplier_id:
            return {}

        Supplier = apps.get_model("suppliers", "Supplier")
        supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
        if not supplier:
            return {}

        contact = resolve_po_contact(
            tenant=self.tenant,
            supplier=supplier,
            contact_type=config.get("useContactType", "Accounting"),
        )
        return _contact_to_dict(contact)

    def _resolve_po_contacts(self, config: dict) -> dict:
        """Resolve contact routing for Purchase Order."""
        from tenant_apps.workflows.services.contact_resolution import resolve_po_contact

        supplier_id = self.context.get("selected_bid", {}).get("supplier_id") or self.context.get("supplier_id")
        if not supplier_id:
            return {}

        Supplier = apps.get_model("suppliers", "Supplier")
        supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
        if not supplier:
            return {}

        contact = resolve_po_contact(
            tenant=self.tenant,
            supplier=supplier,
            contact_type=config.get("useContactType", "Sales"),
        )
        return _contact_to_dict(contact)

    def resolve_rfq_contacts_for_send(self, config: dict[str, Any]) -> ExecutorResult:
        """Resolve contacts for SendEmail/RFQ node dispatch (master-data-rfq-node).

        Uses Plant Contact Type, Title, and "Responsible For" multi-selects to
        determine the optimal RFQ recipient for the current supplier in the
        ForEachSupplier loop.
        """
        try:
            from tenant_apps.workflows.services.contact_resolution import resolve_rfq_recipient

            supplier_id = self.context.get("current_supplier", {}).get("id") or self.context.get("supplier_id")
            if not supplier_id:
                return ExecutorResult(
                    success=False,
                    error="No supplier in context for RFQ contact resolution",
                    telemetry_event="e2e_inquiry_to_po.rfq_send.no_supplier",
                )

            Supplier = apps.get_model("suppliers", "Supplier")
            supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
            if not supplier:
                return ExecutorResult(
                    success=False,
                    error=f"Supplier {supplier_id} not found",
                )

            rfq_config = config.get("contactResolution", {})
            preferred_type = rfq_config.get("plantContactType", "Sales")
            certifications_filter = rfq_config.get("certifications", [])
            shipping_prefs = rfq_config.get("shippingPreferences", [])
            document_attachments = rfq_config.get("documentAttachments", [])
            product_context = self.context.get("product_name")

            contact = resolve_rfq_recipient(
                tenant=self.tenant,
                supplier=supplier,
                preferred_contact_type=preferred_type,
                product_context=product_context,
            )

            routing_data = _contact_to_dict(contact)
            routing_data["certifications_filter"] = certifications_filter
            routing_data["shipping_preferences"] = shipping_prefs
            routing_data["document_attachments"] = document_attachments

            logger.info(
                "[E2E] RFQ contact resolved for supplier %s: %s (method=%s)",
                supplier_id,
                contact.name if contact else "none",
                contact.resolution_method if contact else "none",
            )

            return ExecutorResult(
                success=True,
                data={
                    "rfq_recipient": routing_data,
                    "supplier_id": str(supplier_id),
                    "supplier_name": getattr(supplier, "company_name", str(supplier)),
                    "has_contact": contact is not None,
                },
                telemetry_event="e2e_inquiry_to_po.rfq_send.contact_resolved",
            )

        except Exception as e:
            logger.exception("[E2E] resolve_rfq_contacts_for_send failed: %s", e)
            return ExecutorResult(success=False, error=str(e))

    def bid_selection_with_contacts(self, config: dict[str, Any]) -> ExecutorResult:
        """Extended bid selection that surfaces resolved contact details (master-data-bid-selection).

        Wraps bid_selection with supplier contact info for the winning bid.
        """
        base_result = self.bid_selection(config)
        if not base_result.success:
            return base_result

        # Enhance with contact details from the winning supplier
        try:
            from tenant_apps.workflows.services.contact_resolution import resolve_bid_evaluator

            selected_bid_id = base_result.data.get("selected_bid_id")
            bids = self.context.get("received_bids", [])
            winning_bid = next((b for b in bids if str(b.get("id")) == selected_bid_id), {})
            supplier_id = winning_bid.get("supplier_id")

            if supplier_id:
                Supplier = apps.get_model("suppliers", "Supplier")
                supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
                if supplier:
                    evaluator = resolve_bid_evaluator(tenant=self.tenant, supplier=supplier)
                    base_result.data["supplier_contact"] = _contact_to_dict(evaluator)

        except Exception as e:
            logger.warning("[E2E] Contact enrichment for bid selection failed: %s", e)

        return base_result

    def prefill_po_contacts(self, config: dict[str, Any]) -> ExecutorResult:
        """Pre-fill PO form step nodes with resolved contacts (master-data-po-nodes).

        Auto-populates supplier/billing/shipping contacts from contact_resolution
        results stored in context.
        """
        try:
            from tenant_apps.workflows.services.contact_resolution import resolve_po_contact, resolve_rfq_recipient

            supplier_id = self.context.get("selected_bid", {}).get("supplier_id") or self.context.get("supplier_id")
            if not supplier_id:
                return ExecutorResult(
                    success=True,
                    data={"prefilled": False, "reason": "no_supplier"},
                    telemetry_event="e2e_inquiry_to_po.po_prefill.no_supplier",
                )

            Supplier = apps.get_model("suppliers", "Supplier")
            supplier = Supplier.objects.filter(id=supplier_id, tenant=self.tenant).first()
            if not supplier:
                return ExecutorResult(
                    success=True,
                    data={"prefilled": False, "reason": "supplier_not_found"},
                )

            billing_contact = resolve_po_contact(tenant=self.tenant, supplier=supplier, contact_type="Accounting")
            shipping_contact = resolve_po_contact(tenant=self.tenant, supplier=supplier, contact_type="Operations")
            sales_contact = resolve_rfq_recipient(tenant=self.tenant, supplier=supplier)

            return ExecutorResult(
                success=True,
                data={
                    "prefilled": True,
                    "billing_contact": _contact_to_dict(billing_contact),
                    "shipping_contact": _contact_to_dict(shipping_contact),
                    "sales_contact": _contact_to_dict(sales_contact),
                    "supplier_name": getattr(supplier, "company_name", str(supplier)),
                },
                telemetry_event="e2e_inquiry_to_po.po_prefill.done",
            )

        except Exception as e:
            logger.exception("[E2E] prefill_po_contacts failed: %s", e)
            return ExecutorResult(success=False, error=str(e))


def _contact_to_dict(contact: Any) -> dict:
    """Convert ResolvedContact to serializable dict."""
    if not contact:
        return {}
    return {
        "contact_id": contact.contact_id,
        "name": contact.name,
        "email": contact.email,
        "phone": contact.phone,
        "contact_type": contact.contact_type,
        "title": contact.title,
        "department": contact.department,
        "responsibilities": contact.responsibilities,
        "resolution_method": contact.resolution_method,
    }

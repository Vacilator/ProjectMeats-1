"""Reports API endpoints.

Purpose: Provide business-friendly aggregated metrics for the Reports page without
forcing the frontend to pull entire entity lists (performance + correctness).

All endpoints are tenant-scoped via request.tenant.

Reliability:
- These endpoints are intended for business dashboards and should not 500 if an
  optional table/field is missing or migrations are partially applied in an
  environment. We log and return safe defaults instead.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from django.core.exceptions import FieldError
from django.db.models import Avg, Count, Sum
from django.db.models.functions import TruncMonth
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date


def _parse_iso_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw))
    except ValueError:
        return None


def _get_date_range(request) -> DateRange:
    """Get date range from query params (start/end), default last 30 days."""
    start = _parse_iso_date(request.query_params.get("start"))
    end = _parse_iso_date(request.query_params.get("end"))

    today = timezone.localdate()
    if not end:
        end = today
    if not start:
        start = end - timedelta(days=30)

    if start > end:
        start, end = end, start

    return DateRange(start=start, end=end)


class ReportsSummaryAPIView(APIView):
    """High-level business summary for Reports."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        # Ensure RLS session vars exist for any tenant-scoped models queried below.
        try:
            from apps.tenants.rls import set_current_tenant

            set_current_tenant(str(tenant.id))
        except Exception:
            logger.exception("Reports: failed to set RLS session vars")

        dr = _get_date_range(request)
        now = timezone.now()

        warnings = []

        def _warn(section: str, exc: Exception) -> None:
            # Don’t leak data; keep it high-level but actionable.
            warnings.append({"section": section, "message": f"{section} metrics unavailable"})
            logger.exception(
                "Reports summary section failed: %s tenant=%s start=%s end=%s",
                section,
                getattr(tenant, "id", None),
                dr.start,
                dr.end,
            )

        summary = {
            "purchase_orders": {"count": 0, "total_amount": 0.0, "avg_amount": 0.0},
            "sales_orders": {"count": 0, "total_amount": 0.0, "total_weight": 0.0, "avg_amount": 0.0},
            "inquiries": {"total": 0, "won": 0, "lost": 0, "win_rate": 0.0},
            "calls": {"total": 0, "completed": 0, "upcoming": 0, "overdue": 0, "completion_rate": 0.0},
            "workforms": {"submissions_total": 0, "completed": 0, "in_progress": 0, "completion_rate": 0.0},
            "master_data": {"suppliers": 0, "customers": 0, "contacts": 0},
        }

        # Purchase Orders
        try:
            from tenant_apps.purchase_orders.models import PurchaseOrder

            po_qs = PurchaseOrder.objects.for_tenant(tenant).filter(order_date__gte=dr.start, order_date__lte=dr.end)
            # Avoid alias collisions with real field names (e.g. total_amount).
            po_agg = po_qs.aggregate(
                count=Count("id"),
                total_amount_sum=Sum("total_amount"),
                total_amount_avg=Avg("total_amount"),
            )
            summary["purchase_orders"] = {
                "count": int(po_agg.get("count") or 0),
                "total_amount": float(po_agg.get("total_amount_sum") or 0),
                "avg_amount": float(po_agg.get("total_amount_avg") or 0),
            }
        except (OperationalError, ProgrammingError, FieldError, AttributeError, Exception) as e:
            _warn("purchase_orders", e)

        # Sales Orders
        try:
            from tenant_apps.sales_orders.models import SalesOrder

            so_qs = SalesOrder.objects.for_tenant(tenant).filter(
                date_time_stamp__date__gte=dr.start,
                date_time_stamp__date__lte=dr.end,
            )
            # Avoid alias collisions with real field names (e.g. total_amount / total_weight).
            so_agg = so_qs.aggregate(
                count=Count("id"),
                total_amount_sum=Sum("total_amount"),
                total_weight_sum=Sum("total_weight"),
                total_amount_avg=Avg("total_amount"),
            )
            summary["sales_orders"] = {
                "count": int(so_agg.get("count") or 0),
                "total_amount": float(so_agg.get("total_amount_sum") or 0),
                "total_weight": float(so_agg.get("total_weight_sum") or 0),
                "avg_amount": float(so_agg.get("total_amount_avg") or 0),
            }
        except (OperationalError, ProgrammingError, FieldError, AttributeError, Exception) as e:
            _warn("sales_orders", e)

        # Inquiries
        try:
            from tenant_apps.inquiries.models import Inquiry

            inquiry_qs = Inquiry.objects.filter(
                tenant=tenant,
                inquiry_date__date__gte=dr.start,
                inquiry_date__date__lte=dr.end,
            )
            inquiry_total = inquiry_qs.count()
            inquiry_won = inquiry_qs.filter(status="accepted").count()
            inquiry_lost = inquiry_qs.filter(status="rejected").count()
            inquiry_closed = inquiry_won + inquiry_lost
            inquiry_win_rate = (inquiry_won / inquiry_closed * 100) if inquiry_closed else 0
            summary["inquiries"] = {
                "total": int(inquiry_total),
                "won": int(inquiry_won),
                "lost": int(inquiry_lost),
                "win_rate": round(float(inquiry_win_rate), 1),
            }
        except (OperationalError, ProgrammingError, FieldError, Exception) as e:
            _warn("inquiries", e)

        # Calls
        try:
            from tenant_apps.cockpit.models import ScheduledCall

            calls_qs = ScheduledCall.objects.filter(
                tenant=tenant,
                scheduled_for__date__gte=dr.start,
                scheduled_for__date__lte=dr.end,
            )
            calls_total = calls_qs.count()
            calls_completed = calls_qs.filter(is_completed=True).count()
            calls_overdue = calls_qs.filter(is_completed=False, scheduled_for__lt=now).count()
            calls_upcoming = calls_qs.filter(is_completed=False, scheduled_for__gte=now).count()
            calls_completion_rate = (calls_completed / calls_total * 100) if calls_total else 0
            summary["calls"] = {
                "total": int(calls_total),
                "completed": int(calls_completed),
                "upcoming": int(calls_upcoming),
                "overdue": int(calls_overdue),
                "completion_rate": round(float(calls_completion_rate), 1),
            }
        except (OperationalError, ProgrammingError, FieldError, Exception) as e:
            _warn("calls", e)

        # WorkForms submissions
        try:
            from tenant_apps.workflows.models import FormSubmission, FormSubmissionStatus

            submissions_qs = FormSubmission.objects.filter(
                tenant=tenant,
                created_at__date__gte=dr.start,
                created_at__date__lte=dr.end,
            )
            submissions_total = submissions_qs.count()
            submissions_completed = submissions_qs.filter(status=FormSubmissionStatus.COMPLETED).count()
            submissions_in_progress = submissions_qs.filter(status=FormSubmissionStatus.IN_PROGRESS).count()
            submissions_completion_rate = (submissions_completed / submissions_total * 100) if submissions_total else 0
            summary["workforms"] = {
                "submissions_total": int(submissions_total),
                "completed": int(submissions_completed),
                "in_progress": int(submissions_in_progress),
                "completion_rate": round(float(submissions_completion_rate), 1),
            }
        except (OperationalError, ProgrammingError, FieldError, Exception) as e:
            _warn("workforms", e)

        # Master data
        try:
            from tenant_apps.suppliers.models import Supplier
            from tenant_apps.customers.models import Customer
            from tenant_apps.contacts.models import Contact

            summary["master_data"] = {
                "suppliers": int(Supplier.objects.for_tenant(tenant).count()),
                "customers": int(Customer.objects.for_tenant(tenant).count()),
                "contacts": int(Contact.objects.for_tenant(tenant).count()),
            }
        except (OperationalError, ProgrammingError, FieldError, AttributeError, Exception) as e:
            _warn("master_data", e)

        payload = {
            "date_range": {"start": dr.start.isoformat(), "end": dr.end.isoformat()},
            "summary": summary,
        }
        if warnings:
            payload["warnings"] = warnings

        return Response(payload)


class PurchaseOrderTrendsAPIView(APIView):
    """Trend series for purchase orders (month buckets)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        try:
            from apps.tenants.rls import set_current_tenant

            set_current_tenant(str(tenant.id))
        except Exception:
            logger.exception("Reports: failed to set RLS session vars")

        dr = _get_date_range(request)

        from tenant_apps.purchase_orders.models import PurchaseOrder

        qs = (
            PurchaseOrder.objects.for_tenant(tenant)
            .filter(order_date__gte=dr.start, order_date__lte=dr.end)
            .annotate(bucket=TruncMonth("order_date"))
            .values("bucket")
            .annotate(
                orders=Count("id"),
                value=Sum("total_amount"),
                averageValue=Avg("total_amount"),
            )
            .order_by("bucket")
        )

        data = [
            {
                "date": (row["bucket"].date().isoformat() if isinstance(row["bucket"], datetime) else str(row["bucket"])),
                "orders": int(row["orders"] or 0),
                "value": float(row["value"] or 0),
                "averageValue": float(row["averageValue"] or 0),
            }
            for row in qs
        ]

        return Response({"date_range": {"start": dr.start.isoformat(), "end": dr.end.isoformat()}, "data": data})


class TopSuppliersAPIView(APIView):
    """Top suppliers by PO value for a date range."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=400)

        try:
            from apps.tenants.rls import set_current_tenant

            set_current_tenant(str(tenant.id))
        except Exception:
            logger.exception("Reports: failed to set RLS session vars")

        dr = _get_date_range(request)
        try:
            limit = int(request.query_params.get("limit", 10))
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 25))

        from tenant_apps.purchase_orders.models import PurchaseOrder

        rows = (
            PurchaseOrder.objects.for_tenant(tenant)
            .filter(order_date__gte=dr.start, order_date__lte=dr.end)
            .values("supplier__name")
            .annotate(
                orders=Count("id"),
                revenue=Sum("total_amount"),
            )
            .order_by("-revenue")[:limit]
        )

        data = [
            {
                "name": r["supplier__name"] or "Unknown",
                "orders": int(r["orders"] or 0),
                "revenue": float(r["revenue"] or 0),
                "rating": 0,
            }
            for r in rows
        ]

        return Response({"date_range": {"start": dr.start.isoformat(), "end": dr.end.isoformat()}, "data": data})

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from tenant_apps.fulfillments.models import Fulfillment
from tenant_apps.fulfillments.serializers import PortalFulfillmentTrackingSerializer
from tenant_apps.invoices.models import Invoice
from tenant_apps.invoices.serializers import PortalInvoiceSummarySerializer
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder

from apps.core.models import PortalDocumentReference, PortalGrant, PortalGrantDocumentAccess, TenantAuditEvent
from apps.core.serializers import (
    PortalDocumentReferencePublicSerializer,
    PortalGrantHistoryResponseSerializer,
    PortalGrantIssueRequestSerializer,
    PortalGrantIssueResponseSerializer,
    PortalGrantOperatorSummarySerializer,
    PortalGrantOperatorTargetResponseSerializer,
    PortalGrantRevokeRequestSerializer,
)
from apps.tenants.models import Tenant
from apps.tenants.rls import tenant_rls

PORTAL_TOKEN_QUERY_PARAM = "token"
PORTAL_TOKEN_HEADER = "X-Portal-Token"

PORTAL_OPERATOR_ENTITY_ALIASES = {
    "invoice": "invoice",
    "invoices": "invoice",
    "carrier_purchase_order": "carrier_purchase_order",
    "carrier_po": "carrier_purchase_order",
    "carrier-pos": "carrier_purchase_order",
    "carrier_pos": "carrier_purchase_order",
    "freight-order": "carrier_purchase_order",
    "freight_order": "carrier_purchase_order",
    "freight-orders": "carrier_purchase_order",
    "freight_orders": "carrier_purchase_order",
}


@dataclass(frozen=True)
class ResolvedPortalTarget:
    entity_type: str
    entity_id: str
    label: str
    resource_scope: dict[str, list[str]]
    default_document_sources: list[str]
    available_documents: list[PortalDocumentReference]
    issue_blocker: str | None = None


class PortalInvoiceSummaryResponseSerializer(serializers.Serializer):
    grant_id = serializers.UUIDField()
    subject_email = serializers.EmailField()
    invoices = PortalInvoiceSummarySerializer(many=True)


class PortalDocumentMetadataResponseSerializer(serializers.Serializer):
    grant_id = serializers.UUIDField()
    subject_email = serializers.EmailField()
    documents = PortalDocumentReferencePublicSerializer(many=True)


class PortalFulfillmentTrackingResponseSerializer(serializers.Serializer):
    grant_id = serializers.UUIDField()
    subject_email = serializers.EmailField()
    fulfillments = PortalFulfillmentTrackingSerializer(many=True)


class PortalGrantSnapshotResponseSerializer(serializers.Serializer):
    grant_id = serializers.UUIDField()
    subject_email = serializers.EmailField()
    invoices = PortalInvoiceSummarySerializer(many=True)
    documents = PortalDocumentReferencePublicSerializer(many=True)
    fulfillments = PortalFulfillmentTrackingSerializer(many=True)


class PortalGrantAccessMixin(APIView):
    """Common tenant-explicit signed-grant access helpers for portal read APIs."""

    authentication_classes = []
    permission_classes = [AllowAny]
    required_document_sources: tuple[str, ...] = ()
    scoped_entity_type: str | None = None
    audit_endpoint = ""

    def _portal_not_found(self) -> NotFound:
        return NotFound("Portal resource not found.")

    def get_tenant(self, tenant_id):
        return get_object_or_404(Tenant, id=tenant_id, is_active=True)

    def get_portal_token(self, request) -> str:
        return (
            request.headers.get(PORTAL_TOKEN_HEADER, "") or request.query_params.get(PORTAL_TOKEN_QUERY_PARAM, "")
        ).strip()

    def get_grant(self, tenant: Tenant, grant_id, token: str) -> PortalGrant:
        if not token:
            raise self._portal_not_found()

        grant = (
            PortalGrant.objects.select_for_update().filter(tenant=tenant, id=grant_id).select_related("tenant").first()
        )
        if grant is None or not grant.token_matches(token) or not grant.is_active:
            raise self._portal_not_found()

        if self.required_document_sources and not all(
            source in grant.document_sources for source in self.required_document_sources
        ):
            raise self._portal_not_found()

        if self.scoped_entity_type and not grant.resource_scope.get(self.scoped_entity_type):
            raise self._portal_not_found()

        return grant

    def get_scoped_ids(self, grant: PortalGrant) -> list[int]:
        raw_ids = grant.resource_scope.get(self.scoped_entity_type or "", [])
        return self._normalize_scoped_ids(raw_ids, required=True)

    def get_scoped_ids_for(self, grant: PortalGrant, entity_type: str) -> list[int]:
        return self._normalize_scoped_ids(grant.resource_scope.get(entity_type, []), required=False)

    def _normalize_scoped_ids(self, raw_ids, *, required: bool) -> list[int]:
        scoped_ids: list[int] = []
        for raw_id in raw_ids:
            try:
                scoped_ids.append(int(str(raw_id).strip()))
            except (TypeError, ValueError):
                continue
        if required and not scoped_ids:
            raise self._portal_not_found()
        return scoped_ids

    def mark_grant_accessed(self, grant: PortalGrant) -> None:
        grant.mark_accessed()
        grant.save()

    def create_audit_event(
        self,
        request,
        *,
        tenant: Tenant,
        grant: PortalGrant,
        content_object,
        entity_name: str,
        snapshot_after: dict,
    ) -> None:
        content_type = ContentType.objects.get_for_model(content_object.__class__)
        TenantAuditEvent.objects.create(
            tenant=tenant,
            content_type=content_type,
            object_id=str(content_object.pk),
            entity_type=content_object.__class__.__name__,
            entity_name=entity_name[:255],
            action=TenantAuditEvent.Action.ACCESS,
            changed_fields=None,
            snapshot_before=None,
            snapshot_after=snapshot_after,
            actor=None,
            actor_email=grant.subject_email,
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )


class PortalGrantOperatorMixin(APIView):
    """Tenant-scoped helper methods for internal operator portal management."""

    permission_classes = [permissions.IsAuthenticated]

    def get_operator_tenant(self, request) -> Tenant:
        tenant = getattr(request, "tenant", None)
        if tenant is None:
            raise serializers.ValidationError({"tenant": "Tenant context is required."})
        return get_object_or_404(Tenant, id=tenant.id, is_active=True)

    def normalize_operator_entity_type(self, raw_entity_type: str) -> str:
        normalized = str(raw_entity_type or "").strip().lower().replace(" ", "_")
        entity_type = PORTAL_OPERATOR_ENTITY_ALIASES.get(normalized)
        if entity_type is None:
            raise NotFound("Portal target not found.")
        return entity_type

    def _collect_portal_documents(
        self,
        *,
        tenant: Tenant,
        resource_scope: dict[str, list[str]],
        document_sources: list[str],
    ) -> list[PortalDocumentReference]:
        document_ids: list[str] = []
        for scoped_ids in resource_scope.values():
            for raw_id in scoped_ids:
                normalized_id = str(raw_id).strip()
                if normalized_id:
                    document_ids.append(normalized_id)

        if not document_ids or not document_sources:
            return []

        documents = PortalDocumentReference.objects.filter(
            tenant=tenant,
            is_active=True,
            source_record_id__in=document_ids,
            source_kind__in=document_sources,
        ).order_by("-published_at", "-created_on")

        return list(documents)

    def _has_public_payload(
        self,
        *,
        resource_scope: dict[str, list[str]],
        document_sources: list[str],
        documents: list[PortalDocumentReference],
    ) -> bool:
        if documents:
            return True
        if resource_scope.get("invoice") and "invoice_summary" in document_sources:
            return True
        if resource_scope.get("fulfillment") and "fulfillment_tracking" in document_sources:
            return True
        return False

    def resolve_target(
        self,
        *,
        tenant: Tenant,
        raw_entity_type: str,
        entity_id: str,
    ) -> ResolvedPortalTarget:
        entity_type = self.normalize_operator_entity_type(raw_entity_type)

        if entity_type == "invoice":
            invoice = get_object_or_404(
                Invoice.objects.filter(tenant=tenant).select_related("customer", "sales_order"),
                pk=entity_id,
            )
            resource_scope = {"invoice": [str(invoice.id)]}
            default_document_sources = ["invoice_summary", "invoice_pdf"]
            available_documents = self._collect_portal_documents(
                tenant=tenant,
                resource_scope=resource_scope,
                document_sources=["invoice_pdf"],
            )
            return ResolvedPortalTarget(
                entity_type="invoice",
                entity_id=str(invoice.id),
                label=invoice.invoice_number,
                resource_scope=resource_scope,
                default_document_sources=default_document_sources,
                available_documents=available_documents,
                issue_blocker=None,
            )

        freight_order = get_object_or_404(
            CarrierPurchaseOrder.objects.filter(tenant=tenant).select_related(
                "linked_order",
                "sales_order",
                "carrier",
            ),
            pk=entity_id,
        )
        resource_scope: dict[str, list[str]] = {}
        default_document_sources: list[str] = []

        if freight_order.linked_order_id:
            resource_scope["purchase_order"] = [str(freight_order.linked_order_id)]
            default_document_sources.append("purchase_order_status")

        if freight_order.sales_order_id:
            resource_scope["sales_order"] = [str(freight_order.sales_order_id)]
            default_document_sources.append("sales_order_status")

        available_documents = self._collect_portal_documents(
            tenant=tenant,
            resource_scope=resource_scope,
            document_sources=default_document_sources,
        )

        issue_blocker = None
        if not resource_scope:
            issue_blocker = (
                "This freight order must be linked to a sales order or purchase order "
                "before portal access can be issued."
            )
        elif not available_documents:
            issue_blocker = "This freight order does not have any curated portal-safe documents " "available yet."

        return ResolvedPortalTarget(
            entity_type="carrier_purchase_order",
            entity_id=str(freight_order.id),
            label=freight_order.our_carrier_po_num or f"Carrier PO #{freight_order.id}",
            resource_scope=resource_scope,
            default_document_sources=default_document_sources,
            available_documents=available_documents,
            issue_blocker=issue_blocker,
        )

    def ensure_issue_ready(self, target: ResolvedPortalTarget) -> None:
        if target.issue_blocker:
            raise serializers.ValidationError({"target": target.issue_blocker})

    def grant_matches_target(self, grant: PortalGrant, target: ResolvedPortalTarget) -> bool:
        for entity_type, scoped_ids in target.resource_scope.items():
            expected = {str(raw_id).strip() for raw_id in scoped_ids if str(raw_id).strip()}
            actual = {
                str(raw_id).strip() for raw_id in grant.resource_scope.get(entity_type, []) if str(raw_id).strip()
            }
            if expected & actual:
                return True
        return False

    def build_share_path(self, grant: PortalGrant, raw_token: str) -> str:
        return f"/portal/tenants/{grant.tenant_id}/grants/{grant.id}?token={raw_token}"

    def serialize_grant_audit_snapshot(self, grant: PortalGrant) -> dict:
        return {
            "grant_id": str(grant.id),
            "status": grant.status,
            "subject_email": grant.subject_email,
            "resource_scope": grant.resource_scope,
            "document_sources": grant.document_sources,
            "expires_at": grant.expires_at.isoformat() if grant.expires_at else None,
            "use_count": grant.use_count,
            "max_uses": grant.max_uses,
            "revoked_reason": grant.revoked_reason,
        }

    def sync_grant_document_links(
        self,
        *,
        grant: PortalGrant,
        documents: list[PortalDocumentReference],
        user,
    ) -> None:
        PortalGrantDocumentAccess.objects.filter(tenant=grant.tenant, grant=grant).delete()
        if not documents:
            return

        PortalGrantDocumentAccess.objects.bulk_create(
            [
                PortalGrantDocumentAccess(
                    tenant=grant.tenant,
                    grant=grant,
                    document_reference=document,
                    linked_by=user,
                    sort_order=index,
                )
                for index, document in enumerate(documents)
            ]
        )

    def create_grant_lifecycle_audit_event(
        self,
        request,
        *,
        tenant: Tenant,
        grant: PortalGrant,
        action: str,
        portal_event: str,
        changed_fields: list[str] | None,
        snapshot_before: dict | None = None,
    ) -> None:
        content_type = ContentType.objects.get_for_model(PortalGrant)
        actor_email = getattr(request.user, "email", "") or getattr(request.user, "username", "")
        TenantAuditEvent.objects.create(
            tenant=tenant,
            content_type=content_type,
            object_id=str(grant.id),
            entity_type="PortalGrant",
            entity_name=f"Portal grant for {grant.subject_email}"[:255],
            action=action,
            changed_fields=changed_fields,
            snapshot_before=snapshot_before,
            snapshot_after={
                "portal_event": portal_event,
                **self.serialize_grant_audit_snapshot(grant),
            },
            actor=request.user if getattr(request.user, "is_authenticated", False) else None,
            actor_email=actor_email,
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )

    def get_operator_grant(self, *, tenant: Tenant, grant_id) -> PortalGrant:
        return get_object_or_404(
            PortalGrant.objects.filter(tenant=tenant)
            .select_related("tenant")
            .prefetch_related("document_links__document_reference"),
            id=grant_id,
        )


class PortalInvoiceSummaryView(PortalGrantAccessMixin):
    required_document_sources = ("invoice_summary",)
    scoped_entity_type = "invoice"
    audit_endpoint = "portal.invoice-summary"

    @extend_schema(
        responses=OpenApiResponse(PortalInvoiceSummaryResponseSerializer),
        parameters=[
            OpenApiParameter(
                name=PORTAL_TOKEN_QUERY_PARAM,
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Opaque portal grant token from the counterpart magic link.",
            ),
            OpenApiParameter(
                name=PORTAL_TOKEN_HEADER,
                type=str,
                location=OpenApiParameter.HEADER,
                required=False,
                description="Opaque portal grant token sent after magic-link consumption.",
            ),
        ],
    )
    def get(self, request, tenant_id, grant_id):
        tenant = self.get_tenant(tenant_id)
        request.tenant = tenant

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_grant(tenant, grant_id, self.get_portal_token(request))
            invoice_ids = self.get_scoped_ids(grant)

            invoices = list(
                Invoice.objects.filter(tenant=tenant, pk__in=invoice_ids)
                .select_related("customer", "sales_order")
                .order_by("invoice_number")
            )
            if not invoices:
                raise self._portal_not_found()

            for invoice in invoices:
                self.create_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    content_object=invoice,
                    entity_name=invoice.invoice_number,
                    snapshot_after={
                        "endpoint": self.audit_endpoint,
                        "grant_id": str(grant.id),
                        "subject_email": grant.subject_email,
                    },
                )

            self.mark_grant_accessed(grant)
            payload = PortalInvoiceSummaryResponseSerializer(
                {
                    "grant_id": grant.id,
                    "subject_email": grant.subject_email,
                    "invoices": invoices,
                }
            ).data

        return Response(payload)


class PortalGrantSnapshotView(PortalGrantAccessMixin):
    audit_endpoint = "portal.snapshot"

    @extend_schema(
        responses=OpenApiResponse(PortalGrantSnapshotResponseSerializer),
        parameters=[
            OpenApiParameter(
                name=PORTAL_TOKEN_QUERY_PARAM,
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Opaque portal grant token from the counterpart magic link.",
            ),
            OpenApiParameter(
                name=PORTAL_TOKEN_HEADER,
                type=str,
                location=OpenApiParameter.HEADER,
                required=False,
                description="Opaque portal grant token sent after magic-link consumption.",
            ),
        ],
    )
    def get(self, request, tenant_id, grant_id):
        tenant = self.get_tenant(tenant_id)
        request.tenant = tenant

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_grant(tenant, grant_id, self.get_portal_token(request))

            invoices = []
            invoice_ids = self.get_scoped_ids_for(grant, "invoice")
            if invoice_ids and "invoice_summary" in grant.document_sources:
                invoices = list(
                    Invoice.objects.filter(tenant=tenant, pk__in=invoice_ids)
                    .select_related("customer", "sales_order")
                    .order_by("invoice_number")
                )

            links = []
            documents = []
            if grant.document_sources:
                links = list(
                    PortalGrantDocumentAccess.objects.filter(tenant=tenant, grant=grant)
                    .select_related("document_reference")
                    .order_by("sort_order", "created_on")
                )
                documents = [
                    link.document_reference
                    for link in links
                    if link.document_reference.is_active
                    and link.document_reference.source_kind in grant.document_sources
                ]

            fulfillments = []
            fulfillment_ids = self.get_scoped_ids_for(grant, "fulfillment")
            if fulfillment_ids and "fulfillment_tracking" in grant.document_sources:
                fulfillments = list(
                    Fulfillment.objects.filter(tenant=tenant, pk__in=fulfillment_ids)
                    .select_related("supplier", "customer", "carrier")
                    .order_by("fulfillment_number")
                )

            if not invoices and not documents and not fulfillments:
                raise self._portal_not_found()

            for invoice in invoices:
                self.create_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    content_object=invoice,
                    entity_name=invoice.invoice_number,
                    snapshot_after={
                        "endpoint": self.audit_endpoint,
                        "grant_id": str(grant.id),
                        "subject_email": grant.subject_email,
                        "section": "invoices",
                    },
                )

            for document in documents:
                self.create_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    content_object=document,
                    entity_name=document.display_name,
                    snapshot_after={
                        "endpoint": self.audit_endpoint,
                        "grant_id": str(grant.id),
                        "subject_email": grant.subject_email,
                        "section": "documents",
                        "source_kind": document.source_kind,
                    },
                )

            for fulfillment in fulfillments:
                self.create_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    content_object=fulfillment,
                    entity_name=fulfillment.fulfillment_number,
                    snapshot_after={
                        "endpoint": self.audit_endpoint,
                        "grant_id": str(grant.id),
                        "subject_email": grant.subject_email,
                        "section": "fulfillments",
                    },
                )

            self.mark_grant_accessed(grant)
            payload = PortalGrantSnapshotResponseSerializer(
                {
                    "grant_id": grant.id,
                    "subject_email": grant.subject_email,
                    "invoices": invoices,
                    "documents": documents,
                    "fulfillments": fulfillments,
                }
            ).data

        return Response(payload)


class PortalDocumentMetadataView(PortalGrantAccessMixin):
    audit_endpoint = "portal.documents"

    @extend_schema(
        responses=OpenApiResponse(PortalDocumentMetadataResponseSerializer),
        parameters=[
            OpenApiParameter(
                name=PORTAL_TOKEN_QUERY_PARAM,
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Opaque portal grant token from the counterpart magic link.",
            ),
            OpenApiParameter(
                name=PORTAL_TOKEN_HEADER,
                type=str,
                location=OpenApiParameter.HEADER,
                required=False,
                description="Opaque portal grant token sent after magic-link consumption.",
            ),
        ],
    )
    def get(self, request, tenant_id, grant_id):
        tenant = self.get_tenant(tenant_id)
        request.tenant = tenant

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_grant(tenant, grant_id, self.get_portal_token(request))
            links = list(
                PortalGrantDocumentAccess.objects.filter(tenant=tenant, grant=grant)
                .select_related("document_reference")
                .order_by("sort_order", "created_on")
            )

            documents = [
                link.document_reference
                for link in links
                if link.document_reference.is_active and link.document_reference.source_kind in grant.document_sources
            ]

            if not documents:
                raise self._portal_not_found()

            for document in documents:
                self.create_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    content_object=document,
                    entity_name=document.display_name,
                    snapshot_after={
                        "endpoint": self.audit_endpoint,
                        "grant_id": str(grant.id),
                        "subject_email": grant.subject_email,
                        "source_kind": document.source_kind,
                    },
                )

            self.mark_grant_accessed(grant)
            payload = PortalDocumentMetadataResponseSerializer(
                {
                    "grant_id": grant.id,
                    "subject_email": grant.subject_email,
                    "documents": documents,
                }
            ).data

        return Response(payload)


class PortalFulfillmentTrackingView(PortalGrantAccessMixin):
    required_document_sources = ("fulfillment_tracking",)
    scoped_entity_type = "fulfillment"
    audit_endpoint = "portal.fulfillment-tracking"

    @extend_schema(
        responses=OpenApiResponse(PortalFulfillmentTrackingResponseSerializer),
        parameters=[
            OpenApiParameter(
                name=PORTAL_TOKEN_QUERY_PARAM,
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Opaque portal grant token from the counterpart magic link.",
            ),
            OpenApiParameter(
                name=PORTAL_TOKEN_HEADER,
                type=str,
                location=OpenApiParameter.HEADER,
                required=False,
                description="Opaque portal grant token sent after magic-link consumption.",
            ),
        ],
    )
    def get(self, request, tenant_id, grant_id):
        tenant = self.get_tenant(tenant_id)
        request.tenant = tenant

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_grant(tenant, grant_id, self.get_portal_token(request))
            fulfillment_ids = self.get_scoped_ids(grant)

            fulfillments = list(
                Fulfillment.objects.filter(tenant=tenant, pk__in=fulfillment_ids)
                .select_related("supplier", "customer", "carrier")
                .order_by("fulfillment_number")
            )
            if not fulfillments:
                raise self._portal_not_found()

            for fulfillment in fulfillments:
                self.create_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    content_object=fulfillment,
                    entity_name=fulfillment.fulfillment_number,
                    snapshot_after={
                        "endpoint": self.audit_endpoint,
                        "grant_id": str(grant.id),
                        "subject_email": grant.subject_email,
                    },
                )

            self.mark_grant_accessed(grant)
            payload = PortalFulfillmentTrackingResponseSerializer(
                {
                    "grant_id": grant.id,
                    "subject_email": grant.subject_email,
                    "fulfillments": fulfillments,
                }
            ).data

        return Response(payload)


class PortalGrantOperatorTargetView(PortalGrantOperatorMixin):
    """List and issue portal grants for a tenant-scoped internal record."""

    def get(self, request, entity_type, entity_id):
        tenant = self.get_operator_tenant(request)

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            target = self.resolve_target(tenant=tenant, raw_entity_type=entity_type, entity_id=entity_id)
            grant_filters = Q()
            for scope_type, scoped_ids in target.resource_scope.items():
                if scoped_ids:
                    grant_filters |= Q(resource_scope__contains={scope_type: scoped_ids})

            grants_queryset = (
                PortalGrant.objects.filter(tenant=tenant)
                .select_related("tenant")
                .prefetch_related("document_links__document_reference")
                .order_by("-created_on")
            )
            if grant_filters:
                grants_queryset = grants_queryset.filter(grant_filters)
            else:
                grants_queryset = grants_queryset.none()

            grants = [grant for grant in grants_queryset if self.grant_matches_target(grant, target)]
            payload = PortalGrantOperatorTargetResponseSerializer(
                {
                    "target": {
                        "entity_type": target.entity_type,
                        "entity_id": target.entity_id,
                        "label": target.label,
                        "resource_scope": target.resource_scope,
                        "default_document_sources": target.default_document_sources,
                        "issue_blocker": target.issue_blocker,
                        "available_documents": target.available_documents,
                    },
                    "grants": grants,
                }
            ).data

        return Response(payload)

    def post(self, request, entity_type, entity_id):
        tenant = self.get_operator_tenant(request)
        serializer = PortalGrantIssueRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            target = self.resolve_target(tenant=tenant, raw_entity_type=entity_type, entity_id=entity_id)
            self.ensure_issue_ready(target)

            grant = PortalGrant(
                tenant=tenant,
                subject_email=serializer.validated_data["subject_email"],
                resource_scope=target.resource_scope,
                document_sources=target.default_document_sources,
                expires_at=serializer.validated_data["expires_at"],
                created_by=request.user,
                max_uses=serializer.validated_data["max_uses"],
            )
            raw_token = grant.issue_token()
            grant.save()
            self.sync_grant_document_links(
                grant=grant,
                documents=target.available_documents,
                user=request.user,
            )
            grant = self.get_operator_grant(tenant=tenant, grant_id=grant.id)
            self.create_grant_lifecycle_audit_event(
                request,
                tenant=tenant,
                grant=grant,
                action=TenantAuditEvent.Action.CREATE,
                portal_event="issued",
                changed_fields=["subject_email", "expires_at", "max_uses"],
            )
            payload = PortalGrantIssueResponseSerializer(
                {
                    "grant": grant,
                    "raw_token": raw_token,
                    "share_path": self.build_share_path(grant, raw_token),
                }
            ).data

        return Response(payload, status=status.HTTP_201_CREATED)


class PortalGrantResendView(PortalGrantOperatorMixin):
    """Rotate a grant token and return a fresh counterpart link."""

    def post(self, request, grant_id):
        tenant = self.get_operator_tenant(request)

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_operator_grant(tenant=tenant, grant_id=grant_id)
            if not grant.is_active:
                raise serializers.ValidationError({"grant": "Only active portal grants can be resent."})

            documents = self._collect_portal_documents(
                tenant=tenant,
                resource_scope=grant.resource_scope,
                document_sources=grant.document_sources,
            )
            if not self._has_public_payload(
                resource_scope=grant.resource_scope,
                document_sources=grant.document_sources,
                documents=documents,
            ):
                raise serializers.ValidationError(
                    {"grant": "This portal grant no longer has any portal-safe content to share."}
                )

            snapshot_before = self.serialize_grant_audit_snapshot(grant)
            raw_token = grant.issue_token()
            grant.save()
            self.sync_grant_document_links(grant=grant, documents=documents, user=request.user)
            grant = self.get_operator_grant(tenant=tenant, grant_id=grant.id)
            self.create_grant_lifecycle_audit_event(
                request,
                tenant=tenant,
                grant=grant,
                action=TenantAuditEvent.Action.UPDATE,
                portal_event="resent",
                changed_fields=["token_hash"],
                snapshot_before=snapshot_before,
            )
            payload = PortalGrantIssueResponseSerializer(
                {
                    "grant": grant,
                    "raw_token": raw_token,
                    "share_path": self.build_share_path(grant, raw_token),
                }
            ).data

        return Response(payload)


class PortalGrantRevokeView(PortalGrantOperatorMixin):
    """Revoke a tenant-scoped portal grant."""

    def post(self, request, grant_id):
        tenant = self.get_operator_tenant(request)
        serializer = PortalGrantRevokeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_operator_grant(tenant=tenant, grant_id=grant_id)
            if grant.status != PortalGrant.Status.REVOKED:
                snapshot_before = self.serialize_grant_audit_snapshot(grant)
                grant.revoke(user=request.user, reason=serializer.validated_data["reason"])
                grant.save()
                self.create_grant_lifecycle_audit_event(
                    request,
                    tenant=tenant,
                    grant=grant,
                    action=TenantAuditEvent.Action.UPDATE,
                    portal_event="revoked",
                    changed_fields=["status", "revoked_at", "revoked_reason"],
                    snapshot_before=snapshot_before,
                )

            payload = PortalGrantOperatorSummarySerializer(grant).data

        return Response(payload)


class PortalGrantHistoryView(PortalGrantOperatorMixin):
    """Grant-centric lifecycle and access history feed for operators."""

    def get(self, request, grant_id):
        tenant = self.get_operator_tenant(request)

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            grant = self.get_operator_grant(tenant=tenant, grant_id=grant_id)
            candidate_filters = Q(entity_type="PortalGrant", object_id=str(grant.id))
            invoice_ids = [
                str(raw_id).strip() for raw_id in grant.resource_scope.get("invoice", []) if str(raw_id).strip()
            ]
            fulfillment_ids = [
                str(raw_id).strip() for raw_id in grant.resource_scope.get("fulfillment", []) if str(raw_id).strip()
            ]
            document_ids = [
                str(link.document_reference_id) for link in grant.document_links.all() if link.document_reference_id
            ]

            if invoice_ids:
                candidate_filters |= Q(entity_type="Invoice", object_id__in=invoice_ids)
            if fulfillment_ids:
                candidate_filters |= Q(entity_type="Fulfillment", object_id__in=fulfillment_ids)
            if document_ids:
                candidate_filters |= Q(
                    entity_type="PortalDocumentReference",
                    object_id__in=document_ids,
                )

            candidate_events = (
                TenantAuditEvent.objects.filter(tenant=tenant)
                .filter(candidate_filters)
                .select_related("actor", "content_type", "tenant")
                .order_by("-created_at")
            )
            events = []
            for event in candidate_events:
                if event.entity_type == "PortalGrant" and event.object_id == str(grant.id):
                    events.append(event)
                    continue

                snapshot_after = event.snapshot_after if isinstance(event.snapshot_after, dict) else {}
                if snapshot_after.get("grant_id") == str(grant.id):
                    events.append(event)

            payload = PortalGrantHistoryResponseSerializer({"events": events}).data

        return Response(payload)

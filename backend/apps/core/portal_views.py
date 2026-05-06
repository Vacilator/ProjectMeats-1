from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema

from apps.core.models import (
    PortalDocumentReference,
    PortalGrant,
    PortalGrantDocumentAccess,
    TenantAuditEvent,
)
from apps.core.serializers import PortalDocumentReferencePublicSerializer
from apps.tenants.rls import tenant_rls
from apps.tenants.models import Tenant
from tenant_apps.fulfillments.models import Fulfillment
from tenant_apps.fulfillments.serializers import PortalFulfillmentTrackingSerializer
from tenant_apps.invoices.models import Invoice
from tenant_apps.invoices.serializers import PortalInvoiceSummarySerializer


PORTAL_TOKEN_QUERY_PARAM = "token"
PORTAL_TOKEN_HEADER = "X-Portal-Token"


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
            request.headers.get(PORTAL_TOKEN_HEADER, "")
            or request.query_params.get(PORTAL_TOKEN_QUERY_PARAM, "")
        ).strip()

    def get_grant(self, tenant: Tenant, grant_id, token: str) -> PortalGrant:
        if not token:
            raise self._portal_not_found()

        grant = (
            PortalGrant.objects.select_for_update().filter(tenant=tenant, id=grant_id)
            .select_related("tenant")
            .first()
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
        scoped_ids: list[int] = []
        for raw_id in raw_ids:
            try:
                scoped_ids.append(int(str(raw_id).strip()))
            except (TypeError, ValueError):
                continue
        if not scoped_ids:
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
                if link.document_reference.is_active
                and link.document_reference.source_kind in grant.document_sources
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

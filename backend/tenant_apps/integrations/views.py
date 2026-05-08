from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import set_current_tenant

from .models import (
    SettlementEvent,
    SettlementEventState,
    SettlementSource,
    SettlementSourceAuthMode,
    TenantAPIKey,
    TenantWebhook,
)
from .providers import (
    build_stripe_treasury_canonical_payload,
    is_stripe_treasury_provider,
    verify_stripe_treasury_signature,
)
from .reconciliation import override_settlement_event, reject_settlement_event
from .serializers import (
    SettlementEventIngestSerializer,
    SettlementEventOverrideSerializer,
    SettlementEventRejectSerializer,
    SettlementEventSerializer,
    SettlementSourceCreateSerializer,
    SettlementSourceSerializer,
    TenantAPIKeyCreateSerializer,
    TenantAPIKeySerializer,
    TenantWebhookCreateSerializer,
    TenantWebhookRotateSecretSerializer,
    TenantWebhookSerializer,
)
from .settlement_contract import build_raw_payload_sha256, build_settlement_idempotency_key
from .signing import verify_timestamped_signature
from .tasks import process_settlement_event


def _is_tenant_admin(user, tenant) -> bool:
    if not user or not user.is_authenticated or not tenant:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return TenantUser.objects.filter(
        tenant=tenant,
        user=user,
        role__in=["owner", "admin"],
        is_active=True,
    ).exists()


class TenantAdminOnlyMixin:
    """Mixin that restricts all access to tenant owners/admins (and staff/superusers)."""

    def _assert_admin(self):
        tenant = getattr(self.request, "tenant", None)
        if not _is_tenant_admin(self.request.user, tenant):
            raise PermissionDenied("Tenant admin/owner access required")

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not _is_tenant_admin(self.request.user, tenant):
            return self.queryset.none()
        return self.queryset.filter(tenant=tenant)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["tenant"] = getattr(self.request, "tenant", None)
        ctx["user"] = getattr(self.request, "user", None)
        return ctx


class TenantWebhookViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = TenantWebhook.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return TenantWebhookCreateSerializer
        return TenantWebhookSerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def rotate_secret(self, request, pk=None):
        self._assert_admin()
        webhook = self.get_object()
        secret_value = webhook.rotate_secret()
        serializer = TenantWebhookRotateSecretSerializer({"signing_secret": secret_value})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TenantAPIKeyViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = TenantAPIKey.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return TenantAPIKeyCreateSerializer
        return TenantAPIKeySerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Revoke instead of hard delete."""
        self._assert_admin()
        obj = self.get_object()
        obj.revoke()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _settlement_not_found() -> Response:
    return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)


def _set_tenant_context(request, tenant: Tenant) -> None:
    request.tenant = tenant
    result = set_current_tenant(str(tenant.id))
    if result.ok:
        setattr(request, "_rls_set", True)


class SettlementSourceViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = SettlementSource.objects.select_related("api_key")
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in {"create", "rotate_credential"}:
            return SettlementSourceCreateSerializer
        return SettlementSourceSerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        self._assert_admin()
        source = self.get_object()
        source.is_active = False
        source.save(update_fields=["is_active", "modified_on"])
        if source.api_key and source.api_key.is_active:
            source.api_key.revoke()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def rotate_credential(self, request, pk=None):
        self._assert_admin()
        source = self.get_object()
        credential_kind, credential_value = source.provision_credential(created_by=request.user)
        source._credential_kind = credential_kind
        source._credential_value = credential_value
        serializer = SettlementSourceCreateSerializer(source, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_200_OK)


class SettlementEventViewSet(TenantAdminOnlyMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SettlementEvent.objects.select_related("source")
    serializer_class = SettlementEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().select_related("source", "reviewed_by")

        state_values = [
            value.strip() for value in (self.request.query_params.get("state") or "").split(",") if value.strip()
        ]
        if state_values:
            queryset = queryset.filter(state__in=state_values)

        reason_codes = [
            value.strip() for value in (self.request.query_params.get("reason_code") or "").split(",") if value.strip()
        ]
        if reason_codes:
            queryset = queryset.filter(reconciliation_reason_code__in=reason_codes)

        queue_only = str(self.request.query_params.get("queue_only") or "").strip().lower()
        if queue_only in {"1", "true", "yes"}:
            queryset = queryset.filter(state=SettlementEventState.READY_TO_POST)

        return queryset.order_by("-occurred_at", "-received_at")

    @action(detail=True, methods=["post"])
    def override(self, request, pk=None):
        self._assert_admin()
        event = self.get_object()
        serializer = SettlementEventOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_event = override_settlement_event(
                event=event,
                reviewer=request.user,
                target_type=serializer.validated_data["target_type"],
                target_id=serializer.validated_data["target_id"],
                review_note=serializer.validated_data.get("review_note", ""),
            )
        except DjangoValidationError as exc:
            detail = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
            raise DRFValidationError({"detail": detail}) from exc

        updated_event.refresh_from_db()
        return Response(
            SettlementEventSerializer(updated_event, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        self._assert_admin()
        event = self.get_object()
        serializer = SettlementEventRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_event = reject_settlement_event(
                event=event,
                reviewer=request.user,
                review_note=serializer.validated_data.get("review_note", ""),
            )
        except DjangoValidationError as exc:
            detail = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
            raise DRFValidationError({"detail": detail}) from exc

        updated_event.refresh_from_db()
        return Response(
            SettlementEventSerializer(updated_event, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )


class SettlementEventIngestAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, tenant_id, source_id):
        tenant = Tenant.objects.filter(id=tenant_id, is_active=True).first()
        if not tenant:
            return _settlement_not_found()

        _set_tenant_context(request, tenant)

        source = (
            SettlementSource.objects.select_related("api_key")
            .filter(tenant=tenant, public_id=source_id, is_active=True)
            .first()
        )
        if not source:
            return _settlement_not_found()

        if not self._authenticate_source(request, source):
            return _settlement_not_found()

        raw_payload = request.body.decode("utf-8")
        payload_data = (
            build_stripe_treasury_canonical_payload(raw_payload)
            if is_stripe_treasury_provider(source.provider_code)
            else request.data
        )
        serializer = SettlementEventIngestSerializer(data=payload_data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        now = timezone.now()
        raw_payload_sha256 = build_raw_payload_sha256(raw_payload)
        idempotency_key = build_settlement_idempotency_key(
            tenant_id=str(tenant.id),
            provider_code=source.provider_code,
            external_event_id=payload.get("external_event_id", ""),
            provider_account_reference=source.provider_account_reference,
            occurred_at=payload["occurred_at"],
            amount=payload["amount"],
            direction=payload["direction"],
            raw_payload_sha256=raw_payload_sha256,
        )

        created = False
        try:
            with transaction.atomic():
                event = SettlementEvent.objects.create(
                    tenant=tenant,
                    source=source,
                    provider_code=source.provider_code,
                    provider_account_reference=source.provider_account_reference,
                    external_event_id=payload.get("external_event_id", ""),
                    event_type=payload["event_type"],
                    direction=payload["direction"],
                    occurred_at=payload["occurred_at"],
                    amount=payload["amount"],
                    currency=payload["currency"],
                    raw_payload=raw_payload,
                    raw_payload_sha256=raw_payload_sha256,
                    idempotency_key=idempotency_key,
                    received_at=now,
                    last_received_at=now,
                )
                created = True
                source.last_received_at = now
                source.save(update_fields=["last_received_at", "modified_on"])
        except IntegrityError:
            event = (
                SettlementEvent.objects.filter(tenant=tenant, idempotency_key=idempotency_key)
                .select_related("source")
                .first()
            )
            if not event:
                return _settlement_not_found()
            SettlementEvent.objects.filter(id=event.id).update(
                delivery_count=F("delivery_count") + 1,
                last_received_at=now,
                modified_on=now,
            )
            source.last_received_at = now
            source.save(update_fields=["last_received_at", "modified_on"])

        if created:
            task_result = process_settlement_event.delay(event.id, str(tenant.id))
            task_id = str(getattr(task_result, "id", ""))
            if task_id:
                SettlementEvent.objects.filter(id=event.id).update(processing_task_id=task_id)

        event.refresh_from_db()
        return Response(
            {
                "event_id": event.id,
                "state": event.state,
                "duplicate": not created,
                "processing_task_id": event.processing_task_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    def _authenticate_source(self, request, source: SettlementSource) -> bool:
        if is_stripe_treasury_provider(source.provider_code):
            signature = request.headers.get("Stripe-Signature", "")
            return verify_stripe_treasury_signature(body=request.body, signature_header=signature)

        if source.auth_mode == SettlementSourceAuthMode.TENANT_API_KEY:
            auth_header = request.headers.get("Authorization", "")
            prefix = "Bearer "
            if not auth_header.startswith(prefix) or not source.api_key or not source.api_key.is_active:
                return False
            full_key = auth_header[len(prefix) :]
            if not source.api_key.verify(full_key):
                return False
            source.api_key.last_used_at = timezone.now()
            source.api_key.save(update_fields=["last_used_at", "modified_on"])
            return True

        timestamp = request.headers.get("X-PM-Timestamp", "")
        signature = request.headers.get("X-PM-Signature", "")
        if not timestamp or not signature or not source.signing_secret:
            return False
        return verify_timestamped_signature(source.signing_secret, timestamp, request.body, signature)

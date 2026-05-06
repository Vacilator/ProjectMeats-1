from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import set_current_tenant
from apps.core.models import TenantAuditEvent

from .models import (
    SettlementEvent,
    SettlementReviewAction,
    SettlementEventState,
    SettlementSource,
    SettlementSourceAuthMode,
    TenantAPIKey,
    TenantWebhook,
)
from .serializers import (
    SettlementApproveSerializer,
    SettlementEventDetailSerializer,
    SettlementEventIngestSerializer,
    SettlementRejectSerializer,
    SettlementRelinkSerializer,
    SettlementEventSerializer,
    SettlementSourceCreateSerializer,
    SettlementSourceSerializer,
    TenantAPIKeyCreateSerializer,
    TenantAPIKeySerializer,
    TenantWebhookCreateSerializer,
    TenantWebhookRotateSecretSerializer,
    TenantWebhookSerializer,
)
from .reconciliation import (
    manually_approve_settlement_event,
    manually_reject_settlement_event,
    manually_relink_settlement_event,
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
        role__in=['owner', 'admin'],
        is_active=True,
    ).exists()


class TenantAdminOnlyMixin:
    """Mixin that restricts all access to tenant owners/admins (and staff/superusers)."""

    def _assert_admin(self):
        tenant = getattr(self.request, 'tenant', None)
        if not _is_tenant_admin(self.request.user, tenant):
            raise PermissionDenied('Tenant admin/owner access required')

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not _is_tenant_admin(self.request.user, tenant):
            return self.queryset.none()
        return self.queryset.filter(tenant=tenant)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['tenant'] = getattr(self.request, 'tenant', None)
        ctx['user'] = getattr(self.request, 'user', None)
        return ctx


class TenantWebhookViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = TenantWebhook.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return TenantWebhookCreateSerializer
        return TenantWebhookSerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def rotate_secret(self, request, pk=None):
        self._assert_admin()
        webhook = self.get_object()
        secret_value = webhook.rotate_secret()
        serializer = TenantWebhookRotateSecretSerializer({'signing_secret': secret_value})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TenantAPIKeyViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = TenantAPIKey.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
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
    return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


def _set_tenant_context(request, tenant: Tenant) -> None:
    request.tenant = tenant
    result = set_current_tenant(str(tenant.id))
    if result.ok:
        setattr(request, '_rls_set', True)


class SettlementSourceViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = SettlementSource.objects.select_related('api_key')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in {'create', 'rotate_credential'}:
            return SettlementSourceCreateSerializer
        return SettlementSourceSerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        self._assert_admin()
        source = self.get_object()
        source.is_active = False
        source.save(update_fields=['is_active', 'modified_on'])
        if source.api_key and source.api_key.is_active:
            source.api_key.revoke()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def rotate_credential(self, request, pk=None):
        self._assert_admin()
        source = self.get_object()
        credential_kind, credential_value = source.provision_credential(created_by=request.user)
        source._credential_kind = credential_kind
        source._credential_value = credential_value
        serializer = SettlementSourceCreateSerializer(source, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_200_OK)


class SettlementEventViewSet(TenantAdminOnlyMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SettlementEvent.objects.select_related(
        'source',
        'reviewed_by',
        'matched_invoice',
        'matched_sales_order',
        'matched_purchase_order',
        'payment_transaction',
    )
    serializer_class = SettlementEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().order_by('-received_at', '-id')
        state = str(self.request.query_params.get('state') or '').strip()
        if state:
            queryset = queryset.filter(state=state)
        return queryset

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SettlementEventDetailSerializer
        if self.action == 'approve':
            return SettlementApproveSerializer
        if self.action == 'relink':
            return SettlementRelinkSerializer
        if self.action == 'reject':
            return SettlementRejectSerializer
        return SettlementEventSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        self._assert_admin()
        event = self.get_object()
        serializer = SettlementApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = _build_settlement_event_snapshot(event)
        try:
            event = manually_approve_settlement_event(
                event=event,
                actor=request.user,
                note=serializer.validated_data['note'],
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        after = _build_settlement_event_snapshot(event)
        _create_settlement_audit_event(
            request,
            event=event,
            action=SettlementReviewAction.APPROVE,
            snapshot_before=before,
            snapshot_after=after,
        )
        event.refresh_from_db()
        return Response(
            SettlementEventDetailSerializer(event, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def relink(self, request, pk=None):
        self._assert_admin()
        event = self.get_object()
        serializer = SettlementRelinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = _build_settlement_event_snapshot(event)
        try:
            event = manually_relink_settlement_event(
                event=event,
                actor=request.user,
                note=serializer.validated_data['note'],
                entity_type=serializer.validated_data['entity_type'],
                object_id=serializer.validated_data['object_id'],
            )
        except LookupError:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        after = _build_settlement_event_snapshot(event)
        _create_settlement_audit_event(
            request,
            event=event,
            action=SettlementReviewAction.RELINK,
            snapshot_before=before,
            snapshot_after=after,
        )
        event.refresh_from_db()
        return Response(
            SettlementEventDetailSerializer(event, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        self._assert_admin()
        event = self.get_object()
        serializer = SettlementRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = _build_settlement_event_snapshot(event)
        try:
            event = manually_reject_settlement_event(
                event=event,
                actor=request.user,
                note=serializer.validated_data['note'],
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        after = _build_settlement_event_snapshot(event)
        _create_settlement_audit_event(
            request,
            event=event,
            action=SettlementReviewAction.REJECT,
            snapshot_before=before,
            snapshot_after=after,
        )
        event.refresh_from_db()
        return Response(
            SettlementEventDetailSerializer(event, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )


def _build_settlement_event_snapshot(event: SettlementEvent) -> dict[str, object]:
    event.refresh_from_db()
    return {
        'state': event.state,
        'reconciliation_reason_code': event.reconciliation_reason_code,
        'payment_transaction_id': event.payment_transaction_id,
        'matched_invoice_id': event.matched_invoice_id,
        'matched_sales_order_id': event.matched_sales_order_id,
        'matched_purchase_order_id': event.matched_purchase_order_id,
        'review_action': event.review_action,
        'review_note': event.review_note,
        'reviewed_at': event.reviewed_at.isoformat() if event.reviewed_at else None,
        'reviewed_by_id': event.reviewed_by_id,
    }


def _create_settlement_audit_event(
    request,
    *,
    event: SettlementEvent,
    action: str,
    snapshot_before: dict[str, object],
    snapshot_after: dict[str, object],
) -> None:
    content_type = ContentType.objects.get_for_model(event.__class__)
    TenantAuditEvent.objects.create(
        tenant=event.tenant,
        content_type=content_type,
        object_id=str(event.pk),
        entity_type=event.__class__.__name__,
        entity_name=(event.external_event_id or event.idempotency_key[:12])[:255],
        action=TenantAuditEvent.Action.UPDATE,
        changed_fields=['state', 'reconciliation_reason_code', 'payment_transaction_id', 'review_action', 'review_note'],
        snapshot_before=snapshot_before,
        snapshot_after={**snapshot_after, 'manual_action': action},
        actor=request.user,
        actor_email=getattr(request.user, 'email', '') or '',
        ip_address=request.META.get('REMOTE_ADDR'),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
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
            SettlementSource.objects.select_related('api_key')
            .filter(tenant=tenant, public_id=source_id, is_active=True)
            .first()
        )
        if not source:
            return _settlement_not_found()

        if not self._authenticate_source(request, source):
            return _settlement_not_found()

        raw_payload = request.body.decode('utf-8')
        serializer = SettlementEventIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        now = timezone.now()
        raw_payload_sha256 = build_raw_payload_sha256(raw_payload)
        idempotency_key = build_settlement_idempotency_key(
            tenant_id=str(tenant.id),
            provider_code=source.provider_code,
            external_event_id=payload.get('external_event_id', ''),
            provider_account_reference=source.provider_account_reference,
            occurred_at=payload['occurred_at'],
            amount=payload['amount'],
            direction=payload['direction'],
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
                    external_event_id=payload.get('external_event_id', ''),
                    event_type=payload['event_type'],
                    direction=payload['direction'],
                    occurred_at=payload['occurred_at'],
                    amount=payload['amount'],
                    currency=payload['currency'],
                    raw_payload=raw_payload,
                    raw_payload_sha256=raw_payload_sha256,
                    idempotency_key=idempotency_key,
                    received_at=now,
                    last_received_at=now,
                )
                created = True
                source.last_received_at = now
                source.save(update_fields=['last_received_at', 'modified_on'])
        except IntegrityError:
            event = (
                SettlementEvent.objects.filter(tenant=tenant, idempotency_key=idempotency_key)
                .select_related('source')
                .first()
            )
            if not event:
                return _settlement_not_found()
            SettlementEvent.objects.filter(id=event.id).update(
                delivery_count=F('delivery_count') + 1,
                last_received_at=now,
                modified_on=now,
            )
            source.last_received_at = now
            source.save(update_fields=['last_received_at', 'modified_on'])

        if created:
            task_result = process_settlement_event.delay(event.id, str(tenant.id))
            task_id = str(getattr(task_result, 'id', ''))
            if task_id:
                SettlementEvent.objects.filter(id=event.id).update(processing_task_id=task_id)

        event.refresh_from_db()
        return Response(
            {
                'event_id': event.id,
                'state': event.state,
                'duplicate': not created,
                'processing_task_id': event.processing_task_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    def _authenticate_source(self, request, source: SettlementSource) -> bool:
        if source.auth_mode == SettlementSourceAuthMode.TENANT_API_KEY:
            auth_header = request.headers.get('Authorization', '')
            prefix = 'Bearer '
            if not auth_header.startswith(prefix) or not source.api_key or not source.api_key.is_active:
                return False
            full_key = auth_header[len(prefix) :]
            if not source.api_key.verify(full_key):
                return False
            source.api_key.last_used_at = timezone.now()
            source.api_key.save(update_fields=['last_used_at', 'modified_on'])
            return True

        timestamp = request.headers.get('X-PM-Timestamp', '')
        signature = request.headers.get('X-PM-Signature', '')
        if not timestamp or not signature or not source.signing_secret:
            return False
        return verify_timestamped_signature(source.signing_secret, timestamp, request.body, signature)

"""
Cockpit serializers for aggregated search across tenant models.

Provides lightweight, type-annotated serializers for polymorphic search results.
"""
from rest_framework import serializers

from tenant_apps.cockpit.models import ActivityLog, ScheduledCall, UserWorkspaceLayout
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import Inquiry, TradeSession
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, PurchaseOrder
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier

from apps.core.models import TradeEventLog, TradeExceptionQueue


class CustomerSlotSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Customer search results."""

    type = serializers.CharField(default="customer", read_only=True)
    contact_name = serializers.CharField(source="contact_person", read_only=True)

    class Meta:
        model = Customer
        fields = ["id", "name", "type", "contact_name", "email", "phone"]


class SupplierSlotSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Supplier search results."""

    type = serializers.CharField(default="supplier", read_only=True)
    contact_name = serializers.CharField(source="contact_person", read_only=True)

    class Meta:
        model = Supplier
        fields = ["id", "name", "type", "contact_name", "email", "phone"]


class OrderSlotSerializer(serializers.ModelSerializer):
    """Lightweight serializer for PurchaseOrder search results."""

    type = serializers.CharField(default="order", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = ["id", "order_number", "our_purchase_order_num", "type", "status", "supplier_name", "total_amount"]


class ActivityLogSerializer(serializers.ModelSerializer):
    """Read serializer for ActivityLog model."""

    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "entity_type",
            "entity_id",
            "title",
            "content",
            "created_by",
            "created_by_name",
            "is_pinned",
            "tags",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "created_by_name"]

    def get_created_by_name(self, obj):
        """Get the name of the user who created this log."""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"


class ActivityLogCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating ActivityLog notes.

    We intentionally do NOT allow the client to set tenant/created_by.
    """

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "entity_type",
            "entity_id",
            "title",
            "content",
            "is_pinned",
            "tags",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on"]


class ActivityLogUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for editing existing ActivityLog notes.

    Editing is limited to the note body/metadata. Entity linkage + author are immutable.
    """

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "title",
            "content",
            "is_pinned",
            "tags",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on"]

    def update(self, instance, validated_data):
        validated_data.pop("entity_type", None)
        validated_data.pop("entity_id", None)
        validated_data.pop("created_by", None)
        validated_data.pop("tenant", None)
        return super().update(instance, validated_data)


class ScheduledCallSerializer(serializers.ModelSerializer):
    """Serializer for ScheduledCall model."""

    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    # Allow null/empty description since it's optional
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")

    class Meta:
        model = ScheduledCall
        fields = [
            "id",
            "entity_type",
            "entity_id",
            "title",
            "description",
            "scheduled_for",
            "duration_minutes",
            "is_completed",
            "completed_at",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "activity_log",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "assigned_to_name", "created_by_name"]

    def validate_description(self, value):
        """Convert null to empty string for database compatibility."""
        if value is None:
            return ""
        return value

    def get_assigned_to_name(self, obj):
        """Get the name of the user this call is assigned to."""
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None

    def get_created_by_name(self, obj):
        """Get the name of the user who created this call."""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"


class WorkspaceLayoutPayloadSerializer(serializers.Serializer):
    """Schema serializer for WorkspaceLayoutView payloads (saved or default)."""

    version = serializers.IntegerField()
    layout = serializers.ListField(child=serializers.DictField())
    widgets = serializers.ListField(child=serializers.DictField())


class EntityAIOverviewResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    summary = serializers.CharField(required=False, allow_blank=True)


class UserWorkspaceLayoutSerializer(serializers.ModelSerializer):
    """Serializer for UserWorkspaceLayout model."""

    class Meta:
        model = UserWorkspaceLayout
        fields = [
            "id",
            "layout",
            "widgets",
            "version",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on"]

    def validate_layout(self, value):
        """Validate layout is a list of layout items."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Layout must be a list")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Each layout item must be an object")
            required = {"i", "x", "y", "w", "h"}
            if not required.issubset(item.keys()):
                raise serializers.ValidationError(f"Layout items must have keys: {required}")
        return value

    def validate_widgets(self, value):
        """Validate widgets is a list of widget configs."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Widgets must be a list")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Each widget config must be an object")
            required = {"id", "type", "title"}
            if not required.issubset(item.keys()):
                raise serializers.ValidationError(f"Widget configs must have keys: {required}")
        return value


ENTITY_ROUTE_MAP = {
    "inquiry": "inquiry",
    "inquiries": "inquiry",
    "purchaseorder": "purchase_order",
    "purchase_order": "purchase_order",
    "purchase-orders": "purchase_order",
    "po": "purchase_order",
    "salesorder": "sales_order",
    "sales_order": "sales_order",
    "sales-orders": "sales_order",
    "carrierpurchaseorder": "carrier_purchase_order",
    "carrier_purchase_order": "carrier_purchase_order",
    "carrier-po": "carrier_purchase_order",
    "carrier_po": "carrier_purchase_order",
}


def _normalize_entity_slug(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    normalized = raw.replace("-", "_").replace(" ", "_")
    if normalized in ENTITY_ROUTE_MAP:
        return ENTITY_ROUTE_MAP[normalized]
    compact = normalized.replace("_", "").lower()
    return ENTITY_ROUTE_MAP.get(compact, normalized.lower())


def _build_record_path(entity_type: str | None, entity_id: str | int | None) -> str | None:
    slug = _normalize_entity_slug(entity_type)
    if not slug or entity_id in (None, ""):
        return None
    return f"/records/{slug}/{entity_id}"


def _entity_display_label(instance) -> str:
    if instance is None:
        return ""
    for attr in (
        "inquiry_number",
        "order_number",
        "our_purchase_order_num",
        "our_sales_order_num",
        "our_carrier_po_num",
        "trade_id",
        "name",
    ):
        value = getattr(instance, attr, None)
        if value:
            return str(value)
    instance_id = getattr(instance, "pk", None)
    return f"{instance.__class__.__name__} #{instance_id}" if instance_id is not None else instance.__class__.__name__


class TradeSessionSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    trade_id = serializers.CharField()
    status = serializers.CharField()
    route_decision = serializers.CharField(allow_blank=True)
    inquiry_id = serializers.IntegerField(allow_null=True)
    source_email_subject = serializers.CharField(allow_blank=True)
    source_email_sender = serializers.CharField(allow_blank=True)


class TradeExceptionEntityLinkSerializer(serializers.Serializer):
    entity_type = serializers.CharField()
    entity_id = serializers.CharField()
    label = serializers.CharField()
    status = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    record_path = serializers.CharField(allow_blank=True, allow_null=True, required=False)


class TradeExceptionEventSerializer(serializers.Serializer):
    event_id = serializers.CharField()
    event_type = serializers.CharField()
    entity_type = serializers.CharField(allow_blank=True)
    entity_id = serializers.CharField(allow_blank=True)
    created_on = serializers.DateTimeField()


class TradeExceptionResolveRequestSerializer(serializers.Serializer):
    resolution_notes = serializers.CharField(trim_whitespace=True, allow_blank=False, max_length=2000)


class TradeExceptionQueueListSerializer(serializers.ModelSerializer):
    can_retry = serializers.SerializerMethodField()
    can_resolve = serializers.SerializerMethodField()
    active_sibling_count = serializers.SerializerMethodField()
    trade_session = serializers.SerializerMethodField()
    related_entities = serializers.SerializerMethodField()
    record_path = serializers.SerializerMethodField()

    class Meta:
        model = TradeExceptionQueue
        fields = [
            "id",
            "trade_session_id",
            "trade_id",
            "failed_step",
            "reason_code",
            "error_message",
            "status",
            "retry_count",
            "last_retry_at",
            "resolved_by",
            "resolved_at",
            "resolution_notes",
            "entity_type",
            "entity_id",
            "source_event_id",
            "created_on",
            "modified_on",
            "can_retry",
            "can_resolve",
            "active_sibling_count",
            "trade_session",
            "related_entities",
            "record_path",
        ]

    def get_can_retry(self, obj: TradeExceptionQueue) -> bool:
        return obj.status not in {"resolved", "exhausted"}

    def get_can_resolve(self, obj: TradeExceptionQueue) -> bool:
        return obj.status != "resolved"

    def get_active_sibling_count(self, obj: TradeExceptionQueue) -> int:
        if not obj.trade_session_id:
            return 0
        return (
            TradeExceptionQueue.objects.filter(
                tenant=obj.tenant,
                trade_session_id=obj.trade_session_id,
                status__in=["open", "retrying"],
            )
            .exclude(pk=obj.pk)
            .count()
        )

    def get_trade_session(self, obj: TradeExceptionQueue) -> dict | None:
        trade_session = self._get_trade_session(obj)
        if not trade_session:
            return None
        return TradeSessionSummarySerializer(
            {
                "id": trade_session.pk,
                "trade_id": trade_session.trade_id,
                "status": trade_session.status,
                "route_decision": trade_session.route_decision,
                "inquiry_id": trade_session.inquiry_id,
                "source_email_subject": trade_session.source_email_subject,
                "source_email_sender": trade_session.source_email_sender,
            }
        ).data

    def get_related_entities(self, obj: TradeExceptionQueue) -> list[dict]:
        trade_session = self._get_trade_session(obj)
        related = []
        seen: set[tuple[str, str]] = set()

        for entity_type, entity_id, instance in self._iter_related_instances(obj, trade_session):
            entity_key = (_normalize_entity_slug(entity_type), str(entity_id))
            if entity_key in seen:
                continue
            seen.add(entity_key)
            related.append(
                TradeExceptionEntityLinkSerializer(
                    {
                        "entity_type": _normalize_entity_slug(entity_type),
                        "entity_id": str(entity_id),
                        "label": _entity_display_label(instance) or f"{entity_type} {entity_id}",
                        "status": getattr(instance, "status", "") if instance is not None else "",
                        "record_path": _build_record_path(entity_type, entity_id),
                    }
                ).data
            )
        return related

    def get_record_path(self, obj: TradeExceptionQueue) -> str | None:
        return _build_record_path(obj.entity_type, obj.entity_id)

    def _get_trade_session(self, obj: TradeExceptionQueue) -> TradeSession | None:
        if not obj.trade_session_id:
            return None
        return (
            TradeSession.objects.filter(tenant=obj.tenant, pk=obj.trade_session_id)
            .select_related(
                "inquiry",
                "inquiry__supplier_purchase_order",
                "inquiry__sales_order",
                "inquiry__carrier_purchase_order",
            )
            .first()
        )

    def _iter_related_instances(
        self,
        obj: TradeExceptionQueue,
        trade_session: TradeSession | None,
    ) -> list[tuple[str, str | int, object | None]]:
        entities: list[tuple[str, str | int, object | None]] = []

        if obj.entity_type and obj.entity_id:
            entity = self._fetch_entity_instance(obj.tenant_id, obj.entity_type, obj.entity_id)
            entities.append((obj.entity_type, obj.entity_id, entity))

        inquiry = getattr(trade_session, "inquiry", None)
        if inquiry is not None:
            entities.append(("inquiry", inquiry.pk, inquiry))

            supplier_po = (
                inquiry.supplier_purchase_order
                or PurchaseOrder.objects.filter(
                    tenant=obj.tenant,
                    trade_session=trade_session,
                ).first()
            )
            if supplier_po is not None:
                entities.append(("purchase_order", supplier_po.pk, supplier_po))

            sales_order = (
                inquiry.sales_order
                or SalesOrder.objects.filter(
                    tenant=obj.tenant,
                    trade_session=trade_session,
                ).first()
            )
            if sales_order is not None:
                entities.append(("sales_order", sales_order.pk, sales_order))

            carrier_po = (
                inquiry.carrier_purchase_order
                or CarrierPurchaseOrder.objects.filter(
                    tenant=obj.tenant,
                    trade_session=trade_session,
                ).first()
            )
            if carrier_po is not None:
                entities.append(("carrier_purchase_order", carrier_po.pk, carrier_po))

        return entities

    def _fetch_entity_instance(self, tenant_id, entity_type: str, entity_id: str):
        slug = _normalize_entity_slug(entity_type)
        model_map = {
            "inquiry": Inquiry,
            "purchase_order": PurchaseOrder,
            "sales_order": SalesOrder,
            "carrier_purchase_order": CarrierPurchaseOrder,
        }
        model = model_map.get(slug)
        if not model:
            return None
        return model.objects.filter(tenant_id=tenant_id, pk=entity_id).first()


class TradeExceptionQueueDetailSerializer(TradeExceptionQueueListSerializer):
    recent_events = serializers.SerializerMethodField()
    stack_trace = serializers.CharField()
    context_payload = serializers.JSONField()
    trade_resumable = serializers.SerializerMethodField()

    class Meta(TradeExceptionQueueListSerializer.Meta):
        fields = TradeExceptionQueueListSerializer.Meta.fields + [
            "stack_trace",
            "context_payload",
            "recent_events",
            "trade_resumable",
        ]

    def get_recent_events(self, obj: TradeExceptionQueue) -> list[dict]:
        if not obj.trade_session_id:
            return []
        events = TradeEventLog.objects.filter(
            tenant=obj.tenant,
            trade_session_id=obj.trade_session_id,
        ).order_by(
            "-created_on"
        )[:5]
        return TradeExceptionEventSerializer(
            [
                {
                    "event_id": event.event_id,
                    "event_type": event.event_type,
                    "entity_type": event.entity_type,
                    "entity_id": event.entity_id,
                    "created_on": event.created_on,
                }
                for event in events
            ],
            many=True,
        ).data

    def get_trade_resumable(self, obj: TradeExceptionQueue) -> bool:
        trade_session = self._get_trade_session(obj)
        if not trade_session or trade_session.status != "halted":
            return False
        return self.get_active_sibling_count(obj) == 0 and obj.status == "resolved"

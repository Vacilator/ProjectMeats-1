"""
Serializers for Core app.
"""
from rest_framework import serializers
from apps.core.models import (
    PortalDocumentReference,
    PortalGrant,
    PortalGrantDocumentAccess,
    UserFavorite,
    UserPreferences,
)
from apps.core.security import (
    B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES,
    B2B_PORTAL_ALLOWED_ENTITY_SCOPES,
)
from apps.core.serializers_audit import TenantAuditEventSerializer


class UserPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for UserPreferences model."""

    username = serializers.CharField(source='user.username', read_only=True)
    onboarding_state = serializers.JSONField(required=False)
    _allowed_onboarding_events = {'started', 'completed', 'skipped', 'resumed', 'reset'}
    _allowed_onboarding_statuses = {'not_started', 'in_progress', 'skipped', 'completed'}

    class Meta:
        model = UserPreferences
        fields = [
            'id',
            'user',
            'username',
            'theme',
            'dashboard_layout',
            'sidebar_collapsed',
            'quick_menu_items',
            'widget_preferences',
            'onboarding_state',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'username', 'created_at', 'updated_at']

    @staticmethod
    def _normalize_tour_statuses(value, *, strict):
        if value is None:
            return {}
        if not isinstance(value, dict):
            if strict:
                raise serializers.ValidationError(
                    {'tour_statuses': 'Tour statuses must be an object keyed by tour name.'}
                )
            return {}

        normalized_statuses = {}
        for raw_tour_name, raw_status in value.items():
            if not isinstance(raw_tour_name, str):
                if strict:
                    raise serializers.ValidationError(
                        {'tour_statuses': 'Tour names must be strings.'}
                    )
                continue

            tour_name = raw_tour_name.strip()
            if not tour_name:
                continue

            if not isinstance(raw_status, dict):
                if strict:
                    raise serializers.ValidationError(
                        {'tour_statuses': 'Each tour status must be an object.'}
                    )
                continue

            status = raw_status.get('status', 'not_started')
            if not isinstance(status, str) or status not in UserPreferencesSerializer._allowed_onboarding_statuses:
                if strict:
                    raise serializers.ValidationError(
                        {'tour_statuses': f'Unsupported onboarding status for {tour_name}.'}
                    )
                status = 'not_started'

            last_event = raw_status.get('last_event')
            if last_event is not None and (
                not isinstance(last_event, str)
                or last_event not in UserPreferencesSerializer._allowed_onboarding_events
            ):
                if strict:
                    raise serializers.ValidationError(
                        {'tour_statuses': f'Unsupported onboarding event for {tour_name}.'}
                    )
                last_event = None

            def normalize_nullable_string(field_name):
                field_value = raw_status.get(field_name)
                if field_value is None:
                    return None
                if not isinstance(field_value, str):
                    if strict:
                        raise serializers.ValidationError(
                            {'tour_statuses': f'{field_name} must be a string for {tour_name}.'}
                        )
                    return None
                normalized_value = field_value.strip()
                return normalized_value or None

            def normalize_count(field_name):
                field_value = raw_status.get(field_name, 0)
                if not isinstance(field_value, int) or field_value < 0:
                    if strict:
                        raise serializers.ValidationError(
                            {'tour_statuses': f'{field_name} must be a non-negative integer for {tour_name}.'}
                        )
                    return 0
                return field_value

            normalized_statuses[tour_name] = {
                'status': status,
                'last_event': last_event,
                'last_event_at': normalize_nullable_string('last_event_at'),
                'started_at': normalize_nullable_string('started_at'),
                'completed_at': normalize_nullable_string('completed_at'),
                'skipped_at': normalize_nullable_string('skipped_at'),
                'start_count': normalize_count('start_count'),
                'complete_count': normalize_count('complete_count'),
                'skip_count': normalize_count('skip_count'),
                'resume_count': normalize_count('resume_count'),
            }

        return normalized_statuses

    @staticmethod
    def _normalize_onboarding_state(value):
        """Validate and normalize the canonical onboarding tour contract."""
        if value is None:
            return {'completed_tours': [], 'tour_statuses': {}}
        if not isinstance(value, dict):
            raise serializers.ValidationError('Onboarding state must be an object.')

        unsupported_keys = set(value.keys()) - {'completed_tours', 'tour_statuses'}
        if unsupported_keys:
            unsupported = ', '.join(sorted(unsupported_keys))
            raise serializers.ValidationError(
                f'Unsupported onboarding state keys: {unsupported}.'
            )

        completed_tours = value.get('completed_tours', [])
        if not isinstance(completed_tours, list):
            raise serializers.ValidationError(
                {'completed_tours': 'Completed tours must be a list of tour names.'}
            )

        normalized_tours = []
        seen = set()
        for tour_name in completed_tours:
            if not isinstance(tour_name, str):
                raise serializers.ValidationError(
                    {'completed_tours': 'Completed tours must contain only strings.'}
                )
            normalized_name = tour_name.strip()
            if not normalized_name or normalized_name in seen:
                continue
            normalized_tours.append(normalized_name)
            seen.add(normalized_name)

        tour_statuses = UserPreferencesSerializer._normalize_tour_statuses(
            value.get('tour_statuses', {}),
            strict=True,
        )

        return {
            'completed_tours': normalized_tours,
            'tour_statuses': tour_statuses,
        }

    def validate_onboarding_state(self, value):
        return self._normalize_onboarding_state(value)

    @staticmethod
    def _represent_onboarding_state(widget_preferences):
        onboarding_payload = widget_preferences.get('onboarding') if isinstance(widget_preferences, dict) else {}
        if not isinstance(onboarding_payload, dict):
            return {'completed_tours': [], 'tour_statuses': {}}

        completed_tours = onboarding_payload.get('completed_tours', [])
        if not isinstance(completed_tours, list):
            completed_tours = []

        normalized_tours = []
        seen = set()
        for tour_name in completed_tours:
            if not isinstance(tour_name, str):
                continue
            normalized_name = tour_name.strip()
            if not normalized_name or normalized_name in seen:
                continue
            normalized_tours.append(normalized_name)
            seen.add(normalized_name)

        tour_statuses = UserPreferencesSerializer._normalize_tour_statuses(
            onboarding_payload.get('tour_statuses', {}),
            strict=False,
        )

        return {
            'completed_tours': normalized_tours,
            'tour_statuses': tour_statuses,
        }

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['onboarding_state'] = self._represent_onboarding_state(instance.widget_preferences)
        return representation

    def _merge_onboarding_state(self, current_widget_preferences, validated_data):
        onboarding_state = validated_data.pop('onboarding_state', None)
        if onboarding_state is None:
            return validated_data

        next_widget_preferences = dict(current_widget_preferences or {})
        explicit_widget_preferences = validated_data.get('widget_preferences')
        if isinstance(explicit_widget_preferences, dict):
            next_widget_preferences.update(explicit_widget_preferences)

        next_widget_preferences['onboarding'] = onboarding_state
        validated_data['widget_preferences'] = next_widget_preferences
        return validated_data

    def create(self, validated_data):
        validated_data = self._merge_onboarding_state({}, validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._merge_onboarding_state(instance.widget_preferences, validated_data)
        return super().update(instance, validated_data)


class UserFavoriteSerializer(serializers.ModelSerializer):
    """Serializer for UserFavorite model."""

    tenant_id = serializers.UUIDField(source='tenant.id', read_only=True)

    class Meta:
        model = UserFavorite
        fields = ['id', 'tenant_id', 'entity_type', 'entity_id', 'entity_title', 'created_at']
        read_only_fields = ['id', 'tenant_id', 'created_at']


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class WorkspaceActivityItemSerializer(serializers.Serializer):
    """Normalized item returned by the workspace activity feed endpoint."""

    id = serializers.CharField()
    source = serializers.CharField()
    source_label = serializers.CharField()
    action = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    actor_name = serializers.CharField()
    actor_email = serializers.CharField(allow_blank=True)
    entity_type = serializers.CharField(allow_blank=True)
    entity_id = serializers.CharField(allow_blank=True)
    entity_label = serializers.CharField(allow_blank=True)
    source_record_id = serializers.CharField(allow_blank=True)
    occurred_at = serializers.DateTimeField()
    editable = serializers.BooleanField()
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    metadata = serializers.JSONField(required=False)


def _redact_portal_metadata(value):
    """Expose only explicitly portal-safe metadata keys."""
    if not isinstance(value, dict):
        return {}

    allowed_metadata_keys = {
        "carrier_name",
        "counterpart_name",
        "delivered_at",
        "document_number",
        "fulfillment_number",
        "invoice_number",
        "issued_at",
        "note",
        "notes",
        "order_number",
        "posted_at",
        "purchase_order_number",
        "sales_order_number",
        "status",
        "tracking_number",
    }
    suspicious_value_fragments = (
        "://",
        "s3://",
        "gs://",
        "azure://",
        "tenants/",
        "/tenants/",
        "storage_key",
        "presigned",
    )

    redacted = {}
    for key, nested_value in value.items():
        if key not in allowed_metadata_keys:
            continue
        if isinstance(nested_value, (dict, list)):
            continue
        if isinstance(nested_value, str):
            lowered = nested_value.lower()
            if any(fragment in lowered for fragment in suspicious_value_fragments):
                continue
        redacted[key] = nested_value
    return redacted


def _get_bound_tenant_from_context(serializer):
    tenant = _peek_bound_tenant_from_context(serializer)
    if tenant is None:
        raise serializers.ValidationError(
            {"tenant": "Tenant-scoped portal serializers must bind tenant from server context."}
        )
    return tenant


def _peek_bound_tenant_from_context(serializer):
    tenant = serializer.context.get("tenant")
    request = serializer.context.get("request")
    if tenant is None and request is not None:
        tenant = getattr(request, "tenant", None)
    return tenant


class PortalGrantSerializer(serializers.ModelSerializer):
    """Internal serializer for portal grant creation/update workflows."""

    raw_token = serializers.CharField(write_only=True, required=True, trim_whitespace=False)

    class Meta:
        model = PortalGrant
        fields = [
            "id",
            "tenant",
            "subject_email",
            "raw_token",
            "token_hash",
            "status",
            "resource_scope",
            "document_sources",
            "expires_at",
            "revoked_at",
            "revoked_by",
            "revoked_reason",
            "created_by",
            "last_accessed_at",
            "max_uses",
            "use_count",
            "created_on",
            "modified_on",
        ]
        read_only_fields = [
            "id",
            "tenant",
            "token_hash",
            "last_accessed_at",
            "use_count",
            "created_on",
            "modified_on",
        ]

    def validate_resource_scope(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Resource scope must be an object keyed by entity type.")

        if not value:
            raise serializers.ValidationError("Resource scope must include at least one allowed entity type.")

        normalized_scope = {}
        unsupported = sorted(set(value.keys()) - set(B2B_PORTAL_ALLOWED_ENTITY_SCOPES))
        if unsupported:
            raise serializers.ValidationError(
                f"Unsupported portal entity scopes: {', '.join(unsupported)}."
            )

        for entity_type, record_ids in value.items():
            if not isinstance(record_ids, list) or not record_ids:
                raise serializers.ValidationError(
                    f"Resource scope for {entity_type} must be a non-empty list of record ids."
                )

            normalized_ids = []
            seen = set()
            for record_id in record_ids:
                if not isinstance(record_id, str):
                    raise serializers.ValidationError(
                        f"Resource scope ids for {entity_type} must be strings."
                    )
                normalized_id = record_id.strip()
                if not normalized_id or normalized_id in seen:
                    continue
                normalized_ids.append(normalized_id)
                seen.add(normalized_id)

            if not normalized_ids:
                raise serializers.ValidationError(
                    f"Resource scope for {entity_type} must contain at least one record id."
                )

            normalized_scope[entity_type] = normalized_ids

        return normalized_scope

    def validate_document_sources(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Document sources must be a list of portal-safe source ids.")

        normalized_sources = []
        unsupported = []
        seen = set()
        for item in value:
            if not isinstance(item, str):
                raise serializers.ValidationError("Document sources must contain only strings.")
            normalized_item = item.strip()
            if not normalized_item or normalized_item in seen:
                continue
            if normalized_item not in B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES:
                unsupported.append(normalized_item)
                continue
            normalized_sources.append(normalized_item)
            seen.add(normalized_item)

        if unsupported:
            raise serializers.ValidationError(
                f"Unsupported portal document sources: {', '.join(sorted(unsupported))}."
            )

        if not normalized_sources:
            raise serializers.ValidationError("Document sources must include at least one allowed source.")

        return normalized_sources

    def validate(self, attrs):
        attrs = super().validate(attrs)
        expires_at = attrs.get("expires_at", getattr(self.instance, "expires_at", None))
        max_uses = attrs.get("max_uses", getattr(self.instance, "max_uses", 1))
        errors = {}

        if (self.instance is None or not self.partial) and "resource_scope" not in attrs:
            errors["resource_scope"] = "Portal grants require at least one scoped entity."

        if (self.instance is None or not self.partial) and "document_sources" not in attrs:
            errors["document_sources"] = "Portal grants require at least one document source."

        if self.instance and "tenant" in getattr(self, "initial_data", {}):
            errors["tenant"] = "Portal grant tenant cannot be changed."

        if errors:
            raise serializers.ValidationError(errors)

        if max_uses < 1:
            raise serializers.ValidationError({"max_uses": "Portal grants must allow at least one use."})

        if expires_at is None:
            raise serializers.ValidationError({"expires_at": "Portal grants require an expiration timestamp."})

        return attrs

    def create(self, validated_data):
        raw_token = validated_data.pop("raw_token", None)
        validated_data["tenant"] = _get_bound_tenant_from_context(self)
        grant = PortalGrant(**validated_data)
        grant.issue_token(raw_token)
        grant.save()
        return grant

    def update(self, instance, validated_data):
        raw_token = validated_data.pop("raw_token", None)
        bound_tenant = _get_bound_tenant_from_context(self)

        if instance.tenant_id != bound_tenant.id:
            raise serializers.ValidationError(
                {"tenant": "Portal grant tenant context does not match the existing record."}
            )

        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)

        if raw_token:
            instance.issue_token(raw_token)

        instance.save()
        return instance


class PortalDocumentReferenceSerializer(serializers.ModelSerializer):
    """Internal serializer for curated portal document registry rows."""

    class Meta:
        model = PortalDocumentReference
        fields = [
            "id",
            "tenant",
            "source_kind",
            "source_record_type",
            "source_record_id",
            "display_name",
            "original_filename",
            "mime_type",
            "byte_size",
            "checksum",
            "storage_backend",
            "storage_key",
            "metadata",
            "is_active",
            "published_at",
            "created_by",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "tenant", "created_on", "modified_on"]

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Portal document metadata must be an object.")
        return _redact_portal_metadata(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and "tenant" in getattr(self, "initial_data", {}):
            raise serializers.ValidationError({"tenant": "Portal document tenant cannot be changed."})
        return attrs

    def create(self, validated_data):
        validated_data["tenant"] = _get_bound_tenant_from_context(self)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        bound_tenant = _get_bound_tenant_from_context(self)
        if instance.tenant_id != bound_tenant.id:
            raise serializers.ValidationError(
                {"tenant": "Portal document tenant context does not match the existing record."}
            )
        return super().update(instance, validated_data)


class PortalDocumentReferencePublicSerializer(serializers.ModelSerializer):
    """Portal-safe serializer that intentionally omits internal storage locators."""

    metadata = serializers.SerializerMethodField()

    class Meta:
        model = PortalDocumentReference
        fields = [
            "source_kind",
            "source_record_type",
            "source_record_id",
            "display_name",
            "original_filename",
            "mime_type",
            "byte_size",
            "metadata",
            "published_at",
        ]

    def get_metadata(self, obj):
        return _redact_portal_metadata(obj.metadata)


class PortalGrantDocumentAccessSerializer(serializers.ModelSerializer):
    """Internal serializer for linking grants to curated portal documents."""

    document_reference_detail = PortalDocumentReferencePublicSerializer(
        source="document_reference",
        read_only=True,
    )

    class Meta:
        model = PortalGrantDocumentAccess
        fields = [
            "id",
            "tenant",
            "grant",
            "document_reference",
            "document_reference_detail",
            "linked_by",
            "linked_at",
            "sort_order",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "tenant", "created_on", "modified_on"]

    def get_fields(self):
        fields = super().get_fields()
        bound_tenant = _peek_bound_tenant_from_context(self)

        if bound_tenant is None:
            fields["grant"].queryset = PortalGrant.objects.none()
            fields["document_reference"].queryset = PortalDocumentReference.objects.none()
            return fields

        fields["grant"].queryset = PortalGrant.objects.filter(tenant=bound_tenant)
        fields["document_reference"].queryset = PortalDocumentReference.objects.filter(tenant=bound_tenant)
        return fields

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bound_tenant = _get_bound_tenant_from_context(self)
        if self.instance and "tenant" in getattr(self, "initial_data", {}):
            raise serializers.ValidationError({"tenant": "Portal document access tenant cannot be changed."})

        grant = attrs.get("grant", getattr(self.instance, "grant", None))
        document_reference = attrs.get(
            "document_reference",
            getattr(self.instance, "document_reference", None),
        )

        if grant and grant.tenant_id != bound_tenant.id:
            raise serializers.ValidationError(
                {"grant": "Portal document access grant must belong to the bound tenant."}
            )

        if document_reference and document_reference.tenant_id != bound_tenant.id:
            raise serializers.ValidationError(
                {"document_reference": "Portal document access document must belong to the bound tenant."}
            )

        return attrs

    def create(self, validated_data):
        validated_data["tenant"] = _get_bound_tenant_from_context(self)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        bound_tenant = _get_bound_tenant_from_context(self)
        if instance.tenant_id != bound_tenant.id:
            raise serializers.ValidationError(
                {"tenant": "Portal document access tenant context does not match the existing record."}
            )
        return super().update(instance, validated_data)


class PortalGrantOperatorSummarySerializer(serializers.ModelSerializer):
    """Operator-safe summary for managing portal grants."""

    tenant_id = serializers.UUIDField(source="tenant.id", read_only=True)
    documents = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    can_resend = serializers.SerializerMethodField()

    class Meta:
        model = PortalGrant
        fields = [
            "id",
            "tenant_id",
            "subject_email",
            "status",
            "resource_scope",
            "document_sources",
            "expires_at",
            "revoked_at",
            "revoked_reason",
            "last_accessed_at",
            "max_uses",
            "use_count",
            "created_on",
            "modified_on",
            "is_expired",
            "is_active",
            "can_resend",
            "documents",
        ]
        read_only_fields = fields

    def get_documents(self, obj):
        links = getattr(obj, "_prefetched_objects_cache", {}).get("document_links")
        if links is None:
            links = (
                obj.document_links.select_related("document_reference")
                .order_by("sort_order", "created_on")
            )

        documents = [
            link.document_reference
            for link in links
            if link.document_reference.is_active
            and link.document_reference.source_kind in obj.document_sources
        ]
        return PortalDocumentReferencePublicSerializer(documents, many=True).data

    def get_is_expired(self, obj):
        return obj.is_expired

    def get_is_active(self, obj):
        return obj.is_active

    def get_can_resend(self, obj):
        return obj.is_active


class PortalGrantOperatorTargetSerializer(serializers.Serializer):
    """Resolved operator target metadata for portal grant management."""

    entity_type = serializers.CharField()
    entity_id = serializers.CharField()
    label = serializers.CharField()
    resource_scope = serializers.JSONField()
    default_document_sources = serializers.ListField(child=serializers.CharField())
    issue_blocker = serializers.CharField(allow_blank=True, allow_null=True)
    available_documents = PortalDocumentReferencePublicSerializer(many=True)


class PortalGrantOperatorTargetResponseSerializer(serializers.Serializer):
    target = PortalGrantOperatorTargetSerializer()
    grants = PortalGrantOperatorSummarySerializer(many=True)


class PortalGrantIssueRequestSerializer(serializers.Serializer):
    subject_email = serializers.EmailField()
    expires_at = serializers.DateTimeField()
    max_uses = serializers.IntegerField(required=False, min_value=1, default=1)

    def validate_expires_at(self, value):
        from django.utils import timezone

        if value <= timezone.now():
            raise serializers.ValidationError("Portal grants must expire in the future.")
        return value


class PortalGrantRevokeRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class PortalGrantIssueResponseSerializer(serializers.Serializer):
    grant = PortalGrantOperatorSummarySerializer()
    raw_token = serializers.CharField()
    share_path = serializers.CharField()


class PortalGrantHistoryResponseSerializer(serializers.Serializer):
    events = TenantAuditEventSerializer(many=True)


# ---------------------------------------------------------------------------
# Runtime Error Log
# ---------------------------------------------------------------------------

class RuntimeErrorLogCreateSerializer(serializers.Serializer):
    """Accepts error reports from the frontend — no model binding for safety."""

    level = serializers.ChoiceField(
        choices=["error", "warn", "fatal"], default="error"
    )
    source = serializers.ChoiceField(
        choices=["frontend", "backend", "api"], default="frontend"
    )
    message = serializers.CharField(max_length=2000)
    stack_trace = serializers.CharField(
        max_length=8000, required=False, default="", allow_blank=True
    )
    component = serializers.CharField(
        max_length=255, required=False, default="", allow_blank=True
    )
    url = serializers.CharField(
        max_length=2048, required=False, default="", allow_blank=True
    )
    user_agent = serializers.CharField(
        max_length=512, required=False, default="", allow_blank=True
    )
    metadata = serializers.JSONField(required=False, default=dict)


class RuntimeErrorLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for admin diagnostics."""

    class Meta:
        from apps.core.models import RuntimeErrorLog

        model = RuntimeErrorLog
        fields = [
            "id",
            "level",
            "source",
            "message",
            "stack_trace",
            "component",
            "url",
            "user_agent",
            "tenant_id",
            "user_id",
            "metadata",
            "fingerprint",
            "occurrence_count",
            "created_on",
        ]
        read_only_fields = fields

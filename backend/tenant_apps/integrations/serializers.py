from __future__ import annotations

from rest_framework import serializers

from .reconciliation import list_candidate_matches
from .models import (
    SettlementEvent,
    SettlementSource,
    SettlementSourceAuthMode,
    TenantAPIKey,
    TenantWebhook,
    TenantWebhookEventType,
    generate_api_key,
    generate_webhook_secret,
)


class TenantWebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantWebhook
        fields = [
            'id',
            'target_url',
            'event_type',
            'is_active',
            'created_on',
            'modified_on',
        ]


class TenantWebhookCreateSerializer(serializers.ModelSerializer):
    signing_secret = serializers.CharField(read_only=True)

    class Meta:
        model = TenantWebhook
        fields = [
            'id',
            'target_url',
            'event_type',
            'is_active',
            'signing_secret',
            'created_on',
            'modified_on',
        ]

    def create(self, validated_data):
        tenant = validated_data.pop('tenant', None) or self.context['tenant']
        user = validated_data.pop('created_by', None) or self.context.get('user')
        validated_data.setdefault('signing_secret', generate_webhook_secret())
        return TenantWebhook.objects.create(tenant=tenant, created_by=user, **validated_data)


class TenantWebhookRotateSecretSerializer(serializers.Serializer):
    signing_secret = serializers.CharField(read_only=True)


class TenantAPIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantAPIKey
        fields = [
            'id',
            'name',
            'key_prefix',
            'last_used_at',
            'revoked_at',
            'created_on',
            'modified_on',
        ]


class TenantAPIKeyCreateSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(read_only=True)

    class Meta:
        model = TenantAPIKey
        fields = [
            'id',
            'name',
            'api_key',
            'key_prefix',
            'created_on',
            'modified_on',
        ]

    def create(self, validated_data):
        tenant = validated_data.pop('tenant', None) or self.context['tenant']
        user = validated_data.pop('created_by', None) or self.context.get('user')

        full_key, prefix, secret_hash = generate_api_key()
        obj = TenantAPIKey.objects.create(
            tenant=tenant,
            created_by=user,
            name=validated_data['name'],
            key_prefix=prefix,
            key_hash=secret_hash,
        )
        obj._api_key = full_key  # exposed once via representation
        return obj

    def to_representation(self, instance):
        data = super().to_representation(instance)
        api_key = getattr(instance, '_api_key', None)
        if api_key:
            data['api_key'] = api_key
        return data


class SettlementSourceSerializer(serializers.ModelSerializer):
    api_key_prefix = serializers.CharField(source='api_key.key_prefix', read_only=True)
    public_ingest_url = serializers.SerializerMethodField()

    class Meta:
        model = SettlementSource
        fields = [
            'id',
            'public_id',
            'name',
            'provider_code',
            'provider_account_reference',
            'auth_mode',
            'is_active',
            'last_received_at',
            'api_key_prefix',
            'public_ingest_url',
            'created_on',
            'modified_on',
        ]

    def get_public_ingest_url(self, obj: SettlementSource) -> str | None:
        request = self.context.get('request')
        if not request or not obj.tenant_id:
            return None
        return request.build_absolute_uri(
            f'/api/v1/tenants/{obj.tenant_id}/integrations/settlement-sources/{obj.public_id}/events/'
        )


class SettlementSourceCreateSerializer(SettlementSourceSerializer):
    api_key = serializers.CharField(read_only=True)
    signing_secret = serializers.CharField(read_only=True)

    class Meta(SettlementSourceSerializer.Meta):
        fields = SettlementSourceSerializer.Meta.fields + ['api_key', 'signing_secret']

    def validate(self, attrs):
        auth_mode = attrs.get('auth_mode')
        if auth_mode not in {
            SettlementSourceAuthMode.TENANT_API_KEY,
            SettlementSourceAuthMode.PROVIDER_HMAC_SIGNATURE,
        }:
            raise serializers.ValidationError({'auth_mode': 'Unsupported settlement source auth mode'})
        return attrs

    def create(self, validated_data):
        tenant = validated_data.pop('tenant', None) or self.context['tenant']
        user = validated_data.pop('created_by', None) or self.context.get('user')
        source = SettlementSource.objects.create(tenant=tenant, created_by=user, **validated_data)
        credential_kind, credential_value = source.provision_credential(created_by=user)
        source._credential_kind = credential_kind
        source._credential_value = credential_value
        return source

    def to_representation(self, instance):
        data = super().to_representation(instance)
        credential_kind = getattr(instance, '_credential_kind', None)
        credential_value = getattr(instance, '_credential_value', None)
        if credential_kind and credential_value:
            data[credential_kind] = credential_value
        return data


class SettlementEventSerializer(serializers.ModelSerializer):
    source_public_id = serializers.UUIDField(source='source.public_id', read_only=True)
    source_name = serializers.CharField(source='source.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    matched_entity_type = serializers.SerializerMethodField()
    matched_entity_reference = serializers.SerializerMethodField()

    class Meta:
        model = SettlementEvent
        fields = [
            'id',
            'source',
            'source_public_id',
            'source_name',
            'provider_code',
            'provider_account_reference',
            'external_event_id',
            'event_type',
            'direction',
            'occurred_at',
            'amount',
            'currency',
            'raw_payload',
            'raw_payload_sha256',
            'idempotency_key',
            'state',
            'normalized_payload',
            'reconciliation_reason_code',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'review_action',
            'review_note',
            'matched_purchase_order',
            'matched_sales_order',
            'matched_invoice',
            'matched_entity_type',
            'matched_entity_reference',
            'payment_transaction',
            'delivery_count',
            'received_at',
            'last_received_at',
            'processed_at',
            'processing_task_id',
            'last_error',
            'created_on',
            'modified_on',
        ]
        read_only_fields = fields

    def get_matched_entity_type(self, obj: SettlementEvent) -> str | None:
        if obj.matched_invoice_id:
            return 'invoice'
        if obj.matched_sales_order_id:
            return 'sales_order'
        if obj.matched_purchase_order_id:
            return 'purchase_order'
        return None

    def get_matched_entity_reference(self, obj: SettlementEvent) -> str | None:
        if obj.matched_invoice_id:
            return getattr(obj.matched_invoice, 'invoice_number', None)
        if obj.matched_sales_order_id:
            return getattr(obj.matched_sales_order, 'our_sales_order_num', None)
        if obj.matched_purchase_order_id:
            return getattr(obj.matched_purchase_order, 'order_number', None)
        return None


class SettlementEventDetailSerializer(SettlementEventSerializer):
    candidate_matches = serializers.SerializerMethodField()

    class Meta(SettlementEventSerializer.Meta):
        fields = SettlementEventSerializer.Meta.fields + ['candidate_matches']

    def get_candidate_matches(self, obj: SettlementEvent):
        return list_candidate_matches(event=obj)


class SettlementApproveSerializer(serializers.Serializer):
    note = serializers.CharField(trim_whitespace=True, max_length=1000)


class SettlementRejectSerializer(serializers.Serializer):
    note = serializers.CharField(trim_whitespace=True, max_length=1000)


class SettlementRelinkSerializer(serializers.Serializer):
    entity_type = serializers.ChoiceField(choices=['invoice', 'sales_order', 'purchase_order'])
    object_id = serializers.IntegerField(min_value=1)
    note = serializers.CharField(trim_whitespace=True, max_length=1000)


class SettlementEventIngestSerializer(serializers.Serializer):
    external_event_id = serializers.CharField(max_length=120, required=False, allow_blank=True)
    event_type = serializers.CharField(max_length=64)
    direction = serializers.CharField(max_length=32)
    occurred_at = serializers.DateTimeField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=3)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Settlement amount must be positive')
        return value

    def validate_currency(self, value):
        currency = value.upper()
        if len(currency) != 3 or not currency.isalpha():
            raise serializers.ValidationError('Currency must be a 3-letter ISO code')
        return currency

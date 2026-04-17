from __future__ import annotations

from rest_framework import serializers

from .models import TenantAPIKey, TenantWebhook, TenantWebhookEventType, generate_api_key, generate_webhook_secret


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

from __future__ import annotations

from rest_framework import serializers

from apps.core.models import TenantAuditEvent


class TenantAuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantAuditEvent
        fields = [
            "id",
            "tenant",
            "entity_type",
            "entity_name",
            "object_id",
            "action",
            "changed_fields",
            "snapshot_before",
            "snapshot_after",
            "actor",
            "actor_email",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = fields

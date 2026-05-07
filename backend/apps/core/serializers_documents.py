"""Shared serializers and validation helpers for operational document actions."""

from __future__ import annotations

from rest_framework import serializers

from apps.core.services.document_workflows import validate_initial_status, validate_status_transition


class DocumentStatusValidationMixin:
    """Validate workflow transitions when a serializer updates status."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "status" not in attrs:
            return attrs

        instance = getattr(self, "instance", None)
        if instance is None:
            validate_initial_status(self.Meta.model, attrs["status"])
            return attrs

        if str(getattr(instance, "status", "") or "").strip() != str(attrs["status"] or "").strip():
            validate_status_transition(instance, attrs["status"])
        return attrs


class DocumentStatusTransitionSerializer(serializers.Serializer):
    """Payload for explicit workflow transitions."""

    status = serializers.CharField(max_length=64)

    def validate_status(self, value: str) -> str:
        document = self.context["document"]
        validate_status_transition(document, value)
        return value


class DocumentEmailRequestSerializer(serializers.Serializer):
    """Payload for emailing a generated transactional document."""

    to = serializers.ListField(child=serializers.EmailField(), allow_empty=False)
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField(allow_blank=True)

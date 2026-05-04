"""
Serializers for Core app.
"""
from rest_framework import serializers
from apps.core.models import UserPreferences, UserFavorite


class UserPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for UserPreferences model."""

    username = serializers.CharField(source='user.username', read_only=True)
    onboarding_state = serializers.JSONField(required=False)

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
    def _normalize_onboarding_state(value):
        """Validate and normalize the canonical onboarding tour contract."""
        if value is None:
            return {'completed_tours': []}
        if not isinstance(value, dict):
            raise serializers.ValidationError('Onboarding state must be an object.')

        unsupported_keys = set(value.keys()) - {'completed_tours'}
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

        return {'completed_tours': normalized_tours}

    def validate_onboarding_state(self, value):
        return self._normalize_onboarding_state(value)

    @staticmethod
    def _represent_onboarding_state(widget_preferences):
        onboarding_payload = widget_preferences.get('onboarding') if isinstance(widget_preferences, dict) else {}
        if not isinstance(onboarding_payload, dict):
            return {'completed_tours': []}

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

        return {'completed_tours': normalized_tours}

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

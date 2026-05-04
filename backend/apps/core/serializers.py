"""
Serializers for Core app.
"""
from rest_framework import serializers
from apps.core.models import UserPreferences, UserFavorite


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

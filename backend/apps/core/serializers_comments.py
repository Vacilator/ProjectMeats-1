from __future__ import annotations

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.core.comments import resolve_entity_for_tenant
from apps.core.models import Comment
from apps.tenants.models import TenantUser


class CommentSerializer(serializers.ModelSerializer):
    tenant_id = serializers.UUIDField(source='tenant.id', read_only=True)
    entity_id = serializers.CharField(source='object_id')
    created_by = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    mentioned_user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    mentioned_users = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id',
            'tenant_id',
            'entity_type',
            'entity_id',
            'body',
            'created_by',
            'created_by_name',
            'mentioned_user_ids',
            'mentioned_users',
            'created_on',
            'modified_on',
        ]
        read_only_fields = [
            'id',
            'tenant_id',
            'created_by',
            'created_by_name',
            'mentioned_users',
            'created_on',
            'modified_on',
        ]

    def get_created_by(self, obj):
        user = obj.created_by
        if not user:
            return None
        display_name = ' '.join(part for part in [user.first_name, user.last_name] if part).strip() or user.username
        return {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'display_name': display_name,
        }

    def get_created_by_name(self, obj):
        payload = self.get_created_by(obj)
        return payload['display_name'] if payload else ''

    def get_mentioned_users(self, obj):
        mention_ids = [int(value) for value in (obj.mentions or []) if str(value).isdigit()]
        if not mention_ids:
            return []

        memberships = {
            membership.user_id: membership
            for membership in TenantUser.objects.filter(
                tenant=obj.tenant,
                user_id__in=mention_ids,
                is_active=True,
            ).select_related('user')
        }

        users = []
        for mention_id in mention_ids:
            membership = memberships.get(mention_id)
            user = getattr(membership, 'user', None)
            if not user:
                continue
            display_name = ' '.join(part for part in [user.first_name, user.last_name] if part).strip() or user.username
            users.append(
                {
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'display_name': display_name,
                }
            )
        return users

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError({'tenant': 'Tenant context required'})

        entity_type = attrs.get('entity_type') or getattr(self.instance, 'entity_type', None)
        object_id = attrs.get('object_id') or getattr(self.instance, 'object_id', None)
        if not entity_type or object_id in (None, ''):
            raise serializers.ValidationError({'entity_id': 'Entity reference is required'})

        try:
            resolved_type, model, entity = resolve_entity_for_tenant(
                tenant=tenant,
                entity_type=entity_type,
                entity_id=object_id,
            )
        except ValueError as exc:
            raise serializers.ValidationError({'entity_type': str(exc)}) from exc
        except LookupError as exc:
            raise serializers.ValidationError({'entity_type': str(exc)}) from exc
        except ObjectDoesNotExist as exc:
            raise serializers.ValidationError({'entity_id': 'Entity not found for current tenant'}) from exc

        attrs['entity_type'] = resolved_type
        attrs['content_type'] = ContentType.objects.get_for_model(model)
        attrs['object_id'] = str(entity.pk)
        attrs['mentions'] = self._validate_mentions(tenant=tenant, attrs=attrs)
        return attrs

    def _validate_mentions(self, *, tenant, attrs):
        mention_ids = attrs.pop('mentioned_user_ids', None)
        if mention_ids is None:
            if self.instance:
                return list(self.instance.mentions or [])
            return []

        normalized_ids = list(dict.fromkeys(int(value) for value in mention_ids))
        if not normalized_ids:
            return []

        found_ids = set(
            TenantUser.objects.filter(
                tenant=tenant,
                user_id__in=normalized_ids,
                is_active=True,
            ).values_list('user_id', flat=True)
        )
        missing_ids = [user_id for user_id in normalized_ids if user_id not in found_ids]
        if missing_ids:
            raise serializers.ValidationError({'mentioned_user_ids': 'Mentioned users must belong to the current tenant'})

        return normalized_ids

    def create(self, validated_data):
        request = self.context.get('request')
        comment = Comment.objects.create(
            tenant=request.tenant,
            created_by=request.user,
            **validated_data,
        )
        self._create_notifications(comment=comment)
        return comment

    def update(self, instance, validated_data):
        validated_data.pop('content_type', None)
        validated_data.pop('object_id', None)
        validated_data.pop('entity_type', None)
        return super().update(instance, validated_data)

    def _create_notifications(self, *, comment: Comment):
        mention_ids = [int(value) for value in (comment.mentions or []) if str(value).isdigit()]
        if not mention_ids:
            return

        try:
            from tenant_apps.workflows.models import NotificationType, UserNotification
        except Exception:  # pragma: no cover
            return

        author_name = self.get_created_by_name(comment) or 'A teammate'
        action_url = f'/records/{comment.entity_type}/{comment.object_id}'
        message = f'{author_name} mentioned you in a comment.'
        excerpt = str(comment.body or '').strip()
        if excerpt:
            message = f'{message} "{excerpt[:140]}"'

        for user in User.objects.filter(id__in=mention_ids):
            if comment.created_by_id and user.id == comment.created_by_id:
                continue
            UserNotification.objects.create(
                tenant=comment.tenant,
                user=user,
                notification_type=NotificationType.MENTION,
                title='You were mentioned',
                message=message,
                entity_type=comment.entity_type,
                action_url=action_url,
                metadata={
                    'comment_id': comment.id,
                    'entity_type': comment.entity_type,
                    'entity_id': comment.object_id,
                },
            )

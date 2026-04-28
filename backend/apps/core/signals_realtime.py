from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core.models import TenantAwareModel
from apps.core.realtime import broadcast_tenant_mutation


def _is_concrete_tenant_model(instance) -> bool:
    return isinstance(instance, TenantAwareModel) and not instance._meta.abstract


@receiver(post_save)
def broadcast_tenant_model_save(sender, instance, created, **kwargs):
    if not _is_concrete_tenant_model(instance):
        return

    if getattr(instance, 'is_deleted', False):
        action = 'DELETE'
    elif created:
        action = 'CREATE'
    else:
        action = 'UPDATE'

    broadcast_tenant_mutation(instance=instance, action=action, created=created)


@receiver(post_delete)
def broadcast_tenant_model_delete(sender, instance, **kwargs):
    if not _is_concrete_tenant_model(instance):
        return

    broadcast_tenant_mutation(instance=instance, action='DELETE', created=False)

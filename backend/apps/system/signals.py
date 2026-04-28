from __future__ import annotations

from django.apps import apps as django_apps
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core.cache_utils import bump_shared_cache_version, bump_tenant_cache_version


def _tenant_id_from_instance(instance) -> str | None:
    tenant_id = getattr(instance, 'tenant_id', None)
    return str(tenant_id) if tenant_id else None


def _bump_system_choices(tenant_id: str | None = None) -> None:
    if tenant_id:
        bump_tenant_cache_version('system_choices', tenant_id)
    else:
        bump_shared_cache_version('system_choices')


def _bump_system_products(tenant_id: str | None = None) -> None:
    if tenant_id:
        bump_tenant_cache_version('system_products', tenant_id)
    else:
        bump_shared_cache_version('system_products')


def _bump_tenant_configs(tenant_id: str | None) -> None:
    if tenant_id:
        bump_tenant_cache_version('tenant_configs', tenant_id)


def _bump_universal_search(tenant_id: str | None = None) -> None:
    if tenant_id:
        bump_tenant_cache_version('universal_search', tenant_id)
    else:
        bump_shared_cache_version('universal_search')


SystemChoiceList = django_apps.get_model('system', 'SystemChoiceList')
SystemChoiceItem = django_apps.get_model('system', 'SystemChoiceItem')
TenantChoiceOverride = django_apps.get_model('system', 'TenantChoiceOverride')
TenantConfig = django_apps.get_model('system', 'TenantConfig')
Product = django_apps.get_model('system', 'Product')
TenantProductPreference = django_apps.get_model('system', 'TenantProductPreference')


@receiver([post_save, post_delete], sender=SystemChoiceList)
def _system_choice_list_changed(sender, instance, **kwargs):
    _bump_system_choices()


@receiver([post_save, post_delete], sender=SystemChoiceItem)
def _system_choice_item_changed(sender, instance, **kwargs):
    _bump_system_choices(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=TenantChoiceOverride)
def _tenant_choice_override_changed(sender, instance, **kwargs):
    _bump_system_choices(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=TenantConfig)
def _tenant_config_changed(sender, instance, **kwargs):
    _bump_tenant_configs(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=Product)
def _product_changed(sender, instance, **kwargs):
    _bump_system_products()
    _bump_universal_search()


@receiver([post_save, post_delete], sender=TenantProductPreference)
def _tenant_product_preference_changed(sender, instance, **kwargs):
    tenant_id = _tenant_id_from_instance(instance)
    _bump_system_products(tenant_id)
    _bump_universal_search(tenant_id)

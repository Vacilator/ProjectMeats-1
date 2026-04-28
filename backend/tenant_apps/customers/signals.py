from __future__ import annotations

from django.apps import apps as django_apps
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core.cache_utils import bump_tenant_cache_version


def _tenant_id_from_instance(instance) -> str | None:
    tenant_id = getattr(instance, 'tenant_id', None)
    return str(tenant_id) if tenant_id else None


def _bump_customers(tenant_id: str | None) -> None:
    if tenant_id:
        bump_tenant_cache_version('customers', tenant_id)
        bump_tenant_cache_version('universal_search', tenant_id)


Customer = django_apps.get_model('customers', 'Customer')
Location = django_apps.get_model('locations', 'Location')
LocationAssociatedMasterProduct = django_apps.get_model('locations', 'LocationAssociatedMasterProduct')
Contact = django_apps.get_model('contacts', 'Contact')
ContactPreferredMasterProduct = django_apps.get_model('contacts', 'ContactPreferredMasterProduct')


@receiver([post_save, post_delete], sender=Customer)
def _customer_changed(sender, instance, **kwargs):
    _bump_customers(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=Location)
def _location_changed(sender, instance, **kwargs):
    # Customer list rollup depends on customer_locations and their product links.
    _bump_customers(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=LocationAssociatedMasterProduct)
def _location_products_changed(sender, instance, **kwargs):
    _bump_customers(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=Contact)
def _contact_changed(sender, instance, **kwargs):
    # Customer list rollup depends on contacts under locations.
    if getattr(instance, 'location_id', None) is not None:
        _bump_customers(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=ContactPreferredMasterProduct)
def _contact_preferred_products_changed(sender, instance, **kwargs):
    _bump_customers(_tenant_id_from_instance(instance))

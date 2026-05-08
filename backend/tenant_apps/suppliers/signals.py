from __future__ import annotations

from django.apps import apps as django_apps
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core.cache_utils import bump_tenant_cache_version


def _tenant_id_from_instance(instance) -> str | None:
    tenant_id = getattr(instance, "tenant_id", None)
    return str(tenant_id) if tenant_id else None


def _bump_suppliers(tenant_id: str | None) -> None:
    if tenant_id:
        bump_tenant_cache_version("suppliers", tenant_id)


Supplier = django_apps.get_model("suppliers", "Supplier")
Plant = django_apps.get_model("plants", "Plant")
PlantAssociatedMasterProduct = django_apps.get_model("plants", "PlantAssociatedMasterProduct")


@receiver([post_save, post_delete], sender=Supplier)
def _supplier_changed(sender, instance, **kwargs):
    _bump_suppliers(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=Plant)
def _plant_changed(sender, instance, **kwargs):
    # Supplier list rollup depends on supplier_plants and their product links.
    _bump_suppliers(_tenant_id_from_instance(instance))


@receiver([post_save, post_delete], sender=PlantAssociatedMasterProduct)
def _plant_products_changed(sender, instance, **kwargs):
    _bump_suppliers(_tenant_id_from_instance(instance))

"""Static guardrail: tenant-scoped ViewSets must not expose cross-tenant querysets.

This test enumerates router-registered ViewSets for tenant apps and asserts that
any ViewSet operating on a model with a `tenant` field overrides `get_queryset`
(or inherits a base class that does).

Why:
- The DRF default `GenericAPIView.get_queryset` returns `self.queryset` (often
  `.objects.all()`), which is unsafe in shared-schema multi-tenancy.
- We want a CI catch before a regression ships.
"""

from __future__ import annotations

import importlib

from django.test import SimpleTestCase
from rest_framework.generics import GenericAPIView


TENANT_APP_URL_MODULES = [
    'tenant_apps.suppliers.urls',
    'tenant_apps.customers.urls',
    'tenant_apps.contacts.urls',
    'tenant_apps.plants.urls',
    'tenant_apps.locations.urls',
    'tenant_apps.carriers.urls',
    'tenant_apps.purchase_orders.urls',
    'tenant_apps.sales_orders.urls',
    'tenant_apps.invoices.urls',
    'tenant_apps.inquiries.urls',
    'tenant_apps.fulfillments.urls',
    'tenant_apps.workflows.urls',
    'tenant_apps.bug_reports.urls',
    'tenant_apps.integrations.urls',
]


class TenantViewSetTenantFilterAuditTests(SimpleTestCase):
    def test_tenant_models_do_not_use_unsafe_default_get_queryset(self):
        offenders: list[str] = []

        for mod_path in TENANT_APP_URL_MODULES:
            mod = importlib.import_module(mod_path)
            router = getattr(mod, 'router', None)
            if router is None:
                continue

            for prefix, viewset_cls, _basename in getattr(router, 'registry', []):
                queryset = getattr(viewset_cls, 'queryset', None)
                model = getattr(queryset, 'model', None) if queryset is not None else None
                if model is None:
                    continue

                # Only enforce tenant-scoped models.
                if not any(getattr(f, 'name', None) == 'tenant' for f in model._meta.get_fields()):
                    continue

                # If a tenant-scoped model uses the DRF default get_queryset, it's almost certainly unsafe.
                if viewset_cls.get_queryset is GenericAPIView.get_queryset:
                    offenders.append(f'{mod_path}:{viewset_cls.__name__} (prefix={prefix}, model={model.__name__})')

        if offenders:
            joined = '\n'.join(offenders)
            raise AssertionError(
                'Tenant-scoped ViewSets must override get_queryset (or inherit a tenant-filtered base).\n'
                f'Offenders:\n{joined}'
            )

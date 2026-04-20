from django.test import SimpleTestCase

from apps.core.management.commands.audit_rls_compliance import Command


class AuditRlsComplianceCommandTest(SimpleTestCase):
    def test_includes_non_tenantaware_allowlist_models(self):
        cmd = Command()
        models = cmd.get_tenant_aware_models()
        labels = {f"{m._meta.app_label}.{m.__name__}" for m in models}

        # These models are tenant-scoped but do not inherit TenantAwareModel.
        self.assertIn("system.TenantForm", labels)
        self.assertIn("system.TenantWorkForm", labels)
        self.assertIn("integrations.ExternalAuthProvider", labels)

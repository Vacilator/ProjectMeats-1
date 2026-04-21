"""
RLS Policy Audit Management Command (Phase 9.3)

Verifies that all tenant-aware models have corresponding PostgreSQL RLS policies.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.apps import apps
from apps.core.models import TenantAwareModel


class Command(BaseCommand):
    help = 'Audit RLS policy compliance for all tenant-aware models'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Automatically create missing RLS policies'
        )
        parser.add_argument(
            '--strict',
            action='store_true',
            help='Exit non-zero if any models are not RLS compliant'
        )
    
    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('RLS POLICY COMPLIANCE AUDIT'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')
        
        # Get all models inheriting from TenantAwareModel
        tenant_models = self.get_tenant_aware_models()
        
        self.stdout.write(f'Found {len(tenant_models)} tenant-aware models')
        self.stdout.write('')
        
        # Check each model for RLS policy
        results = []
        for model in tenant_models:
            table_name = model._meta.db_table
            policy_name = f"{table_name}_tenant_isolation"
            
            has_rls = self.check_rls_enabled(table_name)
            has_policy = self.check_policy_exists(policy_name, table_name)
            
            results.append({
                'model': model.__name__,
                'table': table_name,
                'policy': policy_name,
                'rls_enabled': has_rls,
                'policy_exists': has_policy,
                'compliant': has_rls and has_policy
            })
        
        # Display results
        compliant_count = 0
        for result in results:
            if result['compliant']:
                self.stdout.write(
                    self.style.SUCCESS(f"✓ {result['model']} ({result['table']})")
                )
                compliant_count += 1
            else:
                self.stdout.write(
                    self.style.ERROR(f"✗ {result['model']} ({result['table']})")
                )
                
                if not result['rls_enabled']:
                    self.stdout.write(f"  → RLS not enabled")
                if not result['policy_exists']:
                    self.stdout.write(f"  → Policy '{result['policy']}' not found")
                
                if options['fix']:
                    self.fix_rls_policy(result)
        
        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(f"Compliant: {compliant_count}/{len(results)} models")
        
        if compliant_count == len(results):
            self.stdout.write(self.style.SUCCESS('✓ ALL MODELS ARE RLS COMPLIANT'))
        else:
            self.stdout.write(
                self.style.ERROR(
                    f'✗ {len(results) - compliant_count} models need attention'
                )
            )
            if not options['fix']:
                self.stdout.write('')
                self.stdout.write('Run with --fix to automatically create missing policies')
        
        self.stdout.write(self.style.WARNING('=' * 80))

        if options.get('strict') and compliant_count != len(results):
            raise CommandError(f"{len(results) - compliant_count} models are not RLS compliant")
    
    def get_tenant_aware_models(self):
        """Get models that MUST have RLS.

        Historically we audited only TenantAwareModel subclasses.
        For defense-in-depth we also include a small allowlist of non-TenantAwareModel
        models that still carry a tenant FK and store sensitive tenant-scoped data.
        """

        models = []
        for model in apps.get_models():
            if issubclass(model, TenantAwareModel) and model != TenantAwareModel:
                models.append(model)

        # Non-TenantAwareModel tables that must still have RLS enabled.
        must_have = {
            # System WorkForms (tenant-bearing tables in apps.system)
            "system.TenantForm",
            "system.TenantWorkForm",

            # Integrations (tenant-bearing tables in apps.integrations)
            "integrations.ExternalAuthProvider",
            "integrations.EmailLog",

            # Email integration (tenant-bearing tables in apps.email_integration)
            "email_integration.EmailAccount",
            "email_integration.EmailAction",
            "email_integration.EmailLog",
            "email_integration.EmailTrigger",
        }
        for label in sorted(must_have):
            try:
                models.append(apps.get_model(label))
            except Exception:
                # If an app is not installed in the current environment, skip.
                continue

        # De-dupe while keeping stable output order.
        seen = set()
        out = []
        for m in models:
            key = f"{m._meta.app_label}.{m.__name__}"
            if key in seen:
                continue
            seen.add(key)
            out.append(m)
        return out
    
    def check_rls_enabled(self, table_name):
        """
        Check if RLS is enabled on a table.
        """
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT relrowsecurity
                FROM pg_class
                WHERE relname = %s
            """, [table_name])
            
            result = cursor.fetchone()
            return result and result[0]
    
    def check_policy_exists(self, policy_name, table_name):
        """
        Check if an RLS policy exists.

        Note: The codebase historically used multiple naming conventions for the same intent.
        We check both the explicit policy_name and the presence of *any* "*_tenant_isolation"
        policy on the table as an acceptable match.
        """
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM pg_policies
                WHERE tablename = %s
                  AND (
                    policyname = %s
                    OR policyname LIKE %s
                  )
                """,
                [table_name, policy_name, '%_tenant_isolation'],
            )

            result = cursor.fetchone()
            return result and result[0] > 0
    
    def fix_rls_policy(self, result):
        """
        Automatically create missing RLS policy.
        """
        table_name = result['table']
        policy_name = result['policy']
        
        try:
            with connection.cursor() as cursor:
                # Enable RLS if not enabled
                if not result['rls_enabled']:
                    cursor.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Enabled RLS on {table_name}")
                    )
                
                # Create policy if not exists
                if not result['policy_exists']:
                    cursor.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
                    cursor.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")
                    cursor.execute(f"""
                        CREATE POLICY {policy_name} ON {table_name}
                        FOR ALL
                        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
                    """)
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Created policy {policy_name}")
                    )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"  ✗ Failed to fix: {str(e)}")
            )

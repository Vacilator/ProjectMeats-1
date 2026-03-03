"""
RLS Policy Audit Management Command (Phase 9.3)

Verifies that all tenant-aware models have corresponding PostgreSQL RLS policies.
"""
from django.core.management.base import BaseCommand
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
    
    def get_tenant_aware_models(self):
        """
        Get all models that inherit from TenantAwareModel.
        """
        models = []
        for model in apps.get_models():
            if issubclass(model, TenantAwareModel) and model != TenantAwareModel:
                models.append(model)
        return models
    
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
        """
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*)
                FROM pg_policies
                WHERE policyname = %s AND tablename = %s
            """, [policy_name, table_name])
            
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
                    cursor.execute(f"""
                        CREATE POLICY {policy_name} ON {table_name}
                        USING (tenant_id = current_setting('app.current_tenant')::uuid)
                    """)
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Created policy {policy_name}")
                    )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"  ✗ Failed to fix: {str(e)}")
            )

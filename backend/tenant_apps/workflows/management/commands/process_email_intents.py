"""
Process Email Intents Management Command

Batch process emails using AI Intent Recognition engine.

Usage:
    python manage.py process_email_intents --tenant=<uuid>
    python manage.py process_email_intents --tenant=<uuid> --batch-size=20
    python manage.py process_email_intents --all-tenants

Created: 2026-03-04 - Phase 10.3: AI Intent Recognition
"""
from django.core.management.base import BaseCommand
from django.apps import apps


class Command(BaseCommand):
    help = 'Process emails using AI Intent Recognition engine'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='Tenant UUID to process emails for',
        )
        parser.add_argument(
            '--all-tenants',
            action='store_true',
            help='Process emails for all tenants',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=10,
            help='Number of emails to process per tenant (default: 10)',
        )
    
    def handle(self, *args, **options):
        tenant_id = options.get('tenant')
        all_tenants = options.get('all_tenants')
        batch_size = options.get('batch_size', 10)
        
        if not tenant_id and not all_tenants:
            self.stdout.write(self.style.ERROR(
                'Error: Must specify --tenant=<uuid> or --all-tenants'
            ))
            return 1
        
        # Import here to avoid circular dependencies
        from tenant_apps.workflows.services.intent_engine import IntentEngineBatchProcessor
        from apps.tenants.models import Tenant
        
        if all_tenants:
            tenants = Tenant.objects.filter(is_active=True)
            self.stdout.write(f'Processing emails for {tenants.count()} tenants...\n')
        else:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
                tenants = [tenant]
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Tenant {tenant_id} not found'))
                return 1
        
        total_stats = {
            'processed': 0,
            'orders_triggered': 0,
            'inquiries': 0,
            'errors': 0
        }
        
        for tenant in tenants:
            self.stdout.write(f'\n{tenant.name} ({tenant.slug}):')
            self.stdout.write('  Processing emails...')
            
            processor = IntentEngineBatchProcessor(str(tenant.id))
            stats = processor.process_email_log(batch_size)
            
            if 'error' in stats:
                self.stdout.write(self.style.ERROR(f'  ✗ Error: {stats["error"]}'))
                continue
            
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Processed: {stats["processed"]}'
            ))
            if stats['orders_triggered'] > 0:
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ Orders Triggered: {stats["orders_triggered"]}'
                ))
            if stats['inquiries'] > 0:
                self.stdout.write(f'  ℹ️  Inquiries: {stats["inquiries"]}')
            if stats['errors'] > 0:
                self.stdout.write(self.style.WARNING(
                    f'  ⚠️  Errors: {stats["errors"]}'
                ))
            
            # Accumulate totals
            for key in total_stats:
                total_stats[key] += stats.get(key, 0)
        
        # Summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write('SUMMARY')
        self.stdout.write('='*60)
        self.stdout.write(f'  Total Processed: {total_stats["processed"]}')
        self.stdout.write(f'  Orders Triggered: {total_stats["orders_triggered"]}')
        self.stdout.write(f'  Inquiries: {total_stats["inquiries"]}')
        if total_stats['errors'] > 0:
            self.stdout.write(self.style.WARNING(
                f'  Errors: {total_stats["errors"]}'
            ))
        
        return 0

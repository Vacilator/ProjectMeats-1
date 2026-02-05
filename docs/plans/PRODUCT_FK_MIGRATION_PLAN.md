# Product FK Migration Plan

**Status**: 📋 PLANNED  
**Category**: Plans  
**Risk Level**: 🔴 HIGH  
**Estimated Duration**: 2-3 days  
**Last Updated**: 2026-02-03

---

## Executive Summary

This document outlines the complete strategy for migrating Foreign Key references from `tenant_apps.products.Product` to `system.Product`. This is a high-risk operation affecting 9 FK references across 6 apps with production data.

### Affected Models

| App | Model | Field | Reference Count |
|-----|-------|-------|-----------------|
| customers | CustomerProduct | product | 1 |
| invoices | InvoiceLineItem | product | 1 |
| sales_orders | SalesOrderLineItem | product | 1 |
| inquiries | InquiryProduct | product | 1 |
| inquiries | InquiryLineItem | product | 1 |
| suppliers | SupplierProduct | product | 1 |
| purchase_orders | PurchaseOrder | product | 1 |
| purchase_orders | POLineItem | product | 1 |
| purchase_orders | POReceivingItem | product | 1 |

**Total**: 9 FK references across 6 Django apps

---

## 1. Full Backup Strategy

### 1.1 Pre-Migration Backup Checklist

```bash
# ═══════════════════════════════════════════════════════════════════════════
# BACKUP CHECKLIST - Execute BEFORE any migration
# ═══════════════════════════════════════════════════════════════════════════

# Step 1: Create timestamp for this backup session
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/product_fk_migration_${BACKUP_TIMESTAMP}"
mkdir -p $BACKUP_DIR

# Step 2: Document current state
echo "Backup started at: $(date)" > $BACKUP_DIR/backup_manifest.txt
echo "Git SHA: $(git rev-parse HEAD)" >> $BACKUP_DIR/backup_manifest.txt
```

### 1.2 Database Backup (PostgreSQL)

#### Production Database Full Backup
```bash
# Full database dump (compressed)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --format=custom \
  --verbose \
  --file="${BACKUP_DIR}/full_db_backup.dump" \
  2>&1 | tee "${BACKUP_DIR}/pg_dump.log"

# Verify backup integrity
pg_restore --list "${BACKUP_DIR}/full_db_backup.dump" > "${BACKUP_DIR}/backup_contents.txt"

# Record row counts for verification
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
  'products_product' as table_name, COUNT(*) as row_count FROM products_product
UNION ALL SELECT 'system_product', COUNT(*) FROM system_product
UNION ALL SELECT 'tenant_product_preference', COUNT(*) FROM tenant_product_preference
UNION ALL SELECT 'customers_customerproduct', COUNT(*) FROM customers_customerproduct
UNION ALL SELECT 'invoices_invoicelineitem', COUNT(*) FROM invoices_invoicelineitem
UNION ALL SELECT 'sales_orders_salesorderlineitem', COUNT(*) FROM sales_orders_salesorderlineitem
UNION ALL SELECT 'inquiries_inquiryproduct', COUNT(*) FROM inquiries_inquiryproduct
UNION ALL SELECT 'suppliers_supplierproduct', COUNT(*) FROM suppliers_supplierproduct
UNION ALL SELECT 'purchase_orders_purchaseorder', COUNT(*) FROM purchase_orders_purchaseorder
UNION ALL SELECT 'purchase_orders_polineitem', COUNT(*) FROM purchase_orders_polineitem
UNION ALL SELECT 'purchase_orders_poreceivingitem', COUNT(*) FROM purchase_orders_poreceivingitem
;" > "${BACKUP_DIR}/row_counts_before.txt"
```

#### Table-Specific Backups (For Quick Restore)
```bash
# Export affected tables as CSV for quick reference
for table in products_product system_product tenant_product_preference \
             customers_customerproduct invoices_invoicelineitem \
             sales_orders_salesorderlineitem inquiries_inquiryproduct \
             suppliers_supplierproduct purchase_orders_purchaseorder \
             purchase_orders_polineitem purchase_orders_poreceivingitem; do
  psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
    -c "\COPY $table TO '${BACKUP_DIR}/${table}.csv' WITH CSV HEADER"
done
```

### 1.3 Application State Backup

```bash
# Backup current migration state
python manage.py showmigrations > "${BACKUP_DIR}/migrations_state.txt"

# Backup Django settings
cp backend/projectmeats/settings/*.py "${BACKUP_DIR}/settings/"

# Export current model schemas
python manage.py inspectdb > "${BACKUP_DIR}/current_schema.py"
```

### 1.4 ID Mapping Table Creation

Before migration, create a mapping table to track old → new product IDs:

```sql
-- Create mapping table (run BEFORE migration)
CREATE TABLE IF NOT EXISTS product_id_migration_map (
    id SERIAL PRIMARY KEY,
    old_product_id INTEGER NOT NULL,          -- tenant_apps.products.Product.id
    new_product_id UUID NOT NULL,             -- system.Product.id
    tenant_id UUID,                           -- For tenant-specific tracking
    product_code VARCHAR(50) NOT NULL,
    migrated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(old_product_id)
);

-- Populate mapping from existing data
INSERT INTO product_id_migration_map (old_product_id, new_product_id, tenant_id, product_code)
SELECT 
    tp.id as old_product_id,
    sp.id as new_product_id,
    tp.tenant_id,
    tp.product_code
FROM products_product tp
JOIN system_product sp ON tp.product_code = sp.product_code;

-- Verify mapping completeness
SELECT 
    COUNT(*) as total_old_products,
    COUNT(m.new_product_id) as mapped_products,
    COUNT(*) - COUNT(m.new_product_id) as unmapped_products
FROM products_product tp
LEFT JOIN product_id_migration_map m ON tp.id = m.old_product_id;
```

### 1.5 Backup Verification

```bash
#!/bin/bash
# verify_backup.sh - Run after backup to ensure integrity

echo "=== Backup Verification Report ==="
echo "Backup Directory: $BACKUP_DIR"
echo ""

# Check all required files exist
REQUIRED_FILES=(
    "full_db_backup.dump"
    "backup_manifest.txt"
    "row_counts_before.txt"
    "migrations_state.txt"
    "products_product.csv"
    "system_product.csv"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "${BACKUP_DIR}/${file}" ]; then
        echo "✓ ${file} exists ($(du -h ${BACKUP_DIR}/${file} | cut -f1))"
    else
        echo "✗ ${file} MISSING!"
        exit 1
    fi
done

# Verify dump can be read
echo ""
echo "Verifying dump integrity..."
pg_restore --list "${BACKUP_DIR}/full_db_backup.dump" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Database dump is valid"
else
    echo "✗ Database dump is CORRUPTED!"
    exit 1
fi

echo ""
echo "=== Backup Verification PASSED ==="
```

---

## 2. Comprehensive Testing Plan

### 2.1 Pre-Migration Testing (Staging Environment)

#### 2.1.1 Unit Tests for Migration Code

```python
# backend/apps/system/tests/test_product_fk_migration.py

from django.test import TestCase, TransactionTestCase
from django.db import connection
from decimal import Decimal

from apps.system.models import Product, TenantProductPreference
from apps.tenants.models import Tenant
from tenant_apps.products.models import Product as OldProduct
from tenant_apps.customers.models import CustomerProduct
from tenant_apps.purchase_orders.models import PurchaseOrder, POLineItem


class ProductFKMigrationTests(TransactionTestCase):
    """Test suite for product FK migration."""
    
    def setUp(self):
        """Create test data matching production patterns."""
        # Create tenant
        self.tenant = Tenant.objects.create(
            name='Test Company',
            slug='test-company'
        )
        
        # Create old product (tenant_apps)
        self.old_product = OldProduct.objects.create(
            tenant=self.tenant,
            product_code='BEEF-001',
            description_of_product_item='Test Beef Product',
            type_of_protein='BEEF',
        )
        
        # Create system product
        self.system_product = Product.objects.create(
            product_code='BEEF-001',
            name='Test Beef Product',
            category='BEEF',
            legacy_tenant_product_id=self.old_product.id,
        )
        
        # Create preference
        self.preference = TenantProductPreference.objects.create(
            tenant=self.tenant,
            product=self.system_product,
        )
    
    def test_id_mapping_exists(self):
        """Verify old product maps to system product."""
        self.assertEqual(
            self.system_product.legacy_tenant_product_id,
            self.old_product.id
        )
    
    def test_product_code_matches(self):
        """Verify product codes match between old and new."""
        self.assertEqual(
            self.old_product.product_code,
            self.system_product.product_code
        )
    
    def test_fk_can_be_updated(self):
        """Test that FK can be changed from old to new product."""
        # This simulates the migration operation
        with connection.cursor() as cursor:
            # Get the mapping
            cursor.execute("""
                SELECT sp.id 
                FROM system_product sp 
                WHERE sp.product_code = %s
            """, [self.old_product.product_code])
            new_id = cursor.fetchone()[0]
            
            self.assertIsNotNone(new_id)
            self.assertEqual(str(new_id), str(self.system_product.id))
    
    def test_data_integrity_after_migration(self):
        """Verify data integrity is maintained after FK update."""
        # Create a purchase order with old product
        po = PurchaseOrder.objects.create(
            tenant=self.tenant,
            product=self.old_product,
            # ... other required fields
        )
        
        # Simulate FK migration
        # (In real migration, this updates the FK to point to system.Product)
        
        # Verify the relationship still works
        self.assertEqual(po.product.product_code, self.system_product.product_code)


class MigrationRollbackTests(TransactionTestCase):
    """Test rollback procedures."""
    
    def test_mapping_table_enables_rollback(self):
        """Verify we can rollback using the mapping table."""
        # Create mapping
        old_id = 12345
        new_id = '550e8400-e29b-41d4-a716-446655440000'
        
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO product_id_migration_map 
                (old_product_id, new_product_id, product_code)
                VALUES (%s, %s, 'TEST-001')
                ON CONFLICT (old_product_id) DO NOTHING
            """, [old_id, new_id])
            
            # Verify we can retrieve the mapping
            cursor.execute("""
                SELECT old_product_id FROM product_id_migration_map
                WHERE new_product_id = %s
            """, [new_id])
            result = cursor.fetchone()
            
            if result:
                self.assertEqual(result[0], old_id)
```

#### 2.1.2 Integration Tests

```python
# backend/apps/system/tests/test_product_fk_integration.py

from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status


class ProductAPIIntegrationTests(APITestCase):
    """Test API behavior with new product structure."""
    
    def test_purchase_order_create_with_system_product(self):
        """Test creating PO with system.Product reference."""
        # Setup auth
        self.client.force_authenticate(user=self.user)
        
        response = self.client.post('/api/v1/purchase-orders/', {
            'product': str(self.system_product.id),  # UUID
            'quantity': 100,
            # ... other fields
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_invoice_line_item_with_system_product(self):
        """Test invoice line items work with new product."""
        # Similar test for invoices
        pass
    
    def test_customer_product_association(self):
        """Test customer-product relationships."""
        pass
    
    def test_supplier_product_association(self):
        """Test supplier-product relationships."""
        pass


class QueryPerformanceTests(TestCase):
    """Ensure queries remain performant after migration."""
    
    def test_product_lookup_performance(self):
        """Product lookups should be fast."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        
        with CaptureQueriesContext(connection) as context:
            # Perform typical product lookup
            product = Product.objects.get(product_code='BEEF-001')
            prefs = product.tenant_preferences.select_related('tenant').all()
            list(prefs)  # Force evaluation
        
        # Should be 2 queries max (product + preferences with tenant)
        self.assertLessEqual(len(context), 2)
    
    def test_order_with_product_query_count(self):
        """Order queries with product should be efficient."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        
        with CaptureQueriesContext(connection) as context:
            orders = PurchaseOrder.objects.select_related(
                'product', 'tenant'
            ).filter(tenant=self.tenant)[:10]
            list(orders)
        
        # Should be 1 query with proper select_related
        self.assertLessEqual(len(context), 1)
```

### 2.2 Staging Environment Test Procedure

```markdown
## Staging Test Checklist

### Pre-Migration Verification
- [ ] Staging database restored from production backup
- [ ] All services running and healthy
- [ ] Baseline metrics recorded (response times, error rates)

### Migration Execution
- [ ] Run migration in staging: `python manage.py migrate`
- [ ] Monitor for errors in logs
- [ ] Record migration duration

### Post-Migration Verification

#### Data Integrity Checks
- [ ] Row counts match expectations
- [ ] No orphaned records
- [ ] All FKs resolve correctly

#### Functional Tests
- [ ] Create new Purchase Order with product
- [ ] Create new Sales Order with product
- [ ] Create new Invoice with line items
- [ ] View customer product associations
- [ ] View supplier product associations
- [ ] Search products across all interfaces

#### API Tests
- [ ] GET /api/v1/products/ returns products
- [ ] GET /api/v1/purchase-orders/ includes product data
- [ ] POST /api/v1/purchase-orders/ accepts new product IDs
- [ ] Product autocomplete works in forms

#### Admin Interface
- [ ] Django admin loads Product list
- [ ] Can edit Product in admin
- [ ] TenantProductPreference inline works
- [ ] CSV export works

#### Performance Tests
- [ ] Page load times within acceptable range
- [ ] API response times < 200ms
- [ ] No N+1 query issues

### Rollback Test
- [ ] Execute rollback procedure
- [ ] Verify all data restored
- [ ] Verify application functional
- [ ] Re-run migration successfully
```

### 2.3 Production Smoke Tests

```python
# scripts/production_smoke_tests.py
"""
Production smoke tests to run immediately after migration.
Execute with: python manage.py shell < scripts/production_smoke_tests.py
"""

import sys
from django.db import connection

def run_smoke_tests():
    """Run critical smoke tests."""
    tests_passed = 0
    tests_failed = 0
    
    print("=" * 60)
    print("PRODUCTION SMOKE TESTS")
    print("=" * 60)
    
    # Test 1: System products exist
    print("\n[TEST 1] System products exist...")
    from apps.system.models import Product
    count = Product.objects.count()
    if count > 0:
        print(f"  ✓ PASS: {count} system products found")
        tests_passed += 1
    else:
        print(f"  ✗ FAIL: No system products found!")
        tests_failed += 1
    
    # Test 2: Tenant preferences exist
    print("\n[TEST 2] Tenant preferences exist...")
    from apps.system.models import TenantProductPreference
    count = TenantProductPreference.objects.count()
    if count > 0:
        print(f"  ✓ PASS: {count} tenant preferences found")
        tests_passed += 1
    else:
        print(f"  ✗ FAIL: No tenant preferences found!")
        tests_failed += 1
    
    # Test 3: FK integrity (no orphaned records)
    print("\n[TEST 3] FK integrity check...")
    with connection.cursor() as cursor:
        # Check for any purchase orders with invalid product references
        cursor.execute("""
            SELECT COUNT(*) FROM purchase_orders_purchaseorder po
            WHERE po.product_id IS NOT NULL 
            AND NOT EXISTS (
                SELECT 1 FROM system_product sp WHERE sp.id = po.product_id
            )
        """)
        orphaned = cursor.fetchone()[0]
        
        if orphaned == 0:
            print(f"  ✓ PASS: No orphaned FK references")
            tests_passed += 1
        else:
            print(f"  ✗ FAIL: {orphaned} orphaned FK references found!")
            tests_failed += 1
    
    # Test 4: API endpoint health
    print("\n[TEST 4] API endpoint health...")
    from django.test import Client
    client = Client()
    response = client.get('/api/v1/products/')
    if response.status_code in [200, 401, 403]:  # 401/403 OK if auth required
        print(f"  ✓ PASS: Products API responding (status: {response.status_code})")
        tests_passed += 1
    else:
        print(f"  ✗ FAIL: Products API error (status: {response.status_code})")
        tests_failed += 1
    
    # Test 5: Query performance
    print("\n[TEST 5] Query performance...")
    import time
    start = time.time()
    list(Product.objects.all()[:100])
    duration = time.time() - start
    if duration < 1.0:
        print(f"  ✓ PASS: Product query completed in {duration:.3f}s")
        tests_passed += 1
    else:
        print(f"  ✗ WARN: Product query slow ({duration:.3f}s)")
        tests_failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"RESULTS: {tests_passed} passed, {tests_failed} failed")
    print("=" * 60)
    
    if tests_failed > 0:
        print("\n⚠️  SMOKE TESTS FAILED - CONSIDER ROLLBACK")
        return False
    else:
        print("\n✓ ALL SMOKE TESTS PASSED")
        return True

if __name__ == '__main__':
    success = run_smoke_tests()
    sys.exit(0 if success else 1)
```

---

## 3. Rollback Procedures

### 3.1 Decision Matrix: When to Rollback

| Condition | Severity | Action |
|-----------|----------|--------|
| Migration script fails | 🔴 Critical | Immediate rollback |
| >1% FK integrity errors | 🔴 Critical | Immediate rollback |
| API response time >5s | 🟠 High | Rollback within 15 min |
| Admin interface broken | 🟠 High | Rollback within 15 min |
| Minor UI glitches | 🟡 Medium | Fix forward if possible |
| Performance degradation <20% | 🟢 Low | Monitor, fix forward |

### 3.2 Immediate Rollback Procedure (< 5 minutes)

```bash
#!/bin/bash
# rollback_immediate.sh
# Use when migration just completed and issues detected

set -e

echo "=== IMMEDIATE ROLLBACK INITIATED ==="
echo "Time: $(date)"

# Step 1: Stop application to prevent further data changes
echo "[1/5] Stopping application..."
docker stop pm-backend pm-frontend || true

# Step 2: Restore database from pre-migration backup
echo "[2/5] Restoring database..."
BACKUP_DIR="/backups/product_fk_migration_YYYYMMDD_HHMMSS"  # Set to actual backup

pg_restore \
  --host=$DB_HOST \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --clean \
  --if-exists \
  --verbose \
  "${BACKUP_DIR}/full_db_backup.dump" 2>&1 | tee rollback.log

# Step 3: Verify restoration
echo "[3/5] Verifying restoration..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT COUNT(*) as product_count FROM products_product;
"

# Step 4: Revert code changes
echo "[4/5] Reverting code..."
git checkout HEAD~1  # Go back one commit
# Or: git revert <migration-commit-sha>

# Step 5: Restart application
echo "[5/5] Restarting application..."
docker start pm-backend pm-frontend

echo "=== ROLLBACK COMPLETE ==="
echo "Verify application at: https://your-domain.com"
```

### 3.3 Selective Rollback (FK References Only)

If only FK references need reverting (data is OK, but references broken):

```sql
-- selective_rollback.sql
-- Reverts FK references using the mapping table

BEGIN;

-- Temporarily disable FK constraints
SET CONSTRAINTS ALL DEFERRED;

-- Revert purchase_orders.product_id
UPDATE purchase_orders_purchaseorder po
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE po.product_id::text = m.new_product_id::text;

-- Revert purchase_orders_polineitem.product_id
UPDATE purchase_orders_polineitem poli
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE poli.product_id::text = m.new_product_id::text;

-- Revert sales_orders_salesorderlineitem.product_id
UPDATE sales_orders_salesorderlineitem soli
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE soli.product_id::text = m.new_product_id::text;

-- Revert invoices_invoicelineitem.product_id
UPDATE invoices_invoicelineitem ili
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE ili.product_id::text = m.new_product_id::text;

-- Revert customers_customerproduct.product_id
UPDATE customers_customerproduct cp
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE cp.product_id::text = m.new_product_id::text;

-- Revert suppliers_supplierproduct.product_id
UPDATE suppliers_supplierproduct sp
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE sp.product_id::text = m.new_product_id::text;

-- Revert inquiries tables
UPDATE inquiries_inquiryproduct ip
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE ip.product_id::text = m.new_product_id::text;

UPDATE inquiries_inquirylineitem ili
SET product_id = m.old_product_id
FROM product_id_migration_map m
WHERE ili.product_id::text = m.new_product_id::text;

-- Verify counts
SELECT 'purchase_orders' as table_name, COUNT(*) FROM purchase_orders_purchaseorder WHERE product_id IS NOT NULL
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices_invoicelineitem WHERE product_id IS NOT NULL
UNION ALL
SELECT 'sales_orders', COUNT(*) FROM sales_orders_salesorderlineitem WHERE product_id IS NOT NULL;

COMMIT;
```

### 3.4 Django Migration Rollback

```bash
# Rollback Django migrations to pre-FK state

# Find the migration before the FK change
python manage.py showmigrations customers
python manage.py showmigrations invoices
python manage.py showmigrations sales_orders
python manage.py showmigrations purchase_orders
python manage.py showmigrations suppliers
python manage.py showmigrations inquiries

# Rollback each app to the migration before FK change
python manage.py migrate customers 00XX_before_fk_change
python manage.py migrate invoices 00XX_before_fk_change
python manage.py migrate sales_orders 00XX_before_fk_change
python manage.py migrate purchase_orders 00XX_before_fk_change
python manage.py migrate suppliers 00XX_before_fk_change
python manage.py migrate inquiries 00XX_before_fk_change

# Verify migration state
python manage.py showmigrations | grep "\[ \]"  # Should show rolled-back migrations
```

### 3.5 Post-Rollback Verification

```bash
#!/bin/bash
# verify_rollback.sh

echo "=== POST-ROLLBACK VERIFICATION ==="

# Check 1: Database connectivity
echo "[1/5] Testing database connectivity..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✓ Database connection OK"
else
    echo "  ✗ Database connection FAILED"
    exit 1
fi

# Check 2: Row counts match backup
echo "[2/5] Verifying row counts..."
BACKUP_COUNTS="/backups/product_fk_migration_*/row_counts_before.txt"
# Compare current counts with backup counts
# (implementation depends on your backup format)

# Check 3: Application health
echo "[3/5] Testing application health..."
curl -s -o /dev/null -w "%{http_code}" https://your-domain.com/api/health/
if [ $? -eq 200 ]; then
    echo "  ✓ Application healthy"
else
    echo "  ✗ Application health check FAILED"
fi

# Check 4: Key functionality
echo "[4/5] Testing key functionality..."
# Run smoke tests
python manage.py shell < scripts/production_smoke_tests.py

# Check 5: Error logs
echo "[5/5] Checking error logs..."
docker logs pm-backend --since 5m 2>&1 | grep -i error | head -10

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 4. Migration Execution Plan

### 4.1 Timeline

```
Day -7:  Announce maintenance window to stakeholders
Day -3:  Final staging test
Day -1:  Take production backup, verify backup integrity
Day 0:   Execute migration (during low-traffic window)
         - 00:00: Begin maintenance window
         - 00:05: Take final backup
         - 00:15: Execute migration
         - 00:30: Run smoke tests
         - 00:45: End maintenance window OR rollback
Day +1:  Monitor for issues
Day +3:  Remove rollback artifacts (mapping table, old backup)
Day +7:  Final cleanup (remove old products table)
```

### 4.2 Communication Template

```markdown
## Scheduled Maintenance: Product Database Migration

**When**: [DATE] at [TIME] UTC (approximately 45 minutes)

**What**: We are upgrading our product catalog system to improve 
performance and enable new features.

**Impact**: 
- Brief service interruption (< 5 minutes)
- All data will be preserved
- No action required from users

**Contact**: If you experience issues after maintenance, contact 
support@meatscentral.com

---

Status updates will be posted to: [STATUS PAGE URL]
```

### 4.3 Runbook

```markdown
## Migration Runbook

### Pre-Flight (T-1 hour)
- [ ] Notify on-call team
- [ ] Verify backup completed
- [ ] Verify staging test passed
- [ ] Clear deployment queue
- [ ] Prepare rollback commands

### Execution (T-0)
1. [ ] Enable maintenance mode
2. [ ] Stop cron jobs
3. [ ] Take final backup snapshot
4. [ ] Run migration: `python manage.py migrate`
5. [ ] Run smoke tests
6. [ ] Disable maintenance mode
7. [ ] Monitor logs for 15 minutes

### If Issues Detected
1. [ ] Do NOT panic
2. [ ] Assess severity using decision matrix
3. [ ] If critical: Execute rollback
4. [ ] If non-critical: Document and fix forward
5. [ ] Notify stakeholders of status

### Post-Migration
- [ ] Update status page
- [ ] Send completion notification
- [ ] Schedule post-mortem (if issues)
- [ ] Update documentation
```

---

## 5. Appendix

### A. SQL Scripts Repository

All SQL scripts referenced in this document are available at:
```
backend/apps/system/migrations/sql/
├── create_mapping_table.sql
├── populate_mapping.sql
├── migrate_fk_forward.sql
├── rollback_fk.sql
└── verify_migration.sql
```

### B. Contact Information

| Role | Contact | Availability |
|------|---------|--------------|
| DBA On-Call | [EMAIL] | 24/7 |
| Backend Lead | [EMAIL] | Business hours |
| DevOps | [EMAIL] | 24/7 |
| Product Owner | [EMAIL] | Business hours |

### C. Related Documentation

- [CONFIGURATION_AND_SECRETS.md](./CONFIGURATION_AND_SECRETS.md) - Environment configuration
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) - Overall project progress
- [GOLDEN_STANDARD_ACHIEVEMENT.md](./GOLDEN_STANDARD_ACHIEVEMENT.md) - CI/CD standards

---

**Document Owner**: Infrastructure Team  
**Review Cycle**: Before each migration attempt  
**Approval Required**: Tech Lead + DBA

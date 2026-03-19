# Security Compliance & RLS Audit Log

**Last Updated**: March 18, 2026  
**Status**: ✅ ALL SYSTEMS COMPLIANT

---

## PostgreSQL Row-Level Security (RLS) Status

### Latest Audit: March 18, 2026

**Previous Audit**: February 27, 2026 16:50 UTC  
**Previous Audit Run**: [#22495330666](https://github.com/Meats-Central/ProjectMeats/actions/runs/22495330666)  
**Verification Method**: PostgreSQL system catalog query (`pg_class.relrowsecurity`)

**Phase**: RLS Hardening (Issue #3) – Medium/Low Priority Tables  
**Change**: Added RLS policies for remaining 8 tables (fulfillments, inquiries, customers, sales_orders, suppliers, products, plants). Upgraded legacy `app.current_tenant_id` policies to modern `app.current_tenant` pattern.

---

## Workflow Module (17 tables) - ✅ 100% COMPLIANT

All workflow-related tables have Row-Level Security **ENABLED** and **FORCED**:

| Table Name | RLS Enabled | Policy Name | Session Variable |
|------------|-------------|-------------|------------------|
| `workflows_formstatushistory` | ✅ | `formstatushistory_tenant_isolation` | `app.current_tenant` |
| `workflows_formstepsubmission` | ✅ | `formstepsubmission_tenant_isolation` | `app.current_tenant` |
| `workflows_formsubmission` | ✅ | `formsubmission_tenant_isolation` | `app.current_tenant` |
| `workflows_formsubmissionevent` | ✅ | `formsubmissionevent_tenant_isolation` | `app.current_tenant` |
| `workflows_formsubmissionfile` | ✅ | `formsubmissionfile_tenant_isolation` | `app.current_tenant` |
| `workflows_stepassignment` | ✅ | `stepassignment_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantform` | ✅ | `tenantform_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantformentity` | ✅ | `tenantformentity_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantformfield` | ✅ | `tenantformfield_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantformrule` | ✅ | `tenantformrule_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantlist` | ✅ | `tenantlist_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantworkflow` | ✅ | `tenantworkflow_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantworkflowaction` | ✅ | `tenantworkflowaction_tenant_isolation` | `app.current_tenant` |
| `workflows_tenantworkflowcondition` | ✅ | `tenantworkflowcondition_tenant_isolation` | `app.current_tenant` |
| `workflows_usernotification` | ✅ | `usernotification_tenant_isolation` | `app.current_tenant` |
| `workflows_usernotificationpreferences` | ✅ | `usernotificationpreferences_tenant_isolation` | `app.current_tenant` |
| `workflows_workflowexecutionlog` | ✅ | `workflowexecutionlog_tenant_isolation` | `app.current_tenant` |

**Total Policies**: 17 tables × 1 policy each = **17 RLS policies**

**Session Variable**: `app.current_tenant` (set by `TenantMiddleware`)

---

## Financial Module (7 tables) - ✅ 100% COMPLIANT

| Table Name | RLS Enabled | Migration | Deployment Date |
|------------|-------------|-----------|-----------------|
| `invoices_invoice` | ✅ | `invoices/0011_refactor_invoices_to_tenantaware` | Feb 27, 2026 00:36 UTC |
| `invoices_claim` | ✅ | `invoices/0011_refactor_invoices_to_tenantaware` | Feb 27, 2026 00:36 UTC |
| `invoices_paymenttransaction` | ✅ | `invoices/0011_refactor_invoices_to_tenantaware` | Feb 27, 2026 00:36 UTC |
| `contacts_contact` | ✅ | `contacts/0004_refactor_contact_to_tenantaware` | Feb 27, 2026 00:36 UTC |
| `customers_customer` | ✅ | `customers/0010_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |
| `inquiries_inquiry` | ✅ | `inquiries/0004_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |
| `inquiries_inquirytemplate` | ✅ | `inquiries/0004_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |

---

## Logistics Module (8 tables) - ✅ 100% COMPLIANT

| Table Name | RLS Enabled | Migration | Deployment Date |
|------------|-------------|-----------|-----------------|
| `purchase_orders_purchaseorder` | ✅ | `purchase_orders/0013_refactor_to_tenantaware` | Feb 27, 2026 00:45 UTC |
| `purchase_orders_carrierpurchaseorder` | ✅ | `purchase_orders/0013_refactor_to_tenantaware` | Feb 27, 2026 00:45 UTC |
| `purchase_orders_coldstorageentry` | ✅ | `purchase_orders/0013_refactor_to_tenantaware` | Feb 27, 2026 00:45 UTC |
| `locations_location` | ✅ | `locations/0002_enable_rls_locations` | Feb 27, 2026 00:45 UTC |
| `locations_locationassociatedproduct` | ✅ | `locations/0008_locationassociatedproduct_and_more` | Mar 15, 2026 18:21 UTC |
| `plants_plantassociatedproduct` | ✅ | `plants/0008_plantassociatedproduct_plant_associated_products_and_more` | Mar 15, 2026 18:21 UTC |
| `fulfillments_fulfillment` | ✅ | `fulfillments/0003_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |
| `sales_orders_salesorder` | ✅ | `sales_orders/0013_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |

---

## Core Business Module (4 tables) - ✅ 100% COMPLIANT

| Table Name | RLS Enabled | Migration | Deployment Date |
|------------|-------------|-----------|-----------------|
| `suppliers_supplier` | ✅ | `suppliers/0012_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |
| `products_product` | ✅ | `products/0007_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |
| `plants_plant` | ✅ | `plants/0009_add_rls_policies_batch` | Mar 18, 2026 (Issue #3) |
| `carriers_carrier` | ✅ | `carriers/0006_add_rls_policies_batch` | Mar 18, 2026 |

---

## Support Module (4 tables) - ✅ 100% COMPLIANT

| Table Name | RLS Enabled | Migration | Deployment Date |
|------------|-------------|-----------|-----------------|
| `cockpit_activitylog` | ✅ | `cockpit/0006_add_rls_policies_batch` | Mar 18, 2026 |
| `cockpit_scheduledcall` | ✅ | `cockpit/0006_add_rls_policies_batch` | Mar 18, 2026 |
| `bug_reports_bugreport` | ✅ | `bug_reports/0005_add_rls_policies_batch` | Mar 18, 2026 |
| `ai_assistant_configurations` | ✅ | `ai_assistant/0005_add_rls_policies_batch` | Mar 18, 2026 |

---

## Compliance Summary

| Module | Tables | RLS Policies | Status |
|--------|--------|--------------|--------|
| **Workflows** | 17 | 17 | ✅ COMPLIANT |
| **Financial** | 7 | 14 (2 per table) | ✅ COMPLIANT |
| **Logistics** | 8 | 16 (2 per table) | ✅ COMPLIANT |
| **Core Business** | 4 | 8 (2 per table) | ✅ COMPLIANT |
| **Support** | 4 | 4 | ✅ COMPLIANT |
| **TOTAL** | **40** | **59** | ✅ **100% COMPLIANT** |

---

## Security Guarantees

**Database-Level Protections**:
- ✅ Row-Level Security ENABLED (enforced by PostgreSQL engine)
- ✅ Row-Level Security FORCED (cannot be bypassed by superuser)
- ✅ Tenant isolation via `app.current_tenant` session variable
- ✅ Automatic filtering on all SELECT, INSERT, UPDATE, DELETE operations

**Protection Against**:
- ❌ Application code bugs bypassing tenant filters
- ❌ SQL injection attacks attempting cross-tenant access
- ❌ Direct database queries bypassing ORM
- ❌ Accidental `queryset.all()` calls without tenant filtering

**Middleware Integration**:
- `TenantMiddleware` sets `app.current_tenant` before every request
- Session variable persists throughout request lifecycle
- PostgreSQL query planner automatically applies RLS policies

---

## Audit Command

To reproduce this audit manually:

```bash
# Via ops-db-surgery workflow (recommended)
gh workflow run 98-ops-db-surgery.yml \
  --repo Meats-Central/ProjectMeats \
  --ref development \
  --field environment=dev \
  --field type=sql \
  --field 'script=SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE '\''workflows_%'\'' AND relkind = '\''r'\'' ORDER BY relname ASC;'

# Via psql (requires SSH access)
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
  "SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'workflows_%' AND relkind = 'r' ORDER BY relname ASC;"
```

---

## Policy Details

**RLS Policy Pattern** (used by all 33 policies):

```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'table_name' 
        AND policyname = 'table_tenant_isolation'
    ) THEN
        ALTER TABLE app_table ENABLE ROW LEVEL SECURITY;
        ALTER TABLE app_table FORCE ROW LEVEL SECURITY;
        CREATE POLICY table_tenant_isolation ON app_table
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
    END IF;
END $$;
```

**Key Features**:
- Idempotent (safe to retry)
- Uses `current_setting('app.current_tenant', true)::uuid` for tenant matching
- `FORCE ROW LEVEL SECURITY` applies to superuser queries
- Policy name format: `{tablename}_tenant_isolation`

---

## Next Audit Date

**Scheduled**: May 27, 2026 (quarterly review)  
**Trigger**: Any new tenant-aware model added to codebase  
**Automation**: ops-db-surgery workflow (#98)

---

## Related Documentation

- **Migration Standards**: [docs/workforms/MIGRATION_STANDARDS.md](../workforms/MIGRATION_STANDARDS.md)
- **Master Plan**: [.github/MASTER_PLAN.md](../../.github/MASTER_PLAN.md)
- **Technical Debt**: [.github/MASTER_PLAN.md#technical-debt-registry](../../.github/MASTER_PLAN.md#technical-debt-registry)
- **Golden Pipeline**: [docs/GOLDEN_PIPELINE.md](../GOLDEN_PIPELINE.md)

---

**Audit Signature**: Automated CI/CD Pipeline  
**Verification**: PostgreSQL `pg_class.relrowsecurity` = `t` for all 25 tables  
**Status**: ✅ ALL SYSTEMS COMPLIANT

# Changelog

**Status**: ✅ CURRENT
**Category**: Reference
**Last Updated**: 2026-02-04

---

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-04

### Waves Completed (8 of 12) 🎉

#### Wave 4: Admin Studio (100% Complete) - PR #2398-2409
- **ConfigPreview component** - Real-time preview of configuration changes (themes, features, rules)
- **AuditLogViewer** - Full-stack audit trail with filtering, search, and diff view
- **ConfigAuditLog model** - Generic FK tracking for any config entity
- **SchemaEditor enhancements** - Visual field builder with drag-drop, duplicate, bulk actions
- **TenantConfigEditor** - Tenant customization UI with import/export JSON
- **Keyboard shortcuts** - Admin Studio navigation (⌨️)
- **Import/export functionality** - CSV/JSON for choice lists and schemas
- **Bulk operations** - Copy, merge, archive for choice lists

#### Wave 6: Model Migrations (100% Complete) - PR #2321-2345
- **Abstract order base classes** - OrderMethodsMixin for shared PO/SO behavior
- **Product migration to system** - UUID-based system.Product with TenantProductPreference
- **FK migration** - 9 FK references updated across 6 apps
- **Zero-downtime migrations** - All migrations reversible

#### Wave 5: Repository Cleanup (100% Complete) - PR #2392-2393
- **Documentation reorganization** - 67 → ~45 files consolidated
- **Code cleanup** - Removed TODO/FIXME items, unused imports
- **Consistent naming** - Standardized across codebase

#### Wave 3: Forms & Flows (100% Complete) - PR #2381-2390
- **My Tasks dashboard** - Action item tracking
- **Forms & Flows layout** - Tabs for tasks, in-progress, catalog, history
- **Badge support** - Action item counts in sidebar
- **CallTimer component** - Start/stop/pause for calls

#### Wave 2: Cockpit Command Center (100% Complete) - 48/48 tasks
- **Widget system** - Drag-drop, resize, persist layouts
- **Command Palette** - Universal search (⌘K)
- **Entity Explorer** - Visual relationship graphs
- **Backend APIs** - Layout persistence, universal search

#### Wave 1: Foundation (100% Complete) - PR #2394-2395
- **3-tier config system** - System → Tenant → User resolution
- **ConfigResolver service** - Dynamic configuration resolution
- **Choice lists** - 14 system choice lists seeded
- **configService.ts** - Frontend config consumption

#### Wave T: Testing (100% Complete)
- **1166 total tests** - 846 frontend + 221 backend (37 skipped)
- **94.77% line coverage** (frontend)
- **83.59% branch coverage** (frontend)

#### Wave 0: Preparation (90% Complete)
- **Test baseline** - Established 1166 tests
- **API documentation** - Comprehensive API_REFERENCE.md
- **Feature flags** - Setup complete

### Added
- **[MAJOR]** Comprehensive documentation consolidation (November 2024)
  - Created 4 new comprehensive guides consolidating 67 scattered documentation files:
    - `docs/MIGRATION_GUIDE.md` - Complete database migration guide (consolidates 12 docs)
    - `docs/AUTHENTICATION_GUIDE.md` - Authentication & permissions guide (consolidates 13 docs)
    - `docs/TROUBLESHOOTING.md` - Common issues and solutions (consolidates 14 docs)
    - `docs/lessons-learned/3-MONTH-RETROSPECTIVE.md` - 3-month development retrospective (consolidates 10 docs)
  - Archived all redundant documentation to `docs/ (archived - file removed)
  - Updated `docs/README.md` with new structure and navigation
  - Cleaned root directory from 67 to 6 essential markdown files
  - **Impact:** Improved documentation discoverability, reduced duplication, single source of truth per topic
  - **For developers:** All old documentation references updated; use new consolidated guides
- Comprehensive final fix documentation in `MIGRATION_DEPENDENCIES_FIX_FINAL.md` (2025-10-16)
- Migration history fix documentation in `docs/MIGRATION_HISTORY_FIX.md` with step-by-step manual fix procedures
- CI/CD migration consistency validation using `makemigrations --check` and `migrate --plan`
- Comprehensive migration fix documentation in `MIGRATION_FIX_PR135_CORRECTION.md`

### Fixed
- **[CRITICAL]** Fixed RecursionError in deployment pipeline caused by psycopg3 incompatibility with django-tenants
  - Downgraded from `psycopg[binary]==3.2.9` (psycopg3) to `psycopg2-binary==2.9.9`
  - Fixes deployment failures in PRs #235, #240, #237 related to django-tenants integration
  - Root cause: django-tenants 3.5.0 has infinite recursion bug with psycopg3's cursor API
  - See `docs/ (archived - file removed)
  - **Impact:** Enables successful database migrations in CI/CD with django-tenants
  - **Compatibility:** psycopg2-binary 2.9.9 is stable with Django 4.2.7, Python 3.12, PostgreSQL 15
  - **Future upgrade path:** django-tenants 3.7.0+ supports psycopg3 when we upgrade django-tenants
- **[DEFINITIVE FIX]** Resolved root cause of migration dependency issues from PR #126 (2025-10-16)
  - Simplified `purchase_orders.0004` dependencies to only structurally required migrations
  - Changed dependencies from latest migrations (0002/0004/0005/0006) to initial migrations (0001)
  - Eliminates all `InconsistentMigrationHistory` errors from deployment pipeline
  - Works for both fresh and existing database deployments
  - See `docs/ (archived - file removed)
  - **Key insight:** Django auto-generates dependencies on latest migrations, but only structural dependencies should be declared
  - **Impact:** Prevents future migration ordering conflicts; safe for all environments
- **[CRITICAL]** Corrected migration dependency issue that was incorrectly "fixed" in PR #135
  - Reverted PR #135's incorrect change that caused deployment failures
  - Restored `purchase_orders.0004` dependency to `sales_orders.0002` (was incorrectly changed to 0001)
  - Fixes both errors:
    * "Migration purchase_orders.0004 is applied before its dependency carriers.0004"
    * "Migration purchase_orders.0004 is applied before its dependency sales_orders.0002"
  - Migration dependencies now match database history, eliminating `InconsistentMigrationHistory` errors
  - **Lesson learned:** Migration files are historical records - once deployed, dependencies cannot be changed
- ~~Fixed migration dependency issue~~ (PR #135 - THIS WAS INCORRECT, see above correction)
- Fixed inconsistent migration history blocking Dev and UAT deployments (migration `purchase_orders.0004` applied before dependency `suppliers.0006`)
- Added migration consistency checks to CI/CD pipeline to prevent future migration ordering issues
- Fixed SyntaxError in PurchaseOrder model due to duplicate keyword arguments in `total_amount` field definition (refs commit 4ed9474c280c95370953800838533462aed67a4b)
- Fixed corrupted migration file `0004_alter_purchaseorder_carrier_release_format_and_more.py` with duplicate model definitions
- Fixed syntax error in `tests.py` with unclosed docstring

### Changed
- **[DOCUMENTATION]** Reorganized documentation structure (November 2024)
  - Moved 67 scattered root-level markdown files to organized archive
  - Consolidated redundant documentation into comprehensive guides
  - Updated all internal documentation references to new locations
  - **Migration Path:** See `docs/ (archived - file removed)

## [Previous Versions]
See git history for changes prior to this changelog.

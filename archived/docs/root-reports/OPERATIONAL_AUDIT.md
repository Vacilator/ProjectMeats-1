# Operational Audit

## Deliverables

1. **Backend operational endpoints**
   - Transactional documents now expose tenant-safe workflow, PDF, and email actions:
     - `GET .../status-workflow/`
     - `POST .../transition-status/`
     - `GET .../pdf/`
     - `POST .../email/`
   - Covered entities:
     - Purchase Orders
     - Sales Orders
     - Invoices
     - Carrier Purchase Orders / Freight Orders

2. **Lifecycle enforcement**
   - Status catalogs were expanded for purchase orders, sales orders, invoices, and carrier purchase orders.
   - Invalid API transitions are rejected both on explicit transition actions and direct serializer-driven updates.

3. **Document generation and delivery**
   - Added `backend/apps/core/services/pdf_generator.py` using ReportLab.
   - Email send actions attach the generated PDF through Django’s configured email backend.

4. **Audit history**
   - `TenantAuditEvent` coverage now includes:
     - `Carrier`
     - `Invoice`
     - `CarrierPurchaseOrder`
   - Audit feed access is available to active tenant members.

5. **Frontend operational surfaces**
   - Added reusable operational action bar for status updates, PDF download, and email send.
   - Added reusable audit history timeline.
   - Integrated these into canonical record pages for transactional entities.
   - Added a dedicated `/freight-orders` page and navigation entry for Carrier POs.
   - Added deep links from legacy Purchase Orders, Sales Orders, Invoices, and Payables panels into canonical record pages.

## Expected Results

1. Users can progress Golden Schema documents through explicit, validated business lifecycles.
2. Users can download or email formal transaction PDFs directly from document detail surfaces.
3. Users can inspect a tenant-safe mutation timeline for operational documents.
4. Freight Orders are no longer backend-only; they have an accessible frontend surface.

## Acceptance Criteria

1. Illegal status jumps return API validation errors.
2. PDF endpoints return downloadable PDF attachments.
3. Email endpoints send transactional PDFs as attachments.
4. Audit events are emitted for invoice and carrier/freight document mutations and can be viewed by active tenant members.
5. Transactional record pages show operational actions without reintroducing render-loop behavior.

## Dependencies

1. Existing tenant middleware and `X-Tenant-ID` request resolution.
2. Existing `TenantAuditEvent` + signal-based audit framework.
3. Existing ReportLab dependency in backend requirements.
4. Existing frontend `EntityFormSurface` / `UniversalEntityForm` smart-loader architecture.

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Workflow transitions block legacy update paths | Medium | High | Validation is additive and only rejects invalid forward jumps; defaults remain intact where already in use. |
| PDF generation misses legacy/alias fields | Medium | Medium | Generator reads both canonical and legacy aliases and renders fallback values conservatively. |
| Email sending fails in misconfigured environments | Medium | Medium | Endpoint returns stable classified error codes/messages instead of silent failure. |
| Audit history is empty for non-admin users | Low | Medium | Audit feed visibility now includes any active tenant member, not just owner/admin roles. |

## Testing Strategy

### Backend

1. `python manage.py makemigrations --check`
2. `python manage.py test tenant_apps.purchase_orders.tests.DocumentOperationsAPITests tenant_apps.invoices.tests.InvoiceDocumentOperationsAPITests`
3. `python manage.py test tenant_apps.purchase_orders.tests tenant_apps.invoices.tests`

### Frontend

1. `npm --prefix frontend run type-check`
2. `npm --prefix frontend run test -- --run src/components/Operations/documentOperations.test.ts`
3. `npm --prefix frontend run build`

## Rollback Plan

1. Revert the operational-readiness commit/PR.
2. Apply reverse migrations:
   - `purchase_orders 0018_golden_schema_refactor`
   - `sales_orders 0016_golden_schema_refactor`
   - `invoices 0015_golden_schema_refactor`
3. Remove the new frontend operational components and the Freight Orders page if UI rollback is required independently.

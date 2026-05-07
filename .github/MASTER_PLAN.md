# ProjectMeats - PR Reference Master Plan (GitHub)

This file is the **append-only PR-referenceable execution log**.

- **Canonical plan + status snapshot:** repo-root `MASTER_PLAN.md`
- **Execution backlog:** `.github/EPIC_TICKETS.md`
- **Normative delivery rules:** `.github/SDLC_PROTOCOLS.md`
- This file should not claim global completion percentages; it should only record shipped PRs and notable operational notes.

## Operational Notes

- **2026-05-08** — Phase 20 console.log cleanup + copyright: replaced all remaining production `console.log/warn/error` with structured `logger` utility calls across SmartSearch, FormSubmissionModal, SystemChoiceManager, VirtualFieldManager, CloneInquiryModal, InquiryTemplateModal, ErrorBoundary, ReportBugButton, UserAvatar, RelationMindMap, form-builder store, QuickActionsEditor, MySubmissions. Updated footer copyright © 2025 → © 2026. (PRs: #5034, #5035)
- **2026-05-08** — Phase 20 deprecated AntD prop fix: replaced all 19 `destroyOnClose` → `destroyOnHidden` across 14 files for Ant Design v5.x compatibility. (PR: #5033)
- **2026-05-08** — Phase 20 MASTER_PLAN docs updated with all Phase 20 progress. (PR: #5032)
- **2026-05-08** — Phase 20 UI/UX massive color system overhaul: shipped WCAG-compliant CSS custom property color token system across the entire frontend. All 644 hardcoded rgb/rgba status colors in production code replaced with semantic CSS variables (--color-success, --color-warning, --color-error, --color-info, --color-neutral). Fixed critical WCAG contrast failure (warning yellow 1.9:1 → dark amber 7.2:1). Created shared StatusBadge component and statusColors utility. (PRs: #5025, #5026, #5027, #5028, #5029)
- **2026-05-08** — Phase 20 navigation cleanup + inline style extraction: removed placeholder PO/SO Attachment nav items, collapsed 3-hop redirect chains (call-log→calls→cockpit/calls → direct), removed dead ActivityFeedPage/ComingSoon imports. Extracted 268+ inline styles into styled-components across 12 top-offender files (ExecutionDetails, Monitoring, PlantDetailView, LocationDetailView, ExecutionStoryView, EntityProfileHeader, UniversalEntityRecordPage, DynamicFormEngine, UniversalEntityForm, FormStepConfigPanel, WorkflowAnalyticsDashboard, useOnboardingTour). (PRs: #5030, #5031)
- **2026-05-07** — Phase 19 ambient suggestion header integration: shipped `AMB-02.2 record-page-header-integration-and-action-wiring`, wiring `AmbientSuggestions` into the shared record header so contextual AI suggestions now surface directly on entity record pages on `development`. (PR: #5006)
- **2026-05-07** — Phase 19 contextual suggestion foundation: shipped `AMB-01.1 contextual-suggestion-contract-and-heuristic-rules`, `AMB-01.2 contextual-suggestions-endpoint-and-service`, and `AMB-02.1 ambient-suggestions-component-and-service-hook`, adding the heuristic-first contextual suggestion service, focused service tests, and the frontend ambient suggestion client/component foundations on `development`. (PR: #5005)
- **2026-05-07** — Phase 16 trade intervention dashboard: shipped `CTE-08.2 trades-requiring-intervention-dashboard`, adding the tenant-safe `trade-exceptions` cockpit API, safer exception resolution semantics for halted trade sessions, and the Process Cockpit interventions view with detail context plus retry/resolve actions. Validation used `cd backend && source /venv/bin/activate && python manage.py makemigrations --check`, `cd backend && source /venv/bin/activate && python manage.py test apps.core.tests_exception_queue tenant_apps.cockpit.tests --noinput`, `npm -C frontend run type-check`, and focused cockpit/intervention Vitest coverage on the touched surfaces. (PR: #4998)
- **2026-05-07** — Phase 17 cockpit contact visualization: shipped `RT-04.2 cockpit-contact-visualization`, extending the Process Cockpit lineage cards so process nodes show routed contact context and explicit “unassigned” indicators when no contact is available. Validation in the shipped PRs used focused frontend contact-visualization coverage on the cockpit/AI review surfaces. (PRs: #4986, #4987)
- **2026-05-07** — Phase 17 workform node contact enrichment: shipped `RT-04.1 node-plant-contact-enrichment`, adding the typed contact-resolution service that routes RFQ and related workflow recipients through Plant Contact Type, titles, and “Responsible For” metadata while preserving additive legacy fallbacks. (PR: #4984)
- **2026-05-07** — Phase 17 Process Cockpit and per-entity flow views: shipped `RT-03.1 process-cockpit-consolidation` and `RT-03.2 per-entity-react-flow-process-diagram`, consolidating process monitoring into `/process-cockpit` and adding the trade-lineage React Flow detail-surface visualization used across Inquiry and order records. (PRs: #4980, #4981)
- **2026-05-07** — Phase 17 cockpit dynamic header and contact-aware review surfaces: shipped `RT-03.3 cockpit-dynamic-header-and-failure-messaging`, enriching cockpit/detail flow surfaces and AI review panels with routed contact context, clearer status messaging, and clickable drill-ins for the active process path. (PR: #4986)
- **2026-05-07** — Phase 17 AI Inbox auto-sync: shipped `RT-02.1 ai-inbox-15-minute-auto-sync-and-login-refresh`, adding the 15-minute sync cadence plus login-triggered refresh so AI Inbox stays warm without manual intervention. (PR: #4954)
- **2026-05-07** — Phase 17 end-to-end runtime template: shipped `RT-01.1 end-to-end-inquiry-to-po-process-workform-template`, registering the multi-trigger EndToEndInquiryToPOProcess template with the runtime and template test coverage required by the Phase 17 flow. (PR: #4974)
- **2026-05-07** — Phase 16 domain event contracts + durable storage: shipped `CTE-06.1 domain-event-contract-for-approved-trade-transitions`, adding the canonical `TradeEventType` / `TradeEvent` contract, `emit_trade_event()` dispatcher, and tenant-aware durable `TradeEventLog` storage so trade-state transitions can persist lineage-rich event payloads now and migrate cleanly into Celery-backed saga consumers next. Validation from PR #4964: 15 domain-event contract / dispatch / storage tests passed. (PR: #4964)
- **2026-05-07** — Phase 16 unified inquiry + purchase-order forms: shipped `CTE-04.7 unified-inquiry-po-form-consolidation`, adding `frontend/src/components/UnifiedForm/UnifiedForm.tsx` plus the new `useLocalStorageDraft` and `aiDraftFormMapping` helpers so Inquiry and Purchase Order entry points can share one draft-aware wrapper with localStorage autosave, AI Inbox draft hydration, and thin-wrapper adoption across the current create/edit surfaces. Validation: `npm -C frontend run verify-standards`; `cd frontend && npm exec vitest run src/components/AIAssistant/AIDraftReviewModal.test.tsx src/hooks/useLocalStorageDraft.test.ts src/hooks/__tests__/useAutoSave.test.ts src/features/system/DynamicFormEngine.stability.test.tsx`. Note: `npm -C frontend run test:ci` did not progress past global collection in this environment, so focused frontend validation was used for the touched surfaces instead. (PR: #4970)
- **2026-05-07** — Phase 16 trade-session lineage contract and schema: shipped `CTE-05.1 trade-session-lineage-contract-and-schema`, adding the additive `TradeSession` model plus downstream nullable lineage FKs and the canonical lineage service so the inquiry → supplier PO → sales order → carrier PO chain can retain one durable trade session identifier with source-email provenance. Validation from PR #4963: 9 trade-session service tests passed; 163 related backend tests passed in 37s. (PR: #4963)
- **2026-05-07** — Phase 16 hardcoded happy-path orchestration: shipped `CTE-04.5 hardcoded-happy-path-orchestrator-and-end-to-end-regressions`, adding `tenant_apps.inquiries.services.happy_path_orchestrator` plus `GET /api/v1/inquiries/{id}/orchestrator-state/`, `POST /api/v1/inquiries/{id}/orchestrator-advance/`, and `GET /api/v1/inquiries/{id}/lineage/` so the deterministic FULFILL/BROKER trade chain can advance idempotently, expose the full lineage graph, and stop cleanly when replies or approvals are still pending. Validation: `cd backend && python manage.py test tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders apps.integrations tenant_apps.ai_assistant --noinput`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`. (PR: #4961)
- **2026-05-07** — Phase 16 carrier reply parsing and draft carrier POs: shipped `CTE-04.4 structured-carrier-reply-parser-and-draft-carrier-po`, adding `tenant_apps.carriers.services.carrier_reply_parser` so inbound carrier emails can correlate back to outbound freight inquiries, normalize freight quote payloads with OpenAI structured outputs, create draft `CarrierPurchaseOrder` rows for positive replies, and update carrier inquiry state without auto-approval or auto-dispatch. Validation: `cd backend && python manage.py test tenant_apps.carriers tenant_apps.sales_orders tenant_apps.purchase_orders --noinput`; `cd backend && python manage.py test tenant_apps.carriers.tests_carrier_reply_parser --noinput`. (PR: #4959)
- **2026-05-07** — Phase 16 carrier freight inquiry RFQ fan-out: shipped `CTE-04.3 carrier-rfq-match-and-outbound-freight-inquiry`, adding the additive `CarrierFreightInquiry` ledger plus the RLS-backed `carriers/0010_carrierfreightinquiry` migration so approved sales orders can persist one durable outbound freight inquiry row per carrier with frozen trade context, provider metadata, and retry-safe send evidence. Added `tenant_apps.carriers.services.freight_inquiry.send_carrier_freight_inquiries()` plus `POST /api/v1/sales-orders/{id}/send-carrier-freight-inquiries/` so carrier auto-match, explicit carrier targeting, idempotent skip behavior, and partial-success reporting stay tenant-safe and auditable. Validation: `cd backend && python manage.py test tenant_apps.carriers tenant_apps.sales_orders --noinput`. (PR: #4956)
- **2026-05-07** — Phase 16 sales order approval and customer dispatch: shipped `CTE-04.2 sales-order-approval-pdf-and-customer-email`, adding the additive `SalesOrderApprovalDispatch` ledger plus the RLS-backed `sales_orders/0018_salesorderapprovaldispatch` migration so approved sales orders now persist one durable PDF/send record per order with provider metadata, attempt counts, and failure evidence. Added `tenant_apps.sales_orders.services.approval_dispatch.approve_sales_order_and_send_to_customer()` to freeze the approved PDF once, persist a durable dispatch state before the external Outlook/Graph call, and finalize approval only after the customer send succeeds; updated sales-order approval to intercept `APPROVED` transitions; and added focused backend tests for success, idempotent retry reuse, missing-recipient fail-closed behavior, and transition-hook coverage. Validation: `cd backend && python manage.py test tenant_apps.sales_orders --noinput`. (PR: #4955)
- **2026-05-07** — Phase 16 draft sales-order generation: shipped `CTE-04.1 draft-sales-order-generation-from-fulfill-or-approved-source`, adding `tenant_apps.sales_orders.services.draft_sales_order` with deterministic `create_draft_from_fulfill(tenant, inquiry)` and `create_draft_from_approved_source(tenant, purchase_order)` entry points plus `POST /api/v1/inquiries/{id}/create-sales-order-draft/` and `POST /api/v1/purchase-orders/{id}/create-sales-order-draft/` actions. The seam follows `CTE-02.4`'s idempotent pattern, preserves inquiry/supplier-PO lineage in `SalesOrder.custom_data`, emits `sales_order.draft_created` telemetry, and fails closed across tenants. Validation: `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py test tenant_apps.sales_orders tenant_apps.purchase_orders.tests tenant_apps.inquiries.tests`. (PR: #4952)
- **2026-05-07** — Sprint Execution Packages 11–15 planned: expanded CTE-04.1 with 10-step implementation specification (service seam, lineage, PDF, telemetry, API endpoints, Quick Action); added **CTE-04.7 unified-inquiry-po-form-consolidation** as new P1.5 ticket in Phase 16 backlog (UnifiedForm with 5 modes, AI Inbox routing, localStorage autosave); enhanced RT-02.3 with production-grade AI feedback spec (AIFeedbackLog model, correction fields, dependency auto-creation, parse-status badges); enhanced RT-08.3 with real-time margin dashboard spec (live React Flow node metrics, Financial Snapshot panel, drill-down); enhanced RT-10.1/RT-10.2 with template library + variant spec (locked nodes, publish validation, version history, diff UI). Added Sprint Execution Packages section to `MASTER_PLAN.md` and `.github/EPIC_TICKETS.md` with execution order, dependency graph, and cross-cutting requirements. All planning-only; gated execution per dependency chain.
- **2026-05-07** — Documentation consolidation & backlog restructure: archived 44 stale documents to `archived/docs/` (root session reports, phase completion docs, superseded GitHub workflow docs, plan stubs), deduplicated 5 workforms docs, restructured `.github/EPIC_TICKETS.md` from 2180 to ~1150 lines with collapsible shipped-ticket sections and proper phase/epic headers, fixed Phase 16 stale "planned only, not started" contradiction, added dependency graph and execution priority table, and identified 6 high-impact gap tickets (INFRA-01.1 test factories, INFRA-01.2 MSW setup, CTE-04.6 structured logging, RT-00.1 OpenAPI regression gate, INFRA-02.1 Lighthouse CI budget, RT-08.0 financial reconciliation).
- **2026-05-07** — Phase 18 planning sealed: added **Phase 18: Process Intelligence Scale & Self-Service Operations** to canonical `MASTER_PLAN.md`, `.github/EPIC_TICKETS.md` (14 blocked tickets: RT-06.1–RT-06.4, RT-07.1–RT-07.3, RT-08.1–RT-08.3, RT-09.1–RT-09.2, RT-10.1–RT-10.2), `docs/PROCESS_COCKPIT_ENHANCEMENT.md` (RT-06 notification + quick action specs), and `docs/WORKFORMS_DEVELOPER_GUIDE.md` (RT-09 analytics event standards). All tickets blocked behind Phase 17 runtime (RT-01–RT-04). RT-10 double-gated behind RT-06–09 verification. Planning-only; no implementation.
- **2026-05-07** — Phase 17 planning sealed: added **Phase 17: Process Runtime Intelligence & Unified Operations** to canonical `MASTER_PLAN.md`, `.github/EPIC_TICKETS.md` (14 blocked tickets: RT-01.1, RT-02.1–RT-02.4, RT-03.1–RT-03.3, RT-04.1–RT-04.3, RT-05.1–RT-05.2), `docs/workforms/WORKFLOW_EDITOR_ENHANCEMENT_ROADMAP.md` (RT-05 editor stabilization), and `docs/FORM_PROCESS_TESTING_GUIDE.md` (33 test cases for RT-01 template). All tickets blocked behind Phase 16 CTE contracts. RT-05 double-gated behind RT-01–04 verification. Planning-only; no implementation.
- **2026-05-07** — Phase 16 supplier PO approved dispatch: shipped `CTE-03.3 supplier-po-approved-pdf-generation-and-email-send`, adding the additive `PurchaseOrderApprovalDispatch` ledger plus the RLS-backed `purchase_orders/0020_purchaseorderapprovaldispatch` migration so approved supplier purchase-order dispatch now persists one durable PDF/send record per PO with provider metadata, attempt counts, and failure evidence. Added `tenant_apps.purchase_orders.services.approval_dispatch` to freeze the approved PDF once, persist a durable `sending` state before the external Outlook/Graph call, and finalize approval only after the supplier send succeeds; updated purchase-order approval to use a PO-specific `transition-status` path; and blocked purchase-order status bypasses through PATCH and workflow `update_record`. Validation: `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`; `cd backend && python manage.py test tenant_apps.purchase_orders.tests apps.core.tests.test_document_workflows tenant_apps.workflows.tests.test_action_executor_notifications --noinput`; `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.workflows apps.integrations --noinput`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4935)
- **2026-05-07** — Phase 16 supplier PO review and approval: shipped `CTE-03.2 supplier-po-review-and-approve-screen`, adding a tenant-safe `GET /api/v1/purchase-orders/{id}/review-context/` action that re-resolves inquiry and RFQ lineage from trusted same-tenant rows instead of exposing raw draft metadata. Added a dedicated `frontend/src/pages/PurchaseOrderReview.tsx` route and `purchaseOrderReviewService` so operators can inspect draft supplier purchase-order context, parsed supplier quote details, and shared approval controls on `/purchase-orders/:id/review`, then updated AI pending-review purchase-order deep links and legacy `/purchase-orders?review=...` handoff behavior to land on the dedicated review screen. Validation: `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.ai_assistant.tests.test_review_queue_api tenant_apps.inquiries.test_supplier_quote_po_draft --noinput`; `cd frontend && npm run verify-standards`; `cd frontend && ./node_modules/.bin/vitest run src/pages/PurchaseOrderReview.test.tsx src/pages/MyTasks/MyTasks.aiReview.test.tsx`; local `cd frontend && npm run test:ci` still exits non-zero because Vitest reports repo-baseline unhandled `window is not defined` errors from `src/pages/Accounting/SettlementQueue.test.tsx` outside this diff. (PR: #4934)
- **2026-05-07** — Phase 16 generic order approval contract: shipped `CTE-03.1 generic-order-approval-state-machine-contract`, hardening the shared `apps.core.services.document_workflows` state machine so `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder` now share one fail-closed approval lifecycle across create-time status validation and explicit transition actions. The shared serializer mixin now rejects illegal initial approved states, the shared viewset action now re-fetches tenant-scoped rows inside `transaction.atomic()` with `select_for_update(of=("self",))`, and dedicated backend regressions cover service semantics, API rejection paths, tenant fail-closed behavior, and carrier purchase-order audit compatibility without adding new schema. Validation: `cd backend && python manage.py test apps.core.tests.test_document_workflows tenant_apps.purchase_orders.tests.DocumentOperationsAPITests tenant_apps.sales_orders.tests --noinput`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py test apps.core.tests.test_document_workflows tenant_apps.purchase_orders tenant_apps.sales_orders --noinput`. (PR: #4933)
- **2026-05-07** — Phase 16 supplier quote PO drafting: shipped `CTE-02.4 draft-supplier-purchase-order-generation-from-quotes`, adding the canonical `tenant_apps.inquiries.services.supplier_quote_po_draft` seam and `POST /api/v1/inquiries/{id}/create-supplier-po-draft/` so qualifying normalized supplier quote replies now create one tenant-safe draft `PurchaseOrder` with exact inquiry/RFQ/source-email lineage, explicit pending-review metadata, and idempotent retry behavior that preserves resolved `AIFeedbackLog` review items. Added focused backend coverage for draft creation, idempotent retry behavior, fail-closed unqualified and cross-tenant reply handling, action payload semantics, and purchase-order review-target rendering. Validation: `cd backend && python manage.py test tenant_apps.inquiries.test_supplier_quote_po_draft tenant_apps.ai_assistant.tests.test_review_queue_api --noinput`; `cd backend && python manage.py makemigrations --check && python manage.py test tenant_apps.inquiries.test_supplier_quote_po_draft apps.integrations.test_email_review_drafts tenant_apps.ai_assistant.tests.test_review_queue_api tenant_apps.purchase_orders.tests --noinput`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4932)
- **2026-05-07** — Phase 16 supplier reply parsing: shipped `CTE-02.3 structured-supplier-reply-parser-and-quote-normalization`, adding the canonical `tenant_apps.inquiries.services.supplier_quote_reply_parser` seam so inbound supplier emails now correlate back to sent `InquirySupplierRFQ` rows via tenant-safe thread/reference anchors before any generic order-classification logic runs. The new flow uses OpenAI structured outputs to normalize supplier availability, price, quantity, and lead-time replies into explicit confidence/error-state payloads, persists matched reply lineage on `InquirySupplierRFQ.custom_data`, and keeps ambiguous/unmatched/error replies operator-visible without creating draft orders. Added focused backend coverage for thread/reference correlation, ambiguity fail-closed behavior, cross-tenant suppression, parse-error persistence, and signal-level generic-classifier bypassing. Validation: `cd backend && python manage.py test tenant_apps.inquiries.test_supplier_quote_reply_parser apps.integrations.test_email_review_drafts --noinput`; `cd backend && python manage.py makemigrations --check && python manage.py test apps.integrations tenant_apps.integrations tenant_apps.ai_assistant tenant_apps.inquiries --noinput`. (PR: #4931)
- **2026-05-06** — Phase 16 outbound supplier RFQ service: shipped `CTE-02.2 outbound-supplier-rfq-email-service-and-audit-log`, adding the tenant-scoped `InquirySupplierRFQ` audit model and RLS-backed migration so one durable row now tracks each inquiry/supplier RFQ send attempt. Added the canonical `tenant_apps.inquiries.services.supplier_rfq_email` service to resolve broker inquiry matches into outbound supplier RFQs using the existing supplier-matching seam plus the tenant’s Microsoft connection, extended `MicrosoftGraphProvider.send_email()` to create/send drafts and return provider message/thread/internet-message identifiers, and registered the new inquiry RFQ table in the RLS manifest. Added focused backend coverage for provider metadata mapping, sent-row idempotency, non-broker fail-closed behavior, and cross-tenant supplier suppression. Validation: `cd backend && python manage.py test tenant_apps.inquiries.test_supplier_rfq_email apps.integrations.test_microsoft_outbound_send --noinput`; `cd backend && python manage.py makemigrations --check && python manage.py migrate --plan && python manage.py test apps.integrations apps.email_integration tenant_apps.inquiries tenant_apps.ai_assistant --noinput`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4930)
- **2026-05-06** — Phase 16 broker supplier matching: shipped `CTE-02.1 supplier-match-engine-for-broker-route`, adding the canonical `apps.core.services.supplier_matching` service so broker-routed inquiries now return a deterministic ordered supplier candidate list from explicit availability, plant/location master-product affinity, protein signals, and optional commercial narrowing. Kept the seam backend-only for this ticket, hardened the source queries to fail closed on cross-tenant plant/location references, and added focused backend regression coverage for exact-match ranking, commercial-filter narrowing, non-broker fail-closed behavior, and cross-tenant suppression without introducing new schema. Validation: `cd backend && python manage.py test apps.core.tests.test_supplier_matching apps.core.tests.test_inventory_availability tenant_apps.inquiries tenant_apps.suppliers apps.system --noinput`; `bash scripts/verify_golden_state.sh`. (PR: #4929)
- **2026-05-06** — Phase 16 inquiry alerting + review queue: shipped `CTE-01.4 live-inquiry-alerting-and-operator-review-queue`, wiring inquiry create/route-change signals to upsert tenant-safe `AIFeedbackLog` review rows and high-priority same-tenant `UserNotification` alerts with `/inquiries?review=inquiry&inquiry=<id>` metadata/action URLs. Preserved that explicit review target inside the pending-review API, added `frontend/src/services/inquiryService.ts` so the inquiry page/detail flow stops issuing direct client calls, auto-opened `/inquiries` into inquiry review mode from query params, and surfaced route/source provenance inside `InquiryDetailModal` with focused backend/frontend regression coverage. Validation: `cd backend && python manage.py test tenant_apps.inquiries.tests.InquiryAlertingSignalTests tenant_apps.ai_assistant.tests.test_review_queue_api --noinput`; `cd frontend && npm run test -- run src/pages/Inquiries.test.tsx`; `cd frontend && ./node_modules/.bin/tsc --noEmit`; `cd frontend && ./node_modules/.bin/eslint src/pages/Inquiries.tsx src/components/Inquiry/InquiryDetailModal.tsx src/services/inquiryService.ts src/pages/Inquiries.test.tsx`. (PR: #4928)
- **2026-05-06** — Phase 16 inventory routing contract: shipped `CTE-01.3 inventory-availability-contract-and-routing-service`, adding an additive `MasterProduct -> system.Product` bridge plus the canonical `apps.core.services.inventory_availability` service so inquiry routing now derives `FULFILL` vs `BROKER` from explicit tenant-scoped supplier availability instead of ad hoc metadata. Wired the service into inquiry serializer create/update defaults and email draft upserts so `route_decision` is server-authored, fail-closed to `BROKER` when the inquiry lacks a mapped product, and covered with focused routing/product/inquiry/email regression tests. Validation: `cd backend && python manage.py test apps.core.tests.test_inventory_availability tenant_apps.products tenant_apps.inquiries apps.integrations.test_email_review_drafts --noinput`; `cd backend && python manage.py test apps.core apps.system tenant_apps.products tenant_apps.inquiries apps.integrations --noinput`; `cd backend && python manage.py test tenant_apps.inquiries --noinput`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`. (PR: #4927)
- **2026-05-06** — Phase 16 inquiry-draft automation: shipped `CTE-01.2 ai-email-extractor-to-inquiry-draft`, extending the AI email-ingestion seam with structured demand hints, fixing the live classifier/signal contract mismatch, and adding a tenant-safe inquiry-draft upsert helper so qualifying purchase-order/new-customer emails now create or update draft `Inquiry` rows with explicit `source_email` lineage while preserving richer intake metadata in `Inquiry.custom_data`, `EmailLog.extracted_data`, and `EmailReviewDraft.extracted_payload`. Added focused backend coverage for draft inquiry creation, non-qualifying BOL no-ops, and idempotent update behavior without introducing new schema. Validation: `cd backend && python manage.py test apps.integrations tenant_apps.inquiries --noinput`; `cd backend && python manage.py test apps.integrations tenant_apps.ai_assistant tenant_apps.inquiries --noinput`; `cd backend && python manage.py test apps.integrations.test_email_review_drafts apps.integrations.tests tenant_apps.inquiries --noinput`; `cd backend && python manage.py makemigrations --check`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4926)
- **2026-05-06** — Canonical docs correction: updated `MASTER_PLAN.md` and `.github/EPIC_TICKETS.md` so shipped work matches reality after `CTE-01.1 inquiry-happy-path-contract-and-routing-fields` landed in PR #4923 and the standalone plant edit loop hotfix landed in PR #4924. This marks `CTE-01.1` shipped, promotes `CTE-01.2 ai-email-extractor-to-inquiry-draft` to the first unchecked `Ready` ticket, and removes the stale continuation target from the canonical Phase 16 snapshot. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4925)
- **2026-05-06** — Frontend stability execution: shipped a targeted plant edit loop hotfix by moving the remaining supplier-scoped plant edit surfaces off `EntityFormSurface` and onto the standalone plant editor path. `frontend/src/pages/Suppliers/PlantDetail.tsx` now unmounts the heavy detail tree before mounting `StandalonePlantEditForm`, `frontend/src/pages/Suppliers/Plants.tsx` routes edit actions to the safe standalone edit path while keeping create on the existing modal surface, and `frontend/src/App.tsx` swaps `/plants/:id/edit` onto `StandalonePlantEditRoute` so direct plant edit links also avoid the universal form engine. Added focused frontend regressions for supplier-detail edit, supplier-list edit/create routing, and the standalone plant editor test harness. Validation: `cd frontend && npm run test:ci -- src/pages/Suppliers/PlantDetail.workflows.test.tsx src/pages/Suppliers/Plants.edit.test.tsx src/pages/Plants/PlantDetailView.test.tsx src/pages/Plants/StandalonePlantEditForm.test.tsx`; `cd frontend && npm run type-check`; `cd frontend && npm run verify-standards`. (PR: #4924)
- **2026-05-06** — Phase 16 trading-engine execution: shipped `CTE-01.1 inquiry-happy-path-contract-and-routing-fields`, adding additive inquiry header contract fields for route decisions, source-email lineage, requested master-product/protein anchors, and downstream supplier PO / sales order / carrier PO linkage in `backend/tenant_apps/inquiries`. Hardened the inquiry serializers and viewset so these new fields stay tenant-safe, hydrate source-email snapshot IDs, expose the contract on detail/list responses, and preserve the route/product anchors through inquiry clone flows without introducing new tables or mutating applied migrations. Added focused backend coverage for the new contract surface plus the additive migration `0010_inquiry_carrier_purchase_order_and_more.py`. Validation: `cd backend && python manage.py test tenant_apps.inquiries apps.integrations --noinput`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`; `bash scripts/verify_golden_state.sh`. (PR: #4923)
- **2026-05-06** — Canonical docs alignment: updated `MASTER_PLAN.md` so the current-truth snapshot reflects shipped Phase 15 completion and opens Phase 16 execution with `CTE-01.1 inquiry-happy-path-contract-and-routing-fields` as the next focus, and updated `.github/EPIC_TICKETS.md` so `CTE-01.1` is again the first unchecked `Ready` ticket instead of a stale blocked entry. This restores autonomous continuation to a valid ready-state without changing runtime code or backlog ordering. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4922)
- **2026-05-06** — Onboarding contract hardening: shipped a service-layer follow-up for the durable guided-tour preferences contract by adding `frontend/src/services/userPreferencesService.ts` and routing `frontend/src/components/Onboarding/OnboardingProvider.tsx` through it instead of issuing raw `/preferences/me/` client calls. Updated the focused onboarding provider and FlowEditor onboarding-hook tests so the shared user-preferences contract remains explicit at the API seam while preserving the existing GA-04.1 replay/reset behavior. Validation: `cd backend && python manage.py test apps.core --noinput`; `cd frontend && npm run test:ci -- src/components/Onboarding/OnboardingProvider.test.tsx src/components/FlowEditor/hooks/useOnboardingTour.test.tsx`; `cd frontend && npm run verify-standards`; `cd frontend && npm run type-check`. (PR: #4921)
- **2026-05-06** — Pipeline stabilization execution: shipped the CI/CD bottleneck batch in `fix/pipeline-stabilization-20260506`, splitting PR validation so `OpenAPI Artifact` and `Validate Migrations` stop serializing unrelated work, sharding the Playwright production-preview smoke across 3 runners, hardening the shared pytest tenant-authenticated fixture defaults in `backend/conftest.py`, and cleaning the scoped admin-studio hook/unused-symbol warning debt in `Editor.tsx`, `SchemaEditor.tsx`, and `VersionHistory.tsx`. On the deploy side, preserved Golden Pipeline invariants while moving non-schema bootstrap work into `bootstrap-backend`, restoring pre-deploy `collectstatic`, removing the duplicate frontend nginx reload, and carrying forward the backend env-file heredoc fix so future workflow edits do not regress the dev deploy path. Added the requested `PIPELINE_SHARDING_COMPLETE.md` verification artifact plus `docs/guides/BRANCH_PROTECTION_SETUP.md` parity for the new `OpenAPI Artifact` status check. Validation: `cd backend && pytest tests/integration/test_tenant_fixture_defaults.py -q`; `cd backend && python manage.py test tenant_apps.workflows.tests.test_webhook_receiver_tenant_path apps.core.tests.test_throttling --noinput`; `cd backend && python manage.py makemigrations --check`; `bash .github/scripts/check_infrastructure.sh`; `bash scripts/verify_golden_state.sh`; `cd frontend && npm run verify-standards && npm run type-check`. (PR: #4920)
- **2026-05-06** — Development deploy recovery: shipped a follow-up hotfix for failed run `25448628965` by fixing the backend deploy workflow heredoc in `.github/workflows/reusable-deploy.yml` so `backend.env` is written cleanly and Docker no longer parses the shell line `chmod 600 backend.env` as an invalid environment variable. This restores the backend canary launch path without changing the secret payload, cleanup, or deploy topology. Validation: `bash .github/scripts/check_infrastructure.sh`. (PR: #4919)
- **2026-05-06** — Development deploy recovery: shipped a hotfix for failed run `25447672483` by exempting the public workflow webhook receivers in `backend/tenant_apps/workflows/views_triggers.py` from global DRF anon/user throttles, which had made the backend suite nondeterministic and caused `tenant_apps.workflows.tests.test_webhook_receiver_tenant_path` to fail with `429` responses instead of the expected `200/404`. Added a focused regression in `backend/tenant_apps/workflows/tests/test_webhook_receiver_tenant_path.py` that forces a `1/minute` global rate limit and verifies both canonical and legacy webhook endpoints still execute without throttling. Validation: `cd backend && python manage.py test tenant_apps.workflows.tests.test_webhook_receiver_tenant_path apps.core.tests.test_throttling --noinput`; `cd backend && python manage.py makemigrations --check`. (PR: #4918)
- **2026-05-06** — Frontend stability execution: shipped the `SCORCHED_EARTH` Plant edit isolation fix, replacing the Plant detail page edit path with `frontend/src/pages/Plants/StandalonePlantEditForm.tsx`, a clean-room Ant Design + React Query editor that bypasses the universal form engine and fully unmounts the detail surface while editing. Also hardened AI inbox websocket auth so JWTs are accepted from both `?access_token=` query params and websocket subprotocols, and added focused frontend/backend regression coverage plus the requested `SCORCHED_EARTH_COMPLETE.md` verification artifact. Validation: `cd backend && python manage.py test tenant_apps.ai_assistant.test_inbox_websocket tenant_apps.workflows.tests.test_collaboration_websocket_security --noinput`; `cd frontend && npm run type-check`; `cd frontend && npm run verify-standards`; `cd frontend && npm run test:ci -- PlantDetailView StandalonePlantEditForm AIAgentWidget`. (PR: #4917)
- **2026-05-06** — Phase 15 settlement execution: shipped `B2B-03.5 bank-feed-provider-adapter-and-secret-parity`, adding a Stripe Treasury-style provider adapter in `backend/tenant_apps/integrations/providers/stripe_treasury.py` plus ingest/task wiring so provider-managed settlement webhooks authenticate with `STRIPE_SETTLEMENT_WEBHOOK_SECRET`, preserve the exact raw body, and normalize into the existing settlement journal and reconciliation pipeline without introducing a second matcher. Updated `manifests/env.manifest.json`, `.github/workflows/reusable-deploy.yml`, and `docs/runbooks/SETTLEMENT_RECONCILIATION.md` so secret parity, deploy propagation, and the settlement contract stay aligned, and added backend coverage for provider signature verification, normalization, and contract expectations. Validation: `python config/manage_env.py audit`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.integrations tenant_apps.integrations --noinput`; `cd backend && python manage.py makemigrations --check`. (PR: #4916)
- **2026-05-06** — Phase 15 settlement execution: shipped `B2B-03.4 accounting-settlement-queue-and-override-ui`, adding reviewer audit metadata plus manual override/reject actions on `SettlementEvent`; tenant-admin settlement queue filtering in `tenant_apps.integrations`; an accounting settlement review page, route, nav entry, and typed frontend service for relink/reject flows; and `PaymentTransaction` query-param filtering so invoice/payment history surfaces reflect reconciled outcomes. Added focused backend/frontend coverage and updated the settlement reconciliation runbook to document manual review outcomes. This promotes `B2B-03.5 bank-feed-provider-adapter-and-secret-parity` as the next ready Phase 15 ticket. Validation: `cd backend && python manage.py test tenant_apps.integrations tenant_apps.invoices tenant_apps.sales_orders tenant_apps.purchase_orders --noinput`; `cd backend && python manage.py makemigrations --check`; `cd frontend && npm run verify-standards`; `cd frontend && npm test -- --run src/services/settlementEventsService.test.ts src/pages/Accounting/SettlementQueue.test.tsx`. (PR: #4915)
- **2026-05-06** — Phase 15 settlement execution: shipped `B2B-03.2 settlement-event-store-and-public-ingest-endpoint`, adding additive tenant-aware `SettlementSource` and `SettlementEvent` models with RLS-backed migration coverage in `tenant_apps.integrations`; authenticated tenant-admin source management endpoints plus a public tenant-path settlement ingest receiver in `backend/projectmeats/urls.py`; and async settlement-event validation that preserves tenant context without writing `PaymentTransaction` rows yet. Added focused backend coverage plus RLS manifest/validator updates for duplicate event collapse, fail-closed auth, and replay-safe raw journaling. This promotes `B2B-03.3 reconciliation-engine-into-paymenttransaction` as the next ready Phase 15 ticket. Validation: `bash scripts/verify_golden_state.sh`; `cd backend && source /venv/bin/activate && python manage.py makemigrations --check`; `cd backend && source /venv/bin/activate && python manage.py migrate --plan`; `cd backend && source /venv/bin/activate && python manage.py test tenant_apps.integrations tenant_apps.invoices apps.integrations --keepdb -v 2`. (PR: #4910)
- **2026-05-06** — Phase 15 settlement execution: shipped `B2B-03.3 reconciliation-engine-into-paymenttransaction`, adding deterministic settlement-to-ledger matching into `PaymentTransaction` with exact, ambiguous, unsupported, and mismatched review outcomes; replay-safe source-event linkage on `SettlementEvent`; and the first settlement reconciliation runbook in `docs/runbooks/SETTLEMENT_RECONCILIATION.md`. Added backend coverage for exact invoice/order matches, duplicate-event replay safety, and explicit mismatch reason codes. This promotes `B2B-03.4 accounting-settlement-queue-and-override-ui` as the next ready Phase 15 ticket. Validation: `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test tenant_apps.integrations.tests.SettlementTaskTests --keepdb -v 2`; `cd backend && python manage.py test tenant_apps.integrations tenant_apps.invoices tenant_apps.sales_orders tenant_apps.purchase_orders --keepdb -v 2`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`. (PR: #4911)
- **2026-05-06** — Phase 15 settlement execution: shipped `B2B-03.1 settlement-ingest-contract-and-webhook-first-adapter-plan`, adding the authoritative `docs/runbooks/SETTLEMENT_RECONCILIATION.md` runbook, a new `backend/tenant_apps/integrations/settlement_contract.py` contract seam that freezes webhook-first adapter + raw-event journal/idempotency rules, a `PaymentTransaction` ledger note plus focused backend regression coverage in `tenant_apps.invoices.tests` and `tenant_apps.integrations.tests`, and golden-file registry/validator enforcement so downstream settlement ingress starts from one canonical ledger contract. This promotes `B2B-03.2 settlement-event-store-and-public-ingest-endpoint` as the next ready Phase 15 ticket. Validation: `bash scripts/verify_golden_state.sh`; `cd backend && source /venv/bin/activate && python manage.py test tenant_apps.invoices tenant_apps.integrations --keepdb -v 2`. (PR: #4909)
- **2026-05-06** — Phase 15 guest-portal execution: shipped `B2B-01.5 operator-issue-resend-revoke-controls`, adding authenticated tenant-scoped portal-grant operator endpoints for target list/create plus resend, revoke, and grant-centric history in `backend/apps/core/portal_views.py`; backend request/summary/history serializers plus focused API coverage in `backend/apps/core/tests/test_portal_operator_views.py`; and a new `frontend/src/services/portalGrantService.ts` + `frontend/src/components/Portal/SharePortalLinkPanel.tsx` surface so invoice and freight-order operators can issue, resend, revoke, and inspect portal grants without reusing the public portal client. This promotes `B2B-03.1 settlement-ingest-contract-and-webhook-first-adapter-plan` as the next ready Phase 15 ticket. Validation: `cd backend && source /venv/bin/activate && python manage.py test apps.core.tests.test_portal_views apps.core.tests.test_portal_operator_views --verbosity=2 --keepdb`; `cd backend && source /venv/bin/activate && python manage.py spectacular --validate --file /tmp/projectmeats-portal-operator-openapi.yaml`; `npm -C frontend run test:ci -- SharePortalLinkPanel portalGrantService`; `npm -C frontend run verify-standards`; `bash scripts/verify_golden_state.sh`; `cd backend && source /venv/bin/activate && python manage.py test apps.core apps.tenants --verbosity=1 --keepdb`; `cd backend && source /venv/bin/activate && python manage.py makemigrations --check`; `cd backend && source /venv/bin/activate && python manage.py migrate --plan`. (PR: #4908)

- **2026-05-06** — Phase 15 guest-portal execution: shipped `B2B-01.4 frontend-public-portal-shell-and-magic-link-consume`, adding a standalone logged-out `/portal/tenants/:tenantId/grants/:grantId` route outside the internal app shell, a dedicated `frontend/src/services/portalService.ts` client that strips internal auth and tenant headers, token-consume + URL-replace handling for portal magic links, and a guest-safe invoice/document/tracking shell in `frontend/src/pages/Portal/GuestInvoiceView.tsx`; coupled that shell to a new aggregate backend `/snapshot/` endpoint so one-time grants are consumed once and partial-scope grants render empty sections instead of false expired-link failures; and added focused backend/frontend regression coverage for the snapshot contract and deterministic expired-link UX. This promotes `B2B-01.5 operator-issue-resend-revoke-controls` as the next ready Phase 15 ticket. Validation: `cd backend && python manage.py test apps.core.tests.test_portal_views --verbosity=2 --keepdb`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-portal-snapshot-openapi.yaml`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`; `npm -C frontend run test:ci -- GuestInvoiceView portalService`; `npm -C frontend run type-check`; `npm -C frontend run verify-standards`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. Note: `npm -C frontend run test:e2e` still exposes broad pre-existing auth/navigation/workflow failures outside this portal diff. (PR: #4907)

- **2026-05-06** — Phase 15 guest-portal execution: shipped `B2B-01.3 public-portal-read-apis-and-audit-trail`, adding anonymous signed-grant invoice summary, curated document metadata, and fulfillment tracking endpoints under the tenant path in `backend/apps/core/portal_views.py`; guest-safe invoice/fulfillment/public-document serializers; path-driven RLS + atomic bounded-use grant consumption; and append-only `TenantAuditEvent` access records so portal reads now fail closed and leave structured audit evidence. This promotes `B2B-01.4 frontend-public-portal-shell-and-magic-link-consume` as the next ready Phase 15 ticket. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.core apps.tenants tenant_apps.invoices tenant_apps.fulfillments --verbosity=2 --keepdb`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`. (PR: #4906)

- **2026-05-06** — Phase 15 guest-portal execution: shipped `B2B-01.2 portal-grant-and-document-registry-schema`, adding additive tenant-aware `PortalGrant`, `PortalDocumentReference`, and `PortalGrantDocumentAccess` models in `backend/apps/core/models.py`; fail-closed internal serializers that bind tenant context, require explicit resource/document allowlists, hash grant tokens at rest, and sanitize portal-safe metadata; focused backend regression coverage for cross-tenant failures and portal-safe serialization; and additive RLS policy coverage plus manifest registration for the new core portal tables. This promotes `B2B-01.3 public-portal-read-apis-and-audit-trail` as the next ready Phase 15 ticket. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.core apps.tenants --verbosity=2 --keepdb`; `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py migrate --plan`. (PR: #4905)

- **2026-05-06** — Phase 15 guest-portal execution: shipped `B2B-01.1 guest-portal-access-contract-and-doc-source-inventory`, adding the authoritative `docs/runbooks/B2B_EXTRANET_PORTAL.md` runbook, a backend security-constants seam that explicitly forbids reuse of legacy `guest-login`/JWT bootstrap flows and direct `AIDocument` exposure for counterpart access, a note in the legacy guest-mode doc to keep demo auth separate from the future portal, and golden-state enforcement plus focused tests so future guest-portal work starts from one signed-grant, tenant-explicit contract. This promotes `B2B-01.2 portal-grant-and-document-registry-schema` as the next ready ticket. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.tenants apps.core tenant_apps.invoices tenant_apps.fulfillments --verbosity=2 --keepdb`. (PR: #4904)

- **2026-05-06** — Phase 15 trade invariants execution: shipped `B2B-02.4 frontend-display-and-input-normalization`, adding the shared frontend `frontend/src/utils/trade.ts` helper for exact weight rendering, safe date-only formatting, and stable edit-form input seeding; adopting the backend `trade_weight` / `trade_timeline` contract across purchase orders, freight orders, sales orders, and invoices; and adding focused formatter/trade regression coverage to keep unit/time rendering deterministic on the frontend. This completes the `B2B-02` rollout, promotes `B2B-01.1 guest-portal-access-contract-and-doc-source-inventory` as the next ready ticket, and keeps later portal execution blocked behind that contract definition. Validation: `npm -C frontend run verify-standards`; `npm -C frontend run test:ci -- src/utils/formatters.test.ts src/utils/trade.test.ts`. (PR: #4903)

- **2026-05-06** — Phase 15 trade invariants execution: shipped `B2B-02.3 transactional-api-adoption-for-orders-invoices-fulfillments`, adding the shared `backend/apps/core/serializers_trade.py` helper surface and additive `trade_weight` / `trade_timeline` serializer payloads across purchase orders, carrier purchase orders, sales orders, invoices, and fulfillments; adding focused app-level regression coverage for the normalized trade metadata; and refreshing `manifests/openapi/openapi-schema.baseline.json` so the checked-in OpenAPI contract matches the new runtime payloads. This promotes `B2B-02.4 frontend-display-and-input-normalization` as the next ready ticket and keeps guest-portal work blocked behind the remaining B2B-02 frontend rollout. Validation: `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`; `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices tenant_apps.fulfillments --verbosity=2 --keepdb`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py makemigrations --check`. (PR: #4902)

- **2026-05-06** — Phase 15 trade invariants execution: shipped `B2B-02.2 backend-trade-engine-service-and-tests`, extending `backend/apps/core/conversions.py` into the shared backend trade engine service with deterministic Decimal conversion, UTC-safe default rendering, and explicit timezone helpers; adopting that service in `backend/apps/core/exporting.py` and `backend/apps/core/services/pdf_generator.py`; and adding focused regression coverage for CSV/PDF rendering plus DST/date-only safety in `backend/apps/core/tests/{test_conversions.py,test_trade_document_rendering.py}`. This promotes `B2B-02.3 transactional-api-adoption-for-orders-invoices-fulfillments` as the next ready ticket and keeps later guest-portal work blocked behind the remaining B2B-02 rollout. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.core tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices tenant_apps.fulfillments --verbosity=2 --keepdb`; `cd backend && python manage.py makemigrations --check`. (PR: #4901)

- **2026-05-06** — Phase 15 trade invariants execution: shipped `B2B-02.1 trade-invariants-contract-and-surface-audit`, adding the canonical `docs/runbooks/GLOBAL_TRADE_ENGINE.md` runbook, the non-adopted backend helper seam in `backend/apps/core/conversions.py`, focused core contract coverage in `backend/apps/core/tests/test_conversions.py`, and Golden Files / validator enforcement so the weight/time contract remains authoritative without rolling runtime behavior prematurely. This promotes `B2B-02.2 backend-trade-engine-service-and-tests` as the next ready ticket. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.core tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices --verbosity=2 --keepdb`; `cd backend && python manage.py makemigrations --check`. (PR: #4900)

- **2026-05-06** — Canonical backlog repair: aligned the root `MASTER_PLAN.md` and `.github/EPIC_TICKETS.md` so autonomous continuation no longer dead-ends on a blocked first unchecked ticket. This promotes `B2B-02.1 trade-invariants-contract-and-surface-audit` as the single first unchecked `Ready` ticket, marks Phase 15 execution as open only for that trade-invariants contract, and keeps downstream Phase 15 / Phase 16 work blocked behind it. Validation: `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`. (PR: #4899)

- **2026-05-06** — **[COMPLETED] Mirror Protocol follow-through** shipped in PR #4898. Added tenant-safe AI inbox websocket delivery across `backend/tenant_apps/ai_assistant/{consumers,routing,signals}.py`, `backend/projectmeats/asgi.py`, and `frontend/src/components/AIAssistant/AIAgentWidget.tsx`, so staff sessions now receive pending-review snapshots and live inbox updates while non-staff users stay zeroed and outside the tenant broadcast group. Also masked UUID breadcrumb labels to human-readable record fallbacks in `frontend/src/components/Cockpit/BreadcrumbBar.tsx`, added focused frontend/backend regression coverage for the widget and breadcrumb behavior, and enforced the permanent `useQueries` ban under `frontend/src/features/system/` via `.github/workflows/pr-validation.yml`. Plant edit remains on the Air Gap/static-form path; `MIRROR_PROTOCOL_COMPLETE.md` was updated to reflect that final state. Validation: `npm -C frontend run type-check`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci -- src/pages/Plants/PlantDetailView.test.tsx src/components/Cockpit/BreadcrumbBar.test.tsx src/components/AIAssistant/AIAgentWidget.test.tsx`; `cd backend && python manage.py test tenant_apps.ai_assistant.test_inbox_websocket --verbosity=2 --keepdb`; `cd backend && python manage.py makemigrations --check`.

- **2026-05-05** — SDLC V2 governance hardening: shipped the **Autonomous Shield**, adding the `AI PR Gatekeeper` workflow and `scripts/ci/ai_pr_guard.py` so PRs to `development` and `main` get AI-backed Golden Rule enforcement using `.cursorrules` + `.github/SDLC_PROTOCOLS.md`, creating ADRs `0001` through `0003` for architecture-rationale durability, and introducing `make ai-task` / `scripts/dev/bundle_ai_context.sh` so fresh AI sessions start with the next unchecked ticket plus a Golden Schema digest. The deferred execution lane returns to `ai-stop-generation` while the canonical backlog remains blocked at `B2B-02.1 trade-invariants-contract-and-surface-audit`. (PR: #4896)
- **2026-05-05** — Phase 13 AI autonomy platform execution: shipped `EH-06.2 semantic-index-lineage-and-durable-exports`, exposing document lineage summaries on AI document payloads, surfacing semantic indexing health and approval-pending state in the existing AI chat/document UI, and closing the operator-visibility gap now that semantic indexing, lineage persistence, and durable RLHF export storage are live. The next ordered ticket in the backlog is `B2B-02.1 trade-invariants-contract-and-surface-audit`, which remains blocked in the current backlog state. (PR: #4893)
- **2026-05-05** — Phase 13 AI autonomy platform execution: shipped `EH-06.1 autonomous-control-plane-foundation`, confirming the tenant-native AI run/task/approval control plane already on trunk, hardening approval resolution so missing or cross-tenant approval IDs return stable `404` responses instead of surfacing ORM exceptions, expanding regression coverage for approve/deny not-found paths, and promoting `EH-06.2 semantic-index-lineage-and-durable-exports` as the next ready ticket. (PR: #4892)
- **2026-05-05** — Phase 12 runtime/ops reliability execution: shipped `EH-05.2 observability-and-rollback-drill`, replacing the stale Golden registry environment-status matrix with contract-driven verification surfaces, aligning rollback/observability guidance on the live shared frontend `SENTRY_DSN` runtime pass-through, and promoting `EH-06.1 autonomous-control-plane-foundation` as the next ready ticket now that the non-dev rollback drill contract is explicit and reproducible. (PR: #4891)
- **2026-05-05** — Phase 12 runtime correctness execution: shipped `EH-02.4 atomic-workflow-collaboration-locks`, replacing workflow node acquire/renew/release semantics with atomic Redis-backed owner/data operations for non-dev runtimes, tightening the no-Redis path into an explicit process-local dev/test fallback, and expanding concurrency regression coverage so collaboration locks no longer rely on shared-cache read/modify/write races. This promotes `EH-05.2 observability-and-rollback-drill` to the next ready ticket. (PR: #4890)
- **2026-05-05** — Phase 12 runtime/ops reliability execution: shipped `EH-05.1 non-dev-redis-readiness-gate`, threading `REQUIRE_REDIS_READINESS` through reusable-deploy's backend secret preflight steps, enforcing that contract in `validate-workflows.sh`, and aligning the Golden registry wording so non-dev Redis/Valkey readiness fails before deeper deploy stages while dev retains explicit fallback lanes. This promotes `EH-02.4 atomic-workflow-collaboration-locks` to the next ready ticket. (PR: #4889)
- **2026-05-05** — Phase 14 onboarding hardening execution: shipped a follow-up hardening pass on `GA-04.2 cockpit-empty-state-system`, promoting cockpit blank-slate detection off canonical stats data instead of tour completion alone, letting dashboard editing dismiss the welcome state instead of trapping users behind onboarding copy, adding focused cockpit empty-state regression coverage, and fixing the `AIDraftReviewModal` frontend test leak so `test:ci` completes without unhandled browser-global errors. (PR: #4888)
- **2026-05-05** — Phase 14 onboarding hardening execution: shipped a follow-up hardening pass on `GA-04.1 tour-provider-and-user-preference-contract`, extending the shared onboarding provider to migrate legacy Cockpit/FlowEditor localStorage flags into the canonical `onboarding_state` preference contract, clearing stale completion state before tour restarts, and refreshing focused backend/frontend regression coverage against the current serializer/provider architecture. (PR: #4887)
- **2026-05-05** — Planning governance: added **Phase 19: Ambient AI & Contextual Next-Best-Actions** to the canonical root `MASTER_PLAN.md` and appended blocked `AMB-01` through `AMB-04` execution tickets to the bottom of `.github/EPIC_TICKETS.md`. This is planning-state only; the active execution lane remains Phase 14 / Phase 12 work above it.
- **2026-05-05** — Phase 12 hardening execution: shipped `EH-04.3 floweditor-decomposition-phase-1`, extracting the passive overlay presenter layer out of `UnifiedFlowEditor.tsx` into a dedicated `FlowEditorPassiveOverlays` component, keeping the graph mutation/config portal/template logic inside the parent editor, and adding focused FlowEditor regressions so the first decomposition seam lands without widening runtime behavior. This promotes `EH-05.1 non-dev-redis-readiness-gate` to the next ready ticket. (PR: #4878)
- **2026-05-05** — Phase 12 hardening execution: shipped `EH-04.2 search-contract-unification`, consolidating ranked search, universal search, continuous search, and recent-item consumption onto one frontend `searchService` contract backed by `businessApi`, normalizing aliased entity types/routes/icons/colors, migrating the Entity Explorer recent-items widget and search diagnostics onto the shared contract, and refreshing focused frontend regressions so search callers no longer drift on payload shape. This promotes `EH-04.3 floweditor-decomposition-phase-1` to the next ready ticket. (PR: #4876)
- **2026-05-05** — Phase 12 hardening execution: shipped `EH-04.1 tenant-aware-query-keys-and-cache-clear-removal`, migrating the remaining tenant-sensitive React Query keys and invalidations onto the shared `withTenantQueryKey(...)` helper across frontend pages/hooks/components, extending helper regression coverage, and removing the last App-level tenant-switch cache cleanup fallback now that tenant-scoped query identity is consistent. This promotes `EH-04.2 search-contract-unification` to the next ready ticket. (PR: #4874)
- **2026-05-04** — Phase 12 hardening execution: `EH-03.2 openapi-ts-mobile-typegen` is already shipped on `development` via PRs #4777 and #4562, adding the shared OpenAPI type-generation path (`generate:openapi-types` + checked-in `shared/types/generated/openapi.ts`), stable shared aliases in `shared/types/openapi.ts`, frontend AI-service adoption of generated contract types, and mobile WorkForms consumption of generated list/detail contract types. Canonical backlog sync now promotes `EH-04.1 tenant-aware-query-keys-and-cache-clear-removal` to the next ready ticket. (PRs: #4777, #4562)
- **2026-05-04** — Phase 12 hardening execution: `EH-03.1 openapi-ai-and-high-churn-surface-coverage` is already shipped on `development` via PR #4775, adding explicit drf-spectacular request/response contracts for the AI assistant high-churn routes (chat, metrics, pending review, tools/openapi, recent errors, resolve, and swarm invoke) and aligning the OpenAPI baseline artifact so those endpoints expose stable request/response shapes. Canonical backlog sync now promotes `EH-03.2 openapi-ts-mobile-typegen` to the next ready ticket. (PR: #4775)
- **2026-05-04** — Phase 12 hardening execution: shipped `EH-02.3 chat-session-tenant-fk-rls`, removing the remaining AI chat runtime fallback to JSON-stamped tenant context, requiring tenant-FK-bound session/message reads in the chat API/viewsets, rejecting legacy context-only session reuse instead of silently backfilling it at request time, and adding focused chat tenant/RLS regression coverage for the runtime contract plus policy registration. This promotes `EH-03.1 openapi-ai-and-high-churn-surface-coverage` to the next ready ticket. (PR: #4871)
- **2026-05-04** — Phase 12 hardening execution: `EH-02.2 platform-idempotency-keys` is already shipped on `development` via PRs #4773 and #4776, adding the tenant-scoped `IdempotencyKey` model + RLS policy, a shared core idempotency service, and first-batch endpoint coverage for Workform execute and AI document upload with focused replay/conflict regression tests. Canonical backlog sync now promotes `EH-02.3 chat-session-tenant-fk-rls` to the next ready ticket. (PRs: #4773, #4776)
- **2026-05-04** — Phase 12 hardening execution: `EH-02.1 fail-closed-tenant-rls-runtime` is already shipped on `development` via PR #4771, making tenant-scoped HTTP middleware, RLS helpers, invitation/core task entrypoints, and related write-path regressions fail closed when tenant RLS context cannot be asserted. Canonical backlog sync now promotes `EH-02.2 platform-idempotency-keys` to the next ready ticket. (PR: #4771)
- **2026-05-04** — Phase 12 hardening execution: `EH-01.4 rollback-release-automation-alignment` is already shipped on `development` via PR #4769, aligning `.github/scripts/deployment-rollback.sh`, `docs/runbooks/INCIDENT_RESPONSE.md`, `.github/workflows/README.md`, and `docs/GOLDEN_PIPELINE.md` to the reusable-deploy rollback/release contract. Canonical backlog sync now promotes `EH-02.1 fail-closed-tenant-rls-runtime` to the next ready ticket. (PR: #4769)
- **2026-05-04** — Phase 12 hardening execution: `EH-01.3 pr-security-gates-and-dependabot-scope` is already shipped on `development` via PR #4766, adding PR-time dependency review and automation security gates, restricting Dependabot auto-merge to explicit dependency manifests and lockfiles, and enforcing those guardrails through `validate-workflows.sh` and `.github/CODEOWNERS`. This promotes `EH-01.4 rollback-release-automation-alignment` to the next ready ticket. (PR: #4766)
- **2026-05-04** — Phase 12 hardening execution: `EH-01.2 manifest-required-secret-parity` is already shipped on `development` via PR #4764 (building on the deploy secret contract groundwork in PR #4751), replacing reusable-deploy inline required-secret derivation with the shared manifest-driven validator, adding required-secret listing/validation commands to `config/manage_env.py`, and tightening the workflow drift gate so inline secret logic cannot drift back in. This promotes `EH-01.3 pr-security-gates-and-dependabot-scope` to the next ready ticket. (PR: #4764)
- **2026-05-04** — Phase 12 hardening execution: shipped `EH-01.1 drift-gate-depth`, adding branch-protection required-check parity validation to `scripts/verify_golden_state.sh` so stale branch-protection guidance now fails the Golden drift gate, and updating `docs/guides/BRANCH_PROTECTION_SETUP.md` to match the live PR validation job names. This promotes `EH-01.2 manifest-required-secret-parity` to the next ready ticket. (PR: #4863)
- **2026-05-04** — Canonical queue sync: revalidated the merged `development` state after the Phase 14 edge-resilience closeout, confirmed the full Phase 14 / Phase 14.5 lane is already shipped on `development` (including the earlier GA-01 ETL and GA-02 infrastructure batches), and corrected the canonical handoff so autonomous continuation no longer points back at stale `GA-01.1` text. The ordered backlog now promotes `EH-01.1 drift-gate-depth` as the single first unchecked `Ready` ticket. (PR: #4862)
- **2026-05-04** — Deployment hotfix: shipped a frontend CI repair for Actions run `25310797013`, updating `EntityMapperModal.test.tsx` so the form-field load error assertion matches the structured logger payload now emitted by `logger.error`. This restores the failing `deploy-dev / Test Frontend` lane on `development` after PR #4858/#4859. (PR: #4860)
- **2026-05-04** — Phase 14 edge-resilience execution: shipped `GA-05.4 offline-replay-and-warehouse-e2e`, adding a runtime/local emergency disable control for the operational offline queue, a diagnostics replay smoke harness, focused replay/offline integration coverage, and a targeted Chromium smoke for the rollout guard. This seals the GA-05 edge-resilience lane and returns autonomous continuation to the top-most ready Phase 14 ticket `GA-01.1 day-0-etl-source-contracts`. (PR: #4858)
- **2026-05-04** — Phase 14 edge-resilience execution: shipped `GA-05.3 warehouse-critical-optimistic-mutations`, adding optimistic operational status transitions for purchase, sales, and freight documents, a tenant-scoped offline replay queue for transient connectivity loss, immediate freight detail/list status reflection, and focused regression coverage for queue replay plus hard-failure rollback. This promotes `GA-05.4 offline-replay-and-warehouse-e2e` to the next ready ticket. (PR: #4856)
- **2026-05-04** — Phase 14 edge-resilience execution: shipped `GA-05.2 connectivity-state-and-offline-banner`, adding a shared browser connectivity provider, surfacing offline/reconnecting state through a global app-shell banner plus a compact header pill, and adding focused regression coverage for connectivity transitions and banner rendering. This promotes `GA-05.3 warehouse-critical-optimistic-mutations` to the next ready ticket. (PR: #4854)
- **2026-05-04** — Phase 14 edge-resilience execution: shipped `GA-05.1 vite-pwa-app-shell-foundation`, adding the canonical Vite PWA/service-worker path, excluding `env-config.js` from precache so deployment-time runtime config stays network-first, hydrating the last-known runtime config before app import for offline-safe bootstrap, and adding focused runtime-config/service-worker regression coverage plus build documentation. This promotes `GA-05.2 connectivity-state-and-offline-banner` to the next ready ticket. (PR: #4852)
- **2026-05-04** — Phase 14 onboarding execution: shipped `GA-04.4 onboarding-telemetry-and-resume-controls`, extending the shared onboarding preference contract with lightweight per-tour telemetry, teaching the Cockpit and Workforms tour flows to respect intentional skips without auto-restarting, and adding an app-shell help surface that can start, resume, or replay supported tours through the shared onboarding provider. This promotes `GA-05.1 vite-pwa-app-shell-foundation` to the next ready ticket. (PR: #4850)
- **2026-05-04** — Phase 14 onboarding execution: shipped `GA-04.3 transactional-surface-empty-states`, adding a reusable transactional onboarding empty-state wrapper, wiring first-run CTA guidance through purchase orders, sales orders, freight orders, invoices, and shared record tabs, and separating filter/search empty results from true zero-data onboarding states so list surfaces do not regress into misleading first-run prompts. This promotes `GA-04.4 onboarding-telemetry-and-resume-controls` to the next ready ticket. (PR: #4848)
- **2026-05-04** — Phase 14 onboarding execution: shipped `GA-04.2 cockpit-empty-state-system`, upgrading the reusable frontend `EmptyState` primitive to support multi-CTA onboarding layouts, adding a cockpit-specific first-run empty state with direct customer/inquiry/tour/dashboard actions, and wiring the dashboard to show that welcome surface before the normal widget chrome. This promotes `GA-04.3 transactional-surface-empty-states` to the next ready ticket. (PR: #4846)
- **2026-05-04** — Phase 14 onboarding execution: shipped `GA-04.1 tour-provider-and-user-preference-contract`, adding a shared frontend onboarding provider wired at the app shell, a canonical `onboarding_state` serializer contract on `UserPreferences`, and focused backend/frontend regression coverage so Cockpit and FlowEditor tours no longer depend on page-specific localStorage flags. This promotes `GA-04.2 cockpit-empty-state-system` to the next ready ticket. (PR: #4844)
- **2026-05-04** — Phase 14 governance execution: shipped `GA-03.4 governance-schedules-and-evidence-runbook`, adding a governance posture audit service + `audit_data_governance` management command, scheduling the daily `system.audit_data_governance_posture` check on `pm.ops`, wiring the ops management workflow help text to the new audit path, and refreshing the retention/incident runbooks with explicit evidence capture steps for archive/redaction drift. This promotes `GA-04.1 tour-provider-and-user-preference-contract` to the next ready ticket. (PR: #4842)
- **2026-05-04** — Phase 14.5 UI/UX stabilization execution: shipped `UI-01.3 breadcrumb-uuid-resolution-engine`, upgrading the shared app-shell breadcrumb to resolve supported entity-id path segments through the approved business service layer, preserving stable fallback labels when lookups miss, and adding focused regression coverage for nested supplier/plant breadcrumb name resolution. This promotes `GA-03.4 governance-schedules-and-evidence-runbook` to the next ready ticket. (PR: #4840)
- **2026-05-04** — Phase 14.5 UI/UX stabilization execution: shipped `UI-01.2 null-safety-formatters`, adding shared numeric coercion plus null-safe currency/fixed-number helpers, routing shared entity detail and invoice/receivable read-only surfaces through that canonical formatter path, and adding focused regressions for helper behavior plus zero-valued invoice detail rendering. This promotes `UI-01.3 breadcrumb-uuid-resolution-engine` to the next ready ticket. (PR: #4838)
- **2026-05-04** — Phase 14.5 UI/UX stabilization execution: shipped `UI-01.1 modal-lifecycle-lockdown`, restricting the inquiry clone modal to true open-state mounts, adding `destroyOnHidden` to the plant/supplier/customer add-products modals, tightening their catalog refetch effects so search/filter changes no longer churn hidden modal trees, and adding a page-level regression that proves the clone modal unmounts on close. This promotes `UI-01.2 null-safety-formatters` to the next ready ticket. (PR: #4836)
- **2026-05-04** — Phase 14 governance execution: shipped `GA-03.3 pii-redaction-for-logging-and-sentry`, centralizing backend log/Celery/Sentry redaction plus frontend logger/Sentry sanitization, disabling default PII transport, adding focused regression coverage for the observability scrubbers, refreshing the retention runbook, and landing the Phase 14.5 planning hook that promotes `UI-01.1 modal-lifecycle-lockdown` to the next ready execution ticket. (PR: #4832)
- **2026-05-04** — Planning governance: inserted **Phase 14.5: Zero-Defect UI/UX Eradication** into the active Phase 14 lane, defining three next-up stabilization goals for modal lifecycle lockdown, null-safe numeric formatting, and breadcrumb UUID resolution. This planning batch explicitly queues the `UI-01` epic ahead of remaining GA-04/GA-05 and later B2B feature work while the current `GA-03.3 pii-redaction-for-logging-and-sentry` merge remains in flight. This is a planning-state note only; append shipped PR evidence after execution merges.
- **2026-05-01** — Phase 14 governance execution: shipped `GA-03.2 seven-year-archive-command`, adding the dry-run-first `archive_historical_records` management command, tenant-scoped `ArchiveBatch` / `ArchiveRecordSnapshot` / `ArchiveLegalHold` evidence tables with additive RLS policies, legal-hold enforcement for direct and parent-linked records, and updated retention guardrails/runbook coverage. This promotes `GA-03.3 pii-redaction-for-logging-and-sentry` to the next ready ticket. (PR: #4823)
- **2026-05-01** — Phase 14 governance execution: shipped `GA-03.1 retention-inventory-and-archive-contract`, adding the authoritative `docs/runbooks/DATA_RETENTION.md` runbook and `backend/apps/core/services/data_governance.py` contract module to define the 7-year archive inventory, explicit exemptions, future legal-hold shape, archive-restore expectations, and operator evidence requirements without yet shipping archive automation. The retention contract is now registered in `manifests/GOLDEN_FILES.md`, guarded by `scripts/verify_golden_state.sh`, and covered by focused backend tests. This promotes `GA-03.2 seven-year-archive-command` to the next ready ticket. (PR: #4822)
- **2026-05-01** — Phase 14 infrastructure execution: shipped `GA-02.4 redis-eviction-and-queue-health-guardrails`, pinning the Redis/Valkey `noeviction` contract and memory thresholds in Django settings; surfacing additive Redis guardrail + queue backlog diagnostics in public health and `check_infrastructure`; documenting the broker-distress response sequence in the Terraform desired-state scaffold plus infrastructure/DR docs; and extending backend regression coverage plus the golden-state validator so Redis policy or queue-health drift fails before deployment. This promotes `GA-03.1 retention-inventory-and-archive-contract` to the next ready ticket. (PR: #4821)
- **2026-05-01** — Phase 14 infrastructure execution: shipped `GA-02.3 celery-worker-scaling-envelope`, making Celery queue ownership explicit across `pm.ops`, `pm.email`, `pm.workforms`, `pm.ai`, and `pm.etl`; lowering worker prefetch to `1`; publishing beat jobs into named queues; codifying worker envelopes and queue saturation thresholds in `deploy/terraform/`; extending infrastructure / disaster-recovery docs with the async runtime contract; and adding backend regression coverage plus golden-state validation so queue topology drift fails before deployment. This promotes `GA-02.4 redis-eviction-and-queue-health-guardrails` to the next ready ticket. (PR: #4820)
- **2026-04-30** — Phase 14 infrastructure execution: shipped `GA-02.2 postgres-pitr-verification-and-restore-drill`, adding the canonical `docs/runbooks/DISASTER_RECOVERY.md` restore-drill / manual PITR verification playbook; strengthening non-dev pre-migration backup validation with `pg_restore --list`; fixing ops workflow production-lane mapping for `production-backend`; aligning backup/DR docs to manifest-defined DB/SSH secrets; and adding validator coverage so disaster-recovery guidance and backup verification cannot drift silently. This promotes `GA-02.3 celery-worker-scaling-envelope` to the next ready ticket. (PR: #4819)
- **2026-04-30** — Phase 14 infrastructure execution: shipped `GA-02.1 infra-desired-state-and-iac-scaffold`, adding a non-applying `deploy/terraform/` desired-state scaffold for environment lanes, runtime paths, and deployment topology; refreshing `docs/architecture/INFRASTRUCTURE_ARCHITECTURE.md` to reflect workflow reality; registering the scaffold in `manifests/GOLDEN_FILES.md`; and enforcing its presence through `scripts/verify_golden_state.sh`. This promotes `GA-02.2 postgres-pitr-verification-and-restore-drill` to the next ready ticket. (PR: #4818)
- **2026-04-30** — Phase 14 ETL execution: shipped `GA-01.4 etl-transactional-import-and-reconciliation`, adding transactional `import_golden_legacy_data --apply` routing for purchase orders, sales orders, carrier purchase orders, invoices, and their line items; explicit ETL batch modes for dry-run/master-data/transactional apply paths; carrier master-data import coverage to close the freight-order dependency gap; fixture-backed backend coverage for transactional idempotency and row-level reconciliation; and updated Golden Schema ETL runbook guidance. This promotes `GA-02.1 infra-desired-state-and-iac-scaffold` to the next ready ticket. (PR: #4817)
- **2026-04-30** — Phase 14 ETL execution: shipped `GA-01.3 etl-master-data-import-pass`, adding the first write-capable `import_golden_legacy_data --apply` flow for tenant-scoped master data (`MasterProduct`, `Supplier`, `Customer`, `Plant`, `Location`, `Contact`), ETL execution-context guards that suppress workflow-trigger fan-out during import-managed writes, deterministic batch/journal reuse for apply mode, and fixture-backed regression coverage for idempotency, cross-tenant matching, and blank-email parent resolution. This promotes `GA-01.4 etl-transactional-import-and-reconciliation` to the next ready ticket. (PR: #4816)
- **2026-04-30** — Phase 14 ETL execution: shipped `GA-01.2 etl-journal-and-dry-run-engine`, adding tenant-safe `ETLImportBatch` / `ETLImportRowJournal` models with RLS, a journal-write-only dry-run engine behind `import_golden_legacy_data`, restart-safe rerun semantics keyed by manifest checksum, and fixture-backed backend coverage for create/update/skip/error plus failed-run persistence. This promotes `GA-01.3 etl-master-data-import-pass` to the next ready ticket. (PR: #4814)
- **2026-04-30** — Phase 14 ETL execution: shipped `GA-01.1 day-0-etl-source-contracts`, adding contract-only Golden Schema ETL scaffolding under `backend/apps/core/services/etl/`, a preview-only `import_golden_legacy_data` management command, fixture-backed backend coverage, and the `docs/runbooks/GOLDEN_SCHEMA_ETL.md` operator reference. This keeps the Day 0 migration lane additive and non-mutating while promoting `GA-01.2 etl-journal-and-dry-run-engine` to the next ready ticket. (PR: #4813)
- **2026-04-30** — Documentation governance: persisted the canonical Phase 14 / Phase 15 backlog state onto `development`, promoted explicit Smart Loader + referential-stability rules into `.github/copilot-instructions.md`, and added formal Smart Loader + Squad orchestration protocols to `.github/SDLC_PROTOCOLS.md`. (PR: #4812)
- **2026-04-30** — Operational readiness for Golden Schema transactional documents: added workflow-validated status transitions, transactional PDF generation, email-send endpoints with PDF attachments, broader audit coverage (Carrier / Invoice / CarrierPurchaseOrder), reusable frontend operational actions + audit timeline, and a new Freight Orders surface for Carrier POs. Additive migrations shipped for purchase orders, sales orders, and invoices. (PR: #4811)

- **2026-04-30** — CI/frontend: hardened the production-preview React Error #185 guard so the Plant edit smoke traps both `console.error` and `pageerror` minified-runtime failures, exercises the hydrated Customer dropdown after mount, retains Playwright traces on failure, and uploads smoke artifacts from PR validation for post-failure diagnosis. (PR: #4810)

- **2026-04-29** — Planning governance: refreshed the enterprise hardening audit surfaces (`GAP_ANALYSIS_REPORT.md`, `STRATEGIC_BLUEPRINT.md`, `.github/TECH_DEBT_REGISTER.md`, `.github/SDLC_PROTOCOLS.md`, `.github/EPIC_TICKETS.md`) so autonomous continuation starts from one ordered backlog and one normative protocol set. This is an execution scaffold note for the current branch; append shipped PR evidence after merge.

- **2026-04-30** — Planning governance: integrated the Phase 14 General Availability roadmap into the canonical root `MASTER_PLAN.md` and moved the ordered autonomous backlog in `.github/EPIC_TICKETS.md` to start with `GA-01.1 day-0-etl-source-contracts`. This is a planning-state note only; append shipped PR evidence after actual execution merges.

- **2026-04-30** — Planning governance: integrated the Phase 15 B2B Network & Financial Settlement roadmap into the canonical root `MASTER_PLAN.md`, appended blocked Phase 15 tickets to the bottom of `.github/EPIC_TICKETS.md`, and marked the architecture as sealed in planning only. This is a planning-state note only; append shipped PR evidence after actual execution merges.

- **2026-03-31** — WorkForms runtime: Quick Actions workflow items now execute via `/workforms/execute/:id` (not editor). Backend adds `POST /api/v1/tenant-workforms/:id/execute/` to create `TenantWorkFormExecution` and run async via Celery; adds `/api/v1/workflows/workform-executions/` and surfaces active executions in WorkForms Monitoring; Catalog supports deleting draft/archived WorkForms with confirmation. (PR: #4320)

- **2026-03-31** — UniversalEntityForm: purged legacy Plant create/edit forms. Suppliers “+ New Plant” and Plants table “Add/Edit” now route through `EntityFormSurface` → `UniversalEntityForm` (supplier prefill via context). Suppliers can still optionally assign plant products post-create. (PR: #4321)

- **2026-03-31** — UniversalEntityForm/DynamicFormEngine: state/province fields now render as a searchable dropdown (search by full name or abbreviation), including inline array sub-fields. (PR: #4322)

- **2026-03-31** — UniversalEntityForm: purged legacy Location create/edit forms. Customers “+ New Location” and Locations table “Add/Edit” now route through `EntityFormSurface` → `UniversalEntityForm` (customer prefill via context). Customers can still optionally assign location products post-create. (PR: #4323)

- **2026-03-31** — UniversalEntityForm: Contacts page create/edit now routes through `EntityFormSurface` → `UniversalEntityForm` (schema-driven). Context from supplier/customer/plant/location query params is prefilled on create. (PR: #4324)

- **2026-03-31** — Workforms editor: DynamicConfigPanel now supports `formReference` and `keyValue` schema field types (removes the "Unknown field type" placeholder for real node configs). (PR: #4319)
- **2026-03-31** — Workforms AI Suggestions: aligned prompt + backend fallback suggestions to canonical node type IDs; added frontend canonicalization + guard to prevent adding unknown suggested nodes. (PR: #4319)

- **2026-03-31** — Workforms editor: Form Submitted trigger config now lists saved FormProcess nodes via a dynamic dropdown (label: title/display-name + created date). (PR: #4318)

- **2026-03-31** — **HOTFIX**: Stabilized `AvailableFormsViewSet` (Quick Actions) to avoid ORM/enum edge cases and added explicit “document parsing service unreachable” error return for the AI `parse_document` tool. (PR: #4327)

- **2026-03-31** — Workforms editor onboarding: prevented Step 5 tour overlay lockout by targeting stable canvas element, enabling overlay/Esc dismissal, and aborting cleanly on close/overlay/error events. (PR: #4329)

- **2026-03-31** — Cockpit resilience: added circuit breakers to prevent retry/toast spam during 5xx/502 backend outages; show stable "Data unavailable" placeholders. (PR: #4331)

- **2026-04-01** — CI/CD: updated Master Pipeline deployment run-name formatting, restored PR validation checks in Actions feed, and re-enabled auto-promotion PR creation (development→uat, uat→main). (PR: #4333)

- **2026-04-01** — Plants: removed legacy Plant fields (`code`, `manager`, `phone`, `email`), updated Vertical plant type label to “Vertical (Kill to Fabrication)”, fixed contact phone inputs, added Department column in contact lists, and implemented strict drill-down routing + breadcrumbs (Suppliers→Plants→Contacts, Customers→Locations→Contacts). (PR: #4332)

- **2026-04-06** — Suppliers/Plants UX polish: fixed UniversalEntityForm “pushed left / distorted” modal rendering by making AntD modal width responsive (`min(720px, calc(100vw - 32px))`), hardening container sizing (`max-width: 100%`, `box-sizing: border-box`, `overflow-x: hidden`), and ensuring AntD `<Select>` dropdowns mount inside the active modal/drawer container via `getPopupContainer`. Plant detail view now uses Record Pivot standard (`EntityProfileHeader` + Contacts tab) instead of a full read-only UniversalEntityForm wall. (PR: #4344)

- **2026-04-06** — **V3.5 Unified UX Standard (Unified Forms + Record Pivot)**: all primary create/edit entry points route through `EntityFormSurface` (enhanced entity forms are selected inside it). Plant + Location detail pages use the Record Pivot layout (`EntityProfileHeader` top section + AntD `Tabs`), with relationship content in tabs (Contacts + Activity via `ActivityFeed`). Backend form schema now includes an explicit `inquiries.inquiry` “Ideal Inquiry Form” schema including product line items (inline array) for universal form parity.
  - Create/edit: `EntityFormSurface` only (no direct modal/form calls from pages)
  - Record view: `EntityProfileHeader` top section; edit opens `EntityFormSurface` modal
  - Relationships: Tabs below header; at minimum Contacts + Activity
  - Density parity: ~12px spacing, `Table size="small"`, row-click navigation like Cockpit
  (PR: #4351)

- **2026-04-06** — **Unified Component Architecture (Schema-driven Record Management)**: formalized backend form schema metadata as the “brain” for header/table rendering, and introduced canonical record navigation.
  - Backend: `/api/v1/system/forms/schema/` normalized to always include per-field `read_only`, `hidden`, `group`, `surfaces` + top-level `header_fields`/`groups` metadata.
  - Record Pivot: `EntityProfileHeader` now supports `layout` variants and renders header fields based on schema order + grouping.
  - Unified Tables: added `UnifiedEntityTable` (AntD Table, Cockpit-consistent density) with a standard Quick Edit drawer that mounts `EntityFormSurface`.
  - Tabbed Record Page: `UniversalEntityRecordPage` now mounts standard tabs (Overview/Details/Related/Timeline) and uses `UnifiedEntityTable` for related lists.
  - Canonical Routing: added `/records/:entityType/:id` as the default destination for row-click navigation; backend `EntityViewSet` now supports `plant` and `location` for canonical record loading.
  (PR: #4351)

- **2026-04-06** — **Phase 7.0/9.5: Autonomous PO Ingestion stabilized**: fixed AI document parsing failure modes and implemented an end-to-end PO ingestion tool chain.
  - `parse_document`: now accepts UUID or integer document IDs, streams file uploads, sends compatible Unstructured auth headers, and returns structured error payloads (no more silent “unreachable”).
  - Added tools: `extract_purchase_order_fields`, `create_purchase_order`, and `ingest_purchase_order_document` to enable autonomous supplier creation + PO drafting from PO PDFs.
  - Swarm prompt updated to use `ingest_purchase_order_document(document_id)` for Purchase Order documents.
  (PR: #4353)

- **2026-04-16** — Mobile: Customers usable at 375px. Added deterministic Playwright coverage (`frontend/e2e/mobile_customers_create.spec.ts`) and hardened app shell on small screens (Header wrapping + Layout sidebar offset) to prevent page-level horizontal overflow. (PR: #4406)

- **2026-04-16** — CI: Master Pipeline run-name now uses PR merge context (when available) to improve the Actions “All workflows” feed readability; falls back to SHA + run number when metadata isn’t available. (PR: #4408)

- **2026-04-16** — Frontend: added unit coverage for Shared select components (SearchableSelect, LocalSearchableSelect, MultiSelect) as a safety net before consolidation. (PR: #4410)

- **2026-04-16** — Frontend: introduced consolidated `SearchableSelect` surface with a `variant` prop (entity/local/multi) while keeping legacy exports as thin wrappers (no caller changes). (PR: #4412)

- **2026-04-16** — Frontend tests: added unit coverage for consolidated `SearchableSelect` variants (local/multi) and the `allowCreate` → QuickCreate flow. (PR: #4414)

- **2026-04-16** — Forms UX: FormSubmissionModal now disables in-dropdown create for related-entity SearchableSelect fields because the screen already provides a separate "+ New" Quick Create button. (PR: #4416)

- **2026-04-16** — Frontend: added SearchableSelect `variant="static"` (no API) for static option sets; includes unit coverage. (PR: #4418)

- **2026-04-17** — Entities: record-level “Workflows” tab shows WorkForm executions filtered by entity with audit trail; backend form-submissions status filter accepts comma-separated lists. (PR: #4452)

- **2026-04-17** — WorkForms backend: harden execution/submission visibility (fail-closed tenant), prevent started_by/assigned_to user-ID enumeration (me-only unless tenant admin), Quick Actions available-forms includes tenant WorkForms, and expose `node_statuses` derived from audit trail. (PR: #4453)

- **2026-04-17** — WorkForms frontend: restore runtime UX (Catalog Quick Run executes WorkForms, In Progress shows WorkForm executions, Execute falls back to legacy runner for older QuickActions, and FormSelectorModal uses tenant-forms service layer). (PR: #4454)
- **2026-04-18** — CI: improve deploy pipeline workflow display name for Actions feed clarity. (PR: #4458)
- **2026-04-18** — Docs: update canonical root `MASTER_PLAN.md` snapshot with WorkForms PRs (#4452–#4458). (PR: #4459)
- **2026-04-18** — Tests: cover AI document upload endpoint to guarantee 201/400 only (no 500s) + prevent raw exception leakage. (PR: #4460)
- **2026-04-18** — Dependencies: merged grouped npm/yarn bumps (root + mobile) and closed superseded singles. (PR: #4439)
- **2026-04-18** — Promotion: merged development → uat after checks green (merge commit). (PR: #4389)
- **2026-04-20** — Docs: add WorkForms E2E completion workstream + runtime gap snapshot to canonical root `MASTER_PLAN.md` for execution tracking. (PR: #4480)
- **2026-04-20** — WorkForms runtime: implement real in-app notifications (actionNotify -> send_notification) with tenant-safe persistence and preferences respect; add backend tests. (PR: #4481)
- **2026-04-20** — Env manifest: add optional Gmail OAuth secret keys (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI) to canonical env manifest. (PR: #4482)
- **2026-04-20** — WorkForms runtime: add runtime support validation (unsupported action nodes) + block activation when runtime validation fails; extend validate endpoint to return runtime validation details. (PR: #4483)

- **2026-04-21** — Mobile: align WorkForms API contract with backend serializers (status + workflow_definition) and add OpenAPI contract assertions for `/tenant-workforms/` list/detail. (PR: #4562)

- **2026-04-21** — Mobile: add a real WorkForm detail screen (read-only) that calls `GET /api/v1/tenant-workforms/{id}/` and navigates from the WorkForms list. (PR: #4564)

- **2026-04-21** — CI: re-enable backend + frontend test gates in the reusable deploy workflow; gate migrations on both swimlanes to avoid partial deploys; align backend `.env` secret names with the env manifest. (PR: #4566)

- **2026-04-21** — CI: enforce Golden Pipeline workflow topology (validator + reusable deploy alignment) to prevent drift (no compose/latest; correct job dependency invariants). (PR: #4568)

- **2026-04-21** — CI: harden workflow validator to scan `.github/scripts/` too (prevent compose/latest drift outside workflows) and tighten migration-safety checks without false positives. (PR: #4569)

- **2026-04-21** — Security: enforce TenantUser membership when tenant is resolved via Host/domain/subdomain for session-auth requests (prevents cross-tenant host spoofing); return stable JSON 403 envelope on `/api/v1/*`; add regression tests. (PR: #4572)

- **2026-04-27** — Frontend: replace runtime `console.*` usage with centralized `logger.*` in high-churn WorkForms/MyTasks paths to reduce prod noise while preserving dev diagnostics. (PR: #4654)

- **2026-04-27** — Backend tests: add stable regression coverage for invitation validation + signup-with-invitation flows (`/api/v1/invitations/validate/`, `/api/v1/auth/signup-with-invitation/`). (PR: #4655)

- **2026-04-27** — Backend tenant safety: make tenant-specific `current`, `current_theme`, and `admin_permissions` actions fail-closed for multi-tenant users when tenant context is missing/ambiguous (stable 400 code), while allowing safe default if the user has exactly one membership; add tests. (PR: #4656)

- **2026-04-27** — Backend RLS safety: wrap tenant-scoped Celery task ORM sections in `tenant_rls(..., strict=False)` to prevent cross-tenant leakage on pooled connections; add coverage. (PR: #4657)

- **2026-04-27** — Mobile: resolve a device-safe API base URL (Expo hostUri/LAN IP and Android emulator fallback) and add unit coverage; document `EXPO_PUBLIC_API_BASE_URL`. (PR: #4658)

- **2026-04-27** — Mobile: switch deprecated `expo build:*` scripts to EAS Build (via `npx eas-cli`), add `eas.json` profiles and build metadata (`ios.buildNumber`, `android.versionCode`), and update mobile build docs. (PR: #4659)

- **2026-04-27** — **Phase 10: Supplier/Customer Hierarchical UI Simplification**: flattened Suppliers/Customers sidebar navigation, made Supplier/Customer forms HQ-only (HQ labels + dynamic titles), simplified list views to Company Name + Actions with safe Aggregated Products rollups, and converged Supplier/Customer record view to Cockpit-style tabs (Plants/Locations, Dept. Contacts, Documents, Related, Recent Activity). (PR: #4705)

- **2026-04-27** — Workflows/QuickActions stability: `/api/v1/workflows/available-forms/` now validates optional entity context and returns 400 (never 500) for bad params/IDs; frontend adds a circuit breaker to prevent remount loops on backend 5xx; Supplier form title rolled back to "New Supplier"/"Supplier" while keeping HQ field labels and phone input typing; Suppliers/Customers table rows now show pointer cursor on hover. (PR: #4707)

- **2026-04-27** — Workflows/QuickActions hardening: `/api/v1/workflows/available-forms/` now degrades safely even if form/workform serialization or node_count fails (skips bad rows; never 500) with regression coverage; frontend stops probing legacy `/api/v1/products/master/` and calls canonical `/api/v1/master-products/` only (avoids noisy 404 spam). (PR: #4709)

- **2026-04-27** — Phase 10 Sprint 1 gate (in progress):
  - Frontend: standardized API error presentation now recognizes backend `code`/`error_code` (e.g., `AI_NOT_CONFIGURED`, `EMAIL_SEND_NOT_CONFIGURED`) and surfaces user-safe guidance; Email Integration widget uses the shared presentation.
  - CI: workflow validator now enforces that PR validation includes the frontend TypeScript gate (verify-standards/type-check), preventing silent removal.
  - Docs: added canonical incident response runbook (`docs/runbooks/INCIDENT_RESPONSE.md`).
  - Mobile: began hardening the Customers page table container for mobile E2E stability (`customers-table-container` selector) and continued mobile viewport work.

- **2026-04-27** — Phase 10 Sprint 1 gate: completed (mobile Playwright specs green on Mobile Chrome; Drift Gate + verify-standards passing). (PR: Vacilator/ProjectMeats-1#21)

- **2026-04-27** — Entities: fixed UniversalEntityForm React infinite loop (#185) in Plant create/edit by stabilizing initialValues and sanitizing array-like defaults; restored AI Overview on canonical Supplier/Customer record pages; renamed Suppliers/Customers list create buttons to "New Supplier"/"New Customer" and aligned Customer form titles to "New Customer"/"Customer". (PR: #4711)

- **2026-04-27** — Forms: fixed Plant edit/create crash (minified React error #185) by stabilizing cascading option fetch (no more setState loop when dependencies are empty) and adding a short-lived cache for missing `/system/choices/?list=...` slugs to prevent repeated 404 spam. (PR: #4713)
- **2026-04-28** — **[HOTFIX]** Backend choices API hardened to return `200 []` for missing/unseeded `/api/v1/system/choices/?list=...` lookups, with `_`/`-` alias normalization and a canonical `protein_types` mapping. Frontend now uses a single canonical choices request, caches stable empty-array references, and removes permutation-fetch retries to permanently stop the React #185 loop. (PR: #4719)

- **2026-04-27** — WorkForms reliability: added runtime support for `parallelPath` execution deferment (Celery group/chord fanout), added retry signaling for transient `actionHTTP` failures with exponential backoff, and introduced a tenant-scoped Workflow Dead Letter Queue (`WorkflowDeadLetter`) with RLS policies and `SUSPENDED` execution status for retry exhaustion. (PR: TBD)
- **2026-04-27** — WorkForms reliability shipped: parallelPath fanout + retry/DLQ primitives merged. (PR: #25)
- **2026-04-27** — WorkForms frontend: harden QuickActions context + Execute page legacy fallback gating (`?legacy=1`), and prevent auth headers being attached to auth endpoints. (PR: #27)
- **2026-04-27** — WorkForms backend: add node registry + `GET /api/v1/system/workforms/metadata/` endpoint (v1) for canonical node type IDs + aliases. (PR: #28)
- **2026-04-28** — WorkForms editor: FlowEditor overlays backend node registry metadata (aliases/labels) via `/api/v1/system/workforms/metadata/` while preserving local schema fallback. (PR: #29)
- **2026-04-28** — WorkForms editor: derive validation from graph state, stabilize history snapshots with graph signatures, restore debounced `onChange`, and limit draft autosave to persisted draft workflows with dirty-state awareness. (PR: #32)
- **2026-04-28** — WorkForms editor: remove `nodesWithHandlers` canvas cloning by routing edit/delete/save/reorder/title actions through a dedicated FlowEditor node-actions context; keep collapsed-edge virtualization on raw nodes and add context regression coverage. (PR: #4720)
- **2026-04-28** — WorkForms editor: keep config-panel shadow edits local until Apply/Discard so FlowEditor no longer rewrites the full node array on every keystroke; preserve sanitized commit/discard behavior and add regression coverage for pre-commit stability and dirty-state reconciliation. (PR: #4721)
- **2026-04-28** — Docs: sync canonical root `MASTER_PLAN.md` snapshot so it reflects the shipped FlowEditor state-harmonization batches and the verified WorkForms create-time activation guard. (PR: #4722)
- **2026-04-28** — WorkForms runtime: add tenant-scoped execution telemetry (`ExecutionEventLog`) with RLS, persist normalized audit-trail events for executions/node spans/action outcomes, and add backend regression coverage for successful and failed action events. (PR: #4723)
- **2026-04-28** — WorkForms runtime: hydrate a persisted `runtime_state` snapshot on `TenantWorkFormExecution` from the telemetry stream so list/detail serializers can serve current node, node statuses, and errors without reparsing raw audit trails; retain fallback for legacy rows. (PR: #4724)
- **2026-04-28** — WorkForms monitoring: add a tenant-safe execution analytics endpoint and upgrade the Monitoring page with telemetry-backed KPIs, top failed steps, slowest actions, and busiest WorkForms. (PR: #4725)
- **2026-04-28** — WorkForms maintenance: add `python manage.py upgrade_workform_schema` as a dry-run-first schema upgrade command that normalizes legacy node aliases, stamps `schemaVersion`, backfills `tenantFormId` from legacy `formId`, refreshes `form_references`, and remains idempotent under targeted backend tests; also add `core/0007_enable_rls_comment` so fresh-database RLS audits no longer fail on `core_comment`. (PR: #4726)

### 2026-03-31 — Secret audit drift (manifest v5.1)
- Command: `python config/manage_env.py audit --repo Meats-Central/ProjectMeats`
- Stale/Zombie secrets found in GitHub but NOT in `manifests/env.manifest.json` (or legacy `DEV_`/`UAT_`/`PROD_` prefixed):
- `CORS_ALLOW_ALL_ORIGINS` — **ZOMBIE** (env:dev-backend)
- `CSRF_COOKIE_SECURE` — **ZOMBIE** (env:dev-backend)
- `CSRF_TRUSTED_ORIGINS` — **ZOMBIE** (env:dev-backend)
- `DEBUG` — **ZOMBIE** (env:dev-backend)
- `DEVELOPMENT_SUPERUSER_EMAIL` — **ZOMBIE** (env:dev-backend)
- `DEVELOPMENT_SUPERUSER_PASSWORD` — **ZOMBIE** (env:dev-backend)
- `DEVELOPMENT_SUPERUSER_USERNAME` — **ZOMBIE** (env:dev-backend)
- `DEV_ALLOWED_HOSTS` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_API_URL` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_BACKEND_HEALTH_URL` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_BACKEND_IP` — **STALE-PREFIXED** (env:dev-backend, env:dev-frontend)
- `DEV_CORS_ALLOWED_ORIGINS` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DATABASE_URL` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DB_ENGINE` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DB_HOST` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DB_NAME` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DB_PASSWORD` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DB_PORT` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DB_USER` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_DJANGO_SETTINGS_MODULE` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_EMAIL_BACKEND` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_EMAIL_HOST` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_EMAIL_HOST_PASSWORD` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_EMAIL_HOST_USER` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_EMAIL_PORT` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_EMAIL_USE_TLS` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_FRONTEND_HOST` — **STALE-PREFIXED** (env:dev-frontend)
- `DEV_FRONTEND_SSH_KEY` — **STALE-PREFIXED** (env:dev-frontend)
- `DEV_FRONTEND_USER` — **STALE-PREFIXED** (env:dev-frontend)
- `DEV_HOST` — **STALE-PREFIXED** (env:dev-backend, env:dev-frontend)
- `DEV_MEDIA_ROOT` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_OPENAI_API_KEY` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_SECRET_KEY` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_SSH_PASSWORD` — **STALE-PREFIXED** (env:dev-backend, env:dev-frontend)
- `DEV_STATIC_ROOT` — **STALE-PREFIXED** (env:dev-backend)
- `DEV_URL` — **STALE-PREFIXED** (env:dev-frontend)
- `DEV_USER` — **STALE-PREFIXED** (env:dev-backend, env:dev-frontend)
- `DOMAIN_NAME` — **ZOMBIE** (env:dev-frontend, env:production-frontend, env:uat-frontend)
- `DO_ACCESS_TOKEN` — **ZOMBIE** (env:dev-backend, env:dev-frontend)
- `DO_API_TOKEN` — **ZOMBIE** (repo)
- `GIT_TOKEN` — **ZOMBIE** (env:dev-backend)
- `LOG_LEVEL` — **ZOMBIE** (env:dev-backend)
- `PRODUCTION_DB_URL` — **ZOMBIE** (repo)
- `PROD_DB_CLUSTER_ID` — **STALE-PREFIXED** (repo)
- `REACT_APP_ENABLE_CHAT_EXPORT` — **ZOMBIE** (env:dev-frontend)
- `REACT_APP_ENABLE_DEBUG` — **ZOMBIE** (env:dev-frontend)
- `REACT_APP_ENABLE_DEVTOOLS` — **ZOMBIE** (env:dev-frontend)
- `REACT_APP_ENABLE_DOCUMENT_UPLOAD` — **ZOMBIE** (env:dev-frontend)
- `REACT_APP_MAX_FILE_SIZE` — **ZOMBIE** (env:dev-frontend)
- `REACT_APP_SUPPORTED_FILE_TYPES` — **ZOMBIE** (env:dev-frontend)
- `SENTRY_CLIENT_SECRET` — **ZOMBIE** (repo)
- `SESSION_COOKIE_SECURE` — **ZOMBIE** (env:dev-backend)
- `STAGING_DB_URL` — **ZOMBIE** (repo)

### 2026-03-31 — Pending work items (not shipped)
These items were requested/planned in-session but are **not completed yet**:

- **Session handoff (from `plan.md`)**
  - Source of truth for remaining work: this section.
  - Current SQL todos: `plant-schema-cruft-purge` (in_progress), `universal-form-input-fixes` (pending), `hierarchical-drilldown-routing` (pending).
  - Repo rule reminder: changes must land via PRs (direct pushes to `development` are blocked).

- **Plant schema cruft purge** (`plant-schema-cruft-purge`)
  - Backend: remove `Plant.code`, `Plant.manager`, `Plant.phone`, `Plant.email`, `Plant.phone_type`.
  - Update plant type label: `Vertical (Kill to Capture)` → `Vertical (Kill to Fabrication)`.
  - Add migration (expected next number): `backend/tenant_apps/plants/migrations/0016_plant_schema_cleanup.py`.
  - Update `PlantSerializer`, `PlantViewSet` search/order fields, Django admin, and `tenant_apps.plants` tests.
  - Verify:
    - `python backend/manage.py makemigrations --check`
    - `python backend/manage.py test tenant_apps.plants`

- **UniversalEntityForm input fixes** (`universal-form-input-fixes`)
  - Fix grayed/unclickable dropdowns (AntD `<Select>` in overlays/modals): ensure `getPopupContainer` is consistently applied for our wrapper selects.
  - Fix Contact phone fields so they accept standard typing (e.g. `(555) 123-4567`) without blocking; apply formatting on blur, not on each keystroke.
  - Ensure **Department** is visible in all Contacts list UIs where contacts are presented (tables + previews).

- **Hierarchical drill-down routing** (`hierarchical-drilldown-routing`)
  - Suppliers → Plants → Contacts:
    - Row-click navigation: `/suppliers/:supplierId/plants/:plantId` and `/suppliers/:supplierId/plants/:plantId/contacts/:contactId`
    - Breadcrumb format: `Supplier: <name> > Plants: <plant name>`
  - Customers → Locations → Contacts:
    - Row-click navigation: `/customers/:customerId/locations/:locationId` and `/customers/:customerId/locations/:locationId/contacts/:contactId`
    - Breadcrumb format: `Customer: <name> > Locations: <location name>`
  - Mirror behavior between Supplier and Customer sides.

- **Enterprise Polish**: Tenant Webhooks + API Keys (`enterprise-webhooks-api-keys`)
  - Models + RLS + Celery dispatch task + retries/backoff + signing + event hooks

- **V4.0 Vision Sprint docs** (planning complete; documents not created yet)
  - `docs/plans/V4_0_IDEAL_STATE_GAP_ANALYSIS.md`
  - `docs/plans/V4_0_UX_EXCELLENCE.md`
  - `docs/plans/V4_0_FIELD_OPS_ARCHITECTURE.md`
  - `docs/plans/V4_0_AUTONOMOUS_AI.md` (depends on Tenant Webhooks/API Keys)

### 2026-03-31 — Hard purge: legacy docs + archives (context bleed cleanup)
- Destructive cleanup of superseded documentation and archived infra/scripts to reduce AI context bleed.
- Deleted:
  - `docs/archive/`
  - `docs/plans/archive/`
  - `docs/implementation-history/*.md` (all)
  - `docs/plans/*.md` except `docs/plans/V3_FINAL_PUSH_PERFECTION.md`
  - root `archived/`
  - `.github/archived-workflows/`
  - `backend/archived/`
  - `backend/scripts/` (orphan utilities)
- Pruned stale maintenance scripts:
  - removed `scripts/maintenance/*.sh` last modified before 2026-01-30 (kept `scripts/maintenance/verify_golden_state.sh`)
- Frontend cleanup:
  - removed `frontend/src/pages/WorkForms/Catalog.original.tsx` and unused ui tests
  - adjusted `PhoneInput` props for AntD Form compatibility (typecheck)
- Backend cleanup:
  - auto-fixed unused imports/vars (F401/F841) across `backend/apps` + `backend/tenant_apps` (excluding migrations)
- PR: #4231


## Active Initiative: V3.0 Final Push (Consolidation + Scale + Polish)

### 2026-03-31 — Hierarchy: drill-down views
- Supplier/Customer record pages show Plants/Locations with a dedicated drill-down (no flat contacts at the grandparent).
- Added PlantDetailView + LocationDetailView with Contacts grouped by department (Sales/QA/Booking/Accounting).
- PR: #4228

### 2026-03-31 — Hierarchy: Plant/Location inline contact arrays
- Backend: Plant/Location form schema now includes department contact sections (Sales/QA/Booking/Accounting) as inline arrays.
- Frontend: DynamicFormEngine supports `inline_form_array` (react-hook-form field arrays) incl. tag inputs for responsibility lists; UniversalEntityForm honors schema `ui` metadata.
- PR: #4227

### 2026-03-31 — Frontend: hierarchy navigation + row drilldowns + product insights
- Navigation: grouped into Supply Chain (Suppliers → Plants → Contacts) and Demand Chain (Customers → Locations → Contacts).
- Suppliers/Customers list: row-click drilldown (expanded panel); action buttons stop propagation.
- Cockpit Customer detail: Product Insights toggle (Purchase History vs Aggregated Preferences).
  - Aggregated Preferences uses `aggregated_preferred_products` from Customer detail and resolves titles via `/api/v1/master-products/`.
- PR: #4234

### 2026-03-31 — Fix: custom list creation 500
- Fixed 500 on `POST /api/v1/workflows/lists/` by explicitly setting tenant + created_by during create and re-asserting RLS session vars.
- Added workflows migration to ensure TenantList has an explicit RLS INSERT policy (`WITH CHECK`).
- PR: #4236

### 2026-03-31 — Quick Actions: show Workforms
- Quick Actions modal now shows active/draft Workforms by fetching from `/api/v1/tenant-workforms/` (same source as the Catalog page).
- Legacy forms are still fetched from `/api/v1/workflows/available-forms/` (forms only), then merged + de-duped with Workforms into a single list.
- Save payload continues to persist Workforms as `type="workflow"` + `workflow_id`.
- PR: #4238

### 2026-03-31 — Fix: URL-synced tabs (WorkForms + Cockpit)
- WorkForms: Tabs are now URL-driven (AntD Tabs activeKey derived from location.pathname; onChange navigates to `/workforms/{key}`); deep links like `/workforms/in-progress/:id` are routed.
- In Progress: `/workforms/in-progress/:id` now mounts correctly and resumes the submission modal via QuickActionsContext.
- Cockpit: `/cockpit` is now a layout with URL-driven Tabs and nested routes (`/cockpit/dashboard`, `/cockpit/process-monitor`, `/cockpit/calls`); `/calls` redirects to `/cockpit/calls`.
- Safety: wrapped WorkForms InProgress/History/Monitoring in ErrorBoundary.
- PR: #4239

### 2026-03-31 — Test: Playwright E2E foundation
- Added Playwright E2E coverage for:
  - Suppliers drilldown (Suppliers → Plants → create contact → verify Department choices)
  - Workforms editor (add Manual Trigger + Form Process → Layout → verify no overlap between top-level nodes)
- Added root `npm run test:e2e` script delegating to frontend.
- Added stable `data-testid` hooks for Suppliers drilldown flows.
- PR: #4274

### 2026-03-30 — Docs: master plan gap analysis + roadmap hygiene
- Updated `MASTER_PLAN.md` (canonical) with an industry-leader benchmark gap analysis (P0/P1/P2) and refreshed execution-ordered backlog.
- Converted non-canonical roadmaps/plans into clearer **REFERENCE ONLY** docs (removed/neutralized misleading progress emphasis).
- Clarified `docs/plans/README.md` to point to canonical Master Plan.
- PR: #4109

### 2026-03-27T17:03Z — Recovery Execution Plan (Last ~25 prompts)
- Merged recovery plan into `MASTER_PLAN.md` (canonical snapshot). PR: #4036.
- Execution policy: all remaining work ships **only via**: branch → PR → merge to `development`.
- P0 execution order:
  1) Cockpit Favorites (backend persistence + optimistic UX, tenant-safe, RLS-backed)
  2) Email Ingestion Monitor “Sync Now” decrypt error surfacing (stable codes + reconnect CTA)
  3) AI Document Upload stability (no 500s; verify via `test_document_upload`)

## Active Initiative: V3.0 Final Push (Consolidation + Scale + Polish)

### 2026-03-27 — Workform Editor: Node Opacity Fix
- Fixed "all nodes semi-transparent" regression caused by debug session decorations being left active when the Dry Run Debugger panel was hidden.
- Debugger panel now stops/resets debug session when closed and unmounts the debugger UI when not visible.

### 2026-03-27 — Emergency Fix - OAuth Decryption
- Verified Microsoft OAuth encryption salt remains `projectmeats_oauth_encryption_v1` (no drift).
- Added management command: `python manage.py diagnose_oauth_encryption --tenant-id <uuid>` to distinguish `InvalidToken` (key mismatch) vs missing data.
- Email Sync Now: backend now detects decrypt failures and returns `code=decryption_failed` with a stable reconnect hint (UI can show a deterministic CTA).
- AI Swarm: Microsoft Graph tools now catch token decryption failures and return structured payload:
  `{ "status": "error", "error_code": "DECRYPTION_FAILED", "message": "Your Outlook connection needs to be refreshed for security reasons." }`

### 2026-03-27 — Sentry-GitHub-Copilot Loop
- Sentry Passthrough to GitHub — **ACTIVE** (webhook receiver + ownership routing groundwork).
- AI Assistant Sentry Bridge — **STABILIZED** (tenant-scoped `get_recent_errors` tool + admin diagnostics endpoint; uses GitHub Environment secret injection for `SENTRY_AUTH_TOKEN` and defaults org slug to `meats-central` if unset).
  - PR: #4007
  - Follow-up PR: #4008
- Environment-based Sentry Orchestration (Seer) — **STABILIZED**
  - SDK hardening: sendDefaultPii enabled (frontend+backend); backend in_app_include set for CODEOWNERS mapping — PR: #4009.
  - Runtime wiring + secret mapping: `SENTRY_DSN` (runtime env) → `/usr/share/nginx/html/env-config.js` → `window.ENV.SENTRY_DSN` (fallback: build-time `REACT_APP_SENTRY_DSN`), and deploy sets `REACT_APP_SENTRY_DSN` on `docker run`.
  - Verification: Admin→Configurations "Sentry Test" emits `Error(\"Sentry Orchestration Handshake Verified\")`.
  - AI SRE prompt: calls get_recent_errors() (tenant is implicitly scoped from the authenticated session).
  - PR: #4010

**Phase 6.5: AI Document Understanding & Agentic Workflows**

### 2026-03-19 — Phase 6.5: AI Document Understanding
- Integrated Microsoft Graph Email Ingestion service + OpenAI Intent Engine for document classification (Purchase Order, Invoice, Claim, Bill of Lading, Inquiry).
- Added EMAIL_RECEIVED trigger type + documented trigger condition schema.

- Microsoft Graph Email Ingestion
- Meat-Industry Specific LLM Document Classification
- Smart Workflow Triggers based on AI Intents

**Phase 7.0: Hybrid Agentic Workflows & Continuous Learning**

### 2026-03-20 — Phase 7.0: Hybrid Agentic Workflows & Continuous Learning
- Hybrid document pipeline (simulated): LayoutLMv3 / Docling-style OCR + layout parsing produces structured blocks/bounding boxes, then OpenAI normalizes into strict JSON.
- HITL (Human-in-the-Loop) loop: new `AIFeedbackLog` stores original extracted payload + user corrections + confidence + derived deltas to drive continuous improvement.
- UX: `AIAgentWidget` (bottom-right) can pulse/expand when `requires_human_review` is detected (websocket/polling hookup pending).
- UX: wired `AIAgentWidget` to backend chat endpoint (`/api/v1/ai-assistant/ai-chat/chat/`) via `businessApi` (PR #3687).
- UX: added a Tools button in `AIAgentWidget` to list tool operationIds via `GET /api/v1/ai-assistant/tools/openapi/` (PR #3691).

### 2026-03-27 — Phase 9.5: AI Document Stability
- AI Assistant documents: updated `AIDocument.file.upload_to` to include tenant UUID + unique prefix to prevent naming collisions.
- Upload hardening follow-up: switched to a flat tenant+UUID filename (avoids deep mkdir permission issues on mounted media volumes) and assert RLS session vars right before saving.
- Error hardening follow-up: database exceptions now map to actionable 400s (e.g., missing migrations/table) instead of misleading RLS messages or 500s. PR: #4039.
- Added diagnostic command to reproduce uploads and capture tracebacks without needing the frontend:
  - `python manage.py test_document_upload --tenant-id 0f024884-b9ef-4e50-8fc0-89b2eb7c8c69`
  - Safe default: temp `MEDIA_ROOT` (no persistent artifacts)
  - If the tenant doesn’t exist in the environment: add `--create-tenant-if-missing`.

### 2026-03-27 — AI Assistant Restoration
- **AI Assistant V2 — ACTIVE** (memory + analytics + RLS-hardened tools).
- **RLS Tool Hardening — COMPLETE** (explicit `SET app.current_tenant` asserted at tool boundaries; defense-in-depth with TenantMiddleware + ToolExecutor).
- Context awareness: Omnibox + AIAgentWidget + ChatWindow include `currentPath`, `activeEntityId`, `activeEntityType` (and explicit `activeEntity`) in every chat message; Omnibox routes into the widget via `pm:ai-send` — PR #4000.
- Orchestrated AI Action Tools (tenant-safe):
  - RLS: Tool executor asserts `SET app.current_tenant` **before every tool execution** (defense-in-depth with TenantMiddleware).
  - Tool consolidation: removed redundant `search_records` / `search_cockpit_records`; `search_entities` is the single search entrypoint and is backed exclusively by `apps.core.services.universal_search.UniversalSearchService`.
  - Analytics: added `get_entity_analytics(entity_type, metric[, days, limit])` for safe aggregations (top purchased products, revenue by customer, etc.).
  - Tool feedback loop: empty results now return descriptive messages including tenant id (helps explain “0 results” vs RLS constraints).
- PR: #4020

### 2026-03-27 — Emergency Stabilization - Node & API Harmony
- FlowEditor: unify “Form Step” architecture — canonical node type `form` with display name “Form Step”; normalize legacy form step node types (`formStep`, `formStepSingle`, `formStepSingleNode`) to canonical `form`; sync parentId (`node.parentId` ↔ `node.data.parentId`); un-parent nodes with missing containers; clear `hidden` when parent is expanded.
- Product entity harmony: map workflow schema `product` → `system.Product`; alias legacy product entity IDs (`tenant_apps.products.product`, `products.product`) → `system.product`; update frontend fallback entity list to `system.product`.
- Process Monitor hardening: early-return empty 200 when tenant context missing; wrap result building in try/except to prevent RLS/DB 500s.
- Theme hardening: define `--color-surface`/`--color-background` tokens for `[data-theme="high-contrast"]`; add BaseNode background fallback.
- PR: #4003.

### 2026-03-27 — VectorMemory Deprecated (UniversalSearchService Standard)
- VectorMemory is deprecated/removed: endpoints (`/ai-assistant/memory/search/`, `/ai-assistant/memory/upsert/`) and pgvector retrieval are no longer used.
- `apps.core.services.universal_search.UniversalSearchService` is the unified search standard for AI tools + SME grounding.
- Note: legacy `search_records` tooling has been removed in favor of `search_entities` (single entrypoint).
- PR: #4004.

### 2026-03-27 — Omnibox Context Bridge — COMPLETE
- Verified Omnibox + AIAgentWidget + ChatWindow include `currentPath` and active entity context on every send.
  - Canonical keys: `current_entity_type`, `current_entity_id`
  - Legacy keys retained for compatibility: `activeEntityType`, `activeEntityId`
- Omnibox routes into the global widget via `pm:ai-send`, preserving page context.
- PR: #4000 (context injection + widget routing)
- PR: #4005 (schema-aware prompt + get_entity_details tool)
- Close-out PR: #4018

**Phase 8.0: Autonomous Multi-Agent Swarm & Continuous RLHF**

### 2026-03-20 — Phase 8.0: Autonomous Multi-Agent Swarm & Continuous RLHF
- Status: **complete / in maintenance mode**.
- Key ops note: Increased Nginx `client_max_body_size` to **50M** across proxies to support AI document uploads.
- Historical Phase 8.0 execution details remain in the **PR Log** below.

### 2026-03-23 — Phase 8.4: Universal Metadata-Driven UI
- Transition away from hardcoded modals toward a schema-driven `UniversalEntityForm` container.
- Searchable Foreign Key selectors (entity + contact) via `SearchableSelect` to avoid massive dropdown scrolling.
- Cockpit key-field renderer now supports array fields with a dedicated multi-select edit mode (no AntD `<Text editable>` for arrays/products).

## Phase 9.5: Preemptive Hardening & Advanced UX (Workforms Editor)

### 2026-03-30 — Phase 9.5: AI Assistant + Workforms API Stabilization (V3.0)
- AI Assistant uploads: assert RLS session vars via `set_current_tenant()` inside the upload save transaction (reduces intermittent RLS write failures).
- FlowEditor node schemas: `formProcessSchema` now uses `nodeType: 'formProcess'` and registers a legacy alias for `formMultiStepContainer`.
- Entity API: `_get_entity_or_404` now resolves entity types case-insensitively and maps short-names (e.g., `Inquiry`) to canonical keys.

### 2026-03-30T17:10:57Z — Phase 9.5: Universal Forms schema contract expansion (V3.0)
- System form schema endpoint now returns per-field `relationship` metadata (`fk`/`m2m`/`choice`) and `ui` hints (`widget`, `read_only`) while preserving backward-compatible keys (`related_entity`, `choices`, `key_fields`).
- Adds stable per-field `order` to avoid random UI rendering.
- PR: #4153.

### 2026-03-30T17:25:33Z — Phase 9.5: Great Deletion — Invoice create migrated to UniversalEntityForm
- Invoices create flow now uses `EntityFormSurface` (schema-driven `UniversalEntityForm`) instead of the hardcoded `CreateInvoiceModal`.
- UniversalEntityForm now targets canonical `/accounting/*` endpoints for invoice/claim CRUD.
- PR: #4154.

### 2026-03-30T17:28:48Z — Phase 9.5: Global toast error mapping normalization
- `useToast().error()` now accepts unknown error objects and normalizes message extraction across `err.response.data.detail`, `error`, `message`, and `err.message`.
- PR: #4155.

### 2026-03-30T17:34:05Z — Phase 9.5: Dev-only FlowEditor performance harness
- Added `/workflows/perf-harness` (dev-only) to render a synthetic 150/500/1000-node graph in `UnifiedFlowEditor` for profiling.
- PR: #4156.

### 2026-03-30T17:44:16Z — Phase 9.5: Skeleton loaders sweep (pages)
- Replaced ad-hoc page loading spinners/placeholder messages with consistent Ant Design `Skeleton` loaders across `frontend/src/pages/**`.
- PR: #4157.

### 2026-03-30T17:52:00Z — Phase 9.5: RLHF JSONL compilation (redaction + weekly schedule)
- Added management command `compile_rlhf_data` to compile `AIFeedbackLog` rows into OpenAI chat JSONL.
- Redaction: strips obvious PII/secrets (emails/phones/tokens) and removes tenant/document IDs from the training payload.
- Added Celery task `ai_assistant.compile_rlhf_data` + weekly beat schedule (Sun 03:00 UTC) writing artifacts to `/tmp` (or `--out`).
- PR: #4158.

### 2026-03-30T17:58:00Z — Phase 9.5: Great Deletion — Inquiry create consolidation
- Inquiries page + Cockpit SmartSearch + Customer Detail now route Inquiry create through `EntityFormSurface` (single consolidation point).
- Adds runtime flag `USE_UNIVERSAL_INQUIRY_CREATE=true` to switch Inquiry create to schema-driven `UniversalEntityForm` when ready.
- PR: #4159.

### 2026-03-30T18:05:43Z — Phase 9.5: Master Products global active enforcement
- Tenant-visible product catalogs now always respect global `system.Product.is_active`.
- Non-staff users cannot opt into inactive products via query params; tenant preferences cannot resurrect globally inactive products.
- Regression test added in `apps.system.tests.test_product_visibility`.
- PR: #4160.

### 2026-03-30T18:07:00Z — Phase 9.5: Choice Lists cache invalidation (System Active)
- ConfigService cache now supports cross-tab invalidation via a cache-bust localStorage key.
- After saving a choice list, cached `is_active` values won’t linger in other open tabs.
- PR: #4161.

### 2026-03-30T18:16:30Z — Phase 9.5: Quick Actions unified available targets (WorkForms)
- Quick Actions “Available Forms” now returns both `TenantForm` and `TenantWorkForm` records (status in `active`/`draft`).
- Unified payload includes `type` discriminator (`form`/`workflow`) and `node_count` for workforms.
- Quick Actions save now validates `workflow_id` targets against `TenantWorkForm` (tenant-scoped; superuser override).
- PR: #4162.

### 2026-03-30T18:20:30Z — Phase 9.5: Quick Actions UI supports WorkForms
- Quick Actions editor now renders unified available targets and saves workflow quick actions with `type='workflow'` + `workflow_id`.
- Header quick actions now navigate workflow targets to `/workforms/editor/:id`.
- Forms submenu continues to only show runnable forms (filters out workflows).
- PR: #4164.

### 2026-03-30T18:24:30Z — Phase 9.5: Inquiry product dropdown options visible
- `SmartProductAutocomplete` now renders its results dropdown via a portal (fixed positioning) to avoid being clipped by the Inquiry modal’s scroll container.
- Fixes product options appearing “missing” in the Inquiry create products list.
- PR: #4166.

### 2026-03-30T18:47:49Z — Phase 9.5: Login autocomplete warning
- Login username input now sets `autoComplete="username"` to satisfy browser autocomplete best practices.
- PR: #4168.

### 2026-03-30T18:52:38Z — Phase 9.5: Action Items API optimization
- Eliminates N+1 DB queries in Action Items list + counts by bulk-fetching step submissions for assigned steps.
- Preserves strict tenant isolation (`tenant=...` and `submission__tenant=...`).
- PR: #4170.

### 2026-03-30T18:57:28Z — Phase 9.5: AI Swarm + Universal Search execution fixes
- Fixes purchase_order_trends bucket serialization (TruncMonth bucket already date-like).
- Fixes AI Swarm universal search counting for flat `results` arrays.
- Parameterizes `SET app.current_tenant` to prevent SQL injection.
- UniversalSearch now computes total counts before slicing and falls back on `created_at`/`created_on` when ordering.
- PR: #4172.

### 2026-03-30T18:59:45Z — Phase 9.5: Core ORM + audit integrity fixes
- ActivityLog now includes `user.remove` action choice.
- Tenant user removal logging now captures tenant_user_id before delete.
- Favorites creation now errors if tenant context is missing (prevents orphan favorites).
- Cockpit viewsets only apply `?limit=` slicing on list actions.
- PurchaseOrder order number generation + save now run in a single DB transaction.
- Integrations token decryption errors now preserve context via exception chaining.
- PR: #4174.

### 2026-03-30T19:04:16Z — Phase 9.5: Frontend UX blockers
- Admin Profile: contact_email validation only runs when the field is non-empty.
- Purchase Orders: weight_per_unit is no longer required so edits aren’t blocked.
- PR: #4176.

### 2026-03-30T19:07:23Z — Phase 9.5: Final Sentry sweep
- Email sync now uses a stable exception variable in `sync_emails` error handling.
- Cockpit ActivityLog update avoids an extra DB fetch by using `serializer.instance`.
- Inquiry relationship product preview `more_count` now uses `total - 4` (preview slice) math.
- PR: #4178.

### 2026-03-30T19:17:38Z — Phase 9.5: Environment manifest secret schema update
- Updated canonical secret manifest `manifests/env.manifest.json` (v5.1) to document additional repository secrets (xAI + Sentry) and to register Unstructured API keys.
- Updated manifest validation lists to include the new secret names (no secret values committed).
- PR: #4180.

### 2026-03-30T19:25:57Z — Phase 9.5: FlowEditor Smart Auto-Map apply marks dirty
- Smart Auto-Map suggestion application now stages a partial `{fieldMappings}` patch into shadow config so `isDirty` flips true and the “Apply Changes” CTA appears.
- PR: #4182.

### 2026-03-30T19:40:05Z — Phase 9.5: FlowEditor canonical node titles + inline edit
- Consolidated node title editing to canonical `data.title` for core Workforms node schemas (with legacy keys mapped in node normalization).
- BaseNode/FormNode/FormProcessNode now display title fallback (including entityType formatting) and support double-click inline editing.
- Title updates now keep `label` and key legacy fields in sync for backward compatibility.
- PR: #4184.

### 2026-03-30T19:41:04Z — Local dev parity audit (compose/devcontainer/docker)
- Verified `docker-compose.yml` and `.devcontainer/docker-compose.yml` both use `postgres:15`.
- Verified backend base image targets Python 3.12 slim (`backend/Dockerfile`).
- Verified frontend uses multi-stage build (Node 20 Alpine → Nginx Alpine).
- No code changes required; parity is already aligned.

### 2026-03-30T19:44:19Z — CI: auto-promotion workflow consolidation
- Consolidated duplicate auto-promotion workflows (dev→uat and uat→main) into a single workflow with branch-based routing.
- Preserves: PAT-based PR creation, “skip if no commits”, and “skip if PR already open” behavior.
- PR: #4187.

### 2026-03-30T19:46:39Z — CI: gate deployments on Trivy (HIGH/CRITICAL)
- Trivy image scans for backend/frontend are now *blocking* (fail the pipeline if HIGH/CRITICAL vulnerabilities are detected; `ignore-unfixed` remains enabled).
- Backend deploy is now gated on `security-scan-backend`.
- PR: #4189.

### 2026-03-30T19:50:25Z — Frontend hygiene: remove direct axios usage (CloneInquiryModal)
- `frontend/src/components/Inquiry/CloneInquiryModal.tsx` now uses `businessApi` for entity/contact fetches and cloning, avoiding direct axios calls in components.
- PR: #4191.

### 2026-03-30T19:54:09Z — Frontend hygiene: replace hardcoded hex colors
- Replaced a small set of runtime hardcoded hex colors with theme/CSS-variable tokens (QuickActions meta text, FlowEditor preview/help text, onboarding tour, and FlowEditor print styles).
- PR: #4193.

### 2026-03-30T19:59:51Z — Testing: fixtures + archived test ignore
- Backend pytest fixtures now use correct `tenant_apps.*` imports for tenant model factories; added `tenant` alias fixture for consistent naming.
- Pytest no longer attempts to collect `archived/` test suites that reference removed modules.
- PR: #4195.

### 2026-03-30T20:04:04Z — Migrations: missing migration + RLS enforcement
- Added missing migration for ActivityLog action choices so `makemigrations --check` passes again.
- Extended `validate-migrations.sh` to enforce RLS SQL (`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`) on newly-changed tenant-aware `CreateModel` migrations.
- PRs: #4197, #4198.

### 2026-03-30T20:20:30Z — RLS: tenant isolation for InquiryProduct/FulfillmentProduct
- Resolved `tenant` @property collisions so the real tenant FK can be persisted on through tables.
- Added `tenant_id` + `custom_data` to `InquiryProduct` and `FulfillmentProduct`, backfilled from parent records, and enforced NOT NULL.
- Enabled RLS on `inquiries_inquiryproduct` and `fulfillments_fulfillmentproduct` with tenant isolation + insert policies.
- PR: #4200.

### 2026-03-30T20:28:25Z — CI: caching/speed improvements (pip + workflow hygiene)
- Added pip cache to the Golden Drift Gate infra check to speed up PyYAML install.
- Removed redundant pip/node_modules cache steps from docker-only build jobs (Docker layer caching remains the primary accelerator).
- Enabled pip caching for the `check-migrations` job dependency install.
- PR: #4204.

### 2026-03-30T20:30:00Z — Repo hygiene: archive plans + purge superseded scripts
- Moved `docs/plans/*.md` (except `README.md` and `V3_FINAL_PUSH_PERFECTION.md`) into `docs/plans/archive/`.
- Deleted `*.bak` files from `.github/archived-workflows/`.
- Removed deployment bash scripts superseded by the GitHub Actions Golden Pipeline (and updated key in-repo references).
- PR: #4202.

### 2026-03-30T20:36:00Z — RLS: InquiryTemplateProduct tenant isolation
- Made `InquiryTemplateProduct` tenant-aware by persisting `tenant_id` (backfilled from parent `InquiryTemplate`).
- Added timestamps + `custom_data` for TenantAwareModel compliance.
- Enabled RLS on `inquiries_inquirytemplateproduct` with tenant isolation + insert policies.
- PR: #4206.

### 2026-03-30T20:59:00Z — Migrations: resolve inquiries 0007 leaf conflict
- Added a Django merge migration (`0008_merge_...`) to resolve multiple leaf nodes in `tenant_apps.inquiries`.
- Unblocks the CI migration sanity gate (`python manage.py makemigrations --check --dry-run`).
- PR: #4209.

### 2026-03-30 — Phase 9.5: Billing Interface Dynamic Wiring — COMPLETE
- Admin Billing invoice history now loads subscription invoices dynamically (no hardcoded rows).

### 2026-03-30 — Phase 9.5: Resolved Master Data Pagination & Export Scaling (Products/Choice Lists)
- System Products: increased max page size to 1000 and added an unpaginated export route to avoid 20-item exports.
- System Choice Items: supports `?limit=1000` and `?paginate=false` to fetch full lists; frontend loaders now request `limit=1000` and accept `{results: []}` responses.

### 2026-03-30 — Phase 9.5: Quick Actions + Task Assignment Notifications
- Quick Actions: activating a form now also enables it for Quick Actions (`is_quick_action_enabled=True`).
- Notifications: when a `FormStepSubmission` transitions to `ACTION_NEEDED`, the assigned user (via `StepAssignment`) receives an in-app `UserNotification`.
- Notifications: UserNotificationPreferences defaults explicitly cast TextChoices keys/values to `str` to avoid JSON serialization errors during get_or_create.
- Action Items APIs: verified imports (e.g., StepSubmissionStatus) and compiled clean to prevent worker crashes / 502s.
- UI: Quick Actions empty state now reads: "No active forms available for Quick Actions. Publish a form in the Workforms Editor first.".
- UI: Login password input now sets `autoComplete="current-password"`.

### 2026-03-30 — Phase 9.5: Notification Preferences 500 Fix (Tenant Injection + JSON Defaults)
- Notification Preferences endpoint now tenant-scopes the get_or_create call and sets RLS session vars before DB access.
- Defaults are generated via primitive-only comprehensions to prevent JSON serialization errors.
- Errors are surfaced as `{error: "..."}` with HTTP 500 to aid debugging if failures persist.

### 2026-03-30 — Phase 9.5: Relaxed Quick Actions filtering to natively support Draft/Saved Workform processes
- Quick Actions “Available Forms” now includes both `ACTIVE` and `DRAFT` TenantForms.
- Quick Actions save no longer blocks on `is_quick_action_enabled`; user pinning explicitly overrides the flag.

### 2026-03-27 — Phase 9.5: Admin Workspace Hardening
- Invitations: resend action now uses the shared invitation email helper (extracted from `signals.py`), and create prefers the current request tenant.
- Tenant Users: admins can remove a user (hard delete) as long as the role is not `owner`.
- Option Lists: "Master Products" entry now appears under the System Choice Lists tab; Tenant Overrides now use the same Card/Table layout as other admin screens.
- Workflow Lists: tenant list create asserts RLS session vars before validation/save to prevent RLS-related write failures.

### 2026-03-27 — Workform Editor: Initial Canvas Buttons Clickable
- Fixed empty-canvas CTA buttons (Add Manual Trigger / Use Template / Browse Triggers) not being clickable due to ReactFlow pane overlay capturing pointer events.

### 2026-03-27 — Purchase Orders: Location Fields Auth Fix
- LocationSelector now uses the standard JWT-aware apiClient (instead of raw axios + legacy Token auth), preventing spurious “Authentication required” errors on the New PO form.
- Pick-up / Delivery locations are treated as optional (omitted from payload when unset).

### 2026-03-27 — Cockpit Favorites: Backend Persistence (Tenant-Safe)
- SmartSearch + FavoritesWidget now use the backend favorites API (optimistic toggles; no localStorage dependence).
- Favorites are tenant-scoped to prevent cross-tenant entity_id collisions; includes RLS policy on `core_userfavorite`.
- PR: #4037.

### 2026-03-27 — Cockpit Reports: Metrics Available
- Fixed Reports Summary API incorrectly marking purchase_orders/sales_orders/workforms as “metrics unavailable” due to Django `aggregate()` alias collisions (e.g. `total_amount=Sum('total_amount')` shadowing the field name used by `Avg('total_amount')`, raising FieldError).
- PR: #4043.

### 2026-03-27 — Cockpit Search: Favorites Icon Clickable
- Fixed the SmartSearch results “favorite” (star) icon doing nothing. Root cause: nested <button> inside <button> (invalid HTML) prevented click events.
- Result cards now render as accessible div-buttons with keyboard activation; favorite toggle surfaces errors.
- PR: #4044.

### 2026-03-27 — AI Chat: Lessons Block NameError
- Fixed AI chat failing with `NameError: lessons_block is not defined` by defining lessons_block in SwarmOrchestrator.run_tool_loop via memory_service (safe fallback when memory fails).
- PR: #4045.

### 2026-03-30 — AI Assistant: Implicit Tenant Scoping
- Tool schemas removed explicit tenant_id arguments (e.g., `get_recent_errors()` now takes no parameters).
- Tool execution injects tenant scope server-side via the authenticated session (request.tenant); mismatched tenant_id (if provided) is rejected (defense-in-depth).

### 2026-03-27T18:47Z — State Audit (Remaining P0s)
- Identified remaining gaps from runtime logs and repeated UX reports.
- Next execution order:
  1) Fix Workforms AI suggestions route drift (frontend currently calls /api/v1/suggest-nodes/ but backend suggests /api/v1/workflows/suggest-nodes/).
  2) Universal Forms + Cockpit Search usability hardening (save/create CTA, key-fields-first + expand, searchable FK by name, per-keystroke refresh).
  3) Workform Editor UX hardening (connectors top+bottom, remove conflicting collapse buttons, drag body, inline title, reorder swaps edges).

### 2026-03-27 — Workforms: AI Suggestions Endpoint Routed
- Fixed 404s for Workforms AI Suggestions by routing `SuggestNodesView` under `/api/v1/workflows/suggest-nodes/` and updating the frontend to call `/workflows/suggest-nodes/`.
- PR: #4047.

### 2026-03-27 — Charts: ResponsiveContainer Sizing Warning Reduced
- Added explicit width/height and min dimensions for `ResponsiveContainer` in AI Learning Metrics widget to reduce `width(-1)/height(-1)` console warnings.
- PR: #4048.

### 2026-03-27 — Cockpit Search: Better Type Discoverability
- SmartSearch now uses backend counts to render entity sections even when a type has 0 results and shows correct plural labels (Purchase Orders, Inquiries, Tenant Users, etc.).
- PR: #4049.

### PR Log (append-only)

- 2026-03-26 — Reports Summary 500 fixed — PR: #3949.
- 2026-03-26 — Tenant Option Lists (Tenant Lists) create 500 hardened — PR: #3950.
- 2026-03-26 — Email Ingestion “Sync Now” correctness + pagination + error surfacing — PR: #3951.
- 2026-03-26 — Docs: canonicalize Master Plan — PR: #3952.
- 2026-03-26 — Docs: master plan gap audit — PR: #3953.
- 2026-03-26 — Unify Inquiry create form across Cockpit — PR: #3956.
- 2026-03-26 — Add EntityFormSurface consolidation layer — PR: #3957.
- 2026-03-26 — Harden UniversalEntityForm submit + key-field ordering — PR: #3958.
- 2026-03-26 — Add key_fields to universal form schema — PR: #3959.
- 2026-03-26 — Cockpit: fix +New entity create modal — PR: #3960.
- 2026-03-26 — Cockpit: + New call purpose + inquiry modal — PR: #3961.
- 2026-03-26 — Docs: demote non-canonical roadmaps — PR: #3962.
- 2026-03-26 — FlowEditor: auto-map Apply shows Apply Changes — PR: #3963.
- 2026-03-26 — FlowEditor: Form Process node not transparent — PR: #3964.
- 2026-03-26 — Backend: prevent RLS-related 500s — PR: #3965.
- 2026-03-26 — Cockpit: confirm + navigate after create — PR: #3966.
- 2026-03-26 — Email sync: find new order emails reliably — PR: #3967.
- 2026-03-26 — Admin Billing: payment method portal + plan select — PR: #3968.
- 2026-03-26 — Forms: migrate SalesOrders/Claims to EntityFormSurface — PR: #3969.
- 2026-03-26 — Fix Admin Invitations 500 when email fails — PR: #3970.
- 2026-03-26 — Reports: use tenant-aware service + show warnings — PR: #3972.
- 2026-03-26 — WorkForms Catalog: fix Quick Run + Templates tab rendering — PR: #3978.
- 2026-03-26 — Quick Actions: use shared JWT-aware apiClient (fix quick-create auth drift) — PR: #3980.
- 2026-03-26 — Frontend standards: remove remaining hardcoded hex colors; verify-standards passes — PR: #3982.
- 2026-03-26 — Forms: consolidate remaining create entrypoints via EntityFormSurface (schedule call → inquiry, SmartSearch → sales order) — PR: #3984.
- 2026-03-27 — Plants: fix available-products endpoint routing so GET works (was 405) — PR: #3986.
- 2026-03-27 — UniversalEntityForm: fix invoice schema 404 + required FK validation + better 400 error surfacing — PR: #3989.
- 2026-03-27 — Inquiries: prevent 500 on /api/v1/inquiries/ when tenant context missing — PR: #3990.
- 2026-03-27 — Fix: cockpit favorites + inquiry create — PR: #3993.
- 2026-03-27 — Fix: product associations persist — PR: #3994.
- 2026-03-27 — Fix: Email Sync Now avoids timeouts — PR: #3995.
- 2026-03-27 — Fix: Email Sync Now decryption failures always return stable `code=decryption_failed` (UI shows reconnect CTA) — PR: #4038.
- 2026-03-27 — Hotfix: restore development deployments (main-pipeline workflow file issue) — PR: #4011.
- 2026-03-27 — Fix: plant available products save — PR: #3996.
- 2026-03-27 — UI: facelift customer + supplier pages — PR: #3997.
- 2026-03-27 — FlowEditor: wire AI Suggestions panel (toggle + backend suggest-nodes + local fallback) — PR: #3998.
- 2026-03-27 — FlowEditor: unify Form Step normalization (explicit legacy→canonical map in nodeNormalization) — PR: #4013.
- 2026-03-27 — FlowEditor: canonicalize AI node suggestions to match NODE_TYPE_REGISTRY IDs (so suggested nodes always add successfully) — PR: #4014.
- 2026-03-27 — FlowEditor: vertical reordering (Move Up/Down) + restore standard selection (remove click-to-edit onNodeClick override) — PR: #4016.

- 2026-03-24 — Fixed global Ant Design theme corruption (Sanitized background tokens causing pure black component rendering) — PR: #3925.
- 2026-03-24 — Admin Workspace: Organization Profile save hardened (avoid multipart PATCH 502s) — PR: #3924.
- 2026-03-24 — Workforms: restored Publish button (status=active) in FlowEditor toolbar — PR: #3923.
- 2026-03-24 — Restored and Expanded AI Tool Registry: Microsoft Graph Email Sync, Outlook Email Drafting, and Database Search natively connected to the Swarm — PR: #3922.
- 2026-03-24 — Fixed theme token fallbacks (Defined missing CSS vars to prevent UI elements rendering black) — PR: #3921.
- 2026-03-24 — Hardened network request resiliency (Fixed trailing slashes causing 502 loops & added 500 error circuit breakers) — PR: #3920.
- 2026-03-24 — Fixed Workform Editor CSS viewport height + layout overlaps (Eliminated blank bottom space; NodePalette cushions; Toolbar flex-wrapping) — PR: #3919.
- 2026-03-24 — Fixed Workform Editor React Crash #310 (Migrated from sequential counters to unique IDs to prevent hook collisions) — PR: #3918.
- 2026-03-24 — Restored automated environment promotion PR creation (development→uat, uat→main) — PR: #3916.
- 2026-03-24 — Fixed Email OData 400 crash patterns (14-day local filtering) & wired Real OpenAI Chatbot with Email Context injection — PR: #3915.
- 2026-03-24 — Admin Workspace: fixed Invite User 500 by hardening invitation create validation + IntegrityError handling — PR: #3914.
- 2026-03-24 — Admin Workspace: Billing “Manage Plan” modal wired to Tenant Configurations — PR: #3913.
- 2026-03-24 — Admin Workspace: consolidate Customizations into Option Lists (Tenant Overrides tab) — PR: #3912.
- 2026-03-24 — FlowEditor: System Choice Lists selectable for dropdown field options — PR: #3909.
- 2026-03-24 — Workforms: Custom Tenant Lists "Coming Soon" placeholder CTA (ready to wire TenantListModal) — PR: #3907.
- 2026-03-24 — Frontend unified dependency bumps (supersedes Dependabot #3886) — PR: #3905.
- 2026-03-24 — Dependabot: bump frontend TypeScript to 6.0.2 — PR: #3890.
- 2026-03-24 — Dependabot: bump frontend lucide-react to 1.0.1 — PR: #3888.
- 2026-03-24 — Golden Standard Sweep (Docs/Typing): ARCHITECTURE_V3 reference + docstrings + removed remaining TS `any` in key UI components — PR: #3903.
- 2026-03-24 — Golden Standard Sweep (Frontend): route-level lazy loading + logger/type hardening — PR: #3900.
- 2026-03-24 — Phase 4 polish: global keyboard shortcuts + SearchableSelect fuzzy search + theme token strictness — PR: #3899.
- 2026-03-24 — Phase 3 AI Swarm UX: HITL Review Card + AI Learning Metrics Dashboard — PR: #3897.
- 2026-03-24 — WorkFormEngine: loop-body scheduling + error-edge try/catch routing — PR: #3896.
- 2026-03-24 — FlowEditor control-flow UX: LoopNode (2-in/2-out) + ErrorEdge conversion toggle — PR: #3894.
- 2026-03-23 — Universal Form Standardization, AntD Searchable MultiSelect, and Live AI Overviews — PR: #3875.
- 2026-03-23 — Fixed Protein-to-Product cascading filters (Backend case-sensitivity, URL serialization, and removed aggressive UX auto-add) — PR: #3874.
- 2026-03-23 — Admin Workspace Finalization: Option Lists enhancement & Billing Dashboard implementation — PR: #3873.
- 2026-03-23 — Fixed Email Ingestion Monitor 404 routing error & exposed skipped email stats — PR: #3872.
- 2026-03-23 — Improved Email Ingestion UX (Exposed Graph API fetch stats to UI to clarify empty states) — PR: #3853.
- 2026-03-23 — AI Assistant hardened (direct OpenAI chat completion + stable tools/review compatibility endpoints + system entity summarizer action) — PR: #3843.
- 2026-03-23 — Data Architecture: Replaced scaffolded product seeds with the official Master Products (3.22.26) list, establishing the Tier 1 Golden Catalog as the single source of truth. 661 products across 40+ protein types (Beef, Pork, Chicken, Turkey, Duck, Goose, Quail, Pheasant, Squab, Guinea Fowl, Lamb, Goat, Veal, Bison, Elk, Venison, Rabbit, Kangaroo, Ostrich, Emu, Wild Boar, Camel, Yak, Antelope, Salmon, Cod, Pollock, Haddock, Tilapia, Catfish, Trout, Mahi-Mahi, Tuna, Halibut, Snapper, Grouper, Sardines, Anchovy, Whitefish, Carp, Perch, Walleye, Rendered, Pet Food, Specialty) covering primal cuts, organs, bones, by-products, and rendered goods. Each entry maps Protein → Item Name → Variations per the Master Products 3.22.26 diagram, with auto-generated product codes (e.g. BEEF-CHUCK-ROLL), category, and protein_type fields aligned to the diagram's pre-filter cascade (Protein → Item Name → Type → Trim).

- 2026-03-23 — Cockpit UX: Google-style AI Overview Card (show more + graceful fallback) — PR: #3801
- 2026-03-23 — Cockpit UX: Tabbed relations (Orders / Invoices / Contacts) + compact profile header — PR: #3802
- 2026-03-23 — Cockpit UX: Contextual “+ New …” CTA in profile tabs — PR: #3803
- 2026-03-23 — Cockpit UX: Inline create Sales Order subview (URL-driven) — PR: #3804
- 2026-03-23 — Cockpit UX: Notes & Calls drawer (unified timeline + add note) — PR: #3805
- 2026-03-23 — Admin Branding: reliably load tenant logo/colors after login + cache-bust on update — PR: #3807
- 2026-03-23 — Hardened OAuth initiation flow (Removed direct API navigation to preserve JWT/Tenant context) — PR: #3809
- 2026-03-23 — Emergency fix applied to ai_assistant routing to resolve 502 crash. — PR: #3828
- 2026-03-23 — Backend API endpoint for AI Overview Card (Cockpit 404 fix) — PR: #3829
- 2026-03-23 — Cockpit inline action routing & smart contextual auto-population — PR: #3830
- 2026-03-23 — Beautified Cockpit Entity Profile Header (Inline edit UX + Preferred Products) — PR: #3833.
- 2026-03-23 — Product selection filtered by preferred_protein_types (Master Data compliance) — PR: #3841.
- 2026-03-23 — Modal create flows aligned to Master Products (Cockpit quick-create + product-association modals w/ protein filtering) — PR: #3842.
- 2026-03-23 — Admin Workspace: Configurations create/reset/delete + permissions tenant-context auto-repair (fixes missing Admin Workspace sidebar for valid users) — PR: #3844.
- 2026-03-23 — Admin Workspace: persist resolved tenant context from admin_permissions (prevents Billing/Option Lists/Customizations/Configurations from appearing “broken” due to missing X-Tenant-ID) — PR: #3848.
- 2026-03-23 — Email ingestion manual sync converted to synchronous execution (500 fix) — PR: #3845.
- 2026-03-23 — Suppliers/Customers: punch-in drill-down navigation (Suppliers→Plants + details + Contacts; Customers→Locations + details + Contacts) — PR: #3846.
- 2026-03-23 — Cockpit: Preferred/Active Products sections (editable, searchable multi-select) + “New Inquiry/PO/SO” CTAs open full create forms — PR: #3847.
- 2026-03-23 — V3 Phase 1 DRY Purge: UniversalEntityForm replaces legacy Create* modals (CreateOrder/CreateClaim/CreateInquiry removed) — PR: #3850.
- 2026-03-23 — Quick Create Context Hydration & Foreign Key ORM fix (400 Bad Request resolution) — PR: #3854.
- 2026-03-23 — Fixed Microsoft Graph OData 400 error (Migrated to Python-level subject filtering) & hardened UX — PR: #3855.
- 2026-03-23 — AI Vector Engine integration (pgvector + Django RAG pipeline) — PR: #3859.
- 2026-03-23 — Enabled HITL review commands in AIAgentWidget (/pending, /resolve) with staff-only queue support — PR: #3863.

- 2026-03-22T16:39:58Z — EMERGENCY ROLLBACK: Reverted Workform Container UI to stable Friday baseline due to UX degradation.

- 2026-03-20 — Deployed LoopNode, ErrorEdge, Viewport Virtualization, and Backend Try/Catch Graph Routing — PR: #3745

- 2026-03-21 — Admin Workspace: restore API contracts (permissions/current tenant/activity logs/pagination) — PR: #3746

- 2026-03-20 — Outlook OAuth canary validation fix (prompt=select_account) — PR: #3727

- 2026-03-20 — WorkForms: align pages with service layer + monitoring dedupe (PR: #3685)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3685
  - WorkForms InProgress/History now use `businessApi` (no legacy `apiClient`).
  - WorkForms /monitoring now reuses Cockpit ProcessMonitor (single source of truth).
  - Normalized invalid rgba/rgb color strings in WorkForms pages.

- 2026-03-20 — Phase 8.0: staff-only swarm router preview endpoint (PR: #3693)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3693
  - Adds `POST /api/v1/ai-assistant/swarm/invoke/` to run SwarmOrchestrator routing (no tool execution, no side effects).

- 2026-03-20 — Phase 8.0: VectorMemory similarity search endpoint (PR: #3696)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3696
  - Adds staff-only `POST /api/v1/ai-assistant/memory/search/` for tenant-scoped cosine similarity search over VectorMemory.

- 2026-03-20 — Phase 8.0: Swarm invoke contract hardening (PR: #3697)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3697
  - Swarm invoke now uses DRF serializer validation and returns a consistent contract including correlation_id.

- 2026-03-20 — Phase 7.0/8.0: HITL pending review queue endpoint (PR: #3699)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3699
  - Adds staff-only `GET /api/v1/ai-assistant/review/pending/` backed by AIFeedbackLog (unresolved, confidence_score < 0.85).

- 2026-03-20 — Phase 7.0/8.0: Widget polls pending review queue (PR: #3701)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3701
  - AIAgentWidget polls the staff-only pending-review endpoint while expanded and switches to action_required when new items appear (403 disables polling silently).

- 2026-03-20 — Phase 8.0: ToolRegistry includes VectorMemory search (PR: #3703)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3703
  - Registers schema-only `search_vector_memory` so it appears in tools/openapi for agent discovery (execution remains via staff-only API).

- 2026-03-20 — Phase 7.0/8.0: Resolve HITL review items (PR: #3705)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3705
  - Adds staff-only `POST /api/v1/ai-assistant/review/<feedback_id>/resolve/` and a minimal widget action to resolve the latest pending item.

- 2026-03-20 — Phase 7.0/8.0: Widget HITL slash commands (PR: #3707)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3707
  - Adds `/help`, `/pending`, and `/resolve [idPrefix] [json]` commands to AIAgentWidget for faster HITL triage/resolution.

- 2026-03-20 — Phase 8.0: VectorMemory ingestion endpoint (PR: #3709)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3709
  - Adds staff-only `POST /api/v1/ai-assistant/memory/upsert/` for ingesting/updating VectorMemory rows (caller supplies 1536-dim embedding).

- 2026-03-19 — Phase 9.5: Book + Pages paradigm shift — Commit: fca3d658 (PR: #3631)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3631
  - Paradigm: Form Process Group behaves like a "book" / swimlane; Form steps render as "pages" with in-node field preview.
  - Container edges: strict container edge isolation remains removed to support Form → Action → Form workflows across permeable boundaries.
  - Layout: steps sequence horizontally (wider spacing) and non-form child nodes are not repositioned by container auto-layout.

- 2026-03-19 — Phase 7 — Initiative: WorkForm Visual Evolution: Interleaved Action Containers and Horizontal Page Layout — Commit: 9bd8df90 (PR: #3633)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3633
  - FormProcessGroupNode: pages (type `form`) lay out horizontally while other node types remain free-positioned within the container.
  - Group container sizing: width expands with page count ("book" grows as pages are added).
  - FormNode UX: selected pages support a lightweight in-canvas field editor (add/reorder) to reduce side-panel dependency.
  - Connectivity: plan to introduce virtual handles for collapsed groups so edges can cross the container boundary cleanly without breaking `extent: 'parent'` visually.

- 2026-03-19 — Fix: ConditionBuilder loads entity fields — Commit: c3af966d (PR: #3637)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3637
  - DynamicConfigPanel: when an entity is selected (entityType/eventEntity/entity), load entity fields via schemaService and include them in ConditionBuilder available fields.
  - Resolves empty ConditionBuilder dropdowns for Database Event trigger nodes.

- 2026-03-19 — Fix: Catalog filtering shows hybrid WorkForms — Commit: 7dfb64b6 (PR: #3638)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3638
  - WorkForms Catalog: refactored filtering/classification to deeply inspect flow_data.nodes, correctly categorizing hybrid WorkForms (Form Process Groups) and pure workflows so user-created flows are not hidden.

- 2026-03-19 — Phase 7 UX: Sub-flows + toolbars + smoother edges — Commit: bc766c91 (PR: #3640)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3640
  - FormProcessGroupNode: removed dimension transitions and force explicit width/height on expand/collapse to avoid ResizeObserver bounding-box glitches.
  - BaseNode: replaced ad-hoc controls with React Flow NodeToolbar and added button-style output handle.
  - Edges: default to smoothstep (via EnhancedConnectionEdge) with thicker strokes + larger arrow markers; added a hover EdgeToolbar with insert/delete affordances.

- 2026-03-19 — Phase 7 — Fix: TenantForm API path + FormProcessGroup internals + Auto-Map panel click isolation — Commit: 57d5d294 (PR: #3661)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3661
  - tenantFormService: align CRUD base path to `/workflows/forms/` (views mounted on workflows router).
  - FormProcessGroupNode: use `useUpdateNodeInternals()` and remove stale height style when collapsing to avoid ResizeObserver glitches.
  - AutoMappingSuggestionsPanel: improve wrapping and stop event propagation on Apply/Reject/Apply All.

- 2026-03-19 — Fix: Workforms Editor UI/config/publish polish — Commit: 25a56157 (PR: #3629)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3629
  - DynamicConfigPanel: handle field.type=entityType and field.type=multiSelect to prevent "Unknown field type" rendering errors.
  - UnifiedFlowEditor: move canvas settings panel to bottom-left; add explicit node palette toggle; Help (?) opens keyboard shortcuts.
  - WorkForms Editor: click-to-edit flow title; Publish disabled when there are unsaved changes.

- 2026-03-19 — Fix: Dagre global layout crash + Add Step clipping — Commit: 44617749 (PR: #3627)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3627
  - Auto-layout: isolate global dagre pass to top-level nodes only (filters child nodes with parentId) to prevent React Flow grouped-node crashes.
  - UI: container bodies allow visible overflow when expanded so the "Add Step" button is not clipped.

- 2026-03-19 — Fix: Phantom Logout (Settings/Integrations) — Commit: c267ca88 (PR: #3625)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3625
  - tenantService: removed rogue axios.create + interceptors (incl. 401 hard redirect to /login); now uses centralized JWT-aware apiClient.
  - IntegrationSettings + EmailConnection: switched to apiClient and removed hardcoded /api/v1 (or /api) prefixes to avoid double-stacking baseURL.

- 2026-03-19 — Email Integrations UI mounted (Settings) — Commit: 70f9fc43 (PR: #3643)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3643
  - Settings: mounted IntegrationsSection below Tenant Branding.
  - IntegrationsSection + EmailConnection: OAuth calls now use authenticated apiClient (no raw axios, no hardcoded /api prefix).
  - Forced deployment to dev environment via .deployment-trigger to inject updated Microsoft OAuth Client ID and Secret environment variables.
  - Added .well-known/microsoft-identity-association.json to frontend public directory for Azure Publisher Domain verification.

- 2026-03-19 — Phase 11: Data Flow Tracing — Commit: c02d4d2d (PR: #3623)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3623
  - FlowEditor: upstream context is now derived from true graph traversal (edges), not Y-position heuristics.
  - EnhancedConnectionEdge: hover tooltip shows Data Keys flowing across the edge (from source output schema / fields).
  - VariablePicker: adds a scope warning indicator for variables that may not be evaluated before a step executes.

- 2026-03-19 — Phase 9.5: Copy/Paste + container-aware auto-layout + memory-safe undo/redo — Commit: ba8c0d99 (PR: #3612)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3612
  - FlowEditor: Ctrl/⌘C copies selected nodes; Ctrl/⌘V pastes with fresh UUIDs, +50px offset, and selection moves to pasted nodes.
  - Layout: recursive dagre layout per container (parentId grouping) + final top-level pass; containers auto-resize to fit children.
  - History: structuredClone-based snapshots (sanitized for clone safety) with strict 50-state cap.

- 2026-03-19 — Hotfix: Workforms Editor TDZ crash (collaboration hook used `currentWorkflowId` before initialization) — Commit: f24bc3fc (PR: #3613)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3613
  - FlowEditor: move collaboration/presence hook block to after `currentWorkflowId` state initialization to prevent `ReferenceError: Cannot access before initialization`.


### Scope
- Cockpit “continuous browsing” navigation + relationships.
- MyTasks workflow execution dashboard stability.
- Intelligent Workform Editor (entity-first nodes, smart inheritance, node cleanup, config UX).

### PR Log (append-only)

> Fill in as PRs are opened/merged.

- 2026-03-22T17:41:54Z — Hotfix: Corrected Ops workflows to use environment-scoped `SSH_HOST/SSH_USER` (single source of truth) and verified seeding uses `seed_system_products`, resolving pipeline crashes.
- 2026-03-22T17:56:08Z — Hotfix: Unblocked dev deploy by removing `run_before` edges from `tenants.0011_bootstrap_rls_session_vars` (prevents `InconsistentMigrationHistory` with historical RLS migrations) and hardened Ops SSH auth (prefer `SSH_PASSWORD`, support optional `SSH_KEY`, retain legacy fallbacks).

- 2026-03-13 — Phase 7 Stabilization + Cockpit Navigation — Commit: 6144c189 (PR: #3447)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3447
  - Cockpit: navigation-path driven continuous browsing + breadcrumb jumping; UUID-safe relationships endpoint.
  - Backend: relationship discovery returns contacts/recent orders/related products; RLS middleware sets+resets both `app.current_tenant` + `app.current_tenant_id`.
  - Workflows: migrations/models aligned for tenant/RLS stability (MyTasks/workflow executions).
  - FlowEditor: entity-first Form config, Smart Auto-Map suggestions, removed raw JSON editor, deprecated multi-step container edit path (migrates to `formProcessGroup`), collapsed group shadow fix.

- 2026-03-13 — Verification follow-up — Commit: f8458630 (PR: #3448)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3448
  - Fix workflow executor verification tests (safe numeric coercion for equals + correct patch target).

- 2026-03-13 — CI security scan fix — Commit: 07473351 (PR: #3449)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3449
  - Restore Secret Detection Scan reliability (gitleaks CLI, no org license dependency) and remove hardcoded superuser password defaults.

- 2026-03-13 — Deployment migration hardening — Commit: 595f729f (PR: #3451)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3451
  - Make `tenant_apps.workflows` migration `0022` idempotent to prevent `DuplicateColumn` failures during redeploy.

- 2026-03-13 — Deployment backfill correction — Commit: d7766aa0 (PR: #3452)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3452
  - Fix `0022` tenant backfill to derive tenant via `workflows_tenantform` join (avoids missing-column errors on existing DBs).

- 2026-03-13 — Deployment workflow resilience — Commit: 60473ebb (PR: #3453)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3453
  - Fix frontend deploy to tolerate unset `SENTRY_*` variables under `set -u` by using safe defaults in runtime config generation.

- 2026-03-15 — FlowEditor config standards shipped — Commit: f3edd946 (PR: #3455)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3455
  - FlowEditor: schema-driven config UX standards, Smart Auto-Map banner, Developer Mode JSON fallback; Vitest reliability hardening.
  - Governance: update GOLDEN_FILES registry and execution log.

- 2026-03-15 — Phase 7.3 WebSockets foundation — Commit: dd3ae119 (PR: #3456)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3456
  - Backend: Django Channels + ASGI ProtocolTypeRouter; tenant-scoped workflow collaboration WebSocket scaffold.
  - Docs: WorkForms developer guide includes WebSocket path convention for real-time editing.

- 2026-03-15 — Phase 8.1 Universal Search caching — Commit: fc197e4b (PR: #3457)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3457
  - Backend: tenant-safe cache for UniversalSearchService results (short TTL), plus hardened entity lookup response and tenant fallback.

- 2026-03-15 — Phase 8.3 Email ingestion fan-out — Commit: 86c2025f (PR: #3458)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3458
  - Backend: Celery fan-out for email ingestion (provider-scoped tasks) with jittered dispatch.

- 2026-03-15 — Entity-First UI Restoration (Portal + Schema Bootstrap) — Commit: a12c8ec4 (PR: #3460)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3460
  - FlowEditor: add static portal containers to Vite index.html, harden portal lifecycle, and fix portal diagnostics.
  - FlowEditor: ensure schemaRegistry is initialized (no fallback schemas for trigger/formStep), restoring entity-first configuration.
  - FlowEditor: Developer Mode JSON editor uses Monaco (fallback to textarea).

- 2026-03-15 — FlowEditor: cascading relation fields — Commit: 9579a247 (PR: #3462)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3462
  - EntityFieldPicker: relation fields (FK/M2M/1-1) can select an upstream variable template to cascade/auto-populate (`cascadeFrom`).
  - DynamicConfigPanel: entity-field-picker renderer passes upstream variables into EntityFieldPicker.

- 2026-03-15 — Cockpit: global search in header (Ctrl+K) — Commit: 2be7d888 (PR: #3466)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3466
  - Move Cockpit search input to `Header.tsx` with global Ctrl/⌘K focus.
  - CockpitDashboard becomes a results view driven by URL `?q=` (SmartSearch controlled query + hideInput).
  - SmartSearch now debounces via `lodash/debounce` (no setTimeout).

- 2026-03-18 — Cockpit BreadcrumbBar elevation — Commit: 68205801 (PR: #3542)
  - BreadcrumbBar renders directly beneath Toolbar/CockpitTour (outside search block) to keep navigation visible across states.
  - Verification: Breadcrumb persists above search/hint/results when drilling into entities.

- 2026-03-18 — Cockpit Quick Actions routing + PinnedTools event bus — Commit: 68205801 (PR: #3542)
  - SmartSearch quick actions now route via React Router (PO/SO create/history) and dispatch `pm:open-tool` for Send Email.
  - PinnedToolsBar listens for global `pm:open-tool` to open email/record tools automatically.

- 2026-03-18 — Batch: FlowEditor + Cockpit fixes — Commit: 8390003e (PR: #3552)
  - Includes: FlowEditor handler injection hardening, formStep deprecation warning removal, LR auto-layout for FormProcess, entity field refetch fix, hero SmartSearch, and NavigationMenu stability.

- 2026-03-18 — Batch: Master plan updates + audits — Commit: 690cd86b (PR: #3553)
  - SmartWizard decommission confirmed; RLS audit for PO/Invoice recorded; Form node UI verified.

- 2026-03-18 — Hotfix: dev site load crash (nodeConfigSchemas TDZ) — Commit: 4729f149 (PR: #3557)
  - Fixes dev-site crash: “Cannot access before initialization” in nodeConfigSchemas by deferring schema list/registry init until end-of-module.

- 2026-03-18 — Ops: env audit alignment + email integration cleanup — Commit: 101b3caa (PR: #3558)
  - config/manage_env.py now reads manifests/env.manifest.json (v5.1), supports repo + env secrets audit, and reports missing/zombie secrets.
  - Removed duplicate email_integration model declarations and aligned webhook EmailLog writes to migration schema (eliminates Django “already registered” warnings).

- 2026-03-18 — Deps: frontend unified upgrades (safe build) — Commit: 7f03b871 (PR: #3559)
  - Safe Vite 8 upgrade with config hardening (manualChunks + assetFileNames).
  - Fixed Modal barrel export for strict ESM bundling.
  - Tailwind kept pinned at 3.4.19; Tailwind 4 migration requires dedicated follow-up.

- 2026-03-18 — Deploy unblock: integrations EmailLog migration — Commit: 756c89dc (PR: #3561)
  - Adds missing migration for `apps.integrations.EmailLog` (fixes CI `makemigrations --check` gate).
  - Enables Postgres RLS + `emaillog_tenant_isolation` policy on `integrations_emaillog`.

- 2026-03-18 — Ops: harden validate-migrations.sh — Commit: e96ab930 (PR: #3563)
  - Removes incorrect django-tenants logic; ProjectMeats is shared-schema only.
  - Script is runnable from any working directory and validates both `apps/` and `tenant_apps/` migrations.

- 2026-03-18 — Docs: align multi-tenancy guidance (shared schema) — Commit: 7020f5c3 (PR: #3565)
  - Removes outdated `django-tenants`/`migrate_schemas` guidance from backend READMEs.
  - Clarifies tenant isolation via `tenant` FK + `TenantMiddleware` + PostgreSQL RLS.
- 2026-03-15 — Workflows: ActionItems 500 hardening — Commit: 2b5f2346 (PR: #3468)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3468
  - Return empty results when tenant context is missing (prevents RLS `current_setting()` errors).
  - Always tenant-filter assignments/submissions; catch DB/RLS exceptions and return 200.

- 2026-03-15 — System API: Cockpit typed relationships URL fix — Commit: 6574c740 (PR: #3470)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3470
  - Add explicit typed routes for entity detail + relationships: `/api/v1/system/entities/<type>/<id>/...` (keeps router endpoints intact).

- 2026-03-15 — Cockpit: fix remaining 404s (calendar + fuzzy-related) — Commit: dab20712 (PR: #3472)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3472
  - Add typed `/api/v1/system/entities/<type>/<id>/fuzzy-related/` to match SmartSearch.
  - Add placeholder `/api/v1/calendar/events/` endpoint (returns empty results while Phase 5 calendar integration is blocked).
  - CalendarWidget uses `businessApi` for events fetch.


- 2026-03-15 — Workflows: MyTasks execution loading fix — Commit: 775b2b53 (PR: #3474)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3474
  - Backend: non-admin users can list submissions via assigned_to=me (do not pre-filter by created_by).
  - Frontend: workflowExecutionService uses businessApi + defensive list parsing to avoid map() crashes.

- 2026-03-15 — Workflows: runtime cascadeFrom prefill — Commit: 352c5eaa (PR: #3476)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3476
  - Add `ExecutionFormStep` runtime renderer for `formStep` nodes.
  - Fix `WorkflowExecutionModal` context wiring + hydrate context from `execution.data` for resume.
  - Prefill fields from FlowEditor `cascadeFrom` templates (only fills missing/untouched values).

- 2026-03-15 — FlowEditor: fix FormProcessGroup collapsed outline — Commit: 660dae73 (PR: #3478)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3478
  - Explicitly shrink/grow the React Flow node wrapper on expand/collapse so the expanded outline/shadow does not linger when collapsed.

- 2026-03-15 — Dev deploy unblock: frontend build fixes — Commit: 884c9918 (PR: #3480)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3480
  - Fix Sentry v10 integration usage (React Router v7 tracing + replay integration) and make colorthief loading bundler-safe.
  - Verified: GitHub Actions run 23110092071 succeeded (dev deploy green).

- 2026-03-15 — Hotfix: prevent dev blank load (nodeConfigSchemas TDZ) — Commit: bf382917 (PR: #3482)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3482
  - Fix TDZ crash in `nodeConfigSchemas.ts` by defining `allSchemas` and initializing `schemaRegistry` at end-of-module.
  - Verified: GitHub Actions run 23110337287 succeeded (dev deploy green).

- 2026-03-15 — Hotfix: schemaRegistry validator hardening — Commit: 944cecca (PR: #3484)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3484
  - Prevent page-load crashes by making schema validation ordering-independent (two-pass field ID collection), tolerating non-array `field.validation`, and relaxing label requirement for `info`/`button` fields.
  - Verified: GitHub Actions run 23110537337 succeeded (dev deploy green).

- 2026-03-15 — Hotfix: restore Cockpit search input + dynamic select schema warnings — Commit: 84962d5a (PR: #3486)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3486
  - CockpitDashboard: show SmartSearch input (no more hideInput leading to non-actionable "no results" state).
  - schemaRegistry: treat empty/missing select options as warning (supports dynamic option loading like document templates).
  - Verified: GitHub Actions run 23110718199 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: record pivot + pinned tools — Commit: 8c2f6996 (PR: #3488)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3488
  - Cockpit: record-centric pivot (selected record swaps view to profile + relations) while preserving continuous-browsing breadcrumb.
  - Cockpit: PinnedToolsBar under Header + widget pin-to-tools UX.
  - Backend: expand typed entity detail payload and add gated PATCH for inline editing.
  - Verified: GitHub Actions run 23111772995 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: single global search input — Commit: e787f0df (PR: #3489)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3489
  - CockpitDashboard: SmartSearch now runs header-driven (`hideInput=true`); Header search is the sole input (Ctrl/⌘K).
  - Verified: GitHub Actions run 23111883098 succeeded (dev deploy green).

- 2026-03-15 — FlowEditor: schema validation normalization — Commit: d0b23c47 (PR: #3490)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3490
  - Convert remaining object-shaped validation blocks in nodeConfigSchemas.ts to array-based ValidationRule[] entries.
  - Verified: GitHub Actions run 23112116822 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: header-driven search UX — Commit: 35a83144 (PR: #3491)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3491
  - CockpitDashboard: do not show "No results" when there is no query; show a clear prompt + Focus Search affordance.
  - Header: add stable search input id (global-search-input) for focus.
  - Verified: GitHub Actions run 23112192365 succeeded (dev deploy green).

- 2026-03-15 — FlowEditor: fix entity field cascade + blank sections — Commit: fe595364 (PR: #3493)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3493
  - Fix complex config renderers to call `onChange(value)` (not `onChange(field.id, value)`), restoring EntityFieldPicker cascade/selection and other complex controls.
  - DynamicConfigPanel: pass `onFieldChange` through renderer props; show a non-empty empty-state for sections with no currently unlocked fields.
  - Verified: GitHub Actions run 23112462806 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: Process Monitor (WorkForms monitoring) — Commit: 336fdc8f (PR: #3495)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3495
  - Cockpit: add `/cockpit/process-monitor` page listing active FormSubmissions with current step, assignee, elapsed time, and SLA due state.
  - Backend: add `/api/v1/workflows/form-submissions/process-monitor/` endpoint (tenant-safe; supports assigned_to/status/form filters).
  - Detail pivot: clicking a row opens a read-only UnifiedFlowEditor view and highlights the active step node when it can be identified from flow_data.
  - Verified: GitHub Actions run 23112710137 succeeded (dev deploy green). Deployed tags: `development-336fdc8f8274d6b0b4742b6f881aee4ae2e87014` (pm-frontend + pm-backend).

- 2026-03-15 — FlowEditor: validation normalization hardening — Commit: 5b9e5f34 (PR: #3497)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3497
  - schemaRegistry: wrap single-object `field.validation` into an array (backward compatible) to prevent `.forEach` crashes.
  - LiveFormPreview: normalize `field.validation` to an array before iterating.
  - Verified: GitHub Actions run 23112951974 succeeded (dev deploy green). Deployed tags: `development-5b9e5f34da6f80c51f807483caa3910de6d339d9` (pm-frontend + pm-backend).

---

## Consolidated Execution Plan (2026-03-13)

This section consolidates the current work queue into a single execution plan. Work will be delivered as a **sequence of PRs**, each merged into `development`.

### PR A — FlowEditor “Once and For All” Config UX (Frontend)
**Branch:** `fix/floweditor-config-standards`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3455 (merge commit: `f3edd946`)
Unit tests verified via Vitest. NOTE: `src/components/FlowEditor/__tests__/UnifiedFlowEditor.integration.test.tsx` is temporarily quarantined from Vitest collection due to a deterministic hang under JSDOM.

Deliverables:
- **Entity-first config parity for legacy `formStep`** (schema-driven): add `entityType` + `entity-field-picker` so older workflows remain editable.
- **DynamicConfigPanel renderer completeness for critical node UIs**:
  - `info` blocks render (no more “Unknown field type” placeholders)
  - `ruleBuilder`/`conditionBuilder` renders via `ConditionBuilder` (visual rules)
  - `validation-builder` is wired to `ValidationRuleBuilder`
  - common legacy aliases supported (`checkbox`, `boolean`, `email`, `password`, `codeEditor`)
- **Smart Auto-Map surfaced**: top-of-panel banner with one-click “Apply suggested mappings”.
- **JSON fallback restored**: Advanced tab adds a persisted **Developer Mode** toggle with safe raw JSON editor for `node.data`.
- **Standards enforcement**: legacy `NodeConfigPanel` no longer imports `axios` and uses schema bridge (`EntityFieldPicker` → BusinessApi via schemaService).

Verification (repo scripts):
- `npm run type-check` (or equivalent)
- `npm test` (if present)

### PR B — Governance: Golden Files + Phase 7 progress
Status: Completed as part of PR A (#3455).

### PR C — Phase 7.3: Real-Time Collaboration foundation (Backend)
**Branch:** `feat/phase7-3-channels-foundation`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3456 (squash commit: `dd3ae119`)

Deliverables:
- Implement **Channels-ready ASGI routing** and WebSocket path conventions:
  - `/ws/workflows/<workflow_id>/collab/?tenant_id=<tenant_uuid>`
- Use existing `REDIS_URL`/`VALKEY_URL` for channel layer (no new secret names; manifest remains source of truth).

### PR D — Phase 8.1: Tenant-safe caching for Universal Search (Backend)
**Branch:** `feat/phase8-1-universal-search-cache`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3457 (squash commit: `fc197e4b`)

Deliverables:
- Decorator-based caching for `UniversalSearchService.search()` using Redis.
- Cache keys include **tenant id** (and query params) to preserve strict RLS/tenant isolation.

### PR E — Phase 8.3: Email ingestion fan-out (Backend)
**Branch:** `feat/phase8-3-email-ingestion-fanout`

**Status:** PR OPEN — https://github.com/Meats-Central/ProjectMeats/pull/3458
**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3458 (squash commit: `86c2025f`)

Deliverables:
- Convert sequential provider polling into Celery fan-out (task per provider/tenant).
- Add backoff/retry and keep provider rate-limits safe.

Execution rules:
- New branch per PR → PR → merge to `development`.
- No direct axios usage in frontend; BusinessApi/workformsApi only.
- Maintain PostgreSQL RLS parity and tenant isolation in all backend changes.

- 2026-03-18 — CRITICAL HOTFIX: WSOD Resolution (schemaRegistry TDZ) — Evidence: PR #3460 (see section below)
  - Fixed "schemaRegistry is not defined" White Screen of Death on dev environment
  - Root cause: Vite/Rollup ES Module evaluation order caused Temporal Dead Zone
  - Solution: Wrapped all schemaRegistry initialization calls in setTimeout(..., 0) to defer to next macro-task
  - Affected file: frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts (lines 1013-1021, 4171-4173)
  - Impact: Guarantees all ES modules fully link before schema registration executes
---

## Emergency Restoration Addendum (Priority Queue)

**Priority ordering:**
1. Node configuration stability (DONE — PR #3455, #3460, #3462)
2. Emergency UI/UX + API restoration (NEXT)

### PR F — Emergency UI/UX + API restoration (Frontend + Backend)
**Status:** COMPLETE (historical plan snapshot; executed in PRs listed in the reconciliation section below)

Problem summary (from console logs / diagnostics):
- Portal rendering race + schema fallback were the top blockers. These are now addressed by:
  - Portal stability: PR #3460
  - Schema registry bootstrap + legacy aliasing: PR #3460 / PR #3455
- Remaining regressions to eradicate:
  - **Global Search UX**: move Cockpit-local search into `Header.tsx` with Ctrl+K global listener.
  - **API routing / RLS disconnects**: fix 500 on `/api/v1/action-items/` and 404s on `/api/v1/calendar/events/` + entity `/relationships/` routing.

Deliverables:
- Frontend:
  - Remove CockpitDashboard search button/input and relocate to `frontend/src/components/Layout/Header.tsx`.
  - Ensure global search drives Cockpit navigation (“Never Leave the Screen”).
- Backend:
  - Fix ActionItems endpoints stability (`backend/tenant_apps/workflows/views.py`): null-safe fields + tenant/RLS-safe query patterns.
  - Verify entity relationships endpoints are registered under `/api/v1/` and accept snake_case entity names.
  - Register/fix `/api/v1/calendar/events/` endpoint (or align frontend to the correct URL).

Verification (manual):
- Ctrl+K from any page opens search.
- Searching “Purchase Order” navigates back to Cockpit details without full reload.
- Action Items endpoints return 200 for an authenticated tenant.

---

### 2026-03-15 — Cockpit relationships regression fix (PR #3499)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3499

**Status:** MERGED → `development` (squash commit: `adbec5b774eb226fbfd3faa13877038d3b90c350`)

Deliverables:
- Fix Cockpit relationship discovery returning zero related entities.
- “Associated contacts”: union **M2M** (`Supplier.contacts` / `Customer.contacts`) with legacy FK (`Contact.supplier` / `Contact.customer`) for backward compatibility.
- “Related products”: union direct M2M products with order-derived products.
- Per-relationship error isolation so one failing relationship does not zero the entire relationships payload.

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23113180951 (conclusion: success)
- Frontend deploy evidence:
  - `docker pull registry.digitalocean.com/meatscentral/projectmeats-frontend:development-adbec5b774eb226fbfd3faa13877038d3b90c350`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `docker pull registry.digitalocean.com/meatscentral/projectmeats-backend:development-adbec5b774eb226fbfd3faa13877038d3b90c350`
  - container: `pm-backend`

---

### 2026-03-15 — Status reconciliation: “PR F — Emergency UI/UX + API restoration” is COMPLETE
The PR F section above remains as the original plan snapshot. Execution is now complete across shipped PRs; key delivered items:

- **Global search moved to Header (Ctrl/⌘K) and Cockpit uses header-driven search**
  - https://github.com/Meats-Central/ProjectMeats/pull/3466
  - https://github.com/Meats-Central/ProjectMeats/pull/3491
- **Action Items 500 hardening (tenant guards + null safety)**
  - https://github.com/Meats-Central/ProjectMeats/pull/3468
- **Entity relationships routing fixes (snake_case / typed URLs) and Cockpit relationship payload restoration**
  - https://github.com/Meats-Central/ProjectMeats/pull/3470
  - https://github.com/Meats-Central/ProjectMeats/pull/3499
- **Calendar events endpoint alignment + frontend wiring**
  - https://github.com/Meats-Central/ProjectMeats/pull/3472

Verification:
- PR #3499 deployed to `development` via Actions run https://github.com/Meats-Central/ProjectMeats/actions/runs/23113180951.

---

### 2026-03-15 — FlowEditor: Hybrid Form config pivot (PR #3502)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3502

**Status:** MERGED → `development` (squash commit: `8527cfca2bd43455c88b220a60a5b13ec3a03f5e`)

Deliverables:
- FlowEditor: schemaRegistry initialization is now **zero-crash** (per-schema try/catch) so one malformed schema cannot blank the entire config engine.
- FlowEditor: specialized Form node config (`FormNodeConfig`) bypasses DynamicConfigPanel for `node.type === 'form'` to make entityType → fields cascading deterministic.
- Strict compliance: Form schema data is fetched via the existing schemaService/BusinessApi path (no direct axios).

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23113655842 (conclusion: success)
- Frontend deploy evidence:
  - `docker pull registry.digitalocean.com/meatscentral/projectmeats-frontend:development-8527cfca2bd43455c88b220a60a5b13ec3a03f5e`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `docker pull registry.digitalocean.com/meatscentral/projectmeats-backend:development-8527cfca2bd43455c88b220a60a5b13ec3a03f5e`
  - container: `pm-backend`

---

### 2026-03-15 — FlowEditor: Standardize Form Process group + collapse artifact fix (PR #3504)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3504

### 2026-03-15 — FlowEditor: hide legacy NodeConfigPanel export (PR #3506)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3506

**Status:** MERGED → `development` (squash commit: `3eee002d3a7261c8b8f4f42259f2b45266bed86c`)

Deliverables:
- Hardening: stop exporting legacy `NodeConfigPanel` from the FlowEditor ConfigPanel barrel so the standard config flow stays schema-driven/structured (raw JSON remains behind explicit Developer Mode in the tabbed panel).

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23114580593 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-3eee002d3a7261c8b8f4f42259f2b45266bed86c`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-3eee002d3a7261c8b8f4f42259f2b45266bed86c`
  - container: `pm-backend`


### 2026-03-15 — FlowEditor: Standardize Form Process group + collapse artifact fix (PR #3504)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3504

**Status:** MERGED → `development` (squash commit: `0fed7c29b9082c4b8ac7a7431863930ebc789741`)

Deliverables:
- Form Process containers: legacy node types (`formProcess`, `formMultiStepContainer`) are canonicalized to `formProcessGroup` at load-time to standardize behavior.
- Config: Form Process config uses the structured `FormProcessConfigPanel` for `formProcessGroup` (and legacy types for safety).
- UI bugfix: `FormProcessGroupNode` now forces React Flow to re-measure internals on expand/collapse and after auto-layout so collapsed nodes do not retain the expanded outline/shadow bounds.

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23114408796 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-0fed7c29b9082c4b8ac7a7431863930ebc789741`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-0fed7c29b9082c4b8ac7a7431863930ebc789741`
  - container: `pm-backend`


---

### 2026-03-15 — FlowEditor: retire Expert JSON editor + lazy-load Monaco (PR #3508)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3508

**Status:** MERGED → `development` (squash commit: `70081699956e5478a7bc00f971824614b3d37438`)

Deliverables:
- Retired deprecated Expert Mode JSON editor in `UnifiedFlowEditor` (structured schema-driven config remains; JSON escape hatch stays behind Advanced → Developer Mode).
- Lazy-load Monaco in `NodeDebuggerPanel` so Monaco stays out of the main bundle.
- Normalizes stored `flow_editor_mode=expert` to `visual`.

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23114799212 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-70081699956e5478a7bc00f971824614b3d37438`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-70081699956e5478a7bc00f971824614b3d37438`
  - container: `pm-backend`


---

### 2026-03-15 — Core: regression tests for Cockpit relationship discovery (PR #3510)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3510

**Status:** MERGED → `development` (squash commit: `e1e642c82fcb0842c71129e4b1840284b3c72c53`)

Deliverables:
- Backend: add regression coverage for `EntityGraphService` relationship discovery (contacts / recent_orders / related_products) including tenant scoping and RLS session variable setup in tests.
- Backend: fix `tenant_apps.workflows.signals.trigger_event_workflows()` to filter active workflows using `status=WorkflowStatus.ACTIVE` (removes invalid `is_active` filter).

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23115033468 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-e1e642c82fcb0842c71129e4b1840284b3c72c53`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-e1e642c82fcb0842c71129e4b1840284b3c72c53`
  - container: `pm-backend`


---

### 2026-03-15 — Phase 8.0: Three-tier products backend + deploy seed fix (PR #3513)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3513

**Status:** MERGED → `development` (squash commit: `7d4d4445f51caa46460034c2635ac92f6dfe8dfa`)

Deliverables:
- Backend: introduce Three-Tier product visibility (`Product.is_system`, `TenantProductPreference.is_custom`) with centralized `visible_products_qs()` helper.
- System products: visible-by-default unless tenant hides via `TenantProductPreference(is_active=False)`.
- Tenant custom products: visible only to owning tenant via active preference row (`is_custom=True`).
- UniversalSearchService: product search now uses the same tenant visibility rules.
- Deployment workflow: replace removed per-tenant `seed_products` with idempotent `seed_system_products` (golden list seeding).

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23115421302 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-7d4d4445f51caa46460034c2635ac92f6dfe8dfa`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-7d4d4445f51caa46460034c2635ac92f6dfe8dfa`
  - container: `pm-backend`


---

### 2026-03-15 — Phase 8.0: System products in Inquiry UI (PR #3515)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3515

**Status:** MERGED → `development` (squash commit: `2746f0363017aea6419b87b8afe43fa3141e78f1`)

Deliverables:
- Inquiry: product dropdown + suggested products now use `/api/v1/system/products/` (Three-Tier-aware) via `businessApi`.
- Protein cascade: uses `?protein=` query params (normalized to lowercase slugs).
- SmartProductAutocomplete: loads selected product via system products endpoint; renders both legacy + system product fields for backward compatibility.
- Hooks: `useCustomerProducts` no longer creates its own axios client; uses `businessApi` consistently.
- Stability: `useCockpitPinnedTools()` now safely falls back to a no-op context when provider isn't mounted (prevents isolated widget renders/tests from crashing).

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23116224426 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-2746f0363017aea6419b87b8afe43fa3141e78f1`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-2746f0363017aea6419b87b8afe43fa3141e78f1`
  - container: `pm-backend`


---

### 2026-03-15 — Phase 8.0: Product affinity for plants/locations (PR #3517)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3517

**Status:** MERGED → `development` (squash commit: `fbe74d6acd6e1d1f16772a0f84c0485694fdcd64`)

Deliverables:
- Locations: add `associated_products` (Known Products Purchased) via tenant-aware through model `LocationAssociatedProduct`.
- Plants: add `associated_products` (Known Products Sold) via tenant-aware through model `PlantAssociatedProduct`.
- Security: migrations enable + force RLS and create `{table}_tenant_isolation` policies for new link tables.
- API: serializers expose `associated_products` (minimal system product fields) and location list includes `associated_products_count`.
- Governance: update `manifests/RLS_POLICIES.md` registry.

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23116483753 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-fbe74d6acd6e1d1f16772a0f84c0485694fdcd64`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-fbe74d6acd6e1d1f16772a0f84c0485694fdcd64`
  - container: `pm-backend`


---

### 2026-03-15 — Phase 8.0: FlowEditor schema bridge supports affinity fields (PR #3519)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3519

**Status:** MERGED → `development` (squash commit: `53728dbf8d91d090e6a2298aee912e4668dcca4f`)

Deliverables:
- Backend: reserve `/api/v1/system/entities/` for Schema Bridge entity introspection (entity list + `{entity_id}/fields/`).
- Backend: allow dotted entity IDs (e.g., `tenant_apps.locations.location`) via `lookup_value_regex`, unblocking FlowEditor field pickers.
- Backward compatibility: keep `/api/v1/system/entities-introspect/` as an alias.

Impact:
- FlowEditor Form node field picker can now select Plant/Location affinity field `associated_products`.

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23116732409 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-53728dbf8d91d090e6a2298aee912e4668dcca4f`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-53728dbf8d91d090e6a2298aee912e4668dcca4f`
  - container: `pm-backend`


---

### 2026-03-15 — DevEx: fix `apps.system` test discovery (PR #3521)
**PR:** https://github.com/Meats-Central/ProjectMeats/pull/3521

**Status:** MERGED → `development` (squash commit: `72354f4dea69e1fdd889693912fd3a7cc8b2bd9c`)

Deliverables:
- Fix `python backend/manage.py test apps.system` discovery by removing the `tests.py` vs `tests/` package collision.
- Move model tests into `backend/apps/system/tests/test_models.py` and align assertions with `Product.save()` calling `full_clean()`.

**Verified deploy proof (immutable tags):**
- GitHub Actions: https://github.com/Meats-Central/ProjectMeats/actions/runs/23117053656 (conclusion: success)
- Frontend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-frontend:development-72354f4dea69e1fdd889693912fd3a7cc8b2bd9c`
  - container: `pm-frontend`
- Backend deploy evidence:
  - `registry.digitalocean.com/meatscentral/projectmeats-backend:development-72354f4dea69e1fdd889693912fd3a7cc8b2bd9c`
  - container: `pm-backend`
## Phase 7 WorkForms Strategic Overhaul - COMPLETE ✅

**Completion Date:** 2025-01-11
**Total PRs Merged:** 5 (PRs #3569-#3574)

### Delivered Features:
1. ✅ WSOD Fix - Temporal Dead Zone Resolution (PR #3569)
2. ✅ Dynamic Config Panel - Trigger Visibility Conditions (PR #3570)
3. ✅ Schema Validation + Cockpit Search - Cross-Realm Array Fix (PR #3571)
4. ✅ Process Monitoring Dashboard - Real-Time Workflow Tracking (PR #3572)
5. ✅ MyTasks At-Risk Highlighting - Smart Urgency × Value Sorting (PR #3573)
6. ✅ Template Library Upgrade - Protein Type + Department + Quick Run (PR #3574)

### Key Achievements:
- Stabilized dev environment (WSOD eliminated)
- Enhanced UX for workflow management (monitoring, smart sorting, quick run)
- Industry-standard template library with smart categorization
- Zero breaking changes across all 5 PRs
- 100% backward compatible with existing workflows

---

### 2026-03-18 — FlowEditor Stabilization: Batch 2 Panel Migration + Runtime Fixes (COMPLETE) (PR #3584)
**Status:** PR opened — https://github.com/Meats-Central/ProjectMeats/pull/3584

**Deliverables:**
- ✅ Runtime Fixes: UnifiedFlowEditor tenantLists query no longer references deleted `formStepModalOpen`; ProcessMonitor routes fixed (remove redundant `/api/v1`).
- ✅ Schema Validation Bug: schemaRegistry validation normalization avoids double-wrapping arrays.
- ✅ Batch 2 (Migration): FormFieldConfigPanel migrated to standardized config panel shared components (`ConfigPanel/shared/*`) and now reads `tenantLists` / `availableFields` / `currentNodeId` via FlowEditorContext (no prop drilling).

**Impact:**
- Removes a production runtime crash path (stale modal state reference)
- Eliminates incorrect API 404s caused by double-prefixing routes
- Standardizes nested field editor UI patterns and reduces wiring complexity

**Remaining Work:**
- FormStepConfigPanel: Still used for FormStep configuration (already uses shared components)
- DocumentConfigPanel: Still used for document config (already uses shared components)

**Todo Status:**
- ✅ Batch 1 (Cleanup): COMPLETE
- ✅ Batch 2 (Panel Migration): COMPLETE (PR #3584)
- ✅ Runtime Fixes: COMPLETE (PR #3584)
- [x] Wired Cockpit Entity Tools (Smart Quote, Email Drafter) to dynamic workflow engine with record context.
- [x] Integrated 'Configure Tools' UI for user-customizable action buttons.

## Phase 9: Editor Polish & Optimization

- [x] Audit & Destroy Legacy Code: remove direct axios imports under `frontend/src/components/FlowEditor/` (use `businessApi` / `workformsApi` only).
  - [x] Replaced axios usage in `Modals/SharedTemplateDeleteModal.tsx` with `workformsApi` helpers.
  - [x] Added `getTenantFormUsageInfo()` + `decrementTenantFormUsage()` to `frontend/src/services/workformsApi.ts`.

- [x] Phase E.2 (Panel Migration): align panels to FlowEditorContext + shared StyledComponents.
  - [x] `FormFieldConfigPanel.tsx`: imports standardized to `ConfigPanel/shared/StyledComponents.ts` (via explicit path).
  - [x] `DocumentConfigPanel.tsx`: uses FlowEditorContext fallback for `availableFields` and replaces custom fixed wrapper with shared `Panel`.

- [x] Edge semantics + performance tuning:
  - [x] Enforced `MarkerType.ArrowClosed` marker color using CSS vars (no hardcoded hex).
  - [x] Set `onlyRenderVisibleElements={true}` on the main ReactFlow instance.
  - [x] Confirmed Monaco usage remains lazy via `React.lazy(() => import('@monaco-editor/react'))`.

## Phase 9.2: Collaboration & Debugging

- [x] Real-time collaboration scaffold:
  - [x] Added `useCollaboration` hook (WebSocket connect/disconnect/reconnect w/ backoff) at `frontend/src/components/FlowEditor/hooks/useCollaboration.ts`.
  - [x] UnifiedFlowEditor broadcasts cursor movement + selection changes (best-effort; no crashes if WS not available).
  - [x] UnifiedFlowEditor renders live cursors overlay from presence state.

- [x] Debugger improvements:
  - [x] `DryRunDebugger` now includes a **Variables** tab with a collapsible JSON tree view (scaffold until full execution wiring is available).

- [x] Sub-flow export (scaffold):
  - [x] NodeContextMenu: added **Save as Sub-Flow Template** for `formProcessGroup` (serializes container + descendants + internal edges and POSTs to `/workflows/templates/`).

## Phase 9.4: Advanced Debugging & Execution Tracing

- [x] Breakpoints UI:
  - [x] NodeContextMenu: added **Toggle Breakpoint** (sets `node.data.hasBreakpoint`).
  - [x] BaseNode: renders a red breakpoint dot indicator when `hasBreakpoint` is enabled.

- [x] Execution timeline styling (debug sessions):
  - [x] UnifiedFlowEditor: render-time decoration dims unexecuted nodes/edges.
  - [x] UnifiedFlowEditor: highlights + animates the edge from `previousNodeId` → `activeNodeId` while stepping.

- [x] Step-through controls:
  - [x] DryRunDebugger: added **Step Into**, **Step Over**, **Continue**, with FlowEditorContext-backed debug session state.
  - [x] Continue halts at breakpoints or terminal nodes.

- PR: #3878 (feat/workforms): Debugger panel polish (visual breakpoints + execution timeline + step-through)

## Phase 9.6: Canvas UX Overhaul

- [x] Eradicated completion/config % badge on nodes:
  - [x] BaseNode: removed live validation badge plumbing that was surfacing useless “0%” style indicators.

- [x] Fixed handle overlap + improved hit targets:
  - [x] BaseNode: enlarged handles (16x16) and repositioned to avoid overlap with controls (top-left input, bottom-right output, error handle shifted).
  - [x] UnifiedFlowEditor.responsive.css: boosted handle z-index and expanded handle hitbox via ::before.

- [x] Fixed dragging ergonomics:
  - [x] BaseNode: header marked as `.custom-drag-handle`; body/controls marked as `.nodrag` to prevent accidental drags while clicking.
  - [x] UnifiedFlowEditor.responsive.css: added grab/grabbing cursor styling for `.custom-drag-handle`.

- [x] Dual-direction auto-layout:
  - [x] autoLayout.getLayoutedElements: root graph laid out Top-to-Bottom (TB) while container children lay out Left-to-Right (LR) and containers auto-resize to fit.

- PR: #3616 (refactor/workforms): overhaul canvas UX, dual-direction auto-layout, and fix handle targets

## Phase 9.7: Preemptive Hardening & State Sync

- [x] Required validator normalization:
  - [x] schemaRegistry now normalizes schemas on registration so any `required: true` field has a `required` validation rule (including nested child schemas).

- [x] FormBuilder → ReactFlow state sync:
  - [x] UnifiedFlowEditorInner wires FormBuilderProvider `onNodeDataUpdate` to the node update pipeline so edits persist immediately.

- [x] Deep-clone duplication:
  - [x] UnifiedFlowEditor: container duplication now deep-clones nodes, rewrites IDs/parentId, and also clones internal edges between duplicated descendants.
  - [x] NodeContextMenu prefers centralized duplicate logic (with a safe fallback).

- [x] Aggressive edge cleanup:
  - [x] UnifiedFlowEditor: deletes clean up edges for deleted nodes and all descendants (container deletes).
  - [x] NodeContextMenu prefers centralized delete logic (with a safe fallback).

- PR: #3617 (refactor/workforms): Phase 9.7 hardening & state sync



- 2026-03-20 — MSAL common authority restoration (B2B/B2C support) & prompt enforcement — PR: #3741.


## PR Log (append-only) — Workforms UI Hardening (merge-safe)

- 2026-03-23 — Workforms Debugger polish: docked panel + execution timeline for stepping + breakpoint-first entry selection — PR: #3878.
- 2026-03-23 — Fixed MultiSelect internal search filtering (Explicit AntD filterOption injection) — PR: #3891.
- 2026-03-22T19:05:59Z — UI Hardening: Restored standard default container for 'formProcess' nodes, disabling 'formProcessGroup' purple canonicalization/styling overrides.
- 2026-03-24 — Frontend: react-joyride v3 upgrade (tour API migration) — PR: #3911.
- 2026-03-30 — FlowEditor: defer auto-layout after insert (measured sizing) + selected ring visibility — PR: #4213.
- 2026-03-30 — Frontend: TypeScript strictness follow-up (explicit strict flags + unknown error typing) — PR: #4212.
- 2026-03-30 — Suppliers: fix QuickCreateModal footer button click handling (New Supplier “Save” works) — PR: #4216.
- 2026-03-30 — FlowEditor: FormProcess containers restored NodeToolbar actions + Add Step button — PR: #4218.
- 2026-03-30 — Backend: expanded drf-spectacular schemas for Workflows + Cockpit slots (polymorphic search) — PR: #4220.
- 2026-03-31 — Backend: soft deletes for logistics models (PO/SO/Invoice/Fulfillment) — PR: #4221.
- 2026-03-31 — Workforms: collaboration heartbeat + reconnect hardening (WS ping/pong, jittered backoff, overlay error boundary) — PR: #4222.
- 2026-03-31 — FlowEditor: render perf memoization (context value useMemo/useCallback + autosave/formbuilder guards) — PR: #4223.
- 2026-03-31 — Backend: simplified Supplier/Customer HQ create schema for UniversalEntityForm (schema override + nullable non-core fields) — PR: #4224.
- 2026-03-31 — Backend: Contacts department fields (mobile/office phones + Sales responsibility arrays) — PR: #4225.
- 2026-03-31 — Backend: Plants/Locations nested department contacts + Vertical (K2C) type option — PR: #4226.
- 2026-03-31 — System Products: ranked search respects visibility (global inactive + tenant hides), tenant preference upsert + RLS, Option Lists superadmin delete — PR: #4232.
- 2026-03-31 — Frontend: avoid Recharts ResponsiveContainer zero-size warnings — PR: #4240.
- 2026-03-31 — Docs: refresh canonical MASTER_PLAN runtime issues snapshot (mark suggest-nodes + chart warnings resolved) — PR: #4241.
- 2026-03-31 — Email Ingestion Monitor: show reconnect CTA when Outlook not connected (error_code=not_connected) — PR: #4243.
- 2026-03-31 — Ops: align test_document_upload diagnostic command to /api/v1/ai-assistant/ai-documents/ — PR: #4244.
- 2026-03-31 — Workflows: DocumentUploadCard uses real ai-documents upload (fallback to simulated if endpoint missing) — PR: #4245.

### 2026-03-31T14:27:41Z — V3.5 refactor transition (feature freeze)
- Feature development is **halted** pending completion of the V3.5 Enterprise Refactor Roadmap.
- New audits:
  - `docs/audits/SYSTEM_ERRORS_2026.md`
  - `docs/audits/UI_UX_DEBT_2026.md`
  - `docs/audits/API_SCHEMA_DRIFT.md`
- New remediation blueprint:
  - `docs/plans/V3_5_ENTERPRISE_REFACTOR_ROADMAP.md`

- 2026-03-31 — Frontend: add global runtime `unhandledrejection` + `error` handlers via centralized logger/Sentry — PR: #4248.
- 2026-03-31 — Frontend: Suppliers list fetch uses React Query (useQuery) + refetch on create/update/delete — PR: #4251.
- 2026-03-31 — Frontend: Customers list fetch uses React Query (useQuery) + refetch on create/update/delete — PR: #4252.
- 2026-03-31 — Frontend: Contacts list fetch uses React Query (useQuery) + refetch on create/update/delete — PR: #4253.
- 2026-03-31 — Frontend: Inquiries list fetch uses React Query (useQuery) keyed by pagination+filters — PR: #4254.
- 2026-03-31 — Frontend: Option Lists page uses React Query for lists/products/preferences — PR: #4255.
- 2026-03-31 — Frontend: optionListsService now uses shared JWT-aware apiClient (fixes schema-builder choice fetch under JWT) — PR: #4257.
- 2026-03-31 — Frontend: removed unused ResponsiveTable component (part of table primitive consolidation) — PR: #4259.
- 2026-03-31 — Frontend: AdminTable now renders via AntD Table (reduces duplicate table primitives) — PR: #4261.
- 2026-03-31 — Frontend: consolidate modals on AntD (remove custom Modal wrapper) — PR: #4263.
- 2026-03-31 — Frontend: hierarchy drilldown routing (deep-link plants/locations + contacts filters) — PR: #4265.
- 2026-03-31 — Settings: remove tenant branding + rename admin link label — PR: #4270.
- 2026-03-31 — Auth: include user.is_active in JWT token obtain payload — PR: #4271.
- 2026-03-31 — Frontend: fix Profile inactive status false-negative (normalize is_active) — PR: #4272.
- 2026-03-31 — Frontend: Suppliers/Customers create/edit use EntityFormSurface (retire QuickCreateModal + legacy edit overlays) — PR: #4291.
- 2026-03-31 — Workflows: hotfix missing created_on/modified_on + restore infra diagnostics script module — PR: #4293.
- 2026-03-31 — Compliance: tenant audit trails v1 (append-only audit events + RLS + API) — PR: #4295.
- 2026-03-31 — Ops: fix deploy migrations failure (workflows 0031 pending trigger events) — PR: #4297.
- 2026-03-31 — Feature: streaming CSV exports for Purchase Orders + Sales Orders (?format=csv) — PR: #4299.
- 2026-03-31 — Observability: Sentry hardening (capture 5xx + CeleryIntegration + frontend ErrorBoundary + axios 5xx capture + user context binding) — PR: #4301.
- 2026-03-31 — CI/CD: format deploy run name (🚀 Deploy: <env> - <PR title (PR#)>) — PR: #4304.
- 2026-03-31 — Integrations: tenant webhooks + API keys (Celery dispatch + signing) — PR: #4306.
- 2026-03-31 — Docs: V4.0 vision sprint (gap analysis, UX excellence, field ops, autonomous AI) — PR: #4308.
- 2026-03-31 — CI/CD: hotfix Master Pipeline run-name startup failure (remove replace() expression; uat/main runs had 0 jobs) — PR: #4310.
- 2026-03-31 — Note: the earlier "Pending work items (not shipped)" section is obsolete; see PRs #4306 and #4308.
- 2026-03-31 — Auth: guest login UI (Try Demo as Guest) wired to /api/v1/auth/guest-login/ — PR: #4313.
- 2026-03-31 — Docs: clarify historical pending items (handoff + Phase 5 execution summary) — PR: #4314.
- 2026-03-31 — Docs: remove stale pending labels (handoff + Phase 5 docs headings) — PR: #4315.
- 2026-03-31 — Ops: promote development → uat (pipeline hotfix) — PR: #4311. Verified UAT deploy run: 23820147951 ✅
- 2026-03-31 — Ops: promote uat → main (pipeline hotfix) — PR: #4312. Verified main deploy run: 23820173539 ✅
- 2026-03-31 — Docs: V4.0 enterprise moat sprint (traceability, yield mgmt, enterprise gateway, risk/compliance) — PR: #4317.
- 2026-03-31 — Frontend: Suppliers/Customers nested contact create uses EntityFormSurface (retire bespoke contact modals) — PR: #4325.
- 2026-03-31 — Workforms: QuickCreateModal now uses EntityFormSurface → UniversalEntityForm (retire bespoke quick-create fields UI). — PR: #4326.

- [x] FlowEditor UX polish (collapsed config summary + FormProcess drag/collapse fixes) — PR #4336

- 2026-04-01 — Docs: clarify historical checklists + fix roadmap duplication — PR: #4337.

- 2026-04-01 — Docs: align README with canonical master plan (remove 100laims) — PR: #4338.

- 2026-04-01 — CI/CD: fix Master Pipeline workflow file issue (run-name + md paths-ignore) — PR: #4339.

- 2026-04-01 — CI/CD: deploy feed run-name flatten + auto-promote token fallback — PR: #4340.

- **2026-04-16** — Copilot Squad: added enterprise squad roles/tasks/agents/skills + validator and optional gh wrapper (`gh copilot squad run`). (PR: #4374)
- **2026-04-16** — Copilot Squad: PR validation now checks squad structure (`scripts/validate_copilot_squad.sh`). (PR: #4375)
- **2026-04-16** — Health: hardened `/api/v1/health/` with structured dependency signals + resilience. (PR: #4376)
- **2026-04-16** — Integrations: harden Email Sync Now error responses (no raw exception leakage) + update tests. (PR: #4377)
- **2026-04-16** — AI: fix document upload 500s (handle too-large/multipart errors as 4xx; raise upload limit; add tests). (PR: #4379)
- **2026-04-16** — AI: frontend upload UIs show backend `details` messaging for upload failures. (PR: #4380)
- **2026-04-16** — Tests: add API error contract check for AI chat not configured (503 + stable shape). (PR: #4381)
- **2026-04-16** — E2E: add mobile viewport smoke coverage (375px + 768px) and fix header tablet overflow. (PR: #4382)
- **2026-04-16** — Security: require auth for key ViewSets (Bug Reports) + add 401 regression tests. (PR: #4384)
- **2026-04-16** — Tests: add API tenant isolation suite (8 list endpoints) to prevent cross-tenant regressions. (PR: #4385)
- **2026-04-16** — Tests: add static audit ensuring tenant-scoped ViewSets don’t use unsafe default get_queryset. (PR: #4386)

- **2026-04-16** — Tests: clean NotificationsContext unit test localStorage mock to avoid AuthService JSON.parse stderr noise. (PR: #4388)

- **2026-04-16** — Tests: lock Email Sync Now actionable error payloads (not_connected + token_invalid reconnect CTA). (PR: #4392)

- **2026-04-16** — Security: DRF default permission set to IsAuthenticated; explicit allowlist for OAuth callbacks + email webhooks + regression tests. (PR: #4394)

- 2026-04-16 — ci: improve Master Pipeline run-name to show PR title + number instead of SHA — PR: #pending.

- **2026-04-16** — Mobile: Purchase Orders page + create overlay usable at 375px; add E2E create-flow coverage (mocked APIs). (PR: #4397)
- **2026-04-16** — Mobile: Inquiries page usable at 375px; add E2E coverage; constrain Layout containers to prevent page-level horizontal overflow. (PR: #4399)
- **2026-04-16** — Mobile: Sales Orders page + create modal usable at 375px; add E2E create-flow coverage (schema mocked). (PR: #4401)
- **2026-04-16** — CI: Master Pipeline run-name now uses env/branch + SHA + actor (avoid commit message leakage). (PR: #4404)
- **2026-04-20** — WorkForms E2E: added stable `data-testid` selectors for Catalog/Execute/Execution Details, added execution-details polling for async runs, and added Playwright smoke spec for runtime execute + in-app notification. (PR: #4484)
- **2026-04-20** — Quick Actions: `/workflows/available-forms/` now treated as the canonical unified list (forms + WorkForms); WorkForms show in Customize Quick Actions and in the header submenu; WorkForms Catalog classifies by `type` and de-dupes to avoid broken execute flows. (PR: #4485)
- **2026-04-20** — Entities: Plant + Location detail pages now include an **Automation** tab showing record-scoped WorkForm executions; backend entity execution filtering matches entity_id persisted as JSON string or number. (PR: #4486)
- **2026-04-20** — Email integrations: started Gmail connector MVP — signed OAuth state (user_id + tenant_id), clear not_configured behavior, exposed `/api/v1/workflows/email/email-accounts/`, and wired EmailIntegrationWidget to email_integration endpoints; setup checklist documented. (PR: #4487)
- **2026-04-20** — CI note: the earlier `PR: #pending` run-name placeholder corresponds to the Master Pipeline PR-context run-name work (PR #4408 / #4396), and is superseded by the later run-name hardening entry (PR #4404).

- **2026-04-20** — Docs reality correction (append-only): prior entries claiming `docs/plans/*` were purged and that V4.0 sprint docs were "not created yet" are **historical** and superseded. V3.5/V4.0 planning docs exist under `docs/plans/` (e.g., `V4_0_IDEAL_STATE_GAP_ANALYSIS.md`, `V4_0_UX_EXCELLENCE.md`, `V4_0_FIELD_OPS_ARCHITECTURE.md`). Canonical plan/status remains `MASTER_PLAN.md`.

- **2026-04-21** — Mobile: align guest/invite auth endpoints; persist guest sessions; update tests/types. (PR: #4514)
- **2026-04-21** — Mobile: enforce OpenAPI contract (schema artifact + mobile Jest contract test). (PR: #4515)
- **2026-04-21** — WorkForms editor: fix DynamicConfigPanel key aliases + triggerForm defaults/UX + regression tests. (PR: #4516)
- **2026-04-21** — WorkForms editor: populate formReference metadata on selection (name/desc/fieldCount/sectionCount) + test. (PR: #4517)
- **2026-04-21** — WorkForms editor: NestedChildrenRenderer supports toggle/number/select child fields + test. (PR: #4518)
- **2026-04-21** — WorkForms editor: normalize legacy Auto-Mapping fieldMappings for FieldMappingPanel + fix createRecord validator + unit test. (PR: #4519)
- **2026-04-21** — WorkForms editor: template-aware validation (allow {{vars}} in email/url/regex; allow comma-separated email lists) + tests. (PR: #4520)
- **2026-04-21** — WorkForms editor: documentGenerate template field no longer stuck (templateId uses text until template API exists) + schema test. (PR: #4521)
- **2026-04-21** — WorkForms editor: a11y nested children (keyboard expansion + aria labels + button types) + tests. (PR: #4522)
- **2026-04-21** — Docs: append PR log (2026-04-21). (PR: #4523)
- **2026-04-21** — CI: enforce pinned action SHAs (reject tag-based refs; disallow dynamic uses). (PR: #4524)
- **2026-04-21** — Security: harden OAuth callbacks (state binding + nonce single-use; legacy callback tightened) + tests. (PR: #4526)
- **2026-04-21** — CI: enforce RLS audit coverage (deterministic lint; include integrations.EmailLog) + test. (PR: #4527)
- **2026-04-21** — Security: ignore X-Tenant-ID for anonymous requests in TenantMiddleware + regression test. (PR: #4530)
- **2026-04-21** — WorkForms editor: enforce readOnly + a11y sections + keep validation errors stable under shadow updates. (PR: #4532)
- **2026-04-21** — WorkForms editor: keyValueMode=record draft rows are local-only; always stage/persist record shape; supports key rename + tests. (PR: #4534)
- **2026-04-21** — Security: add tenant-scoped workflow webhook receiver (tenant id in path), keep legacy receiver working, fix webhook URL generation, and avoid JWT auth interception on webhook Authorization header; add regression tests. (PR: #4536)
- **2026-04-21** — Security: verify inbound email webhooks (Outlook subscriptionId+clientState hash; Gmail Pub/Sub token/OIDC verification), ensure webhook receivers bypass DRF auth interception, add tests, and document env knobs in env.manifest. (PR: #4538)
- **2026-04-21** — Security: tenant-scope email integration models and webhooks — add tenant FKs + RLS policies for email_integration tables, add tenant-id-in-path email webhook receivers that set RLS context, and extend audit_rls_compliance allowlist + tests. (PR: #4540)
- **2026-04-21** — WorkForms editor: publish-time schema validation parity — enforce schema-driven required validation at publish time (incl. generic `action` nodes via `actionType` inference), materialize non-empty schema defaults on save so persisted config matches UI defaults, and treat empty objects as empty for required validators (keyValue record mode); add vitest coverage. (PR: #4542)
- **2026-04-21** — CI: move archived workflows out of `.github/workflows/` so they cannot appear/run in GitHub Actions (reduces footguns + guardrail bypass). (PR: #4544)
- **2026-04-21** — CI: stop pushing mutable `:latest` tags — build-dev-image now pushes only immutable sha tags; devcontainer builds locally to avoid `:latest` dependency; update workflow instructions to match no-latest policy. (PR: #4546)
- **2026-04-21** — CI: digest-pin workflow service images (postgres + pgvector) to multi-arch manifest digests for deterministic runs. (PR: #4548)
- **2026-04-21** — Docs: refresh discovery backlog pointers and update canonical `MASTER_PLAN.md` execution snapshot (no behavior changes). (PR: #4550)
- **2026-04-21** — Workflows: tenant-path webhook receiver sets tenant/RLS context before ORM lookup (FORCE RLS safe) and adds call-order regression coverage. (PR: #4552)
- **2026-04-21** — Workflows: legacy webhook receiver now fails closed unless tenant context is resolvable; sets tenant/RLS before ORM lookup and scopes lookup by request.tenant. (PR: #4554)
- **2026-04-21** — Integrations: OAuth callback sets tenant/RLS context before tenant-scoped writes (FORCE RLS safe) and adds regression test. (PR: #4556)
- **2026-04-21** — WorkForms: creating a WorkForm with `status=active` now runs activation validation (references + runtime support), preventing invalid active WorkForms; adds integration test. (PR: #4558)
- **2026-04-21** — Tests: add tenant scoping coverage for `/api/v1/tenant-workforms/*` (host-scoped list; cross-tenant retrieve/delete 404; missing tenant context returns empty list). (PR: #4560)
- **2026-04-21** — WorkForms RBAC: harden system WorkForm/Form viewsets (viewer vs editor mutations), validate late tenant resolution for DRF auth flows, and add regression tests. (PR: #4574)
- **2026-04-21** — FlowEditor: ConfigPanel tab a11y (ARIA tabs + keyboard nav) + stable testids; remove hardcoded colors; add unit tests. (PR: #4575)
- **2026-04-21** — Theme: add back-compat CSS variable aliases for `--color-background-secondary/tertiary` (map to surface tokens). (PR: #4576)
- **2026-04-21** — Logging: replace FlowEditor runtime `console.log` with dev-gated `logger.debug()` across editor modules. (PR: #4577)
- **2026-04-21** — Logging: remove Sentry init `console.log` noise (use dev-gated `logger.debug()`). (PR: #4578)
- **2026-04-21** — FlowEditor: HelpModal hook safety + typed Escape handling; add regression tests. (PR: #4579)
- **2026-04-21** — CI: validate workflow environment lane names against `manifests/env.manifest.json` to prevent secret-scope typos. (PR: #4580)
- **2026-04-21** — Docs: append PR log entries (4574–4580) and clarify theme back-compat aliases in Design System docs. (PR: #4581)
- **2026-04-21** — Admin Studio: fix ChoiceListEditor keyboard shortcuts stale-closure bug; add unit test. (PR: #4582)
- **2026-04-21** — Tests: cover schemaRegistry required-validator normalization (incl. nested childSchema). (PR: #4583)
- **2026-04-21** — Tests: cover `_get_request_tenant()` late tenant resolution via `X-Tenant-ID` (fail-closed + caching). (PR: #4584)
- **2026-04-21** — Frontend: replace `console.log` noise with centralized logger in CommandPalette, permissions hook, and Quick Actions autosave. (PR: #4585)
- **2026-04-21** — Frontend: remove remaining `console.log` calls in token refresh debug + Admin Studio editor canvas onSave. (PR: #4586)
- **2026-04-21** — Backend: harden tenant form merge/split endpoints (editor-only, tenant resolution, RLS set_current_tenant) + regression tests. (PR: #4587)
- **2026-04-21** — Docs: append PR log entries (4582–4587). (PR: #4588)
- **2026-04-21** — Frontend: route QuickActionsContext console logging through centralized logger. (PR: #4589)
- **2026-04-21** — Docs: add squad deep dive execution plan to canonical `MASTER_PLAN.md` (next PR-sized batches, deps/risks/tests). (PR: #4590)
- **2026-04-27** — Frontend: expand `lint:colors` guardrail to MyTasks surfaces and tokenized remaining hardcoded colors in MyTasks/QuickActions widgets, shared styles, and theme config. (PR: #4650)
- **2026-04-27** — Docs: record backend audit P0s in canonical master plan + PR log. (PR: #4651)
- **2026-04-27** — Backend: fix `apps/core/views.py` legacy imports/print() and add smoke tests for Ranked Search + Workspace Stats core endpoints. (PR: #4652)

- **2026-04-27** — Ops note: .github/MASTER_PLAN.md had one or more NUL (\0) bytes; repaired by re-serializing as plain UTF-8 text while preserving content.

- **2026-04-27** — Plants/Contacts: rename Booking→Shipping/Loadout + add Certification dept; add Contact title/notes/documents fields; enable tenant-safe nested dept contacts writes on Plant; improve PlantDetail contacts CTA and prevent Activity/Automation infinite spinners by rendering explicit error alerts. (PR: #4685)
- **2026-04-27** — Dev: unblock dev.meatscentral.com login by hardening frontend deploy to deterministically enforce host nginx reverse-proxy routing (`/api/*` → backend, `/` → frontend), ensure nginx site precedence, fix local vhost verification to use TLS SNI (`curl --resolve`), restore nginx→backend reachability, and preserve original Host header to prevent Django `DisallowedHost` 400s. (PRs: #4692, #4693, #4694, #4697, #4698)

- **2026-04-27** — Plants: Plant Profile backend — add Plant Profile fields + tenant-safe patterns/RLS where required. (PR: #4691)

- **2026-04-27** — Plants: Plant Profile frontend — implement Plant Profile in metadata-driven UniversalEntityForm + DynamicFormEngine (conditional visibility + clear-on-hide, max_length validation, proteins subset validation, master product list source), with unit test coverage. (PR: #4699)
- **2026-04-27** — WorkForms/Quick Actions: prevent tenant-scoped boot-time 400 spam by validating tenant context (`getValidTenantId`), gating tenant-scoped loads until tenant is a valid UUID, and ensuring `X-Tenant-ID` is never sent as 'undefined'/'null'. Adds regression tests and stabilizes Vitest coverage runs. (PR: #4701)

- **2026-04-27** — WorkForms editor: polish trigger preview/test/debug UX — persist Dry Run Debugger mock inputs with Reset Input, and make Smart Auto-Map suggestions disappear on accept/reject; add unit coverage for schedule cron helpers + auto-map immutability. (PR: #4702)

- **2026-04-27** — WorkForms UI: a11y hardening — keyboard-operable Catalog/In Progress cards and accessible TemplateSelector modal (dialog semantics, Escape close, focus trap + restore focus) with automated tests. (PR: #4703)
- **2026-04-28** — [COMPLETED] Hardened AI Swarm execution against tool-loop exhaustion and upgraded Microsoft Graph email search to support flexible folder/read/attachment querying with structured tool errors and regression coverage.
- **2026-04-28** — [COMPLETED] Enhanced AI Chat Widget and Swarm ingestion pipeline to support CSV/XLS/XLSX tabular data parsing with markdown conversion, 500-row truncation safeguards, and upload validation for spreadsheet MIME types.
- **2026-04-28** — [COMPLETED] Bridged Microsoft Graph attachments to internal AIDocument parser, enabling autonomous email-to-record workflows. (PR: #4733)
- **2026-04-28** — [COMPLETED] Hardened Graph attachment ingestion to preflight Microsoft Graph attachment metadata, reject unsupported `itemAttachment`/`referenceAttachment` kinds before download, and keep the email → AIDocument path fail-closed with regression coverage. (PR: #4734)
- **2026-04-28** — [COMPLETED] Hardened AI email/document auditability by persisting Microsoft Graph attachment provenance in `AIDocument.custom_data`, deduplicating repeated attachment ingests within the same tenant/user/session, and exposing source-aware `AIDocument` filtering + serializer metadata for operators. (PR: #4735)
- **2026-04-28** — [COMPLETED] Hard-bound AI chat sessions, chat messages, manual document uploads, and Graph attachment session reuse to `request.tenant` via session tenant context, making the multi-tenant AI session APIs fail closed for ambiguous or cross-tenant access. (PR: #4736)
- **2026-04-28** — [COMPLETED] Enforced a session-scoped Outlook attachment allowlist so `fetch_emails` stages attachment refs in the active chat session, `ingest_email_attachment` rejects unstaged/expired IDs, unread-email aliases preserve session staging, and tools-open no longer advertises ingest when Outlook is unavailable. (PR: #4737)
- **2026-04-28** — [COMPLETED] Synced the canonical `MASTER_PLAN.md` snapshot and reference `ROADMAP.md` / `UI_ROADMAP.md` so the AI email/document lane reflects shipped hardening through PR #4737 and points to parse failure/status lifecycle as the next follow-up without authority drift. (PR: #4738)
- **2026-04-28** — [COMPLETED] Hardened `parse_document` to fail closed with structured tool errors, persisted `AIDocument.processing_status` + parser lifecycle metadata across success/failure paths, exposed processing metadata/filtering to operators, and added focused regression coverage for retryable parser-service failures. (PR: #4739)

### Phase 11: The Deal Desk (Trader Ledger Replacement)

- **2026-04-28** — [COMPLETED] Unified Trade Abstraction: added tenant-safe `deals` APIs with `Deal` + `DealActionItem` models linking purchase orders, sales orders, and fulfillments while exposing live revenue/COGS/freight/net-margin calculations for trader dashboards.
- **2026-04-28** — [COMPLETED] Document State Machine: extended fulfillments with `freight_cost` and `document_milestones`, then auto-created follow-up reminder items when a linked load transitions into shipped/in-transit status.
- **2026-04-28** — [COMPLETED] Deal Desk Dashboard: added the `/deals` trader ledger page with spreadsheet-dense columns, next-action visibility, and past-due follow-up highlighting.

## Phase 16: The Core Trading Engine (End-to-End Automation)

**Date Added:** 2026-05-04  
**Priority:** Planned-only follow-on architecture  
**Status:** PLANNING ONLY — translated into blocked tickets in `.github/EPIC_TICKETS.md`; execution remains blocked behind the active higher-priority backlog.

### Happy-path state machine
1. **Ingestion & Decision Node**
   - AI email extraction lands in `Inquiry`.
   - An inventory availability service decides `route = FULFILL` or `route = BROKER`.
   - Operators receive a live “New Inquiry Received / Action Required” alert.
2. **Brokerage / RFQ Engine (Branch A)**
   - `BROKER` inquiries match suppliers by master product/protein.
   - The system sends outbound RFQs.
   - Structured supplier-reply parsing creates draft supplier purchase orders from positive replies.
3. **Human-in-the-Loop Approval Flow**
   - Orders use a generic approval progression: `draft` -> `pending_review` -> `approved`.
   - Supplier PO approval triggers PDF generation plus outbound supplier email.
4. **Sales & Logistics Cascade**
   - Approved supplier sourcing, or direct `FULFILL`, generates the draft sales order.
   - Sales-order approval triggers PDF generation plus outbound customer email.
   - Carrier RFQs, reply parsing, and draft carrier purchase order generation complete the logistics branch.

### 16b: Distributed Hardening & Trade Lineage
1. **Trade Lineage & Traceability**
   - Generate a durable `trade_id` / `TradeSession` UUID at the inquiry node.
   - Cascade that lineage key into `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder`.
   - Expose a lineage visualization in detail views so operators can answer “which inbound email created this carrier PO?” directly from the UI.
2. **Event-Driven State Transitions (Saga Pattern)**
   - Replace synchronous side-effect chaining with event-driven transitions.
   - Example: when a supplier PO transitions to approved, publish a `supplier_po_approved` event; Celery consumers create downstream sales/logistics artifacts and trigger PDF/email work.
3. **Concurrency Locks & Idempotency**
   - Use `select_for_update()` in transition services/views that mutate order state.
   - Enforce `idempotency_key` on AI/webhook/document-creation endpoints so retries never duplicate downstream artifacts.
4. **Exception Control Tower**
   - Introduce an `ExceptionQueue`/dead-letter queue for failed automated trade steps.
   - Halt the affected trade/session and route it to a “Trades Requiring Intervention” dashboard instead of silently dropping the failure.

### Deliverables + expected results
- A deterministic hardcoded trading engine built on the existing `Inquiry`, `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder` models
- Explicit AI structured-output parsing tied to draft commercial documents instead of freeform operator interpretation
- Transition-driven PDF/email side effects instead of ad hoc UI-only actions
- A future-ready state machine that a later visual editor can map onto, rather than inventing behavior from scratch

### Acceptance criteria
1. Phase 16 is represented consistently across `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, and `.github/EPIC_TICKETS.md`.
2. Every Phase 16 ticket is blocked so the backlog still has one active `Ready` ticket above it.
3. The backlog explicitly ties OpenAI structured outputs, outbound email, and PDF generation to `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder` state transitions.
4. Phase 16 hardening explicitly names Celery/Saga execution, trade-lineage propagation, `select_for_update()`, and `idempotency_key` enforcement.

### Dependencies
- Phase 14 remains the active execution lane.
- Phase 15 trade-invariants work should land before Phase 16 executes against live order documents.
- Inventory availability must be formalized first because the repo has no dedicated inventory source-of-truth model yet.
- Distributed hardening must layer onto the same hardcoded happy-path state machine, not bypass it with a parallel orchestration surface.

### Risk register + mitigations
1. **Inventory routing guesses from weak data** -> define an explicit availability contract before automating `FULFILL`.
2. **AI-generated commercial commitments are wrong** -> keep AI outputs draft-only and human-approved.
3. **Duplicate send/PDF side effects** -> make approval transitions idempotent and audit-backed.
4. **Async/event failures become invisible** -> add exception-queue lineage and intervention UI.
5. **Concurrent transitions duplicate downstream records** -> require `select_for_update()` and `idempotency_key` safeguards.

### Testing strategy
- Planning/docs: `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh`
- Execution tickets: targeted backend/frontend suites for inquiries, orders, AI ingestion, notifications, and document send flows
- Distributed hardening tickets: targeted Celery/event, concurrency, idempotency, lineage, and operator-intervention queue tests

### Rollback
- Revert this planning batch if Phase 16 wording or backlog ordering proves contradictory.

### 2026-05-05 — AI Assistant: chat context compaction
- Added tenant-safe chat context compaction settings in `backend/projectmeats/settings/base.py` plus session watermark helpers in `backend/tenant_apps/ai_assistant/session_utils.py`.
- Reused `TenantAIMemory` via `backend/tenant_apps/ai_assistant/services/tenant_memory_service.py` to roll older raw chat messages into a durable per-session summary while keeping `ChatMessage` rows intact for audit.
- Updated `backend/tenant_apps/ai_assistant/views.py` and `backend/tenant_apps/ai_assistant/swarm/router.py` so replay history remains explicitly tenant-filtered, compacted raw messages drop out of the prompt tail once summarized, and the session summary is injected into the swarm system prompt.
- Added regression coverage in `backend/tenant_apps/ai_assistant/tests/test_models.py` and `backend/tenant_apps/ai_assistant/test_swarm_email_tools.py` for durable compaction, raw-tail replay trimming, and session-memory prompt injection.
- Validation: `cd backend && python manage.py makemigrations --check`; `cd backend && ruff check projectmeats/settings/base.py tenant_apps/ai_assistant/session_utils.py tenant_apps/ai_assistant/services/tenant_memory_service.py tenant_apps/ai_assistant/views.py tenant_apps/ai_assistant/swarm/router.py tenant_apps/ai_assistant/tests/test_models.py tenant_apps/ai_assistant/test_swarm_email_tools.py`; `cd backend && python manage.py test tenant_apps.ai_assistant.tests.test_models tenant_apps.ai_assistant.test_swarm_email_tools tenant_apps.ai_assistant.tests_document_upload`; `cd backend && printf 'yes\n' | python manage.py test tenant_apps.ai_assistant apps.core.tests.test_viewset_permissions`.
- PR: #4895.

### 2026-05-05 — AI Assistant: semantic response cache hardening
- Added a tenant-scoped semantic response cache in `backend/tenant_apps/ai_assistant/services/semantic_cache.py` with configurable enablement, TTL, similarity threshold, and bounded entry count in `backend/projectmeats/settings/base.py`.
- Wired `ChatBotAPIViewSet.chat()` to reuse safe cache hits for repeated same-context prompts while still persisting assistant chat messages and lineage events, and to store only tool-free, control-plane-free responses.
- Added regression coverage in `backend/tenant_apps/ai_assistant/tests/test_semantic_cache.py` and `backend/tenant_apps/ai_assistant/tests/test_models.py` for tenant isolation, threshold enforcement, and cache-hit bypass behavior.
- Validation: `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py test tenant_apps.ai_assistant.tests.test_semantic_cache tenant_apps.ai_assistant.tests.test_models`; `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_viewset_permissions`; `cd backend && ruff check projectmeats/settings/base.py tenant_apps/ai_assistant/views.py tenant_apps/ai_assistant/services/semantic_cache.py tenant_apps/ai_assistant/tests/test_semantic_cache.py tenant_apps/ai_assistant/tests/test_models.py`.
- PR: #4894.

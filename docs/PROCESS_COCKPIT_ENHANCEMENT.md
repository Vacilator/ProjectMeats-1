# Process Cockpit Enhancement Specification

**Version:** 1.0
**Last Updated:** 2026-05-07
**Phase:** 18 (Process Intelligence Scale & Self-Service Operations)
**Canonical Reference:** `MASTER_PLAN.md` → Phase 18 / Epic RT-06

---

## RT-06: Intelligent Notifications & Global Quick Action Center

### Overview

The Process Cockpit gains two major capabilities:
1. **Intelligent Notification Service** — real-time in-app and email notifications routed to the correct contact based on Plant Contact Type and Responsibilities
2. **Quick Action Center** — persistent panel providing context-appropriate one-click actions on every entity and in the cockpit

### Notification Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Telemetry Event Bus                      │
│  (from EndToEndInquiryToPOProcess template execution)    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Notification Router Service                  │
│                                                          │
│  1. Receive telemetry event                              │
│  2. Resolve event category (financial, procurement, qa)  │
│  3. Look up Plant Contact Type + Responsibilities        │
│  4. Apply user preference filter (realtime/digest/off)   │
│  5. Dispatch to delivery channel                         │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────┐                  ┌──────────────────┐
│  In-App Push  │                  │  Email (Digest)   │
│  (WebSocket)  │                  │  (Celery Beat)    │
└──────────────┘                  └──────────────────┘
```

### Event-to-Contact Routing Matrix

| Process Event | Category | Target Contact Type |
|---------------|----------|-------------------|
| New Bid Received | Procurement | Procurement / Sales |
| Due Date Approaching (48h) | Operations | Process Owner |
| Due Date Approaching (24h) | Operations | Process Owner + Manager |
| PO Received | Finance | Accounting |
| Approval Needed | Governance | Per ApprovalGate config |
| Process Failure | Operations | Process Owner + IT |
| Invoice Generated | Finance | Accounting |
| Margin Alert (< threshold) | Finance | Accounting + Manager |
| Supplier Response Timeout | Procurement | Procurement |
| Order Value Threshold Exceeded | Finance | Finance + Manager |

### Fallback Rules

1. If no matching Plant Contact Type found → notify Process Owner
2. If Process Owner unavailable → notify tenant admin
3. If notification delivery fails → retry 3x with exponential backoff, then log to failed notifications queue

### Quick Action Center Specification

#### Panel Behavior
- Persistent right-side panel (collapsible) in Process Cockpit
- Floating action button on entity detail pages
- Actions are **context-aware**: only show actions valid for current entity state
- Maximum 5 visible actions; overflow into "More Actions" dropdown

#### Action Registry (Initial Set)

| Action | Entity Context | Required State | API Call |
|--------|---------------|----------------|----------|
| Approve Bid | Bid | pending_review | `POST /api/v1/bids/{id}/approve/` |
| Reject Bid | Bid | pending_review | `POST /api/v1/bids/{id}/reject/` |
| Send RFQ | Inquiry | supplier_matched | `POST /api/v1/inquiries/{id}/send-rfq/` |
| Generate SO | Bid | approved | `POST /api/v1/bids/{id}/generate-so/` |
| Approve PO | PurchaseOrder | pending_approval | `POST /api/v1/purchase-orders/{id}/approve/` |
| Reject PO | PurchaseOrder | pending_approval | `POST /api/v1/purchase-orders/{id}/reject/` |
| Escalate | Any | any_blocked | `POST /api/v1/processes/{id}/escalate/` |
| Mark Received | PurchaseOrder | sent | `POST /api/v1/purchase-orders/{id}/mark-received/` |
| Retry Failed Step | Process | failed | `POST /api/v1/executions/{id}/retry/` |

#### Action Component Structure

```typescript
interface QuickAction {
  id: string;
  label: string;
  icon: ReactNode;
  entityType: EntityType;
  requiredState: string | string[];
  apiEndpoint: string;
  method: 'POST' | 'PUT';
  confirmationRequired: boolean;
  confirmationMessage?: string;
  successNotification: string;
}
```

### User Preference Model

```python
# Stored in UserPreferences.custom_data (no schema change)
{
  "notification_preferences": {
    "procurement_events": "realtime",    # realtime | daily_digest | weekly_digest | off
    "financial_events": "daily_digest",
    "operations_events": "realtime",
    "governance_events": "realtime",
    "failure_events": "realtime"         # failure always defaults to realtime
  },
  "digest_time": "08:00",               # UTC time for digest delivery
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "07:00"
  }
}
```

### Performance Requirements

- Notification delivery: < 60s from event to in-app display
- Quick Action execution: < 2s including confirmation
- Panel load time: < 500ms
- Email digest compilation: < 30s for up to 100 events

### Testing Requirements

See `docs/FORM_PROCESS_TESTING_GUIDE.md` for the full RT-06 test matrix (to be added during implementation).

Key scenarios:
1. Notification routes to correct contact by Plant Contact Type
2. User preference "off" suppresses notification
3. Digest aggregates correctly at configured time
4. Quick Action panel shows only valid actions for entity state
5. Quick Action execution succeeds and triggers state transition
6. Fallback routing when no matching contact found
7. Cross-tenant isolation for all notifications

---

## Related Enhancements (Phase 18)

### RT-07: Approval Gate Visualization

The Process Cockpit React Flow diagram will highlight ApprovalGate nodes:
- **Amber** when pending approval
- **Green** when approved
- **Red** when rejected
- Click opens approval detail panel with one-click approve/reject

### RT-08: Financials Tab (Sprint Package 13 — Real-Time Margin & Risk Dashboard)

New tab in Process Cockpit showing:
- Per-trade: margin %, outstanding amount, payment status
- Aggregated: total portfolio outstanding, average margin, overdue count
- Drill-down from summary to individual orders

**Sprint Package 13 Implementation Detail:**
1. **Live React Flow Node Metrics:** Every entity node in the process flow diagram shows real-time calculated fields in its header: Margin %, Outstanding Amount, Credit Risk Indicator (green/amber/red), Supplier Risk Score (0-100)
2. **Financial Snapshot Panel:** Persistent right-side panel in Cockpit with auto-refresh (reuse existing 15s polling pattern):
   - Per-trade breakdown: cost basis, sell price, margin ($ and %), payment terms, aging bucket
   - Risk indicators: credit limit utilization, supplier payment history score, currency exposure
3. **Entity Detail Page Headers:** Embed financial metrics in every SO/PO/Inquiry detail page header (mini bar chart + key numbers)
4. **Accounting Contact Routing:** When invoice/statement is generated, route notification to contacts with Plant Contact Type = "Accounting" or Responsible For includes "Invoicing"
5. **Drill-down Navigation:** Click aggregate metric → filtered trade list → click trade → React Flow with highlighted financial node → click node → entity detail with full financial history
6. **Export:** CSV/PDF export of both per-trade and aggregate views (reuse existing export pattern)

### RT-09: Analytics View

New view in Process Cockpit with charts:
- Win-rate by supplier (bar chart)
- Average margin trend (line chart)
- Process cycle time distribution (histogram)
- Top contacts by activity (leaderboard)

---

**Document Version:** 1.0
**Last Updated:** 2026-05-07
**Authority:** `MASTER_PLAN.md` → Phase 18

---

## Premium Process Cockpit Redesign (Shipped)

**Shipped:** 2026-05-07
**PR:** Cockpit Redesign + AI Parsing Overhaul

### Design Philosophy

The Process Cockpit has been completely redesigned as a **premium command center** inspired by Linear.app and top trading platforms. Key principles:

- **Spacious card-based layout** with generous whitespace (no cramped tables)
- **Smart navigation bar** replacing basic tabs — clear visual hierarchy
- **Two-column Activity view** with detail panel showing React Flow + Quick Actions
- **"Last synced" indicator** always visible in the header
- **Global search** filtering across entities, POs, suppliers
- **Real-time updates** via React Query polling (30s activity, 60s badges)

### Route & Layout

- **Route:** `/process-cockpit` (unchanged)
- **Sections:** Live Activity • AI Inbox • Drafts • History • Tasks
- **Detail Panel:** Opens on right side with ProcessFlowHeader + TradeLineageFlow + Quick Actions
- **Responsive:** Collapses to single column below 1024px

### Key UI Components

| Component | Purpose |
|-----------|---------|
| `NavBar` + `NavItem` | Segmented control with badge counts |
| `ActivityCard` | Clickable row with icon, title, meta, status dot |
| `DetailPanel` | Right-side panel with close button + React Flow |
| `SyncIndicator` | Header badge showing "Synced Xm ago" |
| `SearchBar` | Ant Design Input with Search icon and clear |

### AI Email Parsing Enhancements (Shipped Same Batch)

Added to `email_parser.py`:
- **Total amount extraction** — contextual and standalone dollar amounts
- **Customer/buyer name extraction** — "Customer:", "Buyer:", "Sold To:" patterns
- **Logistics extraction** — incoterms (FOB, CIF, etc.) + ship from/to locations
- **Enhanced date patterns** — ETA, arrival, due date support
- **Customer dependency resolution** — full chain: Supplier → Customer → Contact → Plant

New fields on `ParsedTradeEmail`:
- `total_amount`, `currency`, `customer_name`, `incoterm`, `ship_from`, `ship_to`

### Email Sync Status

The 15-minute auto-sync + instant login refresh was already implemented in:
- `AIInboxSyncContext.tsx` — 15-min interval + login trigger
- `watchdog.py` — Celery task polling all tenants

**New:** The "Synced Xm ago" indicator in the cockpit header provides user-visible confirmation that sync is working.

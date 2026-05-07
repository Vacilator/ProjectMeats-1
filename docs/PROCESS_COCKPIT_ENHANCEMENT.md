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

### RT-08: Financials Tab

New tab in Process Cockpit showing:
- Per-trade: margin %, outstanding amount, payment status
- Aggregated: total portfolio outstanding, average margin, overdue count
- Drill-down from summary to individual orders

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

# Forms & Flows Enhancement Plan
## Integrating Workflows into Workspace with Action-Aware Status Tracking
## + Cockpit Command Center: The Ultimate Trading Control Surface

**Status**: 🚧 IN PROGRESS  
**Category**: Plans  
**Last Updated**: 2026-02-01

---

## Executive Summary

Transform the ProjectMeats workspace into a **Cockpit Command Center** - a high-tech, pilot-inspired control surface that empowers meat brokers/traders/salespeople to operate their business with maximum efficiency, control, and situational awareness.

### Vision Statement

> *"Like a modern aircraft cockpit - every control at your fingertips, every piece of critical information visible at a glance, seamless workflow execution, and intelligent assistance that anticipates your needs."*

### Core Transformations

1. **🎯 Cockpit Command Center** - Replace Dashboard with an immersive, customizable command center
2. **📞 Calls** - Rename "Call Log" to "Calls" with complete UI/UX overhaul
3. **📋 Forms & Flows** - Unified workflow experience with action-aware status tracking
4. **🔍 Universal Search** - All-in-one search bar for any business entity
5. **🕸️ Entity Graph** - Mind-mapping-style relationship visualization and navigation
6. **🎛️ Widget System** - Customizable, draggable widgets/tools with templates
7. **⚡ Quick Actions Integration** - Custom form flows accessible from anywhere
8. **🔗 Inline Editing** - Edit any entity without leaving context

### Key Design Principles

| Principle | Description |
|-----------|-------------|
| **INTUITIVE** | Zero learning curve - actions feel natural |
| **SMART** | AI-assisted suggestions, auto-complete, predictive actions |
| **SIMPLE** | Clean, uncluttered UI with progressive disclosure |
| **EFFICIENT** | Minimal clicks, keyboard shortcuts, batch operations |
| **DYNAMIC** | Real-time updates, responsive to user context |
| **POWERFUL** | Deep functionality accessible without complexity |
| **IDEAL** | Optimized for meat broker/trader workflows |
| **EXTENSIBLE** | Plugin-ready architecture for future enhancements |

---

## Gap Analysis (Identified Issues)

### Backend Gaps
| Gap | Impact | Solution |
|-----|--------|----------|
| No status change history | Can't audit who/when/why status changed | Add `FormStatusHistory` model |
| No assignment model | Can't assign tasks to specific users | Add `StepAssignment` model |
| No notification model | Can't send targeted user notifications | Add `UserNotification` model |
| No pending items endpoint | Can't efficiently fetch action items | Add `/action-items/` endpoint |
| No badge counts endpoint | Sidebar can't show counts | Add `/action-items/counts/` endpoint |
| No universal search endpoint | Can't search across all entities | Add `/search/universal/` endpoint |
| No entity graph endpoint | Can't fetch relationships | Add `/entities/{id}/graph/` endpoint |
| No widget config storage | Can't persist user layouts | Add `CockpitLayout` model |

### Frontend Gaps
| Gap | Impact | Solution |
|-----|--------|----------|
| NavigationItem lacks badge | Can't show counts in menu | Extend interface |
| Sidebar doesn't render badges | No visual indicator | Add badge component |
| No real-time updates | Badge counts stale | Add polling or WebSocket |
| No notification bell | Users miss alerts | Add NotificationBell component |
| No preference management | Can't configure notifications | Add preferences page |
| Dashboard is static | Not customizable | Replace with Cockpit |
| Call Log outdated | Poor UX, limited features | Rebuild as "Calls" |
| No entity graph visualization | Can't explore relationships | Add EntityGraph component |
| No universal search | Must navigate to find data | Add CommandPalette |

### UserPreferences Gap
The existing `UserPreferences` model in `apps/core/models.py` handles theme/layout but **NOT** notification preferences or cockpit layout. Need to extend.

---

## Current State Analysis

### Navigation Structure (Current)
```
├── Workspace
│   ├── Dashboard       ← TO BE REPLACED WITH COCKPIT COMMAND CENTER
│   ├── Call Log        ← TO BE RENAMED "Calls" + COMPLETE OVERHAUL
│   └── Reports
├── Workflows (separate section)
│   ├── Catalog
│   └── Monitor
```

### Existing Components
| Component | Location | Purpose | Fate |
|-----------|----------|---------|------|
| Dashboard.tsx | pages/ | Static stats view | → Replace with Cockpit |
| CallLog.tsx | pages/Cockpit/ | Call scheduling | → Overhaul as "Calls" |
| Cockpit.tsx | pages/ | Legacy command center | → Merge into new Cockpit |
| WorkflowList.tsx | pages/Workflows/ | "App Store" view | → Move to Forms & Flows |
| WorkflowMonitor.tsx | pages/Workflows/ | Execution tracking | → Move to Forms & Flows |
| MySubmissions/index.tsx | pages/MySubmissions/ | User's form submissions | → Merge into Cockpit |
| FormSubmissionModal.tsx | components/FormSubmission/ | Multi-step form UI | → Keep, enhance |
| QuickActionsContext.tsx | contexts/ | Global quick actions | → Integrate with Cockpit |
| UserPreferences | apps/core/models.py | Theme/layout prefs | → Extend for Cockpit |
| ActivityLog | tenant_apps/cockpit/models.py | Generic activity | → Leverage in Cockpit |

### Backend Status Models (Current)
```python
FormSubmissionStatus:
  - DRAFT
  - IN_PROGRESS
  - COMPLETED
  - CANCELLED

StepSubmissionStatus:
  - NOT_STARTED
  - IN_PROGRESS
  - ACTION_NEEDED  ← Key for user action visibility
  - COMPLETED
  - SKIPPED
```

---

## Proposed Architecture

### 1. New Navigation Structure
```
├── Workspace
│   ├── 🎯 Cockpit (Command Center)     ← REPLACES Dashboard
│   ├── 📞 Calls                         ← RENAMED from "Call Log"
│   ├── 📈 Reports
│   └── 📋 Forms & Flows (NEW - replaces Workflows)
│       ├── My Tasks (3)     ← Badge showing action count
│       ├── In Progress      ← Active form flows
│       ├── Catalog          ← Available forms to start
│       └── History          ← Completed/cancelled flows
```

---

## 🎯 COCKPIT COMMAND CENTER (Major Feature)

### Vision: The Ultimate Trading Control Surface

The Cockpit is inspired by modern aircraft cockpits - a unified command center where everything a meat broker needs is within reach. It combines:

- **Situational Awareness** - Real-time view of business state
- **Rapid Action** - Execute common tasks with minimal friction  
- **Intelligent Navigation** - Find any data through search or visual exploration
- **Context Preservation** - Expand and explore without losing your place
- **Customization** - Arrange your workspace the way YOU work

### Core Components

#### A. Command Bar (Universal Search + Quick Actions)
```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 Search anything... (⌘K)                    [+ Quick Action ▼] [👤]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Universal Entity Search** - Find any Supplier, Customer, Product, PO, SO, Contact, etc.
- **Smart Suggestions** - Recent items, frequently accessed, AI-recommended
- **Type-Ahead Results** - Instant results as you type with entity type icons
- **Quick Actions Menu** - Start any form flow from dropdown
- **Keyboard Shortcuts** - `⌘K` to focus, arrow keys to navigate, Enter to select
- **Search Operators** - `supplier:ABC`, `po:12345`, `status:pending`, `@john`

**Search Result Format:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 tyson                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  SUPPLIERS                                                              │
│  🏭 Tyson Foods Inc.            Chicago, IL • Active • 47 orders       │
│  🏭 Tyson Fresh Meats           Springdale, AR • Active • 12 orders    │
│                                                                         │
│  CONTACTS                                                               │
│  👤 John Tyson                  VP Sales @ Tyson Foods • 📞 555-1234   │
│                                                                         │
│  PURCHASE ORDERS                                                        │
│  📋 PO-2026-0142               Tyson Foods • $45,230 • In Transit     │
│  📋 PO-2026-0089               Tyson Foods • $23,100 • Delivered       │
│                                                                         │
│  PRODUCTS                                                               │
│  🥩 Tyson Boneless Breast      SKU: TYS-001 • $3.45/lb                 │
│                                                                         │
│  Press Enter to select • ↑↓ to navigate • Tab for filters              │
└─────────────────────────────────────────────────────────────────────────┘
```

#### B. Entity Graph (Mind-Mapping Navigation)
```
                                    ┌─────────────────┐
                                    │   PURCHASE      │
                              ┌────▶│   ORDER #142    │────┐
                              │     │   $45,230       │    │
                              │     └─────────────────┘    │
                              │                            │
     ┌─────────────────┐      │     ┌─────────────────┐    │     ┌─────────────────┐
     │   SUPPLIER      │──────┤     │   PRODUCT       │◀───┼────▶│   CUSTOMER      │
     │   Tyson Foods   │      │     │   Ribeye 1x1    │    │     │   Costco #405   │
     │   47 orders     │      │     │   5000 lbs      │    │     │   Los Angeles   │
     └─────────────────┘      │     └─────────────────┘    │     └─────────────────┘
            │                 │                            │            │
            │                 │     ┌─────────────────┐    │            │
            ▼                 └────▶│   SALES         │◀───┘            ▼
     ┌─────────────────┐            │   ORDER #892    │         ┌─────────────────┐
     │   CONTACT       │            │   $52,100       │         │   INVOICE       │
     │   John Smith    │            └─────────────────┘         │   INV-0892      │
     │   📞 555-1234   │                                        │   Due: Feb 15   │
     └─────────────────┘                                        └─────────────────┘
```

**Features:**
- **Visual Relationship Exploration** - See how entities connect
- **Click to Expand** - Add related entities to the graph
- **Inline Preview** - Hover for quick details
- **Inline Edit** - Click to edit any field without leaving graph
- **Context Menu** - Right-click for actions (call, email, create PO, etc.)
- **Pin Nodes** - Keep important entities visible
- **Layout Options** - Force-directed, hierarchical, radial
- **Zoom & Pan** - Smooth navigation with mousewheel/pinch
- **Save Graph State** - Return to this exploration later

#### C. Widget Grid (Customizable Dashboard)
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  COCKPIT COMMAND CENTER                                    [Customize] [Templates ▼] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │ 🎯 MY TASKS          │  │ 📊 TODAY'S NUMBERS   │  │ 📞 UPCOMING CALLS        │  │
│  │                      │  │                      │  │                          │  │
│  │ 🔴 3 Action Required │  │ Orders: 12 ($142K)   │  │ 10:00 - John @ Tyson     │  │
│  │ ⏳ 5 Waiting         │  │ Shipments: 8         │  │ 11:30 - Sarah @ Costco   │  │
│  │ ⚠️ 1 Overdue         │  │ Invoices: $89K       │  │ 14:00 - Mike @ Sysco     │  │
│  │                      │  │ Margin: 18.2%        │  │                          │  │
│  │ [View All Tasks →]   │  │ [View Details →]     │  │ [Schedule Call +]        │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────────┘  │
│                                                                                     │
│  ┌──────────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ 📋 RECENT ACTIVITY                       │  │ ⚡ QUICK ACTIONS               │  │
│  │                                          │  │                                │  │
│  │ 09:45 PO-142 shipped via FedEx          │  │ [📝 New Supplier Onboarding]   │  │
│  │ 09:30 Credit approved for ABC Corp      │  │ [📋 Quick Quote]               │  │
│  │ 09:15 Call completed with John Tyson    │  │ [📞 Log a Call]                │  │
│  │ 08:50 SO-892 confirmed by Costco        │  │ [📊 Run Report]                │  │
│  │                                          │  │ [+ Add Custom...]              │  │
│  └──────────────────────────────────────────┘  └────────────────────────────────┘  │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │ 🕸️ ENTITY EXPLORER (Collapsed - Click to Expand)                            │  │
│  │    Currently exploring: Tyson Foods → PO-142 → Costco                       │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Available Widgets:**
| Widget | Purpose | Default Position |
|--------|---------|------------------|
| **My Tasks** | Action items requiring attention | Top-left |
| **Today's Numbers** | Key metrics at a glance | Top-center |
| **Upcoming Calls** | Scheduled calls for today/tomorrow | Top-right |
| **Recent Activity** | Activity feed | Middle-left |
| **Quick Actions** | Common form flows | Middle-right |
| **Entity Explorer** | Interactive graph (collapsible) | Bottom (full-width) |
| **Price Watch** | Commodity prices (future) | Configurable |
| **Market News** | Industry news feed (future) | Configurable |
| **Weather/Logistics** | Shipping weather alerts (future) | Configurable |
| **Custom KPI** | User-defined metrics | Configurable |

**Widget System Features:**
- **Drag & Drop** - Rearrange widgets freely
- **Resize** - Widgets can span 1-4 columns
- **Collapse/Expand** - Minimize widgets to title bar
- **Templates** - Pre-configured layouts for roles
- **Save Layout** - Persist per-user
- **Add/Remove** - Customize which widgets appear

#### D. Widget Templates (Role-Based Defaults)

**Meat Broker/Trader Template (Default):**
```
Row 1: [My Tasks] [Today's Numbers] [Upcoming Calls]
Row 2: [Recent Activity (wide)] [Quick Actions]
Row 3: [Entity Explorer (full-width, collapsed)]
```

**Sales Manager Template:**
```
Row 1: [Team Tasks] [Sales Pipeline] [Revenue Forecast]
Row 2: [Top Customers] [Quote Tracker]
Row 3: [Activity Feed (full-width)]
```

**Operations Template:**
```
Row 1: [Pending Shipments] [Delivery Status] [Warehouse Capacity]
Row 2: [Today's Pickups] [Today's Deliveries]
Row 3: [Logistics Map (full-width)]
```

### Entity Graph Interaction Model

#### Node Actions (Click)
```typescript
interface EntityNode {
  id: string;
  type: 'supplier' | 'customer' | 'contact' | 'product' | 'purchase_order' | 'sales_order' | 'invoice' | 'plant' | 'carrier';
  data: Record<string, any>;
  position: { x: number; y: number };
  isExpanded: boolean;
  isPinned: boolean;
}

// Click → Show detail panel (slide-in)
// Double-click → Expand relationships
// Right-click → Context menu (actions)
// Drag → Move node position
// Hover → Quick preview tooltip
```

#### Context Menu Actions
```
┌─────────────────────────┐
│ 🏭 Tyson Foods         │
├─────────────────────────┤
│ 👁️ View Full Details    │
│ ✏️ Edit Supplier        │
│ ─────────────────────── │
│ 📋 Create Purchase Order│
│ 📞 Schedule Call        │
│ 📧 Send Email           │
│ ─────────────────────── │
│ 🔗 Expand Relationships │
│ 📌 Pin to Graph         │
│ 🗑️ Remove from Graph    │
│ ─────────────────────── │
│ ⚡ Run Quick Action ▶  │
│    └─ Supplier Onboard  │
│    └─ Credit Check      │
│    └─ Custom...         │
└─────────────────────────┘
```

#### Inline Editing
```
┌─────────────────────────────────────────┐
│ 📋 PURCHASE ORDER #142                  │
├─────────────────────────────────────────┤
│                                         │
│ Status: [In Transit ▼]  ← Click to edit│
│ Supplier: Tyson Foods   ← Click to link│
│ Customer: Costco #405   ← Click to link│
│                                         │
│ Products:                               │
│ ├─ Ribeye 1x1: 5000 lbs @ $4.25        │
│ └─ [+ Add Product]                      │
│                                         │
│ Total: $45,230.00                       │
│ Ship Date: 2026-02-01  ← Click to edit │
│ Carrier: [Select ▼]     ← Click to set │
│                                         │
│ [Save Changes] [Cancel] [View Full →]   │
└─────────────────────────────────────────┘
```

### New Record Creation Flow

The Cockpit supports creating new entities inline with automatic relationship linking:

```
1. User types "new supplier" in Command Bar
   OR clicks "+ Quick Action" → "Add Supplier"
   OR right-clicks empty space in Entity Graph → "Create Supplier"

2. Inline creation panel slides in:
   ┌─────────────────────────────────────────┐
   │ + NEW SUPPLIER                          │
   ├─────────────────────────────────────────┤
   │ Company Name: [________________]        │
   │ Contact Name: [________________] [+]    │
   │ Phone: [________________]               │
   │ Email: [________________]               │
   │ Address: [________________]             │
   │                                         │
   │ Products Supplied: (optional)           │
   │ [+ Add Product]                         │
   │                                         │
   │ [Create & Add to Graph] [Create & Close]│
   └─────────────────────────────────────────┘

3. If user clicks [+] next to Contact:
   - Expands to add contact inline
   - Or allows selecting existing contact
   
4. When saved:
   - New supplier node appears in Entity Graph
   - Relationships automatically linked
   - Success notification shown
```

---

## 📞 CALLS PAGE OVERHAUL (Renamed from "Call Log")

### Current State Issues

- Name "Call Log" is passive/historical - rename to active "Calls"
- Calendar-centric but limited views
- Basic CRUD, no smart features
- No integration with entity context
- Limited activity feed integration

### New "Calls" Page Design

#### Header
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📞 CALLS                                                     [+ Schedule Call]     │
│  ───────────────────────────────────────────────────────────────────────────────────│
│  [Today] [This Week] [This Month] [Custom]     View: [📅 Calendar | 📋 List | 🗺️ Map] │
│                                                                                     │
│  Filter: [All ▼] [Upcoming ▼] [Completed ▼]    🔍 Search calls...                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Smart Features

1. **One-Click Call Logging**
   - Start a call → timer starts
   - End call → quick outcome selection
   - Auto-suggest related entities

2. **Contextual Scheduling**
   - Suggest best times based on history
   - Show contact's timezone
   - Detect scheduling conflicts

3. **Call Intelligence**
   - Track call frequency per contact
   - Surface "overdue" contacts (haven't called in X days)
   - Follow-up reminders

4. **Integration with Entity Graph**
   - View call history on any entity
   - Schedule calls directly from entity context menu
   - Link calls to POs, SOs, etc.

#### Enhanced Calendar View
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📅 JANUARY 2026                                          [◀ Prev] [Today] [Next ▶] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  SUN      MON      TUE      WED      THU      FRI      SAT                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  26       27       28       29       30       31       1                           │
│           ┌────┐   ┌────┐                     ┌────┐                               │
│           │🟢2 │   │🟡3 │                     │🔴1 │                               │
│           └────┘   └────┘                     └────┘                               │
│                                                                                     │
│  2        3        4        5        6        7        8                           │
│           TODAY                                                                    │
│           ┌──────────────────────────┐                                             │
│           │ 10:00 John @ Tyson  🏭   │                                             │
│           │ 11:30 Sarah @ Costco 🛒  │                                             │
│           │ 14:00 Mike @ Sysco  🏭   │                                             │
│           │ [+ Add Call]             │                                             │
│           └──────────────────────────┘                                             │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
│  Legend: 🟢 Completed  🟡 Upcoming  🔴 Overdue  🏭 Supplier  🛒 Customer           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Quick Call Modal
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📞 LOG CALL                                                              [✕ Close] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  With: [🔍 Search contact or company...]                                           │
│        ┌─────────────────────────────────────────────────┐                         │
│        │ Recent:                                         │                         │
│        │ 👤 John Smith (Tyson Foods)                     │                         │
│        │ 👤 Sarah Lee (Costco)                           │                         │
│        │ 🏭 Sysco Corporation                            │                         │
│        └─────────────────────────────────────────────────┘                         │
│                                                                                     │
│  Purpose: [Follow-up ▼]                                                            │
│           ├─ Follow-up                                                             │
│           ├─ Price Negotiation                                                     │
│           ├─ Order Check                                                           │
│           ├─ Relationship Building                                                 │
│           └─ Other                                                                 │
│                                                                                     │
│  Duration: [⏱️ Start Timer] or [Manual: __ min]                                    │
│                                                                                     │
│  Notes:                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │                                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  Outcome: [Connected ▼]   Follow-up: [Schedule ▼]                                 │
│           ├─ Connected                   ├─ No follow-up needed                   │
│           ├─ Left Voicemail              ├─ Tomorrow                              │
│           ├─ No Answer                   ├─ This week                             │
│           └─ Wrong Number                └─ Custom date...                        │
│                                                                                     │
│  Link to: [+ PO] [+ SO] [+ Quote] [+ Other...]                                    │
│                                                                                     │
│  [Cancel]                                                       [Save & Close]     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Enhanced Data Models

#### A. StepSubmissionStatus (Extended)
```python
class StepSubmissionStatus(models.TextChoices):
    # Current statuses
    NOT_STARTED = 'not_started', 'Not Started'
    IN_PROGRESS = 'in_progress', 'In Progress'
    ACTION_NEEDED = 'action_needed', 'Action Needed'
    COMPLETED = 'completed', 'Completed'
    SKIPPED = 'skipped', 'Skipped'
    
    # NEW: Waiting/Pending statuses
    WAITING_DOCUMENT = 'waiting_document', 'Waiting for Document'
    WAITING_APPROVAL = 'waiting_approval', 'Waiting for Approval'
    WAITING_RESPONSE = 'waiting_response', 'Waiting for Response'
    WAITING_CALLBACK = 'waiting_callback', 'Waiting for Callback'
    WAITING_EXTERNAL = 'waiting_external', 'Waiting for External Party'
```

#### B. NEW: FormStatusHistory Model
```python
class FormStatusHistory(models.Model):
    """Audit trail for form submission status changes."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        related_name='status_history'
    )
    step = models.ForeignKey(
        FormStepSubmission,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='status_history'
    )
    
    # Status change details
    previous_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30)
    reason = models.TextField(blank=True)  # Optional explanation
    
    # Audit fields
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    
    # Additional context (JSON for flexibility)
    context = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-changed_at']
        verbose_name_plural = 'Form status histories'
```

#### C. NEW: StepAssignment Model
```python
class StepAssignment(models.Model):
    """Assigns a form step to a specific user for action."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    step_submission = models.ForeignKey(
        FormStepSubmission,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    
    # Assignment details
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='step_assignments'
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='step_assignments_made'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    
    # Priority and due date
    priority = models.CharField(
        max_length=10,
        choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')],
        default='medium'
    )
    due_date = models.DateTimeField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-assigned_at']
```

#### D. NEW: UserNotification Model
```python
class UserNotification(models.Model):
    """User-targeted notifications for form/flow events."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='flow_notifications'
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='user_notifications'
    )
    
    # Notification type
    notification_type = models.CharField(
        max_length=30,
        choices=[
            ('action_required', 'Action Required'),
            ('assignment', 'New Assignment'),
            ('reminder', 'Reminder'),
            ('overdue', 'Task Overdue'),
            ('completed', 'Flow Completed'),
            ('response_received', 'Response Received'),
            ('approval_needed', 'Approval Needed'),
            ('approval_result', 'Approval Result'),
        ]
    )
    
    # Content
    title = models.CharField(max_length=200)
    message = models.TextField()
    
    # Related objects (optional)
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        null=True, blank=True
    )
    step_submission = models.ForeignKey(
        FormStepSubmission,
        on_delete=models.CASCADE,
        null=True, blank=True
    )
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Delivery tracking
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Action URL (where to navigate when clicked)
    action_url = models.CharField(max_length=500, blank=True)
    
    class Meta:
        ordering = ['-created_at']
```

#### E. NEW: NotificationPreferences Model
```python
class NotificationPreferences(models.Model):
    """User preferences for notification delivery."""
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    
    # In-app notifications (always enabled by default)
    in_app_enabled = models.BooleanField(default=True)
    
    # Email notification preferences
    email_enabled = models.BooleanField(default=True)
    email_action_required = models.BooleanField(default=True)
    email_assignments = models.BooleanField(default=True)
    email_reminders = models.BooleanField(default=True)
    email_overdue = models.BooleanField(default=True)
    email_completions = models.BooleanField(default=False)  # Often noisy
    email_approvals = models.BooleanField(default=True)
    
    # Frequency settings
    email_digest = models.CharField(
        max_length=20,
        choices=[
            ('immediate', 'Immediate'),
            ('hourly', 'Hourly Digest'),
            ('daily', 'Daily Digest'),
            ('weekly', 'Weekly Digest'),
        ],
        default='immediate'
    )
    
    # Quiet hours (no email during these times)
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(null=True, blank=True)  # e.g., 22:00
    quiet_hours_end = models.TimeField(null=True, blank=True)    # e.g., 07:00
    
    # Reminder frequency
    reminder_frequency_hours = models.PositiveIntegerField(default=24)
    
    class Meta:
        verbose_name_plural = 'Notification preferences'
```

#### F. FormStepSubmission Enhancement (waiting_on field)
```python
# Add to existing FormStepSubmission model
waiting_on = models.JSONField(
    default=dict,
    blank=True,
    help_text="Details about what/who we're waiting for"
)
# Example: {
#   "type": "document",
#   "description": "W-9 form from supplier",
#   "expected_by": "2026-02-15",
#   "party_name": "ABC Suppliers",
#   "reminder_sent": false,
#   "reminder_sent_at": null
# }

expected_completion = models.DateTimeField(
    null=True, blank=True,
    help_text="Expected completion date/time for SLA tracking"
)
```

#### G. NEW: CockpitLayout Model (Widget Configuration)
```python
class CockpitLayout(models.Model):
    """User's personalized Cockpit widget layout and preferences."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='cockpit_layout'
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='cockpit_layouts'
    )
    
    # Widget configuration (array of widget placements)
    widgets = models.JSONField(
        default=list,
        help_text="Array of widget configurations"
    )
    # Example: [
    #   {"id": "my-tasks", "position": {"row": 0, "col": 0}, "size": {"w": 1, "h": 1}, "collapsed": false},
    #   {"id": "todays-numbers", "position": {"row": 0, "col": 1}, "size": {"w": 1, "h": 1}},
    #   {"id": "entity-explorer", "position": {"row": 2, "col": 0}, "size": {"w": 4, "h": 2}, "collapsed": true}
    # ]
    
    # Layout template (for reset/sharing)
    template_name = models.CharField(
        max_length=50,
        choices=[
            ('broker', 'Meat Broker/Trader'),
            ('sales_manager', 'Sales Manager'),
            ('operations', 'Operations'),
            ('custom', 'Custom'),
        ],
        default='broker'
    )
    
    # Quick Actions favorites (pinned to widget)
    quick_action_favorites = models.JSONField(
        default=list,
        help_text="Array of form IDs for quick access"
    )
    
    # Entity Explorer state (saved graph)
    saved_graph_state = models.JSONField(
        default=dict,
        blank=True,
        help_text="Last entity graph state for restoration"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'tenant']
```

#### H. NEW: SavedEntityGraph Model (Reusable Explorations)
```python
class SavedEntityGraph(models.Model):
    """Saved entity graph explorations for quick access."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='saved_graphs'
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='saved_graphs'
    )
    
    # Graph metadata
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Graph state (nodes, positions, expansion state)
    graph_state = models.JSONField(
        help_text="Complete graph state for restoration"
    )
    # Example: {
    #   "nodes": [
    #     {"type": "supplier", "id": "uuid", "position": {"x": 100, "y": 200}, "expanded": true},
    #     {"type": "purchase_order", "id": "uuid", "position": {"x": 300, "y": 200}},
    #   ],
    #   "viewport": {"x": 0, "y": 0, "zoom": 1.0}
    # }
    
    # Auto-generated preview thumbnail (base64)
    thumbnail = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_opened_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-last_opened_at', '-updated_at']
```

#### I. NEW: UniversalSearchIndex Model (Cached Search Index)
```python
class UniversalSearchIndex(models.Model):
    """Cached search index for fast universal search."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='search_index'
    )
    
    # Entity reference
    entity_type = models.CharField(max_length=50, db_index=True)
    entity_id = models.UUIDField(db_index=True)
    
    # Searchable content (denormalized for speed)
    primary_text = models.CharField(max_length=500, db_index=True)  # e.g., company name
    secondary_text = models.CharField(max_length=500, blank=True)   # e.g., contact name
    search_keywords = models.TextField(blank=True)                   # Additional searchable terms
    
    # Display metadata
    display_icon = models.CharField(max_length=10, default='📄')
    display_subtitle = models.CharField(max_length=200, blank=True)
    
    # Ranking signals
    access_count = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(null=True, blank=True)
    relevance_score = models.FloatField(default=1.0)
    
    # Timestamps
    indexed_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'primary_text']),
            models.Index(fields=['tenant', 'access_count']),
        ]
        unique_together = ['tenant', 'entity_type', 'entity_id']
```

### 3. Status Categories (Frontend)
```typescript
type StatusCategory = 
  | 'action_required'    // User needs to do something NOW
  | 'waiting_external'   // Blocked on third party
  | 'in_progress'        // Active, no blockers
  | 'completed'          // Done
  | 'cancelled';         // Terminated

// Helper to categorize step status
const getStatusCategory = (status: string): StatusCategory => {
  if (['action_needed', 'in_progress'].includes(status)) return 'action_required';
  if (status.startsWith('waiting_')) return 'waiting_external';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled' || status === 'skipped') return 'cancelled';
  return 'in_progress';
};

interface ActionItem {
  id: string;
  submissionId: string;
  stepId: string;
  
  // What's the action?
  actionType: 'fill_form' | 'review' | 'approve' | 'upload_document' | 'confirm';
  actionDescription: string;
  
  // Assignment info
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  assignedBy?: {
    id: string;
    name: string;
  };
  
  // Who/what are we waiting on?
  waitingOn?: {
    type: 'user' | 'document' | 'email' | 'approval' | 'callback' | 'external';
    description: string;
    expectedBy?: Date;
    partyName?: string;
  };
  
  // Priority/urgency
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  isOverdue: boolean;
  
  // Context
  formName: string;
  formIcon: string;
  stepName: string;
  createdAt: Date;
  lastUpdatedAt: Date;
}

interface ActionItemCounts {
  action_required: number;
  waiting_external: number;
  overdue: number;
  total: number;
}
```

### 4. New Page Structure

#### A. My Tasks Page (`/workspace/forms-flows/tasks`)
**Purpose:** Single view of all items requiring user attention

**Features:**
- Filter by action type (my action, waiting on others, all)
- Filter by priority (high, medium, low)
- Sort by due date, priority, form type
- Quick actions (resume, mark complete, add note, reassign)
- Notification badges showing counts
- Group by form flow or by due date
- Overdue highlighting with countdown

**UI Wireframe:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 My Tasks                                    Filter ▼ Sort ▼ │
│                                                 [Refresh 🔄]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 🔴 ACTION REQUIRED (3)                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟥 HIGH PRIORITY                                        │ │
│ │ ⚡ Complete Supplier Onboarding                          │ │
│ │    Step: Upload W-9 Document                            │ │
│ │    📅 Due: Today (OVERDUE) • Started 2 days ago         │ │
│ │    👤 Assigned by: John Smith                           │ │
│ │    [Continue →] [Add Note] [Reassign]                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟨 MEDIUM PRIORITY                                      │ │
│ │ 📋 Customer Credit Application                          │ │
│ │    Step: Review & Approve Credit Limit                  │ │
│ │    📅 Due: Tomorrow • Requested by: Sales Team          │ │
│ │    [Review →] [Approve ✓] [Reject ✗] [Add Note]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ⏳ WAITING ON OTHERS (5)                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📧 Purchase Order Confirmation                          │ │
│ │    Waiting for: Email response from ABC Suppliers       │ │
│ │    ⏱️ Expected: Jan 31, 2026 • Sent: 2 days ago         │ │
│ │    [Send Reminder] [Mark Received] [View Details]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📞 Callback Scheduled                                   │ │
│ │    Waiting for: Callback from John Smith (Customer)     │ │
│ │    ⏱️ Scheduled: Jan 30, 3:00 PM                        │ │
│ │    [Mark Completed] [Reschedule] [Add Note]             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### B. In Progress Page (`/workspace/forms-flows`)
**Purpose:** Overview of all active form flows

**Features:**
- Card grid view of in-progress submissions
- Progress indicators (steps completed / total)
- Status badges with waiting indicators
- Quick resume functionality
- Bulk actions (export, archive)
- Assignee avatars

#### C. Catalog Page (`/workspace/forms-flows/catalog`)
**Purpose:** Browse and start new form flows

**Enhancements:**
- Category filtering (by entity type, department)
- Search by name/description
- Recently used section
- Pinned/favorite flows
- Recommended flows based on user role
- Draft count badge ("3 drafts")

#### D. History Page (`/workspace/forms-flows/history`)
**Purpose:** Completed and cancelled flows

**Features:**
- Date range filtering
- Export to CSV/Excel
- View completed submission data (read-only)
- Clone/restart flow
- Full audit trail view
- Search by form name, submitter

### 5. Notification System

#### A. Notification Types
```typescript
type NotificationType = 
  | 'action_required'    // You have a task to complete
  | 'assignment'         // You've been assigned a task
  | 'reminder'           // Reminder for pending task
  | 'overdue'            // Task is now overdue
  | 'completed'          // A flow you're tracking completed
  | 'response_received'  // External party responded
  | 'approval_needed'    // Someone needs your approval
  | 'approval_result';   // Your request was approved/rejected
```

#### B. In-App Notification Bell
- Shows in header next to user profile
- Badge with unread count
- Dropdown panel with recent notifications
- "Mark all read" action
- Link to full notifications page

#### C. Email Notifications (Based on User Preferences)
- Configurable per notification type
- Digest options (immediate, hourly, daily, weekly)
- Quiet hours support
- Unsubscribe links in each email

#### D. Notification Triggers
```python
# When to create notifications:

# 1. On step status change to action_needed
if new_status == 'action_needed' and step.assigned_to:
    create_notification(step.assigned_to, 'action_required', ...)

# 2. On new assignment
if assignment_created:
    create_notification(assigned_to, 'assignment', ...)

# 3. On overdue (scheduled job)
for step in overdue_steps:
    create_notification(step.assigned_to, 'overdue', ...)

# 4. On waiting response received
if waiting_status_cleared:
    create_notification(step.assigned_to, 'response_received', ...)

# 5. On flow completion
if submission.status == 'completed':
    create_notification(submission.created_by, 'completed', ...)
```

### 6. Dashboard Integration

#### FormsFlowsWidget
```
┌─────────────────────────────────────────┐
│ 📋 Forms & Flows                    →   │
├─────────────────────────────────────────┤
│                                         │
│  🔴 3 Action Required                   │
│  ⏳ 5 Waiting on Others                 │
│  ⚠️ 1 Overdue                           │
│                                         │
│  ────────────────────────────────────   │
│  Recent Activity:                       │
│  • Supplier Onboarding - Step 2/4       │
│  • Credit Application - Awaiting docs   │
│  • PO Confirmation - Completed ✓        │
│                                         │
│  [Start New Flow] [View All Tasks]      │
└─────────────────────────────────────────┘
```

### 7. Future-Proofing: Extensible Action System

#### A. Step Action Types (Database Schema)
```python
class StepActionType(models.TextChoices):
    """Types of actions a step can perform."""
    FORM_FILL = 'form_fill', 'Fill Form'
    APPROVAL = 'approval', 'Approval Request'
    DOCUMENT_UPLOAD = 'document_upload', 'Document Upload'
    DOCUMENT_GENERATE = 'document_generate', 'Generate Document'
    EMAIL_SEND = 'email_send', 'Send Email'
    EMAIL_WAIT = 'email_wait', 'Wait for Email'
    WEBHOOK = 'webhook', 'External Webhook'
    SCHEDULE_CALL = 'schedule_call', 'Schedule Call'
    MANUAL_TASK = 'manual_task', 'Manual Task'
```

#### B. Step Triggers (Future)
```python
class StepTrigger(models.TextChoices):
    """What causes a step to activate."""
    MANUAL = 'manual', 'Manual (User Initiated)'
    AUTO_PREVIOUS = 'auto_previous', 'Previous Step Completed'
    SCHEDULED = 'scheduled', 'Scheduled Time'
    EMAIL_RECEIVED = 'email_received', 'Email Received'
    WEBHOOK = 'webhook', 'External Webhook'
    CONDITION = 'condition', 'Condition Met'
```

#### C. Conditional Path Support (Future)
```python
class StepCondition(models.Model):
    """Conditional routing between steps."""
    source_step = models.ForeignKey(TenantFormEntity, related_name='conditions_from')
    target_step = models.ForeignKey(TenantFormEntity, related_name='conditions_to')
    
    condition_type = models.CharField(choices=[
        ('field_equals', 'Field Equals Value'),
        ('field_not_empty', 'Field Not Empty'),
        ('approval_granted', 'Approval Granted'),
        ('expression', 'Custom Expression'),
    ])
    condition_config = models.JSONField()
    order = models.PositiveIntegerField(default=0)
```

---

## Implementation Plan

### Phase 1: Backend Models & Migrations (2 days)
- [ ] **1.1** Add new StepSubmissionStatus choices
- [ ] **1.2** Create `FormStatusHistory` model
- [ ] **1.3** Create `StepAssignment` model
- [ ] **1.4** Create `UserNotification` model
- [ ] **1.5** Create `NotificationPreferences` model
- [ ] **1.6** Add `waiting_on`, `expected_completion` to FormStepSubmission
- [ ] **1.7** Run migrations

### Phase 2: Backend API Endpoints (2-3 days)
- [ ] **2.1** Create `ActionItemSerializer` with computed fields
- [ ] **2.2** Create `GET /workflows/action-items/` endpoint
- [ ] **2.3** Create `GET /workflows/action-items/counts/` endpoint
- [ ] **2.4** Create `POST /workflows/steps/{id}/assign/` endpoint
- [ ] **2.5** Create `POST /workflows/steps/{id}/mark-waiting/` endpoint
- [ ] **2.6** Create `POST /workflows/steps/{id}/mark-received/` endpoint
- [ ] **2.7** Create notifications CRUD endpoints
- [ ] **2.8** Create notification preferences endpoints
- [ ] **2.9** Add status history recording to existing endpoints

### Phase 3: Navigation & Page Structure (2 days)
- [ ] **3.1** Update `navigation.ts` - restructure menu
- [ ] **3.2** Extend `NavigationItem` interface with badge support
- [ ] **3.3** Create FormsFlows parent page/layout
- [ ] **3.4** Create MyTasks page (basic structure)
- [ ] **3.5** Rename/move WorkflowList to Catalog
- [ ] **3.6** Create InProgress page
- [ ] **3.7** Create History page
- [ ] **3.8** Update routes in App.tsx

### Phase 4: Frontend Services & Hooks (2 days)
- [ ] **4.1** Create `actionItemsService.ts`
- [ ] **4.2** Create `notificationsService.ts`
- [ ] **4.3** Create `useActionItems` hook with polling
- [ ] **4.4** Create `useNotifications` hook
- [ ] **4.5** Create `useActionItemCounts` hook (for badges)
- [ ] **4.6** Create ActionItem TypeScript interfaces

### Phase 5: Sidebar Badge Integration (1 day)
- [ ] **5.1** Add badge rendering to Sidebar component
- [ ] **5.2** Connect badge counts to useActionItemCounts
- [ ] **5.3** Add badge polling/refresh (30-60 second interval)
- [ ] **5.4** Style badges (red for overdue, blue for pending)

### Phase 6: My Tasks Page (3 days)
- [ ] **6.1** Build ActionItemCard component
- [ ] **6.2** Build filter controls (status, priority)
- [ ] **6.3** Build sort controls
- [ ] **6.4** Implement grouping (by status category)
- [ ] **6.5** Add quick actions (continue, complete, note)
- [ ] **6.6** Add overdue highlighting
- [ ] **6.7** Add empty states
- [ ] **6.8** Add loading states

### Phase 7: Notification System (2-3 days)
- [ ] **7.1** Create NotificationBell component
- [ ] **7.2** Create NotificationPanel component
- [ ] **7.3** Create NotificationItem component
- [ ] **7.4** Add to Header/Layout
- [ ] **7.5** Implement mark as read
- [ ] **7.6** Create NotificationsContext
- [ ] **7.7** Add polling for new notifications

### Phase 8: Notification Preferences UI (1-2 days)
- [ ] **8.1** Add Notification Preferences to Settings page
- [ ] **8.2** Build preference toggle UI
- [ ] **8.3** Build email digest selection
- [ ] **8.4** Build quiet hours configuration
- [ ] **8.5** Save/load preferences from API

### Phase 9: Dashboard Widget (1 day)
- [ ] **9.1** Create FormsFlowsWidget component
- [ ] **9.2** Add to Dashboard page
- [ ] **9.3** Connect to action item counts
- [ ] **9.4** Add recent activity list
- [ ] **9.5** Add quick action buttons

---

## 🎯 COCKPIT COMMAND CENTER IMPLEMENTATION

### Phase C1: Backend - Cockpit Data Models (2 days)
- [ ] **C1.1** Create `CockpitLayout` model for widget configuration
- [ ] **C1.2** Create `SavedEntityGraph` model for saved explorations
- [ ] **C1.3** Create `UniversalSearchIndex` model for fast search
- [ ] **C1.4** Run migrations
- [ ] **C1.5** Create search index population management command
- [ ] **C1.6** Add signal handlers to update search index on entity changes

### Phase C2: Backend - Universal Search API (2-3 days)
- [ ] **C2.1** Create `GET /search/universal/` endpoint
- [ ] **C2.2** Implement cross-entity search with ranking
- [ ] **C2.3** Add recent items tracking per user
- [ ] **C2.4** Add search suggestions endpoint `GET /search/suggestions/`
- [ ] **C2.5** Implement search operators parsing (supplier:, po:, @user)
- [ ] **C2.6** Add search result click tracking for relevance

### Phase C3: Backend - Entity Graph API (2-3 days)
- [ ] **C3.1** Create `GET /entities/{type}/{id}/` unified entity endpoint
- [ ] **C3.2** Create `GET /entities/{type}/{id}/relationships/` endpoint
- [ ] **C3.3** Implement relationship traversal with depth control
- [ ] **C3.4** Add `POST /entities/{type}/` inline entity creation
- [ ] **C3.5** Add `PATCH /entities/{type}/{id}/` inline entity update
- [ ] **C3.6** Create `GET /entities/graph-schema/` for frontend type info

### Phase C4: Backend - Cockpit Layout API (1 day)
- [ ] **C4.1** Create `GET /cockpit/layout/` endpoint
- [ ] **C4.2** Create `PUT /cockpit/layout/` endpoint
- [ ] **C4.3** Create `POST /cockpit/layout/reset/` to reset to template
- [ ] **C4.4** Create `GET /cockpit/templates/` for available templates
- [ ] **C4.5** Add saved graph CRUD endpoints

### Phase C5: Frontend - Command Bar (3 days)
- [ ] **C5.1** Create `CommandPalette` component (modal search)
- [ ] **C5.2** Implement keyboard shortcut (⌘K / Ctrl+K)
- [ ] **C5.3** Build `SearchResultsList` with entity grouping
- [ ] **C5.4** Add `SearchResultItem` with type-specific icons
- [ ] **C5.5** Implement search debouncing and caching
- [ ] **C5.6** Add recent items section
- [ ] **C5.7** Add quick actions dropdown integration
- [ ] **C5.8** Build `CommandBar` header component

### Phase C6: Frontend - Entity Graph Visualization (5 days)
- [ ] **C6.1** Set up graph library (react-flow or d3-force)
- [ ] **C6.2** Create `EntityNode` component with type variants
- [ ] **C6.3** Create `EntityEdge` component for relationships
- [ ] **C6.4** Implement node expansion on double-click
- [ ] **C6.5** Create `EntityPreviewTooltip` for hover
- [ ] **C6.6** Create `EntityContextMenu` for right-click actions
- [ ] **C6.7** Build `InlineEditPanel` slide-in for editing
- [ ] **C6.8** Implement graph layout algorithms (force, hierarchical)
- [ ] **C6.9** Add zoom/pan controls
- [ ] **C6.10** Add node pinning and unpinning
- [ ] **C6.11** Implement save/restore graph state
- [ ] **C6.12** Add minimap for large graphs

### Phase C7: Frontend - Widget System (4 days)
- [ ] **C7.1** Create `WidgetGrid` container with react-grid-layout
- [ ] **C7.2** Create `Widget` base component (header, collapse, drag)
- [ ] **C7.3** Create `MyTasksWidget`
- [ ] **C7.4** Create `TodaysNumbersWidget`
- [ ] **C7.5** Create `UpcomingCallsWidget`
- [ ] **C7.6** Create `RecentActivityWidget`
- [ ] **C7.7** Create `QuickActionsWidget`
- [ ] **C7.8** Create `EntityExplorerWidget` (embedded graph)
- [ ] **C7.9** Create `WidgetPicker` modal for adding widgets
- [ ] **C7.10** Implement layout persistence to API
- [ ] **C7.11** Create template switcher

### Phase C8: Frontend - Cockpit Page Assembly (2 days)
- [ ] **C8.1** Create `CockpitPage` as new root page
- [ ] **C8.2** Integrate CommandBar in header
- [ ] **C8.3** Integrate WidgetGrid as main content
- [ ] **C8.4** Add layout customization controls
- [ ] **C8.5** Update navigation to use Cockpit
- [ ] **C8.6** Add keyboard shortcuts help modal
- [ ] **C8.7** Remove/deprecate old Dashboard page

---

## 📞 CALLS PAGE OVERHAUL IMPLEMENTATION

### Phase L1: Rename & Route Updates (0.5 days)
- [ ] **L1.1** Rename `CallLog.tsx` to `Calls.tsx`
- [ ] **L1.2** Update navigation.ts: "Call Log" → "Calls"
- [ ] **L1.3** Update route path: `/call-log` → `/calls`
- [ ] **L1.4** Update all internal references

### Phase L2: Calls Page Redesign (3 days)
- [ ] **L2.1** Create new page header with view toggles
- [ ] **L2.2** Enhance calendar view with call indicators
- [ ] **L2.3** Create list view with smart sorting
- [ ] **L2.4** Add "overdue contacts" section
- [ ] **L2.5** Create call frequency analytics
- [ ] **L2.6** Add filter by entity type/contact

### Phase L3: Quick Call Modal Overhaul (2 days)
- [ ] **L3.1** Redesign ScheduleCallModal with new layout
- [ ] **L3.2** Add contact search with recent suggestions
- [ ] **L3.3** Add call timer for duration tracking
- [ ] **L3.4** Add outcome quick-select buttons
- [ ] **L3.5** Add follow-up scheduling integration
- [ ] **L3.6** Add entity linking (PO, SO, Quote)

### Phase L4: Call Intelligence Features (2 days)
- [ ] **L4.1** Track call frequency per contact
- [ ] **L4.2** Implement "hasn't called in X days" alerts
- [ ] **L4.3** Add suggested call times based on history
- [ ] **L4.4** Add timezone display for contacts
- [ ] **L4.5** Integrate with Entity Graph (call from context menu)

---

## REVISED IMPLEMENTATION PHASES (CONTINUED)

### Phase 10: Form Builder Integration (2 days)
- [ ] **10.1** Add "waiting type" option to step config
- [ ] **10.2** Add "expected response time" field
- [ ] **10.3** Add "default assignee" field
- [ ] **10.4** Add "notification settings" per step
- [ ] **10.5** Update SchemaEditor for new options
- [ ] **10.6** Update form snapshot to include new fields

### Phase 11: Email Notifications (2 days)
- [ ] **11.1** Create email templates for each notification type
- [ ] **11.2** Create notification sending service
- [ ] **11.3** Implement immediate sending
- [ ] **11.4** Implement digest aggregation (hourly/daily)
- [ ] **11.5** Implement quiet hours logic
- [ ] **11.6** Add unsubscribe handling

### Phase 12: Polish & Testing (3 days)
- [ ] **12.1** Comprehensive testing of all flows
- [ ] **12.2** Accessibility review (ARIA, keyboard nav)
- [ ] **12.3** Mobile responsiveness
- [ ] **12.4** Performance optimization (memoization, pagination)
- [ ] **12.5** Error handling review
- [ ] **12.6** Documentation update
- [ ] **12.7** Cockpit keyboard shortcut testing
- [ ] **12.8** Entity graph performance with large datasets

---

## File Changes Summary

### New Backend Files
```
backend/tenant_apps/cockpit/
  ├── migrations/XXXX_add_cockpit_models.py
  ├── models.py                 # CockpitLayout, SavedEntityGraph, UniversalSearchIndex
  ├── views.py                  # Cockpit API endpoints
  ├── serializers.py
  └── urls.py

backend/tenant_apps/workflows/
  ├── migrations/XXXX_add_status_and_notification_models.py
  ├── serializers/action_items.py
  ├── serializers/notifications.py
  └── services/notification_service.py

backend/apps/core/
  ├── views/search.py           # Universal search endpoint
  ├── views/entities.py         # Unified entity API
  └── management/commands/rebuild_search_index.py
```

### New Frontend Files
```
frontend/src/pages/Cockpit/
  ├── index.tsx                 # Main Cockpit page
  ├── Calls.tsx                 # Renamed from CallLog.tsx
  └── components/
      ├── CommandBar.tsx
      ├── CommandPalette.tsx
      ├── SearchResults.tsx
      └── SearchResultItem.tsx

frontend/src/pages/FormsFlows/
  ├── index.tsx                 # Layout/router
  ├── MyTasks.tsx               # Action items view
  ├── InProgress.tsx            # Active flows
  ├── Catalog.tsx               # Available forms
  ├── History.tsx               # Completed flows
  └── components/
      ├── ActionItemCard.tsx
      ├── FlowCard.tsx
      ├── StatusBadge.tsx
      ├── PriorityIndicator.tsx
      ├── WaitingIndicator.tsx
      └── FilterControls.tsx

frontend/src/components/Cockpit/
  ├── EntityGraph/
  │   ├── EntityGraph.tsx       # Main graph component
  │   ├── EntityNode.tsx        # Node rendering
  │   ├── EntityEdge.tsx        # Edge rendering
  │   ├── EntityPreview.tsx     # Hover tooltip
  │   ├── EntityContextMenu.tsx # Right-click menu
  │   ├── InlineEditPanel.tsx   # Side panel for editing
  │   └── GraphMinimap.tsx
  │
  ├── Widgets/
  │   ├── WidgetGrid.tsx        # Grid container
  │   ├── Widget.tsx            # Base widget
  │   ├── MyTasksWidget.tsx
  │   ├── TodaysNumbersWidget.tsx
  │   ├── UpcomingCallsWidget.tsx
  │   ├── RecentActivityWidget.tsx
  │   ├── QuickActionsWidget.tsx
  │   ├── EntityExplorerWidget.tsx
  │   └── WidgetPicker.tsx
  │
  └── CallModal/
      ├── QuickCallModal.tsx    # Enhanced call logging
      └── CallTimer.tsx

frontend/src/services/
  ├── actionItemsService.ts
  ├── notificationsService.ts
  ├── universalSearchService.ts
  ├── entityGraphService.ts
  └── cockpitLayoutService.ts

frontend/src/hooks/
  ├── useActionItems.ts
  ├── useActionItemCounts.ts
  ├── useNotifications.ts
  ├── useUniversalSearch.ts
  ├── useEntityGraph.ts
  ├── useCockpitLayout.ts
  └── useKeyboardShortcuts.ts

frontend/src/contexts/
  ├── NotificationsContext.tsx
  ├── CockpitContext.tsx
  └── EntityGraphContext.tsx

frontend/src/components/Notifications/
  ├── NotificationBell.tsx
  ├── NotificationPanel.tsx
  └── NotificationItem.tsx

frontend/src/components/Settings/
  └── NotificationPreferences.tsx
```

### Modified Files
```
backend/tenant_apps/workflows/models.py      # New models + status choices
backend/tenant_apps/workflows/views.py       # New endpoints
backend/tenant_apps/workflows/urls.py        # New routes
backend/tenant_apps/workflows/serializers.py # New serializers
backend/tenant_apps/cockpit/models.py        # Enhanced with new models
backend/apps/core/models.py                  # Extend UserPreferences
backend/projectmeats/urls.py                 # Add new routes

frontend/src/config/navigation.ts            # Restructure: Cockpit, Calls, Forms & Flows
frontend/src/App.tsx                         # Update routes
frontend/src/components/Layout/Sidebar.tsx   # Badge rendering
frontend/src/components/Layout/Header.tsx    # NotificationBell + CommandBar
frontend/src/pages/Dashboard.tsx             # DEPRECATED → redirect to Cockpit
frontend/src/pages/Settings.tsx              # Notification + Cockpit prefs
```

### Deleted/Moved Files
```
frontend/src/pages/Dashboard.tsx             # → Deprecated, redirect to Cockpit
frontend/src/pages/Cockpit/CallLog.tsx       # → Renamed to Calls.tsx
frontend/src/pages/Cockpit.tsx               # → Merged into new Cockpit/index.tsx
```

---

## API Endpoints

### Workflows & Notifications Endpoints
```
GET  /api/v1/workflows/action-items/
     Query: ?status=action_required|waiting&priority=high|medium|low&assigned_to=me
     Returns: Paginated list of action items

GET  /api/v1/workflows/action-items/counts/
     Returns: { action_required: N, waiting: N, overdue: N, total: N }

POST /api/v1/workflows/steps/{id}/assign/
     Body: { assigned_to, priority, due_date, notes }
     
POST /api/v1/workflows/steps/{id}/mark-waiting/
     Body: { waiting_type, expected_by, party_name, notes }
     
POST /api/v1/workflows/steps/{id}/mark-received/
     Body: { notes }

GET  /api/v1/workflows/submissions/{id}/history/
     Returns: List of status changes with audit info

GET  /api/v1/workflows/notifications/
     Query: ?unread_only=true
     Returns: Paginated list of notifications

POST /api/v1/workflows/notifications/{id}/mark-read/

POST /api/v1/workflows/notifications/mark-all-read/

GET  /api/v1/users/me/notification-preferences/
PUT  /api/v1/users/me/notification-preferences/
```

### Cockpit & Universal Search Endpoints
```
# Universal Search
GET  /api/v1/search/universal/
     Query: ?q=<search_term>&types=supplier,customer,po&limit=20
     Returns: { results: [...], total: N, query: str }

GET  /api/v1/search/suggestions/
     Query: ?q=<partial>&limit=10
     Returns: { suggestions: [...] }

GET  /api/v1/search/recent/
     Returns: { recent_items: [...] }

POST /api/v1/search/track-click/
     Body: { entity_type, entity_id }
     (Updates relevance scoring)

# Entity Graph API
GET  /api/v1/entities/{type}/{id}/
     Returns: Unified entity data with display metadata

GET  /api/v1/entities/{type}/{id}/relationships/
     Query: ?depth=1&types=all
     Returns: { relationships: [...], entity_types: [...] }

POST /api/v1/entities/{type}/
     Body: Entity data
     Returns: Created entity

PATCH /api/v1/entities/{type}/{id}/
     Body: Partial entity data
     Returns: Updated entity

GET  /api/v1/entities/graph-schema/
     Returns: { entity_types: [...], relationship_types: [...] }

# Cockpit Layout API
GET  /api/v1/cockpit/layout/
     Returns: Current user's layout configuration

PUT  /api/v1/cockpit/layout/
     Body: { widgets: [...], template_name: str }
     Returns: Updated layout

POST /api/v1/cockpit/layout/reset/
     Body: { template: "broker" | "sales_manager" | "operations" }
     Returns: Reset layout

GET  /api/v1/cockpit/templates/
     Returns: { templates: [...] }

# Saved Graphs API
GET  /api/v1/cockpit/graphs/
     Returns: Paginated list of saved graphs

POST /api/v1/cockpit/graphs/
     Body: { name, description, graph_state }
     Returns: Created graph

GET  /api/v1/cockpit/graphs/{id}/
     Returns: Saved graph details

PUT  /api/v1/cockpit/graphs/{id}/
     Body: { name?, description?, graph_state? }
     Returns: Updated graph

DELETE /api/v1/cockpit/graphs/{id}/
```

---

## UI/UX Principles

### Core Principles (INTUITIVE • SMART • SIMPLE • EFFICIENT • DYNAMIC • POWERFUL • IDEAL • EXTENSIBLE)

1. **Action-First Design** - Most urgent items at the top, one-click actions
2. **Clear Visual Hierarchy** - Red for overdue, orange for action required, yellow for waiting, green for complete
3. **Progressive Disclosure** - Summary → Details on click → Full page on deep dive
4. **Minimal Clicks** - 3 clicks max to any action, keyboard shortcuts for power users
5. **Responsive** - Works on tablet/mobile for field use
6. **Accessible** - Full keyboard navigation, screen reader support, WCAG 2.1 AA
7. **Real-time Feel** - Polling for updates, optimistic UI for actions, smooth animations
8. **Configurable** - User controls notification and layout preferences
9. **Context Preservation** - Never lose your place when exploring data
10. **Intelligent Assistance** - Smart suggestions, auto-complete, recent items

### Cockpit-Specific Principles

| Principle | Implementation |
|-----------|----------------|
| **Situational Awareness** | All critical info visible without scrolling |
| **Rapid Access** | ⌘K search, keyboard shortcuts, quick actions |
| **Flow State** | Minimize interruptions, smooth transitions |
| **Customization** | Widgets, templates, saved graphs |
| **Visual Connections** | Entity graph shows relationships clearly |
| **Inline Everything** | Edit, create, link without page navigation |

---

## Success Criteria

### Forms & Flows Success Criteria
1. ✅ Users can see all action items in one place (My Tasks)
2. ✅ Clear distinction between "my action" vs "waiting on others"
3. ✅ Navigation reflects new structure with badge counts
4. ✅ Notification bell shows unread count
5. ✅ Users can configure notification preferences
6. ✅ Form builder supports configuring waiting states
7. ✅ Dashboard shows actionable summary widget
8. ✅ Full audit trail of status changes
9. ✅ Assignment workflow functions properly
10. ✅ No regression in existing form submission flow
11. ✅ Architecture supports future conditional paths

### Cockpit Command Center Success Criteria
12. ✅ Universal search finds any entity within 500ms
13. ✅ Entity graph loads and renders smoothly (60fps)
14. ✅ Inline editing saves without page reload
15. ✅ Widget layout persists across sessions
16. ✅ Keyboard shortcuts work consistently
17. ✅ Recent items tracked and displayed accurately
18. ✅ Graph exploration allows 3+ levels of relationship traversal
19. ✅ Templates provide meaningful starting layouts
20. ✅ Cockpit loads within 2 seconds (first paint)
21. ✅ Mobile-responsive for tablet use (iPad)

### Calls Page Success Criteria
22. ✅ "Calls" rename reflected everywhere
23. ✅ Call logging takes <30 seconds
24. ✅ Timer tracks call duration accurately
25. ✅ Follow-up scheduling integrated
26. ✅ Entity linking works bidirectionally
27. ✅ Contact frequency tracking functional

---

## Technical Notes

### Badge Polling Strategy
```typescript
// Poll every 60 seconds for badge counts
// Use shorter interval (30s) when user is on Forms & Flows pages
const POLL_INTERVAL = {
  background: 60000,  // 1 minute
  active: 30000,      // 30 seconds
};
```

### Universal Search Strategy
```typescript
// Search debounce to prevent API spam
const SEARCH_DEBOUNCE_MS = 150;

// Search sources ranked by priority
const SEARCH_SOURCES = [
  { type: 'cached', priority: 1 },    // UniversalSearchIndex
  { type: 'recent', priority: 2 },    // User's recent items
  { type: 'live', priority: 3 },      // Real-time DB query (fallback)
];

// Result limits per entity type
const RESULTS_PER_TYPE = 5;
const TOTAL_RESULTS = 20;
```

### Entity Graph Performance
```typescript
// Graph rendering limits
const MAX_VISIBLE_NODES = 50;      // Beyond this, cluster nodes
const MAX_EXPANSION_DEPTH = 3;     // Prevent infinite traversal
const ANIMATION_DURATION_MS = 300; // Smooth transitions

// Use virtualization for large graphs
// Cluster distant nodes into summary nodes
// Progressive loading as user zooms/pans
```

### Notification Delivery Flow
```
1. Event occurs (status change, assignment, etc.)
2. Signal/hook creates UserNotification record
3. If user's email_enabled && notification type enabled:
   a. If immediate: queue email send
   b. If digest: mark for digest aggregation
4. Frontend polls /notifications/ or receives via WebSocket (future)
5. Badge count updates
6. User clicks → marks as read
```

### Performance Considerations
- Use database indexes on: submission.status, step.status, assignment.assigned_to
- Paginate action items (default 20 per page)
- Cache badge counts with short TTL (30 seconds)
- Use select_related/prefetch_related for nested data
- Debounce polling during rapid user actions
- Virtual scrolling for large lists
- Memoize Entity graph nodes to prevent re-renders
- Cache search results with query-based keys

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking existing forms | High | Medium | Extensive testing, feature flags, gradual rollout |
| Entity graph performance | High | Medium | Virtualization, node limits, lazy loading |
| Search index staleness | Medium | Low | Real-time index updates via signals |
| Performance with many action items | Medium | Medium | Pagination, caching, indexes |
| Email spam from notifications | Medium | Low | User preferences, digest option, rate limiting |
| Complex migration | Medium | Low | Reversible migration, staging test |
| Badge count drift | Low | Low | Regular reconciliation, polling |
| Learning curve for Cockpit | Medium | Medium | Onboarding tour, keyboard shortcut hints |
| Widget layout corruption | Low | Low | Layout validation, reset to template option |

---

## Technology Choices

### Entity Graph Library
**Recommended: React Flow**
- Pros: Mature, well-documented, built-in pan/zoom, node/edge customization
- Cons: Large bundle size (~150KB gzipped)
- Alternative: D3-force (lighter but more manual work)

### Widget Grid Library
**Recommended: react-grid-layout**
- Pros: Drag-and-drop, responsive, persistence-ready
- Cons: Learning curve for responsive breakpoints
- Alternative: Custom CSS Grid + drag API

### Search Implementation
**Recommended: PostgreSQL Full-Text Search + Trigram**
- Pros: No external dependency, good enough for ~100K records
- Cons: Won't scale to millions without dedicated search service
- Future: Consider Elasticsearch/Meilisearch for scale

---

## Notes

- Existing `ActivityLog` in cockpit could be leveraged for step notes
- `FormSubmissionEvent` already tracks form_started, step_completed - extend for status changes
- Quick Actions menu continues to work for starting new flows
- Consider WebSocket upgrade in future for real-time updates
- Mobile app consideration: push notifications via Firebase/APNs
- Entity graph could integrate with AI assistant for "smart suggestions"
- Saved graphs could be shared between team members (future feature)
- Widget templates could be admin-configurable per tenant (future feature)

---

## Appendix A: Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open Command Palette (Universal Search) |
| `⌘/` / `Ctrl+/` | Open Keyboard Shortcuts Help |
| `Escape` | Close modal / Clear selection |
| `Enter` | Select focused item |
| `↑` / `↓` | Navigate search results |
| `Tab` | Switch search filters |
| `⌘S` / `Ctrl+S` | Save current entity (when editing) |
| `⌘N` / `Ctrl+N` | New entity (context-aware) |
| `G` then `C` | Go to Cockpit |
| `G` then `L` | Go to Calls |
| `G` then `T` | Go to Tasks |
| `G` then `F` | Go to Forms & Flows |

---

## Appendix B: Widget Configuration Schema

```typescript
interface WidgetConfig {
  id: string;                    // Unique widget instance ID
  type: WidgetType;              // Widget type identifier
  position: {
    row: number;                 // Grid row (0-indexed)
    col: number;                 // Grid column (0-indexed)
  };
  size: {
    w: 1 | 2 | 3 | 4;           // Width in grid units
    h: 1 | 2 | 3;               // Height in grid units
  };
  settings: Record<string, any>; // Widget-specific settings
  collapsed: boolean;            // Is minimized to title bar
}

type WidgetType = 
  | 'my-tasks'
  | 'todays-numbers'
  | 'upcoming-calls'
  | 'recent-activity'
  | 'quick-actions'
  | 'entity-explorer'
  | 'custom-kpi'
  | 'price-watch'
  | 'market-news';
```

---

## Appendix C: Entity Type Icons & Colors

| Entity Type | Icon | Color (Light) | Color (Dark) |
|-------------|------|---------------|--------------|
| Supplier | 🏭 | `#6366f1` (indigo) | `#818cf8` |
| Customer | 🛒 | `#10b981` (emerald) | `#34d399` |
| Contact | 👤 | `#8b5cf6` (violet) | `#a78bfa` |
| Product | 🥩 | `#f59e0b` (amber) | `#fbbf24` |
| Purchase Order | 📋 | `#3b82f6` (blue) | `#60a5fa` |
| Sales Order | 📦 | `#06b6d4` (cyan) | `#22d3ee` |
| Invoice | 💵 | `#22c55e` (green) | `#4ade80` |
| Plant | 🏗️ | `#64748b` (slate) | `#94a3b8` |
| Carrier | 🚚 | `#f97316` (orange) | `#fb923c` |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | Team | Initial Forms & Flows plan |
| 2.0 | 2026-01-31 | Team | Added Cockpit Command Center, Calls overhaul, Entity Graph |


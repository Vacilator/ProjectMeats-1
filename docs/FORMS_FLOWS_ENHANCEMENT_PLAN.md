# Forms & Flows Enhancement Plan
## Integrating Workflows into Workspace with Action-Aware Status Tracking

**Created:** 2026-01-30
**Status:** 📋 PLANNING - ENHANCED

---

## Executive Summary

Transform the current "Workflows" section into a unified "Forms & Flows" experience within the Workspace section. This enhancement will:

1. **Reorganize Navigation** - Move workflows under Workspace as "Forms & Flows"
2. **Unified Dashboard** - Combine form submissions, in-progress flows, and action items
3. **Action-Aware Status System** - Clear visibility into what requires user action vs waiting on external parties
4. **Notification System** - Configurable notifications (in-app, email) with user preferences
5. **Assignment System** - Ability to assign steps to specific users for action
6. **Audit Trail** - Complete history of status changes and actions
7. **Extensible Architecture** - Design for future conditional paths, triggers, and automated actions

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

### Frontend Gaps
| Gap | Impact | Solution |
|-----|--------|----------|
| NavigationItem lacks badge | Can't show counts in menu | Extend interface |
| Sidebar doesn't render badges | No visual indicator | Add badge component |
| No real-time updates | Badge counts stale | Add polling or WebSocket |
| No notification bell | Users miss alerts | Add NotificationBell component |
| No preference management | Can't configure notifications | Add preferences page |

### UserPreferences Gap
The existing `UserPreferences` model in `apps/core/models.py` handles theme/layout but **NOT** notification preferences. Need to extend or add new model.

---

## Current State Analysis

### Navigation Structure (Current)
```
├── Workspace
│   ├── Dashboard
│   ├── Call Log
│   └── Reports
├── Workflows (separate section)
│   ├── Catalog
│   └── Monitor
```

### Existing Components
| Component | Location | Purpose |
|-----------|----------|---------|
| WorkflowList.tsx | pages/Workflows/ | "App Store" view for starting workflows |
| WorkflowMonitor.tsx | pages/Workflows/ | Execution tracking dashboard |
| MySubmissions/index.tsx | pages/MySubmissions/ | User's form submissions list |
| FormSubmissionModal.tsx | components/FormSubmission/ | Multi-step form filling UI |
| QuickActionsContext.tsx | contexts/ | Global quick actions state |
| UserPreferences | apps/core/models.py | Theme/layout prefs (no notifications) |
| ActivityLog | tenant_apps/cockpit/models.py | Generic activity tracking |

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
│   ├── Dashboard
│   ├── Call Log
│   ├── Reports
│   └── Forms & Flows (NEW - replaces Workflows)
│       ├── My Tasks (3)     ← Badge showing action count
│       ├── In Progress      ← Active form flows
│       ├── Catalog          ← Available forms to start
│       └── History          ← Completed/cancelled flows
```

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

### Phase 12: Polish & Testing (2 days)
- [ ] **12.1** Comprehensive testing of all flows
- [ ] **12.2** Accessibility review (ARIA, keyboard nav)
- [ ] **12.3** Mobile responsiveness
- [ ] **12.4** Performance optimization (memoization, pagination)
- [ ] **12.5** Error handling review
- [ ] **12.6** Documentation update

---

## File Changes Summary

### New Files
```
backend/tenant_apps/workflows/
  ├── migrations/XXXX_add_status_and_notification_models.py
  ├── serializers/action_items.py
  ├── serializers/notifications.py
  └── services/notification_service.py

frontend/src/pages/FormsFlows/
  ├── index.tsx              # Layout/router
  ├── MyTasks.tsx            # Action items view
  ├── InProgress.tsx         # Active flows
  ├── Catalog.tsx            # Available forms
  ├── History.tsx            # Completed flows
  └── components/
      ├── ActionItemCard.tsx
      ├── FlowCard.tsx
      ├── StatusBadge.tsx
      ├── PriorityIndicator.tsx
      ├── WaitingIndicator.tsx
      └── FilterControls.tsx

frontend/src/services/
  ├── actionItemsService.ts
  └── notificationsService.ts

frontend/src/hooks/
  ├── useActionItems.ts
  ├── useActionItemCounts.ts
  └── useNotifications.ts

frontend/src/contexts/
  └── NotificationsContext.tsx

frontend/src/components/Notifications/
  ├── NotificationBell.tsx
  ├── NotificationPanel.tsx
  └── NotificationItem.tsx

frontend/src/components/Dashboard/
  └── FormsFlowsWidget.tsx

frontend/src/components/Settings/
  └── NotificationPreferences.tsx
```

### Modified Files
```
backend/tenant_apps/workflows/models.py      # New models + status choices
backend/tenant_apps/workflows/views.py       # New endpoints
backend/tenant_apps/workflows/urls.py        # New routes
backend/tenant_apps/workflows/serializers.py # New serializers
backend/apps/core/models.py                  # Extend UserPreferences

frontend/src/config/navigation.ts            # Restructure menu + badge support
frontend/src/App.tsx                         # Update routes
frontend/src/components/Layout/Sidebar.tsx   # Badge rendering
frontend/src/components/Layout/Header.tsx    # NotificationBell
frontend/src/pages/Dashboard.tsx             # Add widget
frontend/src/pages/Settings.tsx              # Notification prefs section
```

---

## API Endpoints

### New Endpoints
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

---

## UI/UX Principles

1. **Action-First Design** - Most urgent items at the top
2. **Clear Visual Hierarchy** - Red for overdue, orange for action required, yellow for waiting, green for complete
3. **Progressive Disclosure** - Summary → Details on click
4. **Minimal Clicks** - Quick actions available from list view
5. **Responsive** - Works on tablet/mobile for field use
6. **Accessible** - Full keyboard navigation, screen reader support
7. **Real-time Feel** - Polling for updates, optimistic UI for actions
8. **Configurable** - User controls notification preferences

---

## Success Criteria

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

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing forms | High | Extensive testing, feature flags |
| Performance with many action items | Medium | Pagination, caching, indexes |
| Email spam from notifications | Medium | User preferences, digest option |
| Complex migration | Medium | Reversible migration, staging test |
| Badge count drift | Low | Regular reconciliation, polling |

---

## Notes

- Existing `ActivityLog` in cockpit could be leveraged for step notes
- `FormSubmissionEvent` already tracks form_started, step_completed - extend for status changes
- Quick Actions menu continues to work for starting new flows
- Consider WebSocket upgrade in future for real-time updates
- Mobile app consideration: push notifications via Firebase/APNs


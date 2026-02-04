# Implementation Plan: Cockpit & Forms/Flows Overhaul

**Status**: 🚀 Phase 2.4 Batch 1 COMPLETE (PRs #2451-2452)  
**Created**: 2026-02-04  
**Updated**: 2026-02-04 - Canvas Interactions Batch 1 Complete  
**Scope**: Full Implementation (~6-8 weeks)  
**Priority**: Phase 2.4 Canvas Interactions in progress

**Recent Achievements:**
- ✅ Phase 2.1: Visual Editor Foundation (100%)
- ✅ Phase 2.4 Batch 1: Viewport controls & MiniMap (100%)
- 🔄 Phase 2.4 Batch 2: Drag-drop enhancements (next)

---

## Executive Summary

This plan addresses multiple interconnected issues:
1. **Routing/Breadcrumb Issues**: Fix URL structure and breadcrumb navigation
2. **Cockpit Fixes**: Wire widgets to real data + add Smart Wizard mode
3. **WorkForms**: Complete overhaul with unified visual editor

---

## Industry Research & Competitive Analysis

### CRM & Workflow Leaders Analyzed
| Platform | Strengths | Key UX Patterns to Adopt |
|----------|-----------|-------------------------|
| **Salesforce Flow** | Enterprise-grade, complex multi-branch workflows | Visual debugging, error routes at every node |
| **HubSpot Workflows** | Intuitive drag-drop, unified marketing/sales/support | Frictionless onboarding, strong analytics |
| **Zoho Blueprint** | Cost-effective, step-by-step process automation | Visual process mapping, approval chains |
| **ActiveCampaign** | Advanced flowchart visual builder, multi-channel | Personalization, dynamic content triggers |
| **Pipedrive** | Visual pipeline, sales-focused automation | "If-this-then-that" logic, AI recommendations |
| **Freshsales (Freddy AI)** | AI-powered lead scoring, auto-enrichment | Multi-step automation, built-in communication |

### Form Builder Leaders
| Platform | Strengths | Key UX Patterns to Adopt |
|----------|-----------|-------------------------|
| **JotForm** | Granular conditional logic, workflow approvals | Page skips, dynamic notifications, calculations |
| **Typeform** | Conversational UI, high completion rates | One-question-at-a-time, logic jumps, AI suggestions |
| **Formstack** | Enterprise compliance, e-signatures | Secure document routing, approval workflows |

### Workflow Automation Leaders
| Platform | Strengths | Key UX Patterns to Adopt |
|----------|-----------|-------------------------|
| **Make (Integromat)** | Node-based visual canvas, error handling | Modular scenarios, visual debugging, routers/iterators |
| **n8n** | Open-source, graph-style editor, deep customization | Execution paths, log output, retry logic |
| **Zapier** | Largest app marketplace, AI agents | Conversational flow-building, template galleries |
| **monday.com** | Board-based automations, project-centric | Recipe-based automation, cross-team visibility |

### Document Generation & Approval Leaders
| Platform | Strengths | Key UX Patterns to Adopt |
|----------|-----------|-------------------------|
| **Moxo** | External stakeholder approvals, magic links | No-login guest access, compliance audit trails |
| **Process Street** | Checklist-based, conditional logic | Pending state tracking, external assignments |
| **PandaDoc/DocuSign** | Template management, e-signatures | Version control, data merge, distribution options |

---

## Design Principles (Enhanced)

Based on industry research, our editor will embody:

### 🎯 INTUITIVE
- **Progressive disclosure**: Start simple, reveal complexity as needed (like Typeform)
- **Visual feedback**: Real-time validation, animated connections (like Make)
- **Contextual guidance**: Tooltips, empty states, quick-start templates

### 🧠 SMART
- **AI-powered suggestions**: Field mapping, next-best-action, rule recommendations
- **Semantic analysis**: Understand "customer_name" ≈ "client_name" for auto-mapping
- **Learning from usage**: Improve suggestions based on historical patterns

### ⚡ EFFICIENT
- **Keyboard shortcuts**: Power users move faster (Ctrl+S, Ctrl+Z, Del, etc.)
- **Templates**: Pre-built patterns for 80% of use cases
- **Batch operations**: Multi-select, bulk edit, copy/paste workflows

### 🔄 DYNAMIC
- **Live preview**: See changes instantly without saving
- **Test mode**: Run workflows with sample data before publishing
- **Real-time sync**: Collaborative editing (future enhancement)

### 💪 POWERFUL
- **Advanced mode**: Full access to all node types and configurations
- **Custom expressions**: Code-level control when needed
- **External party integration**: Pending states, guest portals, e-signatures

### 🧩 EXTENSIBLE
- **Plugin architecture**: Add custom node types
- **API integration**: Connect to any external service
- **Tenant customization**: Custom fields, branding, workflows

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.1 URL & Navigation Restructuring

**Problem**: 
- URL shows `/workspace` instead of `/cockpit`
- Breadcrumb incorrectly starts with "Dashboard" 
- Breadcrumb doesn't reflect actual navigation context

**Solution**:

- [x] **1.1.1** Rename `/workspace` route to `/cockpit` ✅ (2026-02-04)
  - File: `frontend/src/App.tsx`
  - Change: `<Route path="workspace" ...>` → `<Route path="cockpit" ...>`
  - Add redirect: `/workspace` → `/cockpit` (for backward compatibility)

- [x] **1.1.2** Update navigation.ts sidebar config ✅ (2026-02-04)
  - File: `frontend/src/config/navigation.ts`
  - Change: `{ label: 'Cockpit', path: '/workspace' }` → `{ label: 'Cockpit', path: '/cockpit' }`
  - Also renamed "Forms & Flows" to "WorkForms" with `/workforms` paths

- [x] **1.1.3** Fix Breadcrumb component to remove "Dashboard" root ✅ (2026-02-04)
  - File: `frontend/src/components/Navigation/Breadcrumb.tsx`
  - Remove hardcoded "Dashboard" link
  - Use first segment as root OR show nothing for root paths
  - Add mapping for `cockpit: 'Cockpit'`, `workforms: 'WorkForms'`

- [x] **1.1.4** Implement context-aware breadcrumbs ✅ (2026-02-04)
  - When on `/suppliers` → show `Suppliers` (no root prefix)
  - When on `/suppliers/123` → show `Suppliers / [Supplier Name]`
  - When on `/cockpit` → show `Cockpit`
  - When on `/workforms/tasks` → show `WorkForms / My Tasks`

---

### 1.2 Cockpit Dual-Mode Interface

**Problem**: 
- Current Cockpit only shows widget dashboard
- User wants Smart Wizard mode for guided actions

**Solution**:

- [x] **1.2.1** Create CockpitPage wrapper with mode toggle ✅ (2026-02-04)
  - File: `frontend/src/pages/Cockpit/index.tsx` (new)
  - Two modes: "Dashboard" (widgets) and "Wizard" (guided actions)
  - Tab/toggle at top to switch modes
  - Remember last mode in localStorage

- [x] **1.2.2** Create SmartWizard component ✅ (2026-02-04)
  - File: `frontend/src/pages/Cockpit/SmartWizard.tsx` (new)
  - Heading: "What would you like to do today?"
  - Prominent search bar (reuse CommandBar)
  - Action category grid below:
    ```
    📞 Make Call(s)           → Quick dial or schedule
    ✅ Complete My Tasks      → Task list with priorities
    ⚡ Quick Actions          → Tenant-configured actions
    ➕ Create New...          → Entity creation wizard
    📝 Update Existing...     → Entity search & edit
    📊 View Reports           → Analytics shortcuts
    ```

- [x] **1.2.3** Wire SmartWizard to real APIs ✅ (2026-02-04)
  - Quick Actions: Uses `useQuickActions` context (GET /api/v1/workflows/forms/)
  - Entity suggestions: Based on recent activity
  - Tasks: Uses `useActionItems` context (GET /api/v1/workflows/action-items/)

- [x] **1.2.4** Rename Workspace.tsx to CockpitDashboard.tsx ✅ (2026-02-04)
  - Created `pages/Cockpit/CockpitDashboard.tsx` (refactored from Workspace.tsx)
  - Update all imports in App.tsx

---

### 1.3 Widget Data Integration (Fix Mock Data)

**Problem**: 
- QuickStatsWidget uses mock data as fallback
- TodaysNumbersWidget uses mock data
- Other widgets may have similar issues

**Solution**:

- [x] **1.3.1** Create backend workspace stats API ✅ (2026-02-04)
  - File: `backend/tenant_apps/cockpit/views.py` (added WorkspaceStatsView)
  - Endpoint: `GET /api/v1/cockpit/stats/` - aggregated stats for all widgets:
    - quick_stats: orders, revenue, customers, suppliers
    - todays_numbers: orders today, pending, completed, active customers
    - recent_activity: last 10 activity logs
    - upcoming_calls: next 5 scheduled calls

- [x] **1.3.2** Update QuickStatsWidget to use real API ✅ (2026-02-04)
  - Uses useCockpitStats hook
  - Removed mock data fallback
  - Shows loading/error states properly
  - Fetches from `/api/v1/cockpit/stats/` (quick_stats)

- [x] **1.3.3** Update TodaysNumbersWidget to use real API ✅ (2026-02-04)
  - Uses useCockpitStats hook
  - Fetches from `/api/v1/cockpit/stats/` (todays_numbers)
  - Proper error handling
  - Clickable metrics to navigate to entity pages

- [x] **1.3.4** Update RecentActivityWidget ✅ (2026-02-04)
  - Uses useCockpitStats hook
  - Wire to `/api/v1/cockpit/stats/` (recent_activity)
  - Show real changes (orders created, customers updated, etc.)
  - Entity type icons and colors

- [x] **1.3.5** Update UpcomingCallsWidget ✅ (2026-02-04)
  - Uses useCockpitStats hook
  - Wire to `/api/v1/cockpit/stats/` (upcoming_calls)
  - Show actual scheduled callbacks
  - Formatted timestamps and duration

- [x] **1.3.6** Update MyTasksWidget ✅ (Already using ActionItemsContext)
  - Already using NotificationsContext for action items
  - No additional API call needed
  - Properly integrated with existing context system

---

### 1.4 WorkForms Basic Fixes

**Problem**:
- WorkForms pages may not be fetching real data
- Basic functionality not working

**Solution**:

- [x] **1.4.1** Fix InProgress.tsx API endpoint ✅ (2026-02-04)
  - Updated endpoint from `/workflows/submissions/` to `/workflows/form-submissions/`
  - Already has proper loading, error, and empty states
  - Verified build passes

- [x] **1.4.2** Fix History.tsx API endpoint ✅ (2026-02-04)
  - Updated endpoint from `/workflows/submissions/` to `/workflows/form-submissions/`
  - Already has proper loading, error, and empty states
  - Verified build passes

- [x] **1.4.3** Verify Catalog.tsx ✅ (2026-02-04)
  - Delegates to WorkflowList component
  - Uses `admin/system-config/api/available-workflows/`
  - Already has proper error handling and empty states
  - No changes needed - working correctly

- [x] **1.4.4** Verify Tasks route ✅ (2026-02-04)
  - Route `/workforms/tasks` already points to MyTasks component
  - MyTasks.tsx exists and is functional
  - Integrated with ActionItemsContext
  - No changes needed - working correctly

---

## Phase 2: Visual Editor Foundation (Week 3-5)

### 2.1 Unified Canvas Architecture (Industry-Best UX)

**Goal**: Single visual editor combining Forms + Workflows, inspired by Make/n8n/Zapier

**Industry Patterns Implemented:**
- **Node-based graph editor** (like Make/n8n) for complex flows
- **Conversational wizard** (like Typeform) for simple forms
- **Visual debugging** (like Make) with error routes and execution paths
- **Template gallery** (like Zapier) for quick starts

- [x] **2.1.1** Create UnifiedFlowEditor component ✅ **COMPLETE (PR #2425)**
  - File: `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`
  - Base on existing `WorkflowCanvas.tsx` from admin-studio (56KB already implemented!)
  - Use `@xyflow/react` (React Flow v13) - already installed
  - Add: Smooth zoom/pan with minimap (like Make)
  - Add: Floating toolbar for quick actions (like Figma)

- [x] **2.1.2** Define comprehensive node types registry ✅ **COMPLETE (PR #2425)**
  ```typescript
  const NODE_TYPES = {
    // === TRIGGERS (Entry Points) ===
    triggerManual: ManualTriggerNode,     // User clicks button
    triggerSchedule: ScheduleTriggerNode, // Cron/time-based
    triggerWebhook: WebhookTriggerNode,   // External API call
    triggerEvent: EventTriggerNode,       // Record created/updated/deleted
    triggerForm: FormSubmitTriggerNode,   // Form submission
    
    // === FORM ELEMENTS ===
    formStep: FormStepNode,               // Container for fields
    formField: FormFieldNode,             // Individual field (text, number, select, etc.)
    formSection: FormSectionNode,         // Visual grouping
    formSignature: SignatureNode,         // E-signature capture
    formFileUpload: FileUploadNode,       // Document upload
    
    // === LOGIC & ROUTING ===
    conditionIf: ConditionIfNode,         // If/then/else
    conditionSwitch: SwitchCaseNode,      // Multi-branch routing (like Make router)
    conditionFilter: FilterNode,          // Filter records
    loopForEach: ForEachLoopNode,         // Iterate over collection
    loopWhile: WhileLoopNode,             // Repeat until condition
    
    // === ACTIONS ===
    actionEmail: EmailActionNode,         // Send email
    actionNotify: NotifyActionNode,       // In-app notification
    actionSMS: SMSActionNode,             // Send SMS (future)
    actionCreateRecord: CreateRecordNode, // Create entity
    actionUpdateRecord: UpdateRecordNode, // Update entity
    actionDeleteRecord: DeleteRecordNode, // Delete entity
    actionHTTP: HTTPRequestNode,          // External API call
    actionScript: ScriptNode,             // Custom JavaScript/Python
    
    // === WAIT STATES (External Party Integration) ===
    pendingApproval: ApprovalPendingNode, // Wait for internal approval
    pendingDocument: DocumentPendingNode, // Wait for document upload
    pendingResponse: ResponsePendingNode, // Wait for external party response
    pendingPayment: PaymentPendingNode,   // Wait for payment confirmation
    timerDelay: DelayTimerNode,           // Wait for time duration
    timerSchedule: ScheduleTimerNode,     // Wait until specific date/time
    
    // === DOCUMENTS ===
    documentGenerate: DocumentGenerateNode, // Generate PDF/Word
    documentMerge: DocumentMergeNode,       // Combine multiple docs
    documentSign: DocumentSignNode,         // Request signature
    documentStore: DocumentStoreNode,       // Save to storage
    
    // === UTILITIES ===
    dataTransform: DataTransformNode,     // Map/transform data
    dataLookup: LookupNode,               // Query related records
    dataMerge: MergeNode,                 // Combine data from branches
    noteComment: CommentNode,             // Visual annotation
    groupSubflow: SubflowNode,            // Encapsulate sub-workflow
    
    // === TERMINAL ===
    endSuccess: EndSuccessNode,           // Successful completion
    endError: EndErrorNode,               // Error termination
    endCancel: EndCancelNode,             // User cancellation
  };
  ```

- [x] **2.1.3** Create node components with industry-best UX ✅ **COMPLETE (PR #2425, #2434)**
  Each node has:
  - **Clear visual identity** (icon, color, shape)
  - **Status indicator** (draft, active, error, disabled)
  - **Quick config preview** (show key settings without opening panel)
  - **Connection handles** with type validation
  - **Step number** for sequential flows
  - **Error route** option (like Make's error handling)
  
  Completed: 8/30+ node types (27% coverage)
  1. `FormStepNode.tsx` - Multi-field form step ✅
  2. `TriggerNode.tsx` - Event triggers with iconography ✅
  3. `ConditionIfNode.tsx` - Visual if/else branches ✅
  4. `ActionNode.tsx` - Generic action with type selection ✅
  5. `WaitStateNode.tsx` - Wait for approval/document/response/payment ✅
  6. `DocumentNode.tsx` - Generate/merge/sign/store documents ✅
  7. `UtilityNode.tsx` - Transform/lookup/merge data ✅
  8. `TerminalNode.tsx` - Success/error/cancel endpoints ✅

- [x] **2.1.4** Implement edge types with visual feedback ✅ **COMPLETE (PR #2434)**
  ```typescript
  const EDGE_TYPES = {
    custom: CustomEdge,             // Standard with animations and labels
    conditional: ConditionalEdge,   // Shows "Yes/No" or custom label
    success: SuccessEdge,           // Green, animated when executing
    error: ErrorEdge,               // Red dashed line
    animated: AnimatedEdge,         // Shows data flowing (for live preview)
  };
  ```
  Features:
  - **Bezier curves** for clean appearance ✅
  - **Labels** on conditional edges ✅
  - **Animated dots** during execution preview ✅
  - **Click to add node** (insert between existing nodes) ⏳ Future

- [x] **2.1.5** Create intelligent node palette/toolbar ✅ **COMPLETE (PR #2436, #2438)**
  - **Categorized accordion** with search filter ✅
  - **Drag preview** shows ghost node ✅
  - **Double-click** to add at center ⏳ Future
  - **Favorites/Recent** section at top ✅
  - **Quick add menu** (right-click on canvas) ⏳ Future
  - **Search with / shortcut** ✅
  - **Category collapse/expand** ✅
  - **Star button to favorite nodes** ✅
  - **Auto-track recent nodes** ✅
  - **Keyboard shortcuts** (Tab, /, Del, Ctrl+Z/Y/S) ✅
  - **Undo/Redo history** (50 snapshots) ✅
  - **Connection validation** (maxInputs/maxOutputs) ✅
  
  Categories:
  ```
  ⚡ TRIGGERS
     Manual Start • Scheduled • Webhook • On Record Change • Form Submit
  
  📋 FORMS
     Form Step • Text Field • Number • Select • Date • File Upload • Signature
  
  🔀 LOGIC
     If/Then/Else • Switch (Multi-Branch) • Filter • Loop • Merge Branches
  
  🎯 ACTIONS
     Send Email • Notify User • Create Record • Update Record • HTTP Request
  
  ⏳ WAIT STATES
     Wait for Approval • Wait for Document • Wait for Response • Delay Timer
  
  📄 DOCUMENTS
     Generate PDF • Merge Documents • Request Signature • Store File
  
  🔧 UTILITIES
     Transform Data • Lookup Record • Add Comment • Create Subflow
  ```

---

### 2.2 Editor Modes & Progressive Disclosure (Like Typeform + Make)

**Goal**: Start simple like Typeform, graduate to powerful like Make

**Industry Insight**: 
- Typeform's one-question-at-a-time builds engagement
- Make's visual canvas handles complexity
- Salesforce Flow's advanced mode serves power users

- [ ] **2.2.1** Implement three-tier editor modes
  ```typescript
  type EditorMode = 
    | 'wizard'    // Typeform-style: One step at a time, guided questions
    | 'visual'    // Make/n8n-style: Drag-drop canvas, see full flow
    | 'expert';   // Salesforce-style: Full control, code expressions
  
  interface ModeCapabilities {
    wizard: {
      nodeTypes: ['formStep', 'formField', 'conditionIf', 'actionEmail', 'endSuccess'],
      features: ['guided-setup', 'templates-only', 'auto-connections'],
      targetUser: 'Business users, first-time creators',
    },
    visual: {
      nodeTypes: [...wizardNodes, 'pendingApproval', 'documentGenerate', 'switchCase', 'loop'],
      features: ['drag-drop', 'custom-connections', 'basic-conditions'],
      targetUser: 'Power users, process owners',
    },
    expert: {
      nodeTypes: ['*'], // All nodes
      features: ['code-expressions', 'api-integrations', 'custom-scripts', 'subflows'],
      targetUser: 'Developers, automation specialists',
    },
  };
  ```

- [ ] **2.2.2** Wizard Mode (Typeform-inspired)
  - **Conversational interface**: "Let's build your form..."
  - **One question at a time**: "What should this form collect?"
  - **Smart suggestions**: After "Customer Name" → suggest "Email", "Phone"
  - **Preview pane**: See form as respondent would see it
  - **Auto-layout**: System creates the canvas structure behind scenes
  - **Escape hatch**: "Switch to Visual Editor" at any time

- [ ] **2.2.3** Visual Mode (Make/n8n-inspired)
  - **Full canvas view** with drag-drop
  - **Connection validation** prevents invalid links
  - **Inline editing** for quick changes
  - **Template insertion** into existing flows
  - **Execution preview** shows data flow animation
  - **Error indicators** on problematic nodes

- [ ] **2.2.4** Expert Mode (Salesforce Flow-inspired)
  - **All node types** available
  - **Code expressions**: `{{customer.name | uppercase}}`
  - **Custom JavaScript** actions
  - **API configuration** for external services
  - **Variable inspector** for debugging
  - **Version diff** viewer

- [ ] **2.2.5** Smart mode transitions
  - **Auto-upgrade**: Wizard → Visual when adding complex node
  - **Guided downgrade**: Visual → Wizard with "Simplify" option
  - **Warning dialogs**: "Some features won't be available in Wizard mode"
  - **Preserve work**: Never lose configuration on mode switch

---

### 2.3 Template Library (Zapier-Quality)

**Goal**: 10,000+ templates feeling, start with 20 core ones

**Industry Insight**: Zapier's template gallery drives 60% of new automations

- [ ] **2.3.1** Create template system architecture
  ```typescript
  interface FlowTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedSetupTime: string; // "5 minutes"
    thumbnail: string;
    tags: string[];
    popularity: number; // Usage count
    
    // The actual flow definition
    nodes: Node[];
    edges: Edge[];
    
    // Customization points
    variables: TemplateVariable[]; // Fields user must fill
    optionalExtensions: string[]; // Suggested additions
  }
  
  type TemplateCategory = 
    | 'forms'           // Data collection
    | 'approvals'       // Approval chains
    | 'onboarding'      // Customer/supplier onboarding
    | 'orders'          // Purchase/sales order flows
    | 'documents'       // Document generation
    | 'notifications'   // Alert workflows
    | 'integrations';   // External system connections
  ```

- [ ] **2.3.2** Implement core templates (20 templates)

  **FORMS (5 templates)**
  - Simple Contact Form (beginner, 2 min)
  - Multi-Step Survey (beginner, 5 min)
  - Customer Feedback with Rating (beginner, 3 min)
  - Job Application with File Upload (intermediate, 10 min)
  - Dynamic Quote Request (intermediate, 15 min)

  **APPROVALS (4 templates)**
  - Single-Level Approval (beginner, 5 min)
  - Sequential Multi-Level Approval (intermediate, 10 min)
  - Parallel Approval (multiple approvers) (intermediate, 15 min)
  - Conditional Approval (amount-based routing) (advanced, 20 min)

  **ONBOARDING (3 templates)**
  - New Customer Onboarding (intermediate, 15 min)
  - New Supplier Onboarding with Documents (intermediate, 20 min)
  - Employee Onboarding Checklist (advanced, 30 min)

  **ORDERS (4 templates)**
  - Purchase Order Request & Approval (intermediate, 15 min)
  - Quote to Sales Order Conversion (intermediate, 20 min)
  - Order Fulfillment Workflow (advanced, 25 min)
  - Return/Refund Processing (advanced, 20 min)

  **DOCUMENTS (4 templates)**
  - Auto-Generate Invoice from Order (intermediate, 10 min)
  - Contract Generation & Signature (advanced, 25 min)
  - Bulk Document Collection (intermediate, 15 min)
  - Compliance Document Checklist (advanced, 30 min)

- [ ] **2.3.3** Template selector modal (Netflix-style browsing)
  - **Hero section**: Featured template of the week
  - **Category rows**: Horizontal scroll cards
  - **Search with filters**: Category, difficulty, time
  - **Preview mode**: See template structure before using
  - **"Use Template" button**: Copies to new draft
  - **"Start from Scratch"**: Blank canvas option

- [ ] **2.3.4** Template customization wizard
  - **Variable filling**: Replace placeholders with real values
  - **Confirmation step**: Review before creating
  - **Optional extensions**: "Add email notification?" suggestions

---

### 2.4 Canvas Interactions (Make/Figma-Quality) ✅ BATCH 1 COMPLETE!

**Goal**: Buttery-smooth interactions that feel professional

**Progress**: 2/7 tasks complete (29%)

#### Batch 1 Complete (PRs #2451, #2452)
- ✅ **2.4.4** Navigation & viewport (Figma-quality)
  - Custom viewport toolbar with zoom in/out/fit buttons
  - Keyboard shortcuts: F (fit), 1 (100%), 2 (50%), 3 (fit)
  - Ctrl+A (select all), Escape (deselect all)
  - Enhanced MiniMap with custom node colors
  - Pannable and zoomable MiniMap
  - Removed redundant default Controls
  - Build time: 16-19s
  - Status: ✅ Merged to development

#### Remaining Tasks
- [ ] **2.4.1** Drag-drop from palette (Figma-quality)
  - **Ghost preview** during drag
  - **Smart snapping** to grid and alignment guides
  - **Drop zone highlighting** 
  - **Auto-connect** when dropped near existing node
  - **Insert between** existing connections
  - **Undo on Escape** while dragging

- [ ] **2.4.2** Node configuration panel (HubSpot-inspired)
  - **Slide-in from right** (400px width)
  - **Tabbed sections**: Config, Data Mapping, Advanced
  - **Live validation** with inline errors
  - **Field search** for complex nodes
  - **Help tooltips** with examples
  - **"Test this step"** button

- [ ] **2.4.3** Connection validation (Make-quality)
  - **Type-aware handles**: Only valid connections allowed
  - **Visual feedback**: Green = valid, Red = invalid
  - **Suggestion popup**: "Did you mean to connect to...?"
  - **Auto-routing**: Edges avoid crossing nodes
  - **Label editing**: Double-click edge to add label

- [ ] **2.4.4** Navigation & viewport (Figma-quality)
  - **Mini-map**: Always-visible in corner
  - **Zoom controls**: Buttons + scroll + pinch
  - **Fit to view**: Center entire flow
  - **Focus on selection**: Zoom to selected nodes
  - **Breadcrumb for subflows**: Navigate hierarchy

- [ ] **2.4.5** Keyboard shortcuts (Power user essentials)
  ```
  Navigation:
  - Space + Drag: Pan canvas
  - Scroll: Zoom
  - F: Fit to view
  - 1/2/3: Zoom to 100%/50%/fit
  
  Editing:
  - Del/Backspace: Delete selected
  - Ctrl+C/V/X: Copy/Paste/Cut
  - Ctrl+D: Duplicate
  - Ctrl+Z/Y: Undo/Redo
  - Ctrl+S: Save
  - Ctrl+Shift+S: Save as new version
  
  Selection:
  - Click: Select single
  - Shift+Click: Add to selection
  - Ctrl+A: Select all
  - Escape: Deselect all
  
  Quick Actions:
  - N: Open node palette
  - /: Search commands
  - ?: Show shortcuts help
  ```

- [ ] **2.4.6** Real-time collaboration indicators (future-ready)
  - **Presence cursors**: See other editors' positions
  - **Lock indicators**: Node being edited by another user
  - **Change highlights**: Recent changes pulse briefly

- [ ] **2.4.7** Execution preview mode
  - **Play button**: Step through flow with sample data
  - **Animated edges**: Show data flowing
  - **Node highlighting**: Currently executing node glows
  - **Variable inspector**: See data at each step
  - **Branch visualization**: Show which path was taken

---

## Phase 3: Smart Features (Week 5-7)

### 3.1 AI-Powered Field Mapping (Industry Best: Salesforce + Ampersand)

**Goal**: Intelligent, learning suggestions for data connections

**Industry Insight**: 
- Salesforce's AI data mapping achieves 85% auto-match accuracy
- Ampersand's declarative platform learns from corrections
- Best practice: Combine rule-based + ML for transparency + adaptability

- [ ] **3.1.1** Create intelligent field mapping engine
  ```typescript
  // File: frontend/src/components/FlowEditor/services/fieldMappingEngine.ts
  
  interface FieldMappingEngine {
    // Analyze and suggest mappings between two datasets
    suggestMappings(
      sourceFields: FieldDefinition[],
      targetFields: FieldDefinition[],
      context?: MappingContext
    ): MappingSuggestion[];
    
    // Learn from user corrections
    learnFromFeedback(suggestion: MappingSuggestion, accepted: boolean): void;
    
    // Get historical mapping patterns for this tenant
    getHistoricalPatterns(entityType: string): HistoricalMapping[];
  }
  
  interface MappingSuggestion {
    sourceField: string;
    sourceType: FieldType;
    targetField: string;
    targetType: FieldType;
    confidence: number;           // 0-1 probability
    mappingType: MappingType;
    reason: string;               // Human-readable explanation
    transformations?: Transform[]; // Required data transformations
  }
  
  type MappingType = 
    | 'direct'      // Exact match: customer_name → customer_name
    | 'semantic'    // Meaning match: client_name → customer_name
    | 'lookup'      // Reference lookup: customer_id → customer.name
    | 'transform'   // Requires conversion: "USD 100" → 100.00
    | 'computed'    // Calculated: quantity * unit_price → total
    | 'default';    // Use default value when missing
  ```

- [ ] **3.1.2** Multi-factor scoring algorithm
  ```typescript
  interface ScoringFactors {
    // Factor 1: Name Similarity (40% weight)
    nameSimilarity: {
      exact: 1.0,           // "customer_name" = "customer_name"
      camelCaseMatch: 0.95, // "customerName" = "customer_name"
      synonymMatch: 0.85,   // "client" = "customer"
      fuzzyMatch: 0.70,     // Levenshtein distance < 3
      prefixMatch: 0.50,    // "cust_name" = "customer_name"
    };
    
    // Factor 2: Type Compatibility (25% weight)
    typeCompatibility: {
      exact: 1.0,           // string → string
      coercible: 0.8,       // number → string
      lossy: 0.4,           // string → number (may fail)
      incompatible: 0.0,    // array → boolean
    };
    
    // Factor 3: Historical Usage (20% weight)
    historicalUsage: {
      tenantSpecific: 1.0,  // This tenant mapped these before
      crossTenant: 0.7,     // Other tenants mapped these
      industryPattern: 0.5, // Common in meat industry
    };
    
    // Factor 4: Semantic Analysis (15% weight)
    semanticAnalysis: {
      sameCategory: 0.8,    // Both are "contact info" fields
      relatedConcept: 0.5,  // "email" and "notification"
      unrelated: 0.1,
    };
  }
  ```

- [ ] **3.1.3** Visual mapping UI (Ampersand-inspired)
  - **Two-column layout**: Source fields | Target fields
  - **Connection lines**: Animated paths showing mappings
  - **Confidence indicators**: Green (>80%), Yellow (50-80%), Red (<50%)
  - **One-click accept**: Apply suggested mapping
  - **Drag to connect**: Manual mapping override
  - **Transform editor**: When types don't match, show conversion options
  - **Preview pane**: See sample data before/after mapping

- [ ] **3.1.4** Learning & feedback loop (Backend)
  ```python
  # backend/tenant_apps/workflows/services/mapping_learner.py
  
  class MappingLearner:
      def record_mapping_feedback(
          self,
          tenant: Tenant,
          source_entity: str,
          target_entity: str,
          mapping: Dict[str, str],
          accepted: bool,
          user: User
      ):
          """Record user's mapping decision for future learning."""
          MappingHistory.objects.create(
              tenant=tenant,
              source_entity=source_entity,
              target_entity=target_entity,
              mapping=mapping,
              accepted=accepted,
              user=user,
              context=self._extract_context()
          )
      
      def get_suggestions(
          self,
          tenant: Tenant,
          source_entity: str,
          target_entity: str
      ) -> List[MappingSuggestion]:
          """Get AI-powered mapping suggestions."""
          # 1. Check tenant-specific history
          # 2. Check cross-tenant patterns
          # 3. Apply semantic analysis
          # 4. Score and rank suggestions
          pass
  ```

---

### 3.2 Pending Steps / Wait States (Moxo + Process Street Best Practices)

**Goal**: Enterprise-grade external party management

**Industry Insight**:
- Moxo's magic links eliminate login friction for external parties
- Process Street's checklist approach ensures nothing is missed
- Pipefy's visual pipelines show pending state progression

- [ ] **3.2.1** Comprehensive PendingNode architecture
  ```typescript
  interface PendingNodeConfig {
    // What are we waiting for?
    waitType: WaitType;
    
    // Who needs to act?
    assignment: AssignmentConfig;
    
    // What's the deadline?
    sla: SLAConfig;
    
    // How do we follow up?
    reminders: ReminderConfig[];
    
    // What if they don't respond?
    escalation: EscalationConfig;
    
    // What can they do?
    allowedActions: ExternalAction[];
    
    // What do they see?
    externalPortal: PortalConfig;
  }
  
  type WaitType = 
    | 'approval'        // Yes/No decision
    | 'document'        // File upload required
    | 'form_response'   // Fill out a form
    | 'signature'       // E-signature required
    | 'payment'         // Payment confirmation
    | 'acknowledgment'  // Just confirm receipt
    | 'custom';         // Custom action defined by flow
  
  interface AssignmentConfig {
    assignmentType: 'static' | 'dynamic' | 'role_based' | 'round_robin';
    
    // For internal assignments
    internalAssignment?: {
      type: 'user' | 'role' | 'team' | 'manager_of';
      roles?: ('finance' | 'sales' | 'purchasing' | 'operations' | 'management')[];
      specificUsers?: string[];
      teamId?: string;
      managerOf?: string; // "submitter" | specific user
    };
    
    // For external assignments
    externalAssignment?: {
      partyType: 'supplier' | 'customer' | 'carrier' | 'broker' | 'other';
      contactRole?: 'primary' | 'billing' | 'shipping' | 'any';
      specificEmail?: string; // From flow data
      lookupField?: string;   // Dynamic: "{{order.supplier.contact_email}}"
    };
  }
  
  interface SLAConfig {
    deadline: Duration;
    deadlineType: 'business_days' | 'calendar_days' | 'hours';
    timezone?: string;
    excludeHolidays?: boolean;
    warningThreshold?: Duration; // Warn when X time remaining
  }
  
  interface ReminderConfig {
    timing: 'before_deadline' | 'after_deadline' | 'recurring';
    offset: Duration;
    channel: ('email' | 'sms' | 'in_app')[];
    template: string;
    maxReminders?: number;
  }
  
  interface EscalationConfig {
    triggerAfter: Duration;
    escalateTo: AssignmentConfig;
    notifyOriginal: boolean;
    autoAction?: 'approve' | 'reject' | 'reassign' | 'cancel';
  }
  ```

- [ ] **3.2.2** Smart assignment selector UI
  - **Tabbed interface**: Internal | External | Dynamic
  - **Role picker** with org chart visualization
  - **External party search** with recent contacts
  - **Dynamic expression builder** for flow-based assignment
  - **Preview**: "This will be assigned to: John Smith (Finance Manager)"

- [ ] **3.2.3** SLA & reminder configuration
  - **Visual timeline** showing deadline, reminders, escalation
  - **Business hours calculator** (respects working hours/holidays)
  - **Template library** for reminder messages
  - **Escalation path** visualization

- [ ] **3.2.4** External portal system (Moxo-inspired)
  - **Magic link generation** (no login required)
  - **Branded portal page** with tenant logo
  - **Clear action buttons** (Approve/Reject, Upload, Sign)
  - **Mobile-responsive** design
  - **Secure file upload** with virus scanning
  - **Action confirmation** with audit trail
  - **Auto-expiring links** for security

---

### 3.3 Document Generation (PandaDoc + Documate Best Practices)

**Goal**: Seamless document creation within workflows

**Industry Insight**:
- PandaDoc's template merge achieves 95% accuracy
- Documate's Salesforce integration is gold standard
- Best practice: Preview before generate, multiple distribution channels

- [ ] **3.3.1** DocumentNode comprehensive configuration
  ```typescript
  interface DocumentNodeConfig {
    // Template selection
    template: {
      source: 'system' | 'tenant' | 'uploaded';
      templateId: string;
      version?: string; // Specific version or "latest"
    };
    
    // Output configuration
    output: {
      format: 'pdf' | 'docx' | 'xlsx' | 'html';
      filename: string; // Supports variables: "Invoice_{{order.number}}.pdf"
      compression?: boolean;
    };
    
    // Data mapping
    dataMapping: DocumentDataMapping[];
    
    // Conditional content
    conditionalSections?: ConditionalSection[];
    
    // Distribution
    distribution: DistributionConfig[];
    
    // Post-generation
    postActions?: PostDocumentAction[];
  }
  
  interface DocumentDataMapping {
    placeholder: string;       // "{{customer_name}}"
    source: string;            // "customer.company_name"
    transform?: Transform;     // Formatting, calculations
    fallback?: string;         // Default if source is null
  }
  
  interface ConditionalSection {
    sectionId: string;
    condition: ConditionExpression;
    includeWhen: 'true' | 'false';
  }
  
  interface DistributionConfig {
    channel: 'attach_to_record' | 'email' | 'storage' | 'signature' | 'print_queue';
    config: ChannelSpecificConfig;
  }
  ```

- [ ] **3.3.2** Template management UI
  - **Template library** with thumbnails and preview
  - **Upload custom templates** (docx, xlsx)
  - **Placeholder detection** automatically identifies {{variables}}
  - **Test with sample data** before use
  - **Version management** with comparison

- [ ] **3.3.3** Visual data mapping interface
  - **Template preview** on left, data picker on right
  - **Highlight placeholders** in template
  - **Drag-drop mapping** from data to placeholder
  - **Transform editor** for formatting (dates, currency, etc.)
  - **Live preview** updates as you map

- [ ] **3.3.4** Multi-channel distribution
  - **Attach to record**: Link document to entity in CRM
  - **Email delivery**: Send as attachment with customizable message
  - **Cloud storage**: Save to configured storage (S3, Azure, etc.)
  - **Signature request**: Route to DocuSign/similar
  - **Print queue**: Add to batch print job

- [ ] **3.3.5** Document generation preview
  - **Sample data selection**: Pick real or mock data
  - **Full preview**: Rendered PDF in modal
  - **Download test**: Generate without saving
  - **Validation warnings**: Missing data, formatting issues

---

### 3.4 Visual Condition/Rule Builder (JotForm + Salesforce Flow)

**Goal**: Powerful logic without coding

**Industry Insight**:
- JotForm's conditional logic handles 10+ conditions per field
- Salesforce Flow's decision elements support complex branching
- Best practice: Visual tree + natural language preview

- [ ] **3.4.1** Enhanced ConditionNode UI
  ```typescript
  interface ConditionNodeUI {
    // Display modes
    displayMode: 'simple' | 'builder' | 'expression';
    
    // Simple mode: Single condition
    simpleCondition?: {
      field: string;
      operator: Operator;
      value: any;
    };
    
    // Builder mode: Visual tree
    builderCondition?: ConditionGroup;
    
    // Expression mode: Code
    expressionCondition?: string;
    
    // Natural language preview
    naturalLanguagePreview: string; // "If order amount is greater than $1000..."
  }
  
  interface ConditionGroup {
    logic: 'AND' | 'OR';
    conditions: (SingleCondition | ConditionGroup)[];
  }
  
  interface SingleCondition {
    field: FieldReference;
    operator: Operator;
    value: ValueDefinition;
  }
  
  type Operator = 
    | 'equals' | 'not_equals'
    | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal'
    | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
    | 'is_empty' | 'is_not_empty'
    | 'is_true' | 'is_false'
    | 'in_list' | 'not_in_list'
    | 'between' | 'not_between'
    | 'matches_regex';
  ```

- [ ] **3.4.2** Smart rule suggestions
  ```typescript
  interface RuleSuggestion {
    condition: ConditionGroup;
    reason: string;
    popularity: number; // How often this pattern is used
    examples: string[]; // Real examples from tenant data
  }
  
  // Suggestion triggers:
  // - Field type: Status → suggest common status values
  // - Entity type: PurchaseOrder → suggest amount thresholds ($1000, $5000, $10000)
  // - Historical patterns: "Most users check if customer.is_active is true"
  // - Industry patterns: "Meat industry often checks weight > 100kg"
  ```

- [ ] **3.4.3** Visual condition tree builder
  - **Drag-drop** conditions and groups
  - **Color-coded** AND (blue) vs OR (orange) groups
  - **Inline editing** of values
  - **Add condition** button at each level
  - **Convert to group** to nest conditions
  - **Natural language** summary below tree

- [ ] **3.4.4** Condition testing & simulation
  - **Sample data selector**: Pick a real record
  - **Evaluate button**: Shows true/false result
  - **Branch highlighting**: Which path would execute
  - **Edge case testing**: "What if this field is null?"

---

### 3.5 Context-Aware Action Suggestions (ActiveCampaign + Pipedrive)

**Goal**: Intelligent next-step recommendations

**Industry Insight**:
- ActiveCampaign suggests next actions based on behavior
- Pipedrive's "if-this-then-that" drives 16% better sales outcomes
- Best practice: Context-aware, not overwhelming

- [ ] **3.5.1** Smart action suggestion engine
  ```typescript
  interface ActionSuggestionEngine {
    // Get suggestions based on current node
    getSuggestions(
      currentNode: FlowNode,
      flowContext: FlowContext
    ): ActionSuggestion[];
    
    // Get suggestions for empty canvas
    getStarterSuggestions(
      flowType: 'form' | 'workflow' | 'mixed',
      entityContext?: string
    ): ActionSuggestion[];
  }
  
  interface ActionSuggestion {
    nodeType: string;
    config: Partial<NodeConfig>;
    reason: string;
    confidence: number;
    category: 'common' | 'recommended' | 'advanced';
  }
  
  // Context-aware suggestion rules:
  const SUGGESTION_RULES = [
    // After triggers
    { after: 'triggerEvent:customer:created', suggest: 'actionEmail:welcome' },
    { after: 'triggerEvent:order:created', suggest: 'conditionIf:order.amount > threshold' },
    
    // After approvals
    { after: 'pendingApproval:approved', suggest: 'actionEmail:confirmation' },
    { after: 'pendingApproval:rejected', suggest: 'actionNotify:submitter' },
    
    // After forms
    { after: 'formStep:contact_info', suggest: 'formStep:company_info' },
    { after: 'formStep:order_details', suggest: 'conditionIf:requires_approval' },
    
    // After conditions
    { after: 'conditionIf:true_branch', suggest: 'actionCreateRecord' },
    { after: 'conditionIf:false_branch', suggest: 'actionNotify:alert' },
    
    // After actions
    { after: 'actionCreateRecord:PurchaseOrder', suggest: 'pendingApproval:manager' },
    { after: 'actionCreateRecord:Invoice', suggest: 'documentGenerate:invoice_pdf' },
    { after: 'documentGenerate', suggest: 'actionEmail:with_attachment' },
  ];
  ```

- [ ] **3.5.2** Suggestion UI components
  - **"Add next step" floating button** with suggestion dropdown
  - **Confidence badges**: ⭐⭐⭐ (highly recommended) to ⭐ (optional)
  - **Quick add**: One-click to add suggested node
  - **"Why this?"** tooltip explaining recommendation
  - **"Not helpful"** feedback to improve suggestions

- [ ] **3.5.3** Action configuration wizards
  - **Email wizard**: Template picker → Recipients → Variables → Preview
  - **Create record wizard**: Entity type → Required fields → Optional fields
  - **Notification wizard**: Channel → Recipients → Message → Urgency
  - **Document wizard**: Template → Data mapping → Distribution

- [ ] **3.5.4** Flow optimization suggestions
  - **Missing error handling**: "Add an error path for this action?"
  - **Long branches**: "This path has 10+ steps. Consider creating a subflow?"
  - **Redundant conditions**: "These conditions are always true together"
  - **Performance hints**: "Batch these API calls for better performance"

---

## Phase 4: Integration & Polish (Week 7-8)

### 4.1 WorkForms Page Integration (Production-Ready)

**Goal**: Seamless integration with existing UI

- [ ] **4.1.1** Enhanced Catalog page with "Create New" flow
  - **Create button**: Opens template selector modal
  - **Template categories**: Forms | Approvals | Documents | Integrations
  - **Search & filter**: By name, category, difficulty
  - **Import option**: Upload JSON flow definition
  - **"Start from scratch"**: Opens blank editor

- [ ] **4.1.2** Edit & clone existing forms/workflows
  - **Edit button**: Opens in editor (locks record)
  - **Clone button**: Creates copy with "Copy of..." prefix
  - **View submissions**: Link to In Progress/History filtered by form
  - **Analytics link**: View form performance metrics

- [ ] **4.1.3** Professional version control (Git-like)
  ```typescript
  interface FlowVersion {
    version: string;           // "1.0.0", "1.0.1", etc.
    status: 'draft' | 'published' | 'archived';
    createdBy: User;
    createdAt: Date;
    changelog: string;
    nodes: Node[];
    edges: Edge[];
  }
  
  // Features:
  // - Auto-save drafts every 30 seconds
  // - Manual save with changelog prompt
  // - Compare versions side-by-side
  // - Rollback to any previous version
  // - Restore archived versions
  ```

- [ ] **4.1.4** Flow testing & validation
  - **Lint check**: Validates all paths have endpoints
  - **Test mode**: Execute with sample data
  - **Simulation**: Step through with pause/resume
  - **Coverage report**: Which paths were tested
  - **Publish gate**: Must pass validation before publish

---

### 4.2 Permission System (Enterprise-Grade)

- [ ] **4.2.1** Granular editor permissions
  ```typescript
  interface EditorPermissions {
    // CRUD permissions
    canCreate: boolean;
    canEdit: boolean;
    canPublish: boolean;
    canArchive: boolean;
    canDelete: boolean;
    
    // Mode restrictions
    allowedModes: ('wizard' | 'visual' | 'expert')[];
    
    // Node type restrictions
    allowedNodeCategories: ('triggers' | 'forms' | 'logic' | 'actions' | 'waits' | 'documents' | 'utilities')[];
    blockedNodeTypes?: string[]; // Specific nodes to hide
    
    // Scope restrictions
    canAccessSystemTemplates: boolean;
    canCreateGlobalTemplates: boolean;
    maxActiveFlows?: number;
  }
  ```

- [ ] **4.2.2** Role-based access matrix
  | Role | Create | Edit | Publish | Expert Mode | System Templates |
  |------|--------|------|---------|-------------|------------------|
  | Tenant User | ❌ | ❌ | ❌ | ❌ | View only |
  | Tenant Power User | ✅ | Own only | ❌ | ❌ | Use only |
  | Tenant Admin | ✅ | ✅ | ✅ | Visual only | Use & create |
  | Super Admin | ✅ | ✅ | ✅ | ✅ | Full control |

- [ ] **4.2.3** Permission-aware UI
  - **Hidden elements**: Don't show features user can't access
  - **Disabled elements**: Show but disable with tooltip
  - **Upgrade prompts**: "Upgrade to access advanced features"
  - **Audit logging**: Track who changed what and when

---

### 4.3 Testing & Quality Assurance

- [ ] **4.3.1** Unit tests for editor components
  - Test each node type renders correctly
  - Test node configuration validation
  - Test edge connection rules
  - Test undo/redo functionality
  - Target: >90% coverage

- [ ] **4.3.2** Integration tests for flow execution
  - Test form submission flow
  - Test approval workflow
  - Test document generation
  - Test external party notifications
  - Test error handling paths

- [ ] **4.3.3** E2E tests for common scenarios
  - Create simple form from template
  - Build approval workflow from scratch
  - Edit existing form and publish new version
  - Complete form submission as user
  - Approve pending task as manager

- [ ] **4.3.4** Performance testing
  - Load test: 100+ nodes on canvas
  - Interaction test: Drag-drop responsiveness
  - Save test: Large flow serialization
  - Target: 60fps interactions, <500ms saves

---

### 4.4 Documentation & Training

- [ ] **4.4.1** User documentation
  - Getting started guide
  - Template library walkthrough
  - Building your first form (tutorial)
  - Building your first workflow (tutorial)
  - FAQ and troubleshooting

- [ ] **4.4.2** Admin documentation
  - Permission configuration
  - Template management
  - System settings
  - Integration configuration

- [ ] **4.4.3** In-app help
  - Contextual tooltips on all nodes
  - "Learn more" links to docs
  - Video tutorials embedded
  - Interactive onboarding tour

- [ ] **4.4.4** API documentation
  - Flow definition schema
  - Execution webhook events
  - Integration endpoints

---

## Phase 5: Cockpit Enhancement (Bonus - Week 8+)

### 5.1 SmartWizard Intelligence (HubSpot + Pipedrive-inspired)

**Goal**: Proactive, intelligent dashboard

- [ ] **5.1.1** AI-powered daily briefing
  ```typescript
  interface DailyBriefing {
    greeting: string;              // "Good morning, John!"
    weatherSummary?: string;       // "It's 72°F and sunny in Houston"
    
    urgentItems: UrgentItem[];     // Overdue tasks, SLA breaches
    todaysFocus: FocusItem[];      // Key priorities for today
    
    quickStats: {
      callsToMake: number;
      tasksToComplete: number;
      ordersAwaitingAction: number;
      customersToFollowUp: number;
    };
    
    aiInsights: AIInsight[];       // "Customer ABC hasn't ordered in 30 days"
    achievements: Achievement[];   // "You've completed 50 tasks this month!"
  }
  ```

- [ ] **5.1.2** Intelligent action cards
  - **Prioritized by urgency**: SLA breaches first
  - **Contextual actions**: "Call now", "Send reminder", "Mark complete"
  - **One-click resolution**: Complete task without navigation
  - **Batch actions**: "Complete all similar tasks"

- [ ] **5.1.3** Voice-enabled commands (future)
  - "Show me overdue orders"
  - "Create new purchase order"
  - "Call John Smith at ABC Foods"

---

### 5.2 Enhanced Widget Intelligence

- [ ] **5.2.1** Predictive analytics widgets
  - **Revenue forecast**: Based on pipeline
  - **Inventory alerts**: Low stock predictions
  - **Customer health**: Churn risk indicators
  - **Performance trends**: Week-over-week comparison

- [ ] **5.2.2** Actionable insights widget
  - "5 customers haven't been contacted in 30+ days"
  - "3 orders have been in 'processing' for 7+ days"
  - "Supplier XYZ has 90% on-time delivery rate"
  - One-click action buttons on each insight

- [ ] **5.2.3** Personalized widget recommendations
  - "Based on your role, you might find these widgets useful..."
  - Track widget engagement and suggest changes
  - A/B test widget layouts

---

### 5.3 Call Center Integration (Relevant to Calls Page)

**Goal**: Seamless calling experience from Cockpit

- [ ] **5.3.1** Click-to-call from any phone number
  - Detect phone numbers in UI
  - Initiate call via configured provider (VoIP, Twilio)
  - Log call in CRM automatically

- [ ] **5.3.2** Call queue management
  - View scheduled callbacks
  - Prioritize by customer value
  - Track call outcomes

- [ ] **5.3.3** During-call context panel
  - Customer history at a glance
  - Recent orders and issues
  - Suggested talking points
  - Quick note-taking

---

## Updated File Structure

```
frontend/src/
├── pages/
│   ├── Cockpit/
│   │   ├── index.tsx                # Mode switcher (Dashboard/Wizard)
│   │   ├── CockpitDashboard.tsx     # Widget grid (renamed from Workspace.tsx)
│   │   ├── SmartWizard.tsx          # Guided action interface
│   │   └── components/
│   │       ├── DailyBriefing.tsx    # AI-powered daily summary
│   │       ├── ActionCards.tsx      # Prioritized action items
│   │       └── QuickActions.tsx     # One-click common actions
│   └── WorkForms/
│       ├── index.tsx                # Layout with tabs
│       ├── Tasks.tsx                # My Tasks
│       ├── InProgress.tsx           # In progress submissions
│       ├── History.tsx              # Completed submissions
│       ├── Catalog.tsx              # Template browser (enhanced)
│       └── Editor.tsx               # UnifiedFlowEditor wrapper
├── components/
│   ├── Navigation/
│   │   └── Breadcrumb.tsx           # Context-aware breadcrumb
│   ├── FlowEditor/
│   │   ├── UnifiedFlowEditor.tsx    # Main editor component
│   │   ├── EditorToolbar.tsx        # Top toolbar with actions
│   │   ├── nodes/
│   │   │   ├── index.ts             # Node type registry
│   │   │   ├── base/
│   │   │   │   └── BaseNode.tsx     # Common node functionality
│   │   │   ├── triggers/
│   │   │   │   ├── ManualTriggerNode.tsx
│   │   │   │   ├── ScheduleTriggerNode.tsx
│   │   │   │   ├── WebhookTriggerNode.tsx
│   │   │   │   └── EventTriggerNode.tsx
│   │   │   ├── forms/
│   │   │   │   ├── FormStepNode.tsx
│   │   │   │   ├── FormFieldNode.tsx
│   │   │   │   └── SignatureNode.tsx
│   │   │   ├── logic/
│   │   │   │   ├── ConditionIfNode.tsx
│   │   │   │   ├── SwitchCaseNode.tsx
│   │   │   │   └── ForEachLoopNode.tsx
│   │   │   ├── actions/
│   │   │   │   ├── EmailActionNode.tsx
│   │   │   │   ├── NotifyActionNode.tsx
│   │   │   │   ├── CreateRecordNode.tsx
│   │   │   │   └── HTTPRequestNode.tsx
│   │   │   ├── waits/
│   │   │   │   ├── ApprovalPendingNode.tsx
│   │   │   │   ├── DocumentPendingNode.tsx
│   │   │   │   └── DelayTimerNode.tsx
│   │   │   └── documents/
│   │   │       ├── DocumentGenerateNode.tsx
│   │   │       └── DocumentSignNode.tsx
│   │   ├── edges/
│   │   │   ├── DefaultEdge.tsx
│   │   │   ├── ConditionalEdge.tsx
│   │   │   └── AnimatedEdge.tsx
│   │   ├── panels/
│   │   │   ├── NodePalette.tsx      # Left sidebar with drag nodes
│   │   │   ├── NodeConfigPanel.tsx  # Right sidebar for config
│   │   │   ├── MappingPanel.tsx     # Data mapping interface
│   │   │   └── VersionPanel.tsx     # Version history
│   │   ├── templates/
│   │   │   ├── index.ts             # Template registry
│   │   │   ├── TemplateSelector.tsx # Modal for picking templates
│   │   │   └── definitions/         # JSON template files
│   │   ├── services/
│   │   │   ├── fieldMappingEngine.ts
│   │   │   ├── suggestionEngine.ts
│   │   │   ├── validationEngine.ts
│   │   │   └── executionSimulator.ts
│   │   ├── hooks/
│   │   │   ├── useFlowEditor.ts     # Main editor state
│   │   │   ├── useUndoRedo.ts       # History management
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   └── useAutoSave.ts
│   │   └── utils/
│   │       ├── layoutEngine.ts      # Auto-layout with dagre
│   │       ├── connectionValidator.ts
│   │       └── flowSerializer.ts
│   └── Widgets/
│       ├── QuickStatsWidget.tsx     # Updated with real APIs
│       ├── TodaysNumbersWidget.tsx  # Updated with real APIs
│       ├── PredictiveWidget.tsx     # NEW: AI insights
│       └── ActionableInsightsWidget.tsx # NEW: Smart recommendations
└── config/
    └── navigation.ts                # Updated with /cockpit route
```

---

## Enhanced Workplan Checklist

### Week 1-2: Phase 1 - Critical Fixes
**URL & Navigation:**
- [ ] 1.1.1 Rename /workspace to /cockpit route
- [ ] 1.1.2 Update navigation.ts sidebar
- [ ] 1.1.3 Fix Breadcrumb component (remove Dashboard root)
- [ ] 1.1.4 Implement context-aware breadcrumbs

**Cockpit Dual-Mode:**
- [ ] 1.2.1 Create CockpitPage wrapper (Dashboard/Wizard toggle)
- [ ] 1.2.2 Create SmartWizard component ("What would you like to do today?")
- [ ] 1.2.3 Wire SmartWizard to real APIs
- [ ] 1.2.4 Rename Workspace.tsx to CockpitDashboard.tsx

**Widget Data (Remove Mock Data):**
- [ ] 1.3.1 Create backend workspace stats API
- [ ] 1.3.2 Update QuickStatsWidget (real data)
- [ ] 1.3.3 Update TodaysNumbersWidget (real data)
- [ ] 1.3.4 Update RecentActivityWidget (real data)
- [ ] 1.3.5 Update UpcomingCallsWidget (real data)
- [ ] 1.3.6 Update MyTasksWidget (real data)

**WorkForms Basic Fixes:**
- [ ] 1.4.1 Fix InProgress.tsx (verify API, error handling)
- [ ] 1.4.2 Fix History.tsx (verify API, error handling)
- [ ] 1.4.3 Fix Catalog.tsx (verify API, empty states)
- [ ] 1.4.4 Create Tasks.tsx (My Tasks page)

### Week 3-5: Phase 2 - Visual Editor Foundation
**Canvas Architecture (Make/n8n-inspired):**
- [ ] 2.1.1 Create UnifiedFlowEditor component
- [ ] 2.1.2 Define comprehensive node types registry (30+ node types)
- [ ] 2.1.3 Create priority node components (6 core nodes first)
- [ ] 2.1.4 Implement edge types with visual feedback
- [ ] 2.1.5 Create intelligent node palette with categories

**Editor Modes (Typeform → Make → Salesforce):**
- [ ] 2.2.1 Implement three-tier editor modes (wizard/visual/expert)
- [ ] 2.2.2 Build Wizard Mode (conversational, one-step-at-a-time)
- [ ] 2.2.3 Build Visual Mode (drag-drop canvas)
- [ ] 2.2.4 Build Expert Mode (full power, code expressions)
- [ ] 2.2.5 Implement smart mode transitions

**Template Library (Zapier-quality):**
- [ ] 2.3.1 Create template system architecture
- [ ] 2.3.2 Implement 20 core templates (5 forms, 4 approvals, 3 onboarding, 4 orders, 4 documents)
- [ ] 2.3.3 Build template selector modal (Netflix-style browsing)
- [ ] 2.3.4 Implement template customization wizard

**Canvas Interactions (Figma-quality):**
- [ ] 2.4.1 Drag-drop with ghost preview and smart snapping
- [ ] 2.4.2 Node configuration panel (slide-in, tabbed)
- [ ] 2.4.3 Connection validation with visual feedback
- [ ] 2.4.4 Navigation & viewport (mini-map, zoom, fit)
- [ ] 2.4.5 Keyboard shortcuts (full power-user set)
- [ ] 2.4.6 Real-time collaboration indicators (future-ready)
- [ ] 2.4.7 Execution preview mode

### Week 5-7: Phase 3 - Smart Features
**AI-Powered Field Mapping:**
- [ ] 3.1.1 Create intelligent field mapping engine
- [ ] 3.1.2 Implement multi-factor scoring algorithm
- [ ] 3.1.3 Build visual mapping UI (two-column, connection lines)
- [ ] 3.1.4 Backend learning & feedback loop

**Pending Steps / Wait States:**
- [ ] 3.2.1 Build comprehensive PendingNode architecture
- [ ] 3.2.2 Create smart assignment selector UI
- [ ] 3.2.3 Implement SLA & reminder configuration
- [ ] 3.2.4 Build external portal system (magic links, branded pages)

**Document Generation:**
- [ ] 3.3.1 Build comprehensive DocumentNode configuration
- [ ] 3.3.2 Create template management UI
- [ ] 3.3.3 Build visual data mapping interface
- [ ] 3.3.4 Implement multi-channel distribution
- [ ] 3.3.5 Add document generation preview

**Visual Condition/Rule Builder:**
- [ ] 3.4.1 Build enhanced ConditionNode UI (simple/builder/expression modes)
- [ ] 3.4.2 Implement smart rule suggestions
- [ ] 3.4.3 Create visual condition tree builder
- [ ] 3.4.4 Add condition testing & simulation

**Context-Aware Action Suggestions:**
- [ ] 3.5.1 Build smart action suggestion engine
- [ ] 3.5.2 Create suggestion UI components
- [ ] 3.5.3 Implement action configuration wizards
- [ ] 3.5.4 Add flow optimization suggestions

### Week 7-8: Phase 4 - Integration & Polish
**WorkForms Page Integration:**
- [ ] 4.1.1 Enhanced Catalog with "Create New" flow
- [ ] 4.1.2 Edit & clone existing forms/workflows
- [ ] 4.1.3 Professional version control (Git-like)
- [ ] 4.1.4 Flow testing & validation

**Permission System:**
- [ ] 4.2.1 Implement granular editor permissions
- [ ] 4.2.2 Create role-based access matrix
- [ ] 4.2.3 Build permission-aware UI

**Testing & Quality:**
- [ ] 4.3.1 Unit tests for editor components (>90% coverage)
- [ ] 4.3.2 Integration tests for flow execution
- [ ] 4.3.3 E2E tests for common scenarios
- [ ] 4.3.4 Performance testing (100+ nodes, 60fps target)

**Documentation:**
- [ ] 4.4.1 User documentation (getting started, tutorials)
- [ ] 4.4.2 Admin documentation (permissions, settings)
- [ ] 4.4.3 In-app help (tooltips, videos, tours)
- [ ] 4.4.4 API documentation

### Week 8+: Phase 5 - Cockpit Enhancement (Bonus)
**SmartWizard Intelligence:**
- [ ] 5.1.1 AI-powered daily briefing
- [ ] 5.1.2 Intelligent action cards
- [ ] 5.1.3 Voice-enabled commands (future)

**Enhanced Widget Intelligence:**
- [ ] 5.2.1 Predictive analytics widgets
- [ ] 5.2.2 Actionable insights widget
- [ ] 5.2.3 Personalized widget recommendations

**Call Center Integration:**
- [ ] 5.3.1 Click-to-call from any phone number
- [ ] 5.3.2 Call queue management
- [ ] 5.3.3 During-call context panel

---

## Notes & Considerations

### Technical Decisions
1. **Reuse existing WorkflowCanvas**: The admin-studio already has a 56KB React Flow implementation - adapt it rather than rebuild
2. **Backend models are comprehensive**: TenantForm, TenantWorkflow, etc. already support complex scenarios
3. **Progressive disclosure**: Show simple UI by default, reveal complexity via mode toggle
4. **Industry-best patterns**: Combined best practices from Salesforce, HubSpot, Make, Typeform, JotForm, Moxo, PandaDoc

### Risks
1. **Scope creep**: Full implementation is large (80+ tasks); may need to prioritize Phase 1-2 first
2. **AI suggestions**: Phase 3 ML features may require backend ML service or fall back to heuristic rules
3. **External party portals**: Magic link system may need separate microservice for security
4. **Performance**: Complex flows with 100+ nodes need optimization

### Dependencies
- React Flow v13 (`@xyflow/react`) - ✅ already installed
- Backend workflow models - ✅ already exist
- Existing WorkflowCanvas code - ✅ can be adapted
- dagre (auto-layout) - ✅ already used in WorkflowCanvas

### Competitive Advantages When Complete
1. **Unified Editor**: One tool for forms + workflows (competitors separate these)
2. **Three-Tier Modes**: Serves beginners to experts (most only have 1-2 modes)
3. **AI Suggestions**: Learning field mapping (unique differentiator)
4. **External Party Integration**: Magic links, branded portals (enterprise feature)
5. **Document Generation**: Built-in PDF creation (usually separate product)

---

## Success Criteria

### Phase 1 Success (Must Have)
1. ✅ URL shows `/cockpit` with correct breadcrumbs
2. ✅ All widgets show real data (no mock fallbacks)
3. ✅ SmartWizard provides guided action paths
4. ✅ WorkForms basic pages work correctly

### Phase 2 Success (Should Have)
5. ✅ Visual editor allows creating simple forms
6. ✅ Templates accelerate common patterns
7. ✅ Three editor modes work (wizard/visual/expert)
8. ✅ Smooth drag-drop and canvas interactions

### Phase 3 Success (Nice to Have)
9. ✅ AI field mapping suggestions with >70% acceptance rate
10. ✅ Pending steps work with external parties
11. ✅ Document generation produces valid PDFs
12. ✅ Condition builder handles complex logic

### Phase 4 Success (Nice to Have)
13. ✅ Version control enables safe iteration
14. ✅ Permissions protect sensitive features
15. ✅ Test coverage >80%
16. ✅ Documentation complete

### Phase 5 Success (Future)
17. ✅ Daily briefing drives engagement
18. ✅ Predictive widgets provide business value
19. ✅ Call integration improves sales efficiency

---

## Industry Research Sources

This plan incorporates best practices from:

**CRM Platforms:**
- Salesforce Flow (enterprise workflows)
- HubSpot Workflows (intuitive UX)
- Zoho Blueprint (process automation)
- Pipedrive (sales-focused automation)
- Freshsales Freddy AI (AI-powered suggestions)
- ActiveCampaign (multi-channel automation)

**Form Builders:**
- JotForm (conditional logic, approvals)
- Typeform (conversational UX)
- Formstack (enterprise compliance)

**Workflow Automation:**
- Make/Integromat (visual node editor)
- n8n (open-source, graph editor)
- Zapier (templates, AI agents)
- monday.com (board-based automation)

**Document & Approval:**
- Moxo (external party approvals)
- Process Street (checklist workflows)
- PandaDoc (document generation)
- DocuSign (e-signatures)

**UX/Design:**
- Figma (canvas interactions)
- Mobbin (UI pattern reference)
- Dribbble (visual inspiration)

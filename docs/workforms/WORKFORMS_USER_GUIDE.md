# WorkForms User Guide

**Version**: 3.0  
**Last Updated**: 2026-02-21  
**Status**: Production Ready (Enhanced Stability)

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [WorkForms Editor](#workforms-editor)
4. [Node Types](#node-types)
5. [Configuration Panels](#configuration-panels)
6. [Form Builder](#form-builder)
7. [WorkForms Catalog](#workforms-catalog)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

WorkForms is a visual workflow editor that combines forms and automation logic into a single, powerful tool. Build complex multi-step forms, automate business processes, and create conditional workflows—all with a drag-and-drop interface.

### Key Features

- **Visual Editor**: Drag-and-drop node-based interface
- **30+ Node Types**: Triggers, forms, actions, conditions, waits, documents
- **Multi-Step Forms**: Create complex forms with conditional logic
- **Form Builder**: Standalone form builder for reusable forms
- **Data Mapping**: Connect form fields to actions automatically
- **Conditional Logic**: Show/hide fields and sections based on conditions
- **Template Library**: Start from pre-built workflow templates

---

## Getting Started

### Accessing WorkForms

1. Navigate to **WorkForms** in the sidebar
2. Click **Create New** to start a blank workflow
3. Or select a **Template** to start from a pre-built workflow

### Basic Workflow

1. **Add Trigger**: Every workflow starts with a trigger node
2. **Add Form Steps**: Create multi-step forms to collect data
3. **Add Actions**: Process the collected data (create records, send emails, etc.)
4. **Configure Conditions**: Add branching logic
5. **Test & Deploy**: Test your workflow and publish

---

## WorkForms Editor

### Editor Interface

```
┌─────────────────────────────────────────────────────────┐
│  Templates  │  Node Palette  │  Toolbar              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│               Canvas (Drag & Drop Area)                 │
│                                                         │
│  ┌──────┐          ┌──────┐          ┌──────┐         │
│  │Trigger│  ──────> │Form  │  ──────> │Action│         │
│  └──────┘          └──────┘          └──────┘         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Minimap │  Controls │  JSON/Preview Toggle          │
└─────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete` | Delete selected node |
| `Ctrl/Cmd + C` | Copy node |
| `Ctrl/Cmd + V` | Paste node |
| `Ctrl/Cmd + F` | Search nodes |
| `+` / `-` | Zoom in/out |
| `0` | Reset zoom |

### Adding Nodes

1. **Find Node**: Browse the node palette on the left, organized by category:
   - **Triggers**: Form Submission, Schedule, Webhook, Button Click
   - **Forms**: Form Step, Form Field, Form Section, Form Reference
   - **Logic**: Condition (If/Else), Switch, Loop
   - **Actions**: Create Record, Update Record, Send Email, HTTP Request
   - **Waits**: Delay, Wait for Approval, Wait Until Date
   - **Documents**: Generate PDF, Upload Document
   - **Utilities**: Data Transformer, Calculator, Formatter
   - **Terminals**: End Success, End Error

2. **Drag to Canvas**: Click and drag the node type to the canvas

3. **Connect Nodes**: Click and drag from one node's output handle to another's input handle

4. **Configure**: Click the node to open its configuration panel

---

## Node Types

### Trigger Nodes

**Start your workflow with a trigger**:

- **Form Submission**: Trigger when a specific form is submitted
- **Schedule**: Run on a recurring schedule (hourly, daily, weekly)
- **Webhook**: Trigger from external API call
- **Button Click**: Manual trigger from a custom button
- **Data Change**: Trigger when a record changes

### Form Nodes

**Collect information from users**:

- **Form Step**: Multi-step form container with validation
- **Form Field**: Individual input fields (text, email, number, date, file, etc.)
- **Form Section**: Organize fields into sections with conditional visibility
- **Form Reference**: Embed a reusable form created in Form Builder

### Logic Nodes

**Add branching and loops**:

- **Condition (If/Else)**: Branch based on field values
- **Switch**: Multiple branches (like a switch statement)
- **Loop**: Iterate over arrays or repeat actions

### Action Nodes

**Do something with the data**:

- **Create Record**: Create a new database record (Customer, Supplier, Order, etc.)
- **Update Record**: Update an existing record
- **Send Email**: Send emails with templates
- **Send SMS**: Send SMS messages
- **HTTP Request**: Call external APIs
- **Run Script**: Execute custom JavaScript

### Wait Nodes

**Pause workflow execution**:

- **Delay**: Wait for a fixed duration (minutes, hours, days)
- **Wait for Approval**: Pause until approved/rejected
- **Wait Until Date**: Wait until a specific date/time

### Document Nodes

**Generate and manage documents**:

- **Generate PDF**: Create PDFs from templates
- **Upload Document**: Accept file uploads
- **Sign Document**: Collect e-signatures

### Utility Nodes

**Transform and process data**:

- **Data Transformer**: Map and transform field values
- **Calculator**: Perform calculations
- **Formatter**: Format dates, numbers, text
- **Validator**: Validate data formats

### Terminal Nodes

**End your workflow**:

- **End Success**: Successful completion
- **End Error**: Error termination with message

---

## Configuration Panels

### Opening Configuration

Click any node on the canvas to open its configuration panel (slides in from the right).

### Common Configuration Options

All nodes share these base configurations:

- **Label**: Custom display name for the node
- **Description**: Optional notes about what this node does
- **Error Handling**: What to do if this node fails

### Form Step Configuration

**Step Settings**:
- **Step Title**: Name shown to users
- **Step Description**: Help text for this step
- **Fields**: Add/edit/reorder fields in this step

**Visibility**:
- **Always**: Show to all users
- **Conditional**: Show only when conditions are met

**Navigation**:
- **Allow Back**: Let users go back to previous step
- **Allow Skip**: Let users skip this step
- **Auto-Advance**: Automatically move to next step when completed

**Validation**:
- **Require All**: All fields must be filled
- **Minimum Required**: At least X fields must be filled

### Form Field Configuration

**Field Settings**:
- **Field Type**: text, email, number, date, select, checkbox, radio, file, etc.
- **Label**: Field name shown to users
- **Placeholder**: Hint text in empty field
- **Default Value**: Pre-filled value
- **Help Text**: Additional guidance

**Validation**:
- **Required**: Must be filled to proceed
- **Pattern**: Regex validation (e.g., phone numbers)
- **Min/Max**: Length or value limits
- **Custom Validation**: JavaScript validation logic

**Visibility**:
- **Always Visible**: Show to all users
- **Conditional**: Show only when conditions are met

**Options** (for select, radio, checkbox):
- **Static List**: Manually enter options
- **Dynamic List**: Load from database
- **Allow Other**: Let users add custom option

### Form Section Configuration

**Section Settings**:
- **Title**: Section heading
- **Description**: Section help text
- **Collapsible**: Can users collapse this section?
- **Default State**: Expanded or collapsed

**Visibility**:
- **Always**: Show to all users
- **Conditional**: Show only when conditions are met

### Action Configuration

**Create Record**:
- **Entity Type**: What to create (Customer, Supplier, Order, etc.)
- **Field Mapping**: Map form fields to entity fields
- **Error Handling**: What to do if creation fails

**Send Email**:
- **To**: Recipient email (can use form fields)
- **Subject**: Email subject
- **Template**: Select email template
- **Attachments**: Include files from form

**HTTP Request**:
- **Method**: GET, POST, PUT, DELETE
- **URL**: API endpoint (can use form fields)
- **Headers**: Custom headers
- **Body**: Request payload
- **Authentication**: API keys, OAuth, etc.

### Condition Configuration

**Condition Builder**:
- **Field**: Select field to check
- **Operator**: equals, not equals, greater than, less than, contains, etc.
- **Value**: Compare to this value
- **Logic**: AND/OR for multiple conditions

**Example Conditions**:
```
IF order_total > 1000 AND customer_type = "VIP"
THEN route to "VIP Processing"
ELSE route to "Standard Processing"
```

---

## Form Builder

### What is the Form Builder?

The Form Builder is a standalone tool for creating reusable forms. Forms created here can be referenced in workflows using the **Form Reference** node.

### When to Use Form Builder vs. Form Steps?

| Use Form Builder | Use Form Steps |
|------------------|----------------|
| Form used in multiple workflows | Form specific to one workflow |
| Complex forms with many fields | Simple 2-3 field forms |
| Forms that change frequently | Static workflow-specific forms |
| Team collaboration on forms | Individual workflow development |

### Creating a Form

1. **Access**: WorkForms → Catalog → Create New Form
2. **Drag Fields**: Drag field types from palette to canvas
3. **Organize Sections**: Group related fields into sections
4. **Configure Fields**: Click each field to set label, validation, etc.
5. **Save**: Name your form and save

### Field Types Available

- **Text Inputs**: Text, Email, Phone, URL
- **Numbers**: Number, Currency, Percentage
- **Date/Time**: Date, Time, DateTime
- **Choices**: Dropdown, Radio Buttons, Checkboxes, Multi-Select
- **Special**: File Upload, Signature, Rating, Rich Text

### Using Forms in Workflows

1. **Add Form Reference Node**: Drag "Form Reference" node to canvas
2. **Select Form**: Click node → Choose Form → Select from library
3. **Configure**: Map form outputs to workflow variables
4. **Connect**: Link to next action node

---

## WorkForms Catalog

### Browsing Forms

The Catalog shows all forms and workflows in your workspace:

- **Search**: Find by name or description
- **Filter**: By category, creator, or date
- **Sort**: By name, created date, or last modified

### Form Preview

Click any form to see a preview:
- **Field List**: See all fields and their types
- **Conditional Logic**: View visibility rules
- **Validation Rules**: See required fields and validation

### Managing Forms

- **Edit**: Modify form structure and fields
- **Duplicate**: Copy form as starting point
- **Archive**: Hide unused forms
- **Delete**: Permanently remove form
- **Export/Import**: Share forms between workspaces

---

## Best Practices

### Workflow Design

1. **Start Simple**: Begin with a basic flow, add complexity gradually
2. **Use Sections**: Group related fields for better UX
3. **Add Validation**: Catch errors early with field validation
4. **Test Thoroughly**: Test all branches and edge cases
5. **Document**: Add descriptions to nodes for team clarity

### Form Design

1. **Keep Steps Short**: 3-5 fields per step maximum
2. **Use Progress Indicators**: Show users how many steps remain
3. **Smart Defaults**: Pre-fill fields when possible
4. **Clear Labels**: Use plain language, avoid jargon
5. **Help Text**: Add hints for complex fields

### Performance

1. **Minimize API Calls**: Batch operations when possible
2. **Cache Static Data**: Store dropdown options in workflow
3. **Optimize Conditions**: Put most common conditions first
4. **Use Wait Nodes**: Don't overwhelm external APIs

### Error Handling

1. **Add Error Routes**: Every action should have error handling
2. **Meaningful Messages**: Tell users what went wrong and how to fix it
3. **Retry Logic**: Automatically retry failed API calls
4. **Fallback Actions**: Have backup plans for critical actions

---

## Troubleshooting

### 🆕 New Features (February 2026)

#### Error Recovery
**What's New**: If a component crashes, you'll see a friendly error screen with a "Try Again" button instead of losing your work.

**How to Use**:
1. If you see an error screen, don't panic - your workflow is saved
2. Click **"Try Again"** to recover
3. If the error persists, refresh the page
4. In development mode, you'll see detailed error information to help us fix the issue

#### Loading States
**What's New**: When loading entity fields or performing slow operations, you'll see skeleton screens and helpful messages.

**What You'll See**:
- Animated skeleton screens while data loads
- "Request timed out" message if operation takes longer than 5 seconds
- **"Retry"** button to try the operation again
- Clear error messages with actionable advice

#### Form Process Groups
**What's New**: Form Process nodes are now true containers - you can drag child nodes directly inside them.

**How to Use**:
1. Add a **Form Process** node to canvas
2. Double-click to expand the container
3. Drag **Form Step** nodes from the palette into the container
4. Nodes automatically become children with proper relationships
5. Double-click again to collapse

#### Improved FormBuilder
**What's New**: FormBuilder modal now opens reliably with type-safe communication.

**How to Use**:
1. Select a Form Process node
2. Click **"🛠️ Open Full Form Builder"** button in the config panel
3. Build your multi-step form in the modal
4. Changes automatically sync back to the editor when you close

---

### Common Issues (Updated Feb 2026)

### Editor Crashes (FIXED ✅)

**Problem**: Deleting a node while its config panel is open used to crash the editor  
**Status**: **FIXED** - Error boundaries now catch these crashes  
**What You'll See**: Friendly error screen with retry button instead of blank page

### Slow Field Loading (IMPROVED ✅)

**Problem**: No feedback when entity fields took a long time to load  
**Status**: **IMPROVED** - Skeleton loaders and timeout detection  
**What You'll See**: 
- Animated skeleton while loading
- "Request timed out" after 5 seconds
- Retry button to try again

### Nodes Not Appearing

**Problem**: Dragged node doesn't appear on canvas  
**Solution**: Make sure you're dropping inside the canvas area, not on the palette

### Config Panel Not Opening

**Problem**: Clicking node doesn't open configuration  
**Solution**: This was fixed in PR #2586. Update to latest version.

### Connection Won't Snap

**Problem**: Can't connect two nodes  
**Solution**: Check that output → input connection is valid (some node types have restrictions)

### Form Not Submitting

**Problem**: Submit button disabled or form won't submit  
**Solution**: Check required field validation. All required fields must be filled.

### Workflow Not Running

**Problem**: Workflow doesn't execute  
**Solution**:
1. Check trigger is properly configured
2. Verify all nodes are connected
3. Check for error nodes (red indicators)
4. View execution logs for details

### Data Not Mapping

**Problem**: Form fields not showing in action configuration  
**Solution**: Make sure form step is connected before action node. Data flows top-to-bottom.

### Empty Config Panel (NEW)

**Problem**: Config panel shows "Select a node to configure its properties"  
**Status**: **NORMAL BEHAVIOR**  
**Solution**: This is expected when no node is selected. Click on any node to see its configuration.

### Node Configuration Not Saving (TROUBLESHOOTING)

**Problem**: Changes in config panel don't persist  
**Solution**:
1. Make sure to click **"Apply"** button (not just closing the panel)
2. Check for validation errors (red indicators)
3. Required fields must be filled before saving
4. If using FormBuilder modal, close the modal to sync changes

### Workflow Taking Long to Load (NEW)

**Problem**: Workflow seems stuck loading  
**What to Check**:
1. Look for skeleton loaders - data is actively loading
2. Wait for "Request timed out" message (5 seconds)
3. Click **"Retry"** button if timeout occurs
4. Check browser console for network errors
5. Verify backend service is running

### Cannot Drag Nodes into Form Process (NEW)

**Problem**: Can't drag child nodes into Form Process container  
**Solution**:
1. Make sure Form Process node is **expanded** (double-click to expand)
2. Look for dashed border - this indicates the drop zone
3. Drag **Form Step** nodes specifically (not all node types work)
4. Release mouse inside the dashed border area
5. Child node should snap into place with automatic positioning

---

## Getting Help

### Resources

- **Documentation**: `/docs/WORKFORMS_DEVELOPER_GUIDE.md`
- **API Reference**: `/docs/api/workforms.md`
- **Video Tutorials**: Coming soon
- **Community Forum**: Coming soon

### Support

- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions
- **Urgent Issues**: support@meatscentral.com

---

**Last Updated**: 2026-02-21  
**Version**: 3.0 (Enhanced Stability + Error Recovery)  
**Maintained By**: ProjectMeats Development Team

**Recent Enhancements (Feb 2026)**:
- ✅ Error boundaries with crash recovery
- ✅ Loading states with skeleton screens
- ✅ Timeout detection with retry buttons
- ✅ Form Process as true drag-drop containers
- ✅ Type-safe FormBuilder integration
- ✅ Null safety improvements throughout

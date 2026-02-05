# Blueprint Studio User Guide

**Version**: 1.0  
**Last Updated**: January 23, 2026  
**Status**: Production Ready

---

## Overview

The **Blueprint Studio** is a visual workflow designer that allows system administrators to create, configure, and publish custom business workflows without writing code.

### What You Can Build

- **Data Collection Workflows** - Forms with validation rules
- **Approval Processes** - Multi-step approval chains
- **Automated Notifications** - Email/SMS alerts based on events
- **Custom Actions** - Trigger backend operations

### Key Features

- 🎨 **Visual Schema Designer** - Excel-like interface for data fields
- 🔄 **Workflow Canvas** - Drag-and-drop workflow builder
- 📋 **Form Preview** - Live preview of what users will see
- 📜 **Version History** - Track all changes with rollback
- 🚀 **One-Click Publishing** - Deploy workflows instantly
- 🔒 **Tenant Isolation** - Secure multi-tenant architecture

---

## Getting Started

### Prerequisites

- ✅ **User Role**: "Global System Admin" group membership
- ✅ **Permissions**: Django admin access
- ✅ **Browser**: Chrome, Firefox, Safari, or Edge (latest versions)

### Accessing the Studio

1. **Navigate to Django Admin**
   ```
   https://dev.meatscentral.com/admin/
   ```

2. **Go to System Config Section**
   - Click "System Config" in the sidebar
   - Select "Blueprint Versions"

3. **Launch Studio**
   - Find the blueprint you want to edit
   - Click **"🛠 Launch Visual Studio"** button
   - Studio opens in new tab/window

**Alternative Path:**
```
Direct URL: /admin/system-config/studio/{version-id}/
```

---

## Studio Interface

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Blueprint Name: Sales Order Workflow        [Publish] │
├─────────────────────────────────────────────────────┤
│  [Data Schema] [Workflow] [Version History]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│     Active Tab Content                              │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Navigation Tabs

1. **Data Schema** - Define what data the workflow collects
2. **Workflow** - Configure the steps and logic
3. **Version History** - View changes and rollback if needed

---

## Tab 1: Data Schema Editor

### Purpose

Define the **data fields** that your workflow will collect from users. Think of this as designing a form or database table.

### Interface Elements

#### Add Field Button
```
[+ Add Field]
```
- Click to create a new data field
- Fields appear as rows in the table

#### Field Configuration Columns

| Column | Description | Required | Example |
|--------|-------------|----------|---------|
| **Label** | Human-readable name | ✅ Yes | "Customer Name" |
| **Key** | Unique identifier | ✅ Yes | "customer_name" |
| **Type** | Data type (see below) | ✅ Yes | Text |
| **Required** | Must be filled? | ❌ No | ☑️ |
| **Actions** | Delete field | - | 🗑️ |

#### Validation Rules

**Unique Keys Required:**
- ✅ Keys must be unique within the workflow
- ✅ Keys are auto-generated from labels
- ❌ Cannot have two fields with same key

**Visual Feedback:**
- ❌ **Red border** = Error (fix before saving)
- ⚠️ **Yellow warning** = Suggestion (optional)
- ✅ **Green checkmark** = Valid

### Field Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| **Text** | Short text input | Name, Email, SKU |
| **Textarea** | Long text input | Comments, Description |
| **Number** | Numeric input | Quantity, Price, Age |
| **Date** | Date picker | Order Date, Due Date |
| **Select** | Dropdown list | Status, Category, Priority |
| **Checkbox** | Yes/No toggle | Approved, Active |
| **Email** | Email validation | Contact Email |
| **Phone** | Phone validation | Phone Number |

### Step-by-Step: Creating Fields

#### Example: Building a "Customer Order" Form

**Step 1: Add Customer Name**
1. Click **[+ Add Field]**
2. Enter Label: `Customer Name`
3. Key auto-fills: `customer_name` ✅
4. Select Type: `Text`
5. Check **Required** ☑️

**Step 2: Add Order Quantity**
1. Click **[+ Add Field]**
2. Enter Label: `Quantity`
3. Key auto-fills: `quantity` ✅
4. Select Type: `Number`
5. Check **Required** ☑️

**Step 3: Add Optional Notes**
1. Click **[+ Add Field]**
2. Enter Label: `Special Instructions`
3. Key auto-fills: `special_instructions` ✅
4. Select Type: `Textarea`
5. Leave **Required** unchecked ☐

**Step 4: Save Schema**
1. Click **[Save Schema]** button
2. Wait for confirmation message
3. Schema is now saved as draft

### Common Patterns

#### Contact Information
```
- full_name (Text, Required)
- email (Email, Required)
- phone (Phone, Optional)
- company (Text, Optional)
```

#### Order Details
```
- product_id (Text, Required)
- quantity (Number, Required)
- unit_price (Number, Required)
- total_price (Number, Read-only/Calculated)
```

#### Approval Workflow
```
- request_title (Text, Required)
- request_reason (Textarea, Required)
- approval_status (Select, System-managed)
- approver_comments (Textarea, Optional)
```

### Tips & Best Practices

✅ **DO:**
- Use descriptive labels ("Customer Email" not just "Email")
- Make keys consistent (snake_case: `customer_name`)
- Mark critical fields as required
- Group related fields logically

❌ **DON'T:**
- Use spaces in keys (`customer name` → `customer_name`)
- Create duplicate keys
- Make everything required (frustrates users)
- Use generic labels ("Field 1", "Data")

---

## Tab 2: Workflow Canvas

### Purpose

Configure the **steps** that execute when the workflow runs. Define the sequence, logic, and actions.

### Step Types

#### 1. Form Step
**Purpose**: Collect data from users

**Configuration:**
- **Title**: Display name ("Enter Order Details")
- **Instructions**: Help text for users
- **Fields**: Select which schema fields to show
- **Validation**: Add custom validation rules

**Example:**
```yaml
Title: "Customer Information"
Instructions: "Please provide your contact details"
Fields: [full_name, email, phone]
```

#### 2. Approval Step
**Purpose**: Require approval before continuing

**Configuration:**
- **Title**: Approval stage name
- **Approver Role**: Who can approve
- **Approval Message**: What users see
- **On Approve**: Next step
- **On Reject**: Rejection step or end

**Example:**
```yaml
Title: "Manager Approval"
Approver: "Department Manager"
Message: "Review and approve this purchase request"
```

#### 3. Notification Step
**Purpose**: Send email/SMS alerts

**Configuration:**
- **Title**: Internal name
- **Recipient**: Email/phone or field reference
- **Template**: Message content with variables
- **Timing**: Immediate or scheduled

**Example:**
```yaml
Title: "Order Confirmation Email"
Recipient: {customer_email}
Subject: "Order #{order_id} Confirmed"
Body: "Thank you for your order..."
```

#### 4. Action Step
**Purpose**: Execute custom backend logic

**Configuration:**
- **Title**: Action name
- **Action Type**: API call, database update, etc.
- **Parameters**: Input data
- **On Success**: Next step
- **On Failure**: Error handling

**Example:**
```yaml
Title: "Create Customer Record"
Action: "create_customer"
Params: {name: {full_name}, email: {email}}
```

### Step Configuration UI

```
┌─────────────────────────────────────┐
│  Step 1: Customer Information  [▼] │
├─────────────────────────────────────┤
│  Type: Form                         │
│  Title: [Enter your details]        │
│  Instructions: [...]                │
│  Fields: ☑ full_name                │
│          ☑ email                    │
│          ☐ phone                    │
│  [Save Step]                        │
└─────────────────────────────────────┘
```

**Expandable Panels:**
- Click **[▼]** to expand step configuration
- Click **[▲]** to collapse when done
- Only edit one step at a time

### Step-by-Step: Building Workflow

#### Example: 3-Step Order Workflow

**Step 1: Data Collection**
1. Click **[+ Add Step]**
2. Select Type: **Form**
3. Enter Title: `Enter Order Details`
4. Add Instructions: `Fill in the order information below`
5. Select Fields:
   - ☑️ `product_name`
   - ☑️ `quantity`
   - ☑️ `customer_email`
6. Click **[Save Step]**

**Step 2: Manager Approval**
1. Click **[+ Add Step]**
2. Select Type: **Approval**
3. Enter Title: `Manager Approval Required`
4. Set Approver Role: `Sales Manager`
5. Enter Message: `Please review this order`
6. Click **[Save Step]**

**Step 3: Confirmation Email**
1. Click **[+ Add Step]**
2. Select Type: **Notification**
3. Enter Title: `Send Confirmation`
4. Set Recipient: `{customer_email}`
5. Write Template:
   ```
   Order Confirmed!
   Product: {product_name}
   Quantity: {quantity}
   ```
6. Click **[Save Step]**

**Final: Save Workflow**
1. Click **[Save Workflow]** (top right)
2. Confirmation: "Workflow saved successfully"
3. Status remains **DRAFT** until published

### Tips & Best Practices

✅ **DO:**
- Start with simple 2-3 step workflows
- Test each step before adding more
- Use clear, descriptive titles
- Add helpful instructions for users
- Plan approval chains before building

❌ **DON'T:**
- Create circular references (Step 3 → Step 1)
- Skip required configuration fields
- Make workflows too long (>10 steps)
- Forget to save after each change

---

## Tab 3: Version History

### Purpose

Track all changes made to the blueprint, compare versions, and rollback if needed.

### Interface Elements

#### Version Timeline
```
┌─────────────────────────────────────┐
│  Version 3 (Current - PUBLISHED)    │
│  Jan 23, 2026 at 2:30 PM           │
│  By: admin@example.com             │
│  [View Details] [Rollback]          │
├─────────────────────────────────────┤
│  Version 2 (DRAFT)                  │
│  Jan 22, 2026 at 4:15 PM           │
│  By: manager@example.com           │
│  [View Details] [Rollback]          │
└─────────────────────────────────────┘
```

### Version Metadata

Each version shows:
- **Version Number**: Sequential counter (1, 2, 3...)
- **Status**: DRAFT, PUBLISHED, ARCHIVED
- **Timestamp**: When it was created
- **Author**: Who made the changes
- **Change Summary**: What was modified (if available)

### Actions

#### View Details
- Opens version comparison modal
- Shows **color-coded diff**:
  - 🟢 **Green**: Added fields/steps
  - 🔴 **Red**: Removed fields/steps
  - 🟡 **Yellow**: Modified fields/steps

#### Rollback
- Creates **new draft version** (non-destructive)
- Copies configuration from selected version
- **Does NOT delete** current version
- You must **publish** the new draft to make it active

### Step-by-Step: Rollback Process

**Scenario**: You published a workflow but need to revert to previous version

**Step 1: Review History**
1. Click **"Version History"** tab
2. Find the version you want to restore
3. Note the version number (e.g., "Version 2")

**Step 2: Compare Versions**
1. Click **[View Details]** on target version
2. Review the differences
3. Confirm this is the correct version

**Step 3: Perform Rollback**
1. Click **[Rollback]** on target version
2. Confirmation dialog appears:
   ```
   Create new draft from Version 2?
   This will not delete the current version.
   ```
3. Click **[Confirm]**

**Step 4: Review & Publish**
1. System creates new draft (e.g., "Version 4")
2. Review the schema and workflow tabs
3. Make any additional changes if needed
4. Click **[Publish]** to make it active

### Version Comparison

**Example Diff View:**
```
Schema Changes:
  + customer_phone (Phone) - Added
  - customer_fax (Text) - Removed
  ~ customer_email (Email) - Type changed from Text

Workflow Changes:
  + Step 3: SMS Notification - Added
  ~ Step 1: Form - Fields updated
```

**Legend:**
- `+` = Added
- `-` = Removed
- `~` = Modified

---

## Publishing Workflows

### What Publishing Does

**When you click [Publish]:**
1. ✅ Current draft becomes **active version**
2. ✅ Workflow appears in **Workflow Catalog** for users
3. ✅ Old published version becomes **read-only**
4. ✅ Users can start new instances of workflow

**Publish Button Location:**
- Top-right corner of Studio interface
- Visible on all tabs
- Grayed out if already published

### Pre-Publish Checklist

Before publishing, verify:

- [ ] All schema fields have unique keys
- [ ] Required fields are marked correctly
- [ ] Workflow has at least one step
- [ ] Step configuration is complete
- [ ] Form preview looks correct
- [ ] Test workflow in staging (if available)

### Publishing Steps

**Step 1: Final Review**
1. Go through each tab
2. Check for red error indicators
3. Save all changes

**Step 2: Publish**
1. Click **[Publish]** button (top-right)
2. Confirmation dialog:
   ```
   Publish this workflow?
   This will make it available to all users.
   The current published version will be archived.
   ```
3. Click **[Confirm]**

**Step 3: Verification**
1. Success message appears
2. Button changes from **[Publish]** to **[Published]**
3. Version status updates to "PUBLISHED"

### Unpublishing

**To unpublish a workflow:**
1. Open Django Admin
2. Navigate to "Entity Blueprints"
3. Find your blueprint
4. Set `published_version` to **None**
5. Save

**Effect:**
- Workflow disappears from catalog
- Existing runs continue executing
- No new runs can be started

---

## Form Preview

### Purpose

See exactly what users will experience when filling out your workflow form.

### How to Access

**Option 1: From Schema Tab**
1. Click **[Preview Form]** button
2. Modal opens with live form

**Option 2: From Workflow Tab**
1. Find Form step
2. Click **[Preview]** icon
3. Modal shows that step's form

### Preview Features

#### Live Rendering
- Fields render as they will in production
- Validation rules apply
- Required fields show asterisks
- Help text displays

#### Interactive Testing
- Fill out form fields
- Test validation (try invalid data)
- See error messages
- Check field types work correctly

#### Close Preview
- Click **[X]** button
- Click outside modal
- Press **Esc** key

### What Preview Shows

```
┌──────────────────────────────────┐
│  Customer Information Form       │
├──────────────────────────────────┤
│  Full Name *                     │
│  [____________________________]  │
│                                  │
│  Email Address *                 │
│  [____________________________]  │
│                                  │
│  Phone Number                    │
│  [____________________________]  │
│  (Optional)                      │
│                                  │
│  [Cancel]            [Submit]    │
└──────────────────────────────────┘
```

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: "Studio won't load"
**Symptoms:**
- Blank page
- Console errors
- Infinite loading spinner

**Solutions:**
1. ✅ Check browser console (F12)
2. ✅ Clear browser cache (Ctrl+F5)
3. ✅ Verify you're in "Global System Admins" group
4. ✅ Try incognito/private mode
5. ✅ Contact system administrator

#### Issue: "Can't save schema/workflow"
**Symptoms:**
- Save button disabled
- Red error borders on fields
- "Validation failed" message

**Solutions:**
1. ✅ Look for red borders on fields
2. ✅ Ensure all keys are unique
3. ✅ Fill in required fields (Title, Key, Type)
4. ✅ Check browser console for specific errors
5. ✅ Try removing last added field

#### Issue: "Publish button is grayed out"
**Symptoms:**
- Button shows **[Published]** instead of **[Publish]**
- Can't click publish

**Explanation:**
- Workflow is already published
- This version is the current active one

**To make changes:**
1. Edit schema/workflow (creates new draft)
2. Publish new draft (becomes new active version)

#### Issue: "Changes aren't showing up for users"
**Symptoms:**
- Modified workflow but users see old version
- New fields missing from form

**Solutions:**
1. ✅ Verify you clicked **[Save]** after changes
2. ✅ Verify you clicked **[Publish]** after saving
3. ✅ Check version history to confirm publication
4. ✅ Have users hard-refresh (Ctrl+F5)

---

## Best Practices

### Workflow Design

**Start Simple:**
- Begin with 2-3 steps
- Test thoroughly
- Add complexity gradually

**User-Centric:**
- Clear labels and instructions
- Minimize required fields
- Provide helpful error messages
- Show progress indicators

**Maintainability:**
- Use consistent naming conventions
- Document complex logic
- Keep version history clean
- Test before publishing

### Data Schema Design

**Field Naming:**
```
✅ Good:
- customer_email
- order_date
- shipping_address_line1

❌ Bad:
- email1
- date
- addr
```

**Required Fields:**
- Only mark truly required fields
- Consider user experience
- Balance data quality vs. completion rate

**Field Types:**
- Choose most specific type available
- Email validation prevents errors
- Phone formatting improves UX
- Date pickers better than text entry

### Testing Strategy

**Before Publishing:**
1. Preview form with all field types
2. Try invalid data (test validation)
3. Complete full workflow as user
4. Test approval flows (if applicable)
5. Verify notifications send correctly

**After Publishing:**
1. Monitor first few workflow runs
2. Check execution logs for errors
3. Gather user feedback
4. Iterate based on real usage

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save current tab |
| `Esc` | Close modal/preview |
| `Tab` | Navigate between fields |
| `Ctrl + Z` | Undo last change (in fields) |

---

## Security & Permissions

### Who Can Access Studio?

**Required:**
- ✅ Django staff status
- ✅ "Global System Admin" group membership
- ✅ Valid authentication session

**Cannot access:**
- ❌ Regular tenant users
- ❌ Unauthenticated visitors
- ❌ Users without admin privileges

### Data Security

**Tenant Isolation:**
- Each tenant's workflows are isolated
- Cannot access other tenants' blueprints
- Execution data stays within tenant boundary

**Audit Trail:**
- All changes logged with timestamp
- Author tracked for each version
- Version history never deleted

---

## FAQ

**Q: Can I delete a published workflow?**  
A: No, but you can unpublish it (removes from catalog). Existing workflow runs continue.

**Q: What happens to running workflows when I publish changes?**  
A: Running workflows continue with their original version. Only new runs use the new version.

**Q: Can I have multiple draft versions?**  
A: No, only one draft per blueprint. Publishing makes it active and creates space for new draft.

**Q: How many fields can I add?**  
A: Technically unlimited, but recommend <20 for usability. Break complex forms into steps.

**Q: Can I import/export workflows?**  
A: Not yet, but planned for future release. Currently manual recreation needed.

**Q: Does rollback delete my current version?**  
A: No! Rollback is non-destructive. It creates a new draft copy of the old version.

**Q: Can users see draft workflows?**  
A: No, only published workflows appear in the catalog. Drafts are admin-only.

---

## Getting Help

### Support Channels

**Technical Issues:**
- Contact: System Administrator
- Email: support@meatscentral.com

**Feature Requests:**
- Submit via Django admin "Feedback" form
- Include use case and business justification

**Training:**
- Live training sessions: Monthly
- Video tutorials: Available in knowledge base
- Documentation: `/docs/WORKFLOW_ENGINE_API.md`

---

## Appendix: Example Workflows

### Example 1: Simple Contact Form

**Schema:**
```
- full_name (Text, Required)
- email (Email, Required)
- subject (Text, Required)
- message (Textarea, Required)
```

**Workflow:**
```
Step 1: Form - Collect contact info
Step 2: Notification - Email to support team
Step 3: Notification - Confirmation to user
```

### Example 2: Purchase Approval

**Schema:**
```
- item_description (Text, Required)
- quantity (Number, Required)
- unit_price (Number, Required)
- justification (Textarea, Required)
- approver_comments (Textarea, Optional)
```

**Workflow:**
```
Step 1: Form - Request details
Step 2: Approval - Manager review
Step 3a: If approved → Notification to procurement
Step 3b: If rejected → Notification to requester
```

### Example 3: Customer Onboarding

**Schema:**
```
- company_name (Text, Required)
- primary_contact (Text, Required)
- contact_email (Email, Required)
- contact_phone (Phone, Optional)
- industry (Select, Required)
- employee_count (Number, Optional)
```

**Workflow:**
```
Step 1: Form - Company information
Step 2: Action - Create account in system
Step 3: Notification - Welcome email with login
Step 4: Approval - Sales rep verification
Step 5: Action - Activate account
Step 6: Notification - Account activated email
```

---

**Document Version**: 1.0  
**Last Updated**: January 23, 2026  
**Feedback**: Submit via support@meatscentral.com

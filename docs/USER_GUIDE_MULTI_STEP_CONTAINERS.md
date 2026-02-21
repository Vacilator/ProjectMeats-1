# Multi-Step Container User Guide

## Overview

Multi-step containers are a powerful feature in the ProjectMeats workflow editor that allows you to create complex, multi-stage form workflows with automatic layout and connection management.

## What are Multi-Step Containers?

A multi-step container is a special node type that acts as a workflow within a workflow. It:
- **Auto-arranges** form steps horizontally from left to right
- **Auto-connects** sequential steps with visual edges
- **Isolates scope** - child nodes can only connect to siblings, not external nodes
- **Supports actions** - add action nodes vertically beneath form steps
- **Persists separately** - form steps save to `tenant-forms`, actions save to `tenant-workforms`

## Creating a Container

1. **Drag a "Multi-Step Container" node** from the node palette onto the canvas
2. **Drop form step nodes** into the container (they will auto-position horizontally)
3. **Add action nodes** below form steps for additional logic (email, API calls, etc.)

## Working with Containers

### Adding Form Steps

- Drag a "Form Step" or "Form Reference" node
- Drop it inside the container (highlighted with green border)
- Steps auto-arrange left-to-right with 250px spacing
- Steps auto-connect with sequential edges labeled "Step 1 → 2"

### Reordering Steps

- Click and drag a form step horizontally within the container
- Drop it between existing steps to reorder
- Auto-layout recalculates all positions
- Auto-connection updates to match new order

### Adding Actions

- Drag an action node (e.g., "Send Email", "API Call")
- Drop it inside the container below a form step
- Actions stack vertically with 120px spacing

### Container Statistics

The container node displays:
- **Total child nodes** (e.g., "5 nodes")
- **Form step count** (e.g., "3 form steps")
- **Action count** (e.g., "2 actions")
- **Mini canvas preview** showing internal structure

## Workflow Management

### Saving Workflows

- Click the "Save" button in the toolbar (💾 icon)
- Or press `Ctrl+S` / `Cmd+S`
- First save prompts for workflow name, description, and status
- Subsequent saves update existing workflow
- Validation runs automatically (containers must have at least 1 form step)

### Loading Workflows

- Click the "Load" button dropdown (📂 icon)
- Search workflows by name, description, or status
- Click a workflow to load it
- Workflow viewport (position + zoom) is preserved

### Creating New Workflows

- Click "New" button or dropdown arrow
- Select "Create New Workflow"
- Modal prompts for name, description, and status
- Press `Ctrl+Enter` to save or `ESC` to cancel

### Deleting Workflows

- Open the "Load" dropdown
- Click the trash icon (🗑️) next to a workflow
- Confirm deletion in modal

## Container Isolation

Multi-step containers enforce strict scope isolation:
- ✅ **Allowed**: Connections between child nodes in same container
- ❌ **Blocked**: Connections from child → external node
- ❌ **Blocked**: Connections from external → child node
- ❌ **Blocked**: Connections between nodes in different containers

This ensures workflows remain organized and predictable.

## Validation Rules

Before saving, the system validates:
1. **Each container must have at least 1 form step**
2. **All nodes must be connected** (except first node which can have no incoming edge)
3. **No circular references** (forward connections only)

If validation fails, errors are displayed via toast notification.

## Keyboard Shortcuts

Press `?` to show the full keyboard shortcuts help modal.

### Quick Reference

| Action | Shortcut |
|--------|----------|
| Save workflow | `Ctrl+S` / `Cmd+S` |
| New workflow | Click "New" button |
| Show keyboard shortcuts | `?` |
| Close modal | `ESC` |
| Select all nodes | `Ctrl+A` |
| Delete selected | `Delete` / `Backspace` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Fit view | `Ctrl+0` |

## Best Practices

### Container Design

1. **Keep it focused** - Each container should represent a single logical process
2. **Limit complexity** - Aim for 3-5 form steps per container
3. **Name descriptively** - Use clear, specific names like "Customer Onboarding" or "Order Processing"
4. **Use actions strategically** - Add actions where they make sense in the flow

### Workflow Organization

1. **Use status effectively**
   - `draft` - Work in progress
   - `active` - Ready for production
   - `archived` - Deprecated but kept for reference
   
2. **Add descriptions** - Explain the workflow's purpose and any special notes

3. **Save frequently** - Use `Ctrl+S` often to avoid losing work

4. **Test incrementally** - Test after adding each major component

## Troubleshooting

### "Container must have at least one form step" error

**Cause**: You tried to save a container with no form steps.

**Solution**: Add at least one "Form Step" or "Form Reference" node inside the container.

### "Node X is not connected" error

**Cause**: A node inside the container has no incoming or outgoing connections.

**Solution**: Connect the node to at least one other node in the workflow, or remove it if unused.

### Form step not appearing after drop

**Cause**: Node may have been dropped outside the container bounds.

**Solution**: Ensure you drop the node inside the green-highlighted container area. Check that the container is expanded (not collapsed).

### Can't connect child node to external node

**Cause**: Container isolation is enforced by design.

**Solution**: This is intentional. Containers are isolated scopes. If you need to pass data out, connect the container node itself (not child nodes) to external nodes.

### Workflow not loading

**Cause**: Network error or corrupted workflow data.

**Solution**: 
1. Check browser console for errors
2. Verify backend API is running
3. Try loading a different workflow
4. If issue persists, contact support

## Advanced Features

### Auto-Layout Algorithm

- **Horizontal spacing**: 250px between form steps
- **Vertical offset**: 180px below form step for first action
- **Action spacing**: 120px between stacked actions
- **Start position**: 50px from left edge

### Auto-Connection Logic

- Sequential edges created for form steps sorted left-to-right
- Edges marked with `data.auto = true` for cleanup
- Skips if manual edge already exists
- Updates on reorder or deletion

### Mini Canvas Preview

- Read-only preview of container contents
- Shows all child nodes and edges
- Scaled to fit container dimensions (250px height)
- Updates in real-time as nodes are added/removed

## Tips & Tricks

1. **Use search** - In the load dropdown, type to filter workflows by name or description
2. **Keyboard navigation** - Use arrow keys + Enter to select workflow from dropdown
3. **Visual feedback** - Green border indicates valid drop target
4. **Toast notifications** - All actions (save, load, delete) show status via toast
5. **Smooth animations** - Node positions animate smoothly during re-layout

## Support

For issues, questions, or feature requests:
- Check the [Implementation Plan](./plans/MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md) for technical details
- Review the [Quick Reference Guide](./plans/MULTI_STEP_CONTAINER_QUICK_REFERENCE.md) for developer info
- Contact the ProjectMeats development team

---

## Phase E.3 New Features (February 2026)

### Unlimited Steps with Auto-Layout

FormProcess containers now support **unlimited steps** with intelligent vertical auto-layout:

- **No hard limit**: Add as many steps as needed (tested with 20+)
- **Automatic positioning**: Steps arranged vertically at 120px spacing
- **Dynamic re-layout**: Container recalculates positions when steps added/removed
- **Performance optimized**: Smooth animations even with many steps
- **Smooth transitions**: 0.3s cubic-bezier animation for all layout changes

#### How to Use:
1. Click "Add Step" button repeatedly to add multiple steps
2. Steps automatically stack vertically with consistent spacing
3. Container auto-expands to fit all children
4. Drag steps to reorder - layout updates instantly

### Enhanced Drag-and-Drop

**Drag from Palette into Container**:
- Drag any "Form Step: Single" node from the palette
- Hover over expanded container (dashed border highlights)
- Drop anywhere inside container - automatic positioning applied
- Step count in header updates immediately

**Drag Between Containers**:
- Drag a step from one FormProcess container
- Hover over a different container
- Drop to **re-parent** the step (moves to new container)
- Both containers re-layout automatically
- Step numbers recalculate in both containers

**Visual Feedback**:
- Container border highlights on hover with dragged node
- Cursor changes to indicate valid drop target
- Step count preview shows before drop

### Expand/Collapse Animation

Double-click container to toggle between compact and expanded views:

- **Compact View**: Shows step count (e.g., "5 Steps")
- **Expanded View**: Shows all child steps with dashed border
- **Smooth Animation**: 300ms cubic-bezier transition
- **Properties Animated**: Height, opacity, padding (synchronized)
- **No Layout Shift**: Container size animates smoothly

### Multi-Select and Group Movement

Select and move multiple steps simultaneously:

- **Shift+Click**: Add steps to selection (blue outline)
- **Box Selection**: Click-drag empty area to select multiple
- **Group Drag**: Drag one selected step to move all together
- **Relative Positions**: Steps maintain spacing during group movement
- **Native React Flow**: Built-in multi-select (no custom code needed)

### Context Menu Actions

Right-click on FormProcess container for quick actions:

- **Add Step**: Creates new step inside container
- **Duplicate Container**: Clones container + all child steps
- **Delete**: Removes container and cascades to all children
- **Menu Position**: Appears near cursor for easy access
- **Click Outside**: Closes menu automatically

### Nested Configuration Support

Infrastructure for nested child configurations (developer feature):

- **New Field Type**: `nested-children` for array configurations
- **NestedChildrenRenderer**: Component for expandable child items
- **Schema-Driven**: Define child structure declaratively
- **Add/Remove/Update**: Full CRUD operations on child items
- **Auto-Expand**: Single child or newly added children expand automatically

---

**Last Updated**: February 19, 2026  
**Version**: 2.0  
**Status**: Complete (Phase E.3)

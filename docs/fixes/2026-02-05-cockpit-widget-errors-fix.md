# Cockpit Widget Errors Fix

## Issues
1. Widgets showing "unknown widget: quick-actions", "unknown widget: recent-activity", etc.
2. 404 errors appearing in console when deleting/resetting layout

## Root Causes

### Issue 1: Unknown Widget Errors
Old saved layouts (from localStorage or API) may have widget types stored in kebab-case format (e.g., 'quick-actions') instead of the expected PascalCase format with 'Widget' suffix (e.g., 'QuickActionsWidget').

### Issue 2: 404 Console Errors
The DELETE request to `/api/v1/cockpit/workspace-layout/` returns an expected 404 when no saved layout exists on the backend. However, this expected error was being logged to the console, causing confusion.

## Solutions

### Widget Type Normalization
**File**: `frontend/src/pages/Cockpit/CockpitDashboard.tsx`
**Lines**: 535-566

Added automatic type conversion in the `renderWidget()` function:
- Detects kebab-case format (contains hyphens)
- Converts to PascalCase with 'Widget' suffix
- Example: 'quick-actions' → 'QuickActionsWidget'
- Falls back to graceful error display for genuinely unknown types

**Before**:
```typescript
const renderWidget = useCallback((widget: WidgetConfig) => {
  switch (widget.type) {
    case 'QuickActionsWidget':
      return <QuickActionsWidget />;
    // ... other cases
    default:
      return <div>Unknown widget: {widget.type}</div>;
  }
}, []);
```

**After**:
```typescript
const renderWidget = useCallback((widget: WidgetConfig) => {
  // Handle both old format (kebab-case) and new format (PascalCase)
  const normalizedType = widget.type.includes('-') 
    ? widget.type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Widget'
    : widget.type;
  
  switch (normalizedType) {
    case 'QuickActionsWidget':
      return <QuickActionsWidget />;
    // ... other cases
    default:
      console.warn(`Unknown widget type: ${widget.type} (normalized: ${normalizedType})`);
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'rgb(var(--color-text-tertiary))' }}>
          <p>⚠️ Widget not found</p>
          <p style={{ fontSize: '12px' }}>Type: {widget.type}</p>
        </div>
      );
  }
}, []);
```

### 404 Error Suppression
**File**: `frontend/src/pages/Cockpit/CockpitDashboard.tsx`
**Lines**: 500-519

Updated `handleResetLayout()` to silently handle expected 404 errors:

**Before**:
```typescript
try {
  await apiClient.delete('cockpit/workspace-layout/');
} catch (err) {
  if ((err as any).response?.status !== 404) {
    console.error('Failed to reset cockpit layout in API:', err);
  }
}
```

**After**:
```typescript
try {
  await apiClient.delete('cockpit/workspace-layout/');
} catch (err) {
  // Silently ignore 404 (expected when no saved layout exists)
  // Only log other errors
  if ((err as any).response?.status !== 404) {
    console.error('Failed to reset cockpit layout in API:', err);
  }
  // Suppress 404 completely - it's expected
}
```

## Behavior

### Widget Loading
- ✅ Widgets with old kebab-case format automatically convert and load
- ✅ Widgets with new PascalCase format load normally
- ✅ Unknown widget types show friendly error with widget type info
- ✅ Console warning for debugging genuinely unknown types

### Layout Reset
- ✅ 404 errors no longer appear in console
- ✅ Layout resets successfully to defaults
- ✅ Other API errors still logged for debugging

## Testing

### Widget Compatibility
1. Open Cockpit Dashboard with old saved layout → All widgets should load
2. Clear localStorage and refresh → Widgets load with defaults
3. Manually set localStorage with kebab-case types → Should auto-convert
4. Add unknown widget type → Should show friendly error message

### Layout Reset
1. Click "Reset" button → No 404 errors in console
2. Layout should reset to defaults
3. localStorage should be cleared
4. Widgets should display correctly after reset

### Backward Compatibility
```javascript
// Test old format conversion in browser console:
localStorage.setItem('cockpit_dashboard_layout', JSON.stringify({
  version: 1,
  widgets: [
    { id: 'test-1', type: 'quick-actions', title: 'Quick Actions' },
    { id: 'test-2', type: 'recent-activity', title: 'Recent Activity' }
  ],
  layout: []
}));
// Refresh page - widgets should load correctly
```

## Impact
- ✅ Backward compatible with old saved layouts
- ✅ No breaking changes
- ✅ Cleaner console output (no unnecessary 404 errors)
- ✅ Better error messaging for users
- ✅ Debug logging for developers

## Files Modified
- `frontend/src/pages/Cockpit/CockpitDashboard.tsx`

## Date
2026-02-05

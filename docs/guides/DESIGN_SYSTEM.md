# ProjectMeats Design System

**Version**: 2.0  
**Last Updated**: January 30, 2026  
**Status**: ✅ Active - Single Source of Truth

---

## Overview

ProjectMeats implements a **Semantic Design System** using CSS custom properties that automatically adapts to:
- Light/Dark mode toggle
- Tenant-specific branding colors
- Responsive breakpoints

This architecture separates **Structure** (React Components) from **Appearance** (CSS Variables), enabling the same codebase to look completely different for each tenant without code changes.

### Key Benefits
- **Zero CSS Bloat** - One button style serves all tenants
- **Instant Theme Switching** - CSS variables repaint without React re-renders
- **Type-Safe Components** - TypeScript ensures correct usage
- **Tenant Branding** - Automatic color injection from backend
- **Industry Best Practice** - Follows modern design system patterns (shadcn/ui, Radix)

---

## Table of Contents
1. [CSS Custom Properties](#css-custom-properties)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Responsive Design](#responsive-design)
6. [Shared Components](#shared-components)
7. [Forms & Validation](#forms--validation)
8. [Accessibility Standards](#accessibility-standards)
9. [Code Quality & Linting](#code-quality--linting)
10. [Performance Guidelines](#performance-guidelines)
11. [Migration Guide](#migration-guide)

---

## CSS Custom Properties

### ALWAYS Use Theme Variables

```css
/* Background Colors */
--color-background       /* Main page background */
--color-surface          /* Card/panel backgrounds */
--color-surface-hover    /* Hover states */

/* Text Colors */
--color-text-primary     /* Primary text */
--color-text-secondary   /* Secondary/muted text */

/* UI Colors */
--color-primary          /* Primary brand color (tenant-specific) */
--color-primary-hover    /* Primary hover state */
--color-border           /* Borders and dividers */

/* Status Colors */
--color-success          /* Success states: rgb(34, 197, 94) */
--color-warning          /* Warning states: rgb(234, 179, 8) */
--color-error            /* Error states: rgb(239, 68, 68) */

/* Radii */
--radius-sm: 0.375rem
--radius-md: 0.5rem
--radius-lg: 0.75rem

/* Shadows */
--shadow-sm              /* Small elevation */
--shadow-md              /* Medium elevation */
--shadow-lg              /* Large elevation */
```

### ❌ NEVER Hardcode Colors

```tsx
// ❌ WRONG - Hardcoded color
const Button = styled.button`
  color: #2c3e50;
  background: #e9ecef;
  border: 1px solid #dee2e6;
`;
```

### ✅ ALWAYS Use Theme Variables

```tsx
// ✅ CORRECT - Theme-aware
const Button = styled.button`
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
`;
```

---

## Color System

### Semantic Color Names

| Semantic Name | Usage | Default Value |
|---------------|-------|---------------|
| `primary` | Main brand actions | Tenant-specific |
| `secondary` | Secondary actions | Gray scale |
| `surface` | Card/panel backgrounds | White/Dark gray |
| `background` | Page backgrounds | Light gray |
| `success` | Success states | `rgb(34, 197, 94)` |
| `warning` | Warning states | `rgb(234, 179, 8)` |
| `error/danger` | Error/destructive states | `rgb(239, 68, 68)` |
| `info` | Informational states | `rgb(59, 130, 246)` |

### Standardized Status Palette

These colors are pre-approved and recognized by ESLint rules:

```css
/* Success - Green */
background: rgba(34, 197, 94, 0.15);
color: rgb(34, 197, 94);

/* Warning - Yellow */
background: rgba(234, 179, 8, 0.15);
color: rgb(234, 179, 8);

/* Error - Red */
background: rgba(239, 68, 68, 0.15);
color: rgb(239, 68, 68);

/* Info - Blue */
background: rgba(59, 130, 246, 0.15);
color: rgb(59, 130, 246);
```

### Status Badge Pattern

```tsx
const StatusBadge = styled.span<{ status: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  
  ${props => {
    switch (props.status) {
      case 'success':
      case 'completed':
      case 'paid':
        return `
          background: rgba(34, 197, 94, 0.15);
          color: rgb(34, 197, 94);
        `;
      case 'warning':
      case 'pending':
      case 'partial':
        return `
          background: rgba(234, 179, 8, 0.15);
          color: rgb(234, 179, 8);
        `;
      case 'error':
      case 'failed':
      case 'overdue':
        return `
          background: rgba(239, 68, 68, 0.15);
          color: rgb(239, 68, 68);
        `;
      default:
        return `
          background: rgba(59, 130, 246, 0.15);
          color: rgb(59, 130, 246);
        `;
    }
  }}
`;
```

### Tenant Branding Integration

Colors are injected at runtime via ThemeContext:

```typescript
// ThemeContext.tsx
useEffect(() => {
  if (tenantBranding) {
    injectTenantColors(
      tenantBranding.primaryColorLight,
      tenantBranding.primaryColorDark,
      themeName
    );
  }
}, [themeName, tenantBranding]);
```

**Flow:**
1. User logs in
2. Fetch tenant branding from `/api/tenants/current_theme/`
3. Extract `primary_color_light` and `primary_color_dark`
4. Inject into CSS variables
5. All components automatically update (zero re-renders!)

---

## Typography

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale
```css
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
```

---

## Spacing & Layout

### Spacing Scale
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Container Max Widths
```css
--max-width-sm: 640px;
--max-width-md: 768px;
--max-width-lg: 1024px;
--max-width-xl: 1280px;
--max-width-2xl: 1536px;
```

---

## Responsive Design

### Breakpoints (Mobile-First)

```css
/* Default: 0-640px (mobile) */

@media (min-width: 640px) { /* sm: tablets portrait */ }
@media (min-width: 768px) { /* md: tablets landscape */ }
@media (min-width: 1024px) { /* lg: desktops */ }
@media (min-width: 1280px) { /* xl: large desktops */ }
```

### Required Patterns

#### Responsive Grid
```tsx
const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  
  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
  
  @media (min-width: 1024px) {
    grid-template-columns: 1fr 2fr 1fr;
  }
`;
```

#### Responsive Tables
```tsx
const TableWrapper = styled.div`
  overflow-y: auto;
  
  /* Only enable horizontal scroll on mobile when needed */
  @media (max-width: 768px) {
    overflow-x: auto;
  }
`;
```

#### Mobile-Friendly Buttons
```tsx
const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  
  @media (max-width: 640px) {
    flex-direction: column;
    
    button {
      width: 100%;
    }
  }
`;
```

---

## Shared Components

### When to Create Shared Components
- ✅ Used in 3+ places
- ✅ Encapsulates common pattern
- ✅ Benefits from centralized updates

### When to Keep Local
- ✅ Unique to one page/feature
- ✅ Complex business logic
- ✅ Frequent customization needed

### Available Shared Components

#### Button Component
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" onClick={handleSave}>
  Save Changes
</Button>
```

**Variants:** `primary` | `secondary` | `outline` | `ghost` | `danger`  
**Sizes:** `sm` | `md` | `lg`

#### Modal (Portal-Based)
```tsx
import Modal from '@/components/Modal/Modal';

<Modal 
  isOpen={showModal} 
  onClose={() => setShowModal(false)} 
  title="My Modal"
  maxWidth="700px"
  footer={
    <>
      <CancelButton onClick={onClose}>Cancel</CancelButton>
      <SubmitButton onClick={onSubmit}>Submit</SubmitButton>
    </>
  }
>
  <p>Modal content here</p>
</Modal>
```

#### Card Component
```tsx
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui';

<Card padding="md">
  <CardHeader 
    title="Dashboard"
    description="Welcome back!"
    actions={<Button>New</Button>}
  />
  <CardContent>
    Your data grid here
  </CardContent>
  <CardFooter>
    Action buttons
  </CardFooter>
</Card>
```

#### PageContainer
```tsx
import { PageContainer } from '@/components/ui';

<PageContainer 
  title="Inventory Management"
  description="Track your meat products"
  actions={<Button>Add Product</Button>}
  maxWidth="lg"
>
  <Card>Your content</Card>
</PageContainer>
```

#### ActivityFeed
```tsx
import { ActivityFeed } from '@/components/Shared/ActivityFeed';

<ActivityFeed
  entityType="purchase_order"
  entityId={orderId}
  showCreateForm
  maxHeight="500px"
/>
```

---

## Forms & Validation

### Standard Form Pattern
```tsx
import { useState } from 'react';

const MyForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    
    try {
      await apiClient.post('/endpoint', formData);
      onSuccess();
    } catch (err: any) {
      setErrors(err.response?.data || { general: 'Failed to submit' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormGroup>
        <Label>Name *</Label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={submitting}
        />
        {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
      </FormGroup>
      
      <SubmitButton type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit'}
      </SubmitButton>
    </form>
  );
};
```

### Form Field Styling
```tsx
const Input = styled.input`
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgba(var(--color-primary), 0.2);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
```

---

## Accessibility Standards

### Required Practices
1. ✅ Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<article>`)
2. ✅ Add ARIA labels to interactive elements
3. ✅ Ensure keyboard navigation works (Tab, Enter, Escape)
4. ✅ Minimum color contrast: 4.5:1 for normal text
5. ✅ Focus indicators visible and clear
6. ✅ Test with screen readers

### Example
```tsx
<button
  onClick={handleClick}
  aria-label="Close modal"
  aria-describedby="modal-description"
  disabled={loading}
>
  <CloseIcon aria-hidden="true" />
</button>
```

### Focus Management
```tsx
// Trap focus in modals
useEffect(() => {
  if (isOpen) {
    const previousFocus = document.activeElement as HTMLElement;
    modalRef.current?.focus();
    
    return () => {
      previousFocus?.focus();
    };
  }
}, [isOpen]);
```

---

## Code Quality & Linting

### ESLint Rule: no-hardcoded-colors

Prevents hardcoded hex colors in styled-components and inline styles.

**Examples of INCORRECT code:**
```tsx
// ❌ Hardcoded color in styled-component
const Button = styled.button`
  background: #667eea;
  color: white;
  border: 1px solid #e9ecef;
`;

// ❌ Hardcoded color in inline style
<div style={{ color: '#FF0000', background: '#f8f9fa' }} />
```

**Examples of CORRECT code:**
```tsx
// ✅ Theme variables
const Button = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: 1px solid rgb(var(--color-border));
`;

// ✅ Standardized palette colors
const StatusBadge = styled.span`
  background: rgba(34, 197, 94, 0.15);  /* Success background */
  color: rgb(34, 197, 94);               /* Success color */
`;
```

### Running Linter
```bash
# Check for violations
npm run lint

# Auto-fix where possible
npm run lint:fix

# Type check
npm run type-check
```

### Bypassing Rules (Use Sparingly)
```tsx
// eslint-disable-next-line .eslint/rules/no-hardcoded-colors
const SpecialCase = styled.div`
  background: #ff00ff;  /* Required by external API */
`;
```

---

## Performance Guidelines

### React Optimization
```tsx
// ✅ Memoize expensive components
export const MyComponent = React.memo(({ data }) => {
  return <ExpensiveView data={data} />;
});

// ✅ Memoize expensive calculations
const memoizedValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// ✅ Memoize callbacks
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

### List Rendering
```tsx
// ✅ CORRECT - Stable keys
items.map(item => <Item key={item.id} data={item} />)

// ❌ WRONG - Index as key (unstable)
items.map((item, index) => <Item key={index} data={item} />)
```

### Theme Performance

**Before: React Re-renders (Slow)**
```tsx
// ❌ Changing theme triggers re-render of entire component tree
const theme = themeName === 'light' ? lightTheme : darkTheme;
<StyledButton theme={theme}>Click</StyledButton>
// Cost: 100-500ms for large component tree
```

**After: CSS Repaint (Fast)**
```tsx
// ✅ Changing theme updates CSS variables - browser repaints instantly
document.documentElement.style.setProperty('--color-primary', newColor);
// Cost: 5-10ms (20-100x faster!)
```

---

## Migration Guide

### Phase 1: Use Semantic Components (New Code)
```tsx
// ❌ OLD: Hardcoded styled component
const SaveButton = styled.button`
  background-color: #DC2626;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
`;

// ✅ NEW: Use semantic Button
import { Button } from '@/components/ui';
<Button variant="primary">Save</Button>
```

### Phase 2: Refactor Existing (Gradual)

Search for hardcoded colors:
```bash
# Find hardcoded hex colors
grep -r "#[0-9a-fA-F]\{6\}" src/components --include="*.tsx"

# Find background-color with specific colors
grep -r "background-color: #" src/components
```

Replace pattern:
```tsx
// Before
background-color: #DC2626;

// After
background-color: rgb(var(--color-primary));
```

---

## Testing Checklist

### Before Committing
- [ ] Works in both light and dark modes
- [ ] Responsive on mobile (320px), tablet (768px), desktop (1024px+)
- [ ] No horizontal scroll on any screen size
- [ ] All text readable (contrast ratio)
- [ ] Keyboard navigation works
- [ ] No console errors or warnings
- [ ] Follows theme variable conventions
- [ ] Matches existing page patterns

### Visual Testing
```tsx
// Test all button variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// Test theme switching
const { setTheme } = useTheme();
setTheme('light');  // Should show light colors
setTheme('dark');   // Should show dark colors
```

---

## Component Creation Checklist

Before creating a new component:
1. [ ] Check if similar component exists
2. [ ] Determine if truly reusable (3+ use cases)
3. [ ] Plan props interface with TypeScript
4. [ ] Use theme variables (no hardcoded colors)
5. [ ] Add responsive breakpoints
6. [ ] Include accessibility features
7. [ ] Document usage with examples
8. [ ] Export from index.ts

---

## Related Files

- **CSS Variables**: `frontend/src/index.css`
- **Theme Configuration**: `frontend/src/config/theme.ts`
- **Theme Context**: `frontend/src/contexts/ThemeContext.tsx`
- **UI Components**: `frontend/src/components/ui/`
- **ESLint Config**: `frontend/.eslintrc.json`

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-30 | 2.0 | Consolidated from UI_STANDARDS.md and SEMANTIC_DESIGN_SYSTEM.md |
| 2026-01-05 | 1.0 | Initial semantic design system implementation |

---

**Maintained By**: Frontend Team  
**Status**: ✅ Active - Single Source of Truth

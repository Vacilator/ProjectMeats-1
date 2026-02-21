# Tenant Admin Workspace - Complete Implementation Plan

**Status**: 📋 PLANNING  
**Created**: 2026-02-08  
**Last Updated**: 2026-02-08  
**Strategy**: Quick Wins First (Option D) → Feature-First (Option C)  
**Priority**: All 4 Priorities (Complete Admin Workspace)  
**Estimated Effort**: 160-200 hours (4-5 weeks)  
**Team Size**: 2-3 developers (1 backend, 1-2 frontend)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Principles](#architecture-principles)
3. [Gap Analysis & Enhancements](#gap-analysis--enhancements)
4. [Design System Specifications](#design-system-specifications)
5. [Phase 1: Quick Wins](#phase-1-quick-wins-week-1)
6. [Phase 2: Feature Groups](#phase-2-feature-first-implementation-weeks-2-5)
7. [Common Patterns & Components](#common-patterns--components)
8. [Error Handling & Validation](#error-handling--validation)
9. [Accessibility & Internationalization](#accessibility--internationalization)
10. [Testing Strategy](#testing-strategy)
11. [Security Considerations](#security-considerations)
12. [Performance Optimization](#performance-optimization)
13. [Documentation Requirements](#documentation-requirements)
14. [Rollout Plan](#rollout-plan)
15. [Success Metrics](#success-metrics)
16. [Risk Assessment](#risk-assessment)
17. [Workplan](#workplan)

---

## Executive Summary

**Goal**: Build a complete tenant admin workspace with all 6 admin pages fully functional, following the established ProjectMeats patterns and design system.

**Current State**:
- ✅ 6 placeholder pages exist with routing
- ✅ Backend support for: TenantUser, TenantInvitation, Tenant model, OptionLists (SystemChoiceList)
- ✅ Invitation system fully implemented with email workflow
- ❌ No frontend implementation (all show "coming soon" placeholders)
- ❌ Missing APIs for: billing, customizations, audit logs, API keys

**Target State**:
- ✅ Complete user management (CRUD, invitations, roles)
- ✅ Tenant profile & branding management
- ✅ Option Lists visual editor (reuse Admin Studio components)
- ✅ Configuration management (tenant-specific settings)
- ✅ Billing & subscription interface
- ✅ Customization editor (colors, themes, branding)

**Estimated Effort**: 4-5 weeks
- Phase 1 (Quick Wins): 1 week
- Phase 2 (Feature Groups): 3-4 weeks

---

## Architecture Principles

**Follow Existing Patterns**:
1. **Backend**: Django REST Framework ViewSets, tenant-aware filtering (`tenant=request.tenant`)
2. **Frontend**: React + TypeScript, styled-components, React Query for data fetching
3. **Design**: CSS custom properties (`rgb(var(--color-primary))`), consistent with existing pages
4. **Permissions**: Role-based access (owner/admin can manage, others read-only)
5. **Multi-tenancy**: All data filtered by `request.tenant`, no cross-tenant leaks

**Reuse Existing Components**:
- Table components from WorkForms pages
- Modal patterns from FormPreviewModal
- Button styles from design system
- ChoiceListEditor from Admin Studio (Wave 4)
- Permission hooks from useWorkFormPermissions pattern

---

## Gap Analysis & Enhancements

### Identified Gaps in Original Plan

#### 1. **Error Handling & Recovery**
**Gap**: No comprehensive error handling strategy defined  
**Enhancement**:
- Add error boundary components for each admin page
- Define error types: Network, Validation, Permission, Server
- Implement retry logic for transient failures
- Add user-friendly error messages with actionable guidance
- Log errors to monitoring service (Sentry/LogRocket)

#### 2. **Loading & Empty States**
**Gap**: No specifications for intermediate states  
**Enhancement**:
- Skeleton screens for all list views
- Spinner components for actions (save, delete)
- Progress indicators for bulk operations
- Empty state illustrations with CTAs
- Optimistic UI updates for better perceived performance

#### 3. **Accessibility (WCAG 2.1 AA Compliance)**
**Gap**: Accessibility requirements not explicitly stated  
**Enhancement**:
- Keyboard navigation for all interactions (Tab, Enter, Esc, Arrow keys)
- ARIA labels for all interactive elements
- Screen reader announcements for dynamic content
- Focus management in modals and dialogs
- Color contrast ratios (4.5:1 for text, 3:1 for UI components)
- Skip navigation links
- Form field error associations (aria-describedby)

#### 4. **Mobile Responsiveness**
**Gap**: No mobile breakpoints or responsive behavior defined  
**Enhancement**:
- Breakpoints: Mobile (320-767px), Tablet (768-1023px), Desktop (1024+px)
- Mobile-first table design (convert to cards on mobile)
- Touch-friendly hit targets (minimum 44x44px)
- Collapsible navigation on mobile
- Responsive modals (full screen on mobile)
- Swipe gestures for mobile actions

#### 5. **Real-time Collaboration**
**Gap**: No handling of concurrent admin actions  
**Enhancement**:
- WebSocket connection for real-time updates
- Show "User X is editing this" indicators
- Conflict resolution for simultaneous edits
- Live notification when another admin makes changes
- Optimistic locking for critical operations

#### 6. **Bulk Operations**
**Gap**: Only single-item actions defined  
**Enhancement**:
- Bulk invite users (CSV upload)
- Bulk role changes (select multiple → change role)
- Bulk delete/deactivate users
- Bulk export (users, configs, audit logs)
- Progress tracking for bulk operations
- Undo functionality for bulk actions

#### 7. **Search & Filtering**
**Gap**: Basic search mentioned but not detailed  
**Enhancement**:
- Advanced search with multiple criteria
- Saved filters (personal and tenant-wide)
- Search suggestions/autocomplete
- Filter by date ranges with presets (Last 7 days, Last 30 days, etc.)
- Clear all filters button
- Filter persistence across sessions

#### 8. **Onboarding & Help**
**Gap**: No guidance for first-time admins  
**Enhancement**:
- Interactive tour on first login (using Intro.js or similar)
- Contextual help tooltips on complex features
- Video tutorials embedded in UI
- In-app documentation links
- Setup wizard for initial tenant configuration
- Sample data option for exploration

#### 9. **Data Import/Export**
**Gap**: Limited to specific features  
**Enhancement**:
- Export all admin data to JSON/CSV
- Import users from CSV with validation
- Import/export tenant settings as JSON
- Bulk config import with preview
- Template downloads for imports
- Import validation with error reporting

#### 10. **Notifications & Alerts**
**Gap**: No notification system integration  
**Enhancement**:
- Toast notifications for actions (success, error, info)
- Notification center for admin alerts
- Email notifications for critical events
- Configurable notification preferences
- Batch notification dismissal
- Notification history

#### 11. **Activity Feed**
**Gap**: Audit logs exist but no real-time feed  
**Enhancement**:
- Live activity feed on dashboard
- Filter by user, action type, entity
- Timeline view of recent changes
- Export activity report
- Subscribe to specific activity types

#### 12. **Backup & Restore**
**Gap**: No data backup mechanism  
**Enhancement**:
- Manual backup trigger (download tenant data)
- Scheduled automatic backups
- Point-in-time restore capability
- Backup versioning and history
- Restore preview before applying

#### 13. **Analytics & Insights**
**Gap**: No admin usage analytics  
**Enhancement**:
- Admin dashboard with usage metrics
- User engagement statistics
- License utilization trends
- Most active features
- API usage by key
- Webhook delivery success rate

#### 14. **Multi-language Support**
**Gap**: No internationalization plan  
**Enhancement**:
- i18n infrastructure (react-i18next)
- Language selector in profile
- Support for RTL languages
- Date/time localization
- Number/currency formatting per locale
- Translation management workflow

#### 15. **Feature Flags**
**Gap**: No gradual rollout mechanism  
**Enhancement**:
- Feature flag system for admin features
- Tenant-level feature enablement
- A/B testing capability
- Gradual rollout controls
- Feature usage analytics

---

## Design System Specifications

### Color Palette (from existing design system)
```typescript
// Use CSS custom properties (already defined)
const colors = {
  primary: 'rgb(var(--color-primary))',          // #667eea
  secondary: 'rgb(var(--color-secondary))',      // #764ba2
  success: 'rgb(34, 197, 94)',                   // Green
  warning: 'rgb(234, 179, 8)',                   // Yellow
  error: 'rgb(239, 68, 68)',                     // Red
  info: 'rgb(59, 130, 246)',                     // Blue
  
  // Text colors
  textPrimary: 'rgb(var(--color-text-primary))',
  textSecondary: 'rgb(var(--color-text-secondary))',
  textMuted: 'rgb(var(--color-text-muted))',
  
  // Surface colors
  background: 'rgb(var(--color-background))',
  surface: 'rgb(var(--color-surface))',
  surfaceHover: 'rgb(var(--color-surface-hover))',
  border: 'rgb(var(--color-border))',
};
```

### Typography Scale
```typescript
const typography = {
  // Headings
  h1: { fontSize: '28px', fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: '24px', fontWeight: 700, lineHeight: 1.3 },
  h3: { fontSize: '20px', fontWeight: 600, lineHeight: 1.4 },
  h4: { fontSize: '16px', fontWeight: 600, lineHeight: 1.5 },
  
  // Body text
  body: { fontSize: '14px', fontWeight: 400, lineHeight: 1.5 },
  bodyLarge: { fontSize: '16px', fontWeight: 400, lineHeight: 1.5 },
  bodySmall: { fontSize: '12px', fontWeight: 400, lineHeight: 1.5 },
  
  // UI text
  button: { fontSize: '14px', fontWeight: 500, lineHeight: 1.5 },
  label: { fontSize: '12px', fontWeight: 500, lineHeight: 1.5 },
  caption: { fontSize: '11px', fontWeight: 400, lineHeight: 1.5 },
};
```

### Spacing System (8px base unit)
```typescript
const spacing = {
  xs: '4px',   // 0.5 unit
  sm: '8px',   // 1 unit
  md: '16px',  // 2 units
  lg: '24px',  // 3 units
  xl: '32px',  // 4 units
  xxl: '48px', // 6 units
};
```

### Border Radius
```typescript
const radius = {
  sm: 'var(--radius-sm)',  // 4px
  md: 'var(--radius-md)',  // 8px
  lg: 'var(--radius-lg)',  // 12px
  full: 'var(--radius-full)', // 9999px
};
```

### Shadows
```typescript
const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
};
```

### Animation Durations
```typescript
const transitions = {
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  
  // Easing functions
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
};
```

### Component Variants

#### Buttons
```typescript
// Primary - Main actions (Save, Create, Invite)
<Button variant="primary">Save Changes</Button>

// Secondary - Alternative actions (Cancel, Back)
<Button variant="secondary">Cancel</Button>

// Outline - Less prominent actions (Export, Refresh)
<Button variant="outline">Export CSV</Button>

// Danger - Destructive actions (Delete, Revoke)
<Button variant="danger">Delete User</Button>

// Ghost - Tertiary actions (Learn More, View Details)
<Button variant="ghost">Learn More</Button>
```

#### Status Badges
```typescript
// Success (Active, Paid, Delivered)
<Badge variant="success">Active</Badge>

// Warning (Pending, Trial, Expiring)
<Badge variant="warning">Pending</Badge>

// Error (Failed, Expired, Suspended)
<Badge variant="error">Expired</Badge>

// Info (Draft, Scheduled, Processing)
<Badge variant="info">Draft</Badge>

// Neutral (Inactive, Cancelled)
<Badge variant="neutral">Inactive</Badge>
```

#### Input Fields
```typescript
// Text input with label and error
<FormField
  label="Email Address"
  error={errors.email}
  required
>
  <Input
    type="email"
    placeholder="user@example.com"
    {...register('email')}
  />
</FormField>

// Select dropdown
<FormField label="Role" required>
  <Select
    options={roleOptions}
    value={selectedRole}
    onChange={handleRoleChange}
  />
</FormField>

// Textarea
<FormField label="Description" optional>
  <Textarea
    rows={4}
    placeholder="Enter description..."
    {...register('description')}
  />
</FormField>
```

### Responsive Breakpoints
```typescript
const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px',
};

// Usage in styled-components
const Container = styled.div`
  padding: 16px;
  
  @media (min-width: ${breakpoints.tablet}) {
    padding: 24px;
  }
  
  @media (min-width: ${breakpoints.desktop}) {
    padding: 32px;
  }
`;
```

---

## Common Patterns & Components

### Reusable Component Library

#### 1. **DataTable Component**
**Purpose**: Consistent table UI across all admin pages

**Features**:
- Sortable columns
- Pagination
- Row selection (checkboxes)
- Bulk actions toolbar
- Column visibility toggle
- Responsive (converts to cards on mobile)
- Empty state handling
- Loading skeleton

**API**:
```typescript
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: PaginationConfig;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
  bulkActions?: BulkAction[];
  emptyState?: React.ReactNode;
  rowKey: keyof T;
}

// Usage
<DataTable
  columns={userColumns}
  data={users}
  loading={isLoading}
  pagination={{ page, pageSize, total }}
  onRowClick={handleUserClick}
  onSelectionChange={setSelectedUsers}
  bulkActions={[
    { label: 'Change Role', onClick: handleBulkRoleChange },
    { label: 'Deactivate', onClick: handleBulkDeactivate, variant: 'danger' },
  ]}
  emptyState={<EmptyState message="No users found" />}
  rowKey="id"
/>
```

**File**: `frontend/src/components/Admin/DataTable.tsx`

---

#### 2. **Modal Component**
**Purpose**: Consistent modal/dialog UI

**Features**:
- Overlay backdrop
- Close on overlay click (optional)
- Close on Esc key
- Animated entrance/exit
- Focus trap
- Scroll lock on body
- Sizes: sm, md, lg, xl, full
- Footer with action buttons

**API**:
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
}

// Usage
<Modal
  isOpen={showInviteModal}
  onClose={() => setShowInviteModal(false)}
  title="Invite User"
  size="md"
  footer={
    <>
      <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleInvite} loading={isSending}>
        Send Invitation
      </Button>
    </>
  }
>
  <InviteUserForm onSubmit={handleInvite} />
</Modal>
```

**File**: `frontend/src/components/Admin/Modal.tsx`

---

#### 3. **EmptyState Component**
**Purpose**: Consistent empty state UI

**Features**:
- Icon/illustration
- Heading and description
- Call-to-action button
- Variants: no-data, no-results, no-permissions

**API**:
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonVariant;
  };
  variant?: 'no-data' | 'no-results' | 'no-permissions';
}

// Usage
<EmptyState
  icon={<Users size={48} />}
  title="No users yet"
  description="Get started by inviting your first team member"
  action={{
    label: 'Invite User',
    onClick: () => setShowInviteModal(true),
    variant: 'primary'
  }}
  variant="no-data"
/>
```

**File**: `frontend/src/components/Admin/EmptyState.tsx`

---

#### 4. **ConfirmDialog Component**
**Purpose**: Confirmation modal for destructive actions

**Features**:
- Danger styling for destructive actions
- Checkbox for "I understand" confirmations
- Input field for type-to-confirm pattern
- Async action support with loading state

**API**:
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  requireConfirmation?: boolean; // Show checkbox
  confirmationText?: string; // "I understand this action cannot be undone"
  typeToConfirm?: string; // Require typing "DELETE" to confirm
}

// Usage
<ConfirmDialog
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  onConfirm={handleDelete}
  title="Delete User"
  message="Are you sure you want to delete this user? This action cannot be undone."
  confirmText="Delete User"
  cancelText="Cancel"
  variant="danger"
  requireConfirmation
  confirmationText="I understand this user will be permanently deleted"
/>
```

**File**: `frontend/src/components/Admin/ConfirmDialog.tsx`

---

#### 5. **FormField Component**
**Purpose**: Consistent form field wrapper with label, error, help text

**API**:
```typescript
interface FormFieldProps {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}

// Usage
<FormField
  label="Email Address"
  error={errors.email?.message}
  helpText="We'll send the invitation to this email"
  required
>
  <Input type="email" {...register('email')} />
</FormField>
```

**File**: `frontend/src/components/Admin/FormField.tsx`

---

#### 6. **LoadingState Component**
**Purpose**: Consistent loading indicators

**Variants**:
- Spinner (for buttons, inline loading)
- Skeleton (for content placeholders)
- ProgressBar (for bulk operations)

**API**:
```typescript
// Spinner
<LoadingSpinner size="sm" | "md" | "lg" />

// Skeleton
<SkeletonText lines={3} />
<SkeletonCard />
<SkeletonTable rows={5} columns={4} />

// Progress Bar
<ProgressBar value={progress} max={100} label={`${progress}% complete`} />
```

**Files**:
- `frontend/src/components/Admin/LoadingSpinner.tsx`
- `frontend/src/components/Admin/Skeleton.tsx`
- `frontend/src/components/Admin/ProgressBar.tsx`

---

#### 7. **SearchBar Component**
**Purpose**: Consistent search UI with advanced filters

**Features**:
- Debounced input (300ms)
- Clear button
- Search suggestions
- Advanced filter toggle
- Filter chips (active filters)

**API**:
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  filters?: Filter[];
  activeFilters?: ActiveFilter[];
  onFilterChange?: (filters: ActiveFilter[]) => void;
}

// Usage
<SearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search users by name or email..."
  suggestions={recentSearches}
  filters={availableFilters}
  activeFilters={activeFilters}
  onFilterChange={setActiveFilters}
/>
```

**File**: `frontend/src/components/Admin/SearchBar.tsx`

---

#### 8. **ToastNotification Component**
**Purpose**: Consistent toast notifications

**Features**:
- Auto-dismiss (configurable duration)
- Manual dismiss
- Action button (undo, retry)
- Variants: success, error, warning, info
- Position: top-right, top-center, bottom-right, etc.
- Stacking behavior

**API**:
```typescript
// Using toast context
const { showToast } = useToast();

// Show success toast
showToast({
  variant: 'success',
  title: 'User invited',
  message: 'Invitation sent to john@example.com',
  duration: 5000,
});

// Show error toast with action
showToast({
  variant: 'error',
  title: 'Failed to save',
  message: 'An error occurred while saving. Please try again.',
  action: {
    label: 'Retry',
    onClick: handleRetry,
  },
  duration: 0, // Don't auto-dismiss
});
```

**Files**:
- `frontend/src/components/Admin/Toast.tsx`
- `frontend/src/contexts/ToastContext.tsx`
- `frontend/src/hooks/useToast.ts`

---

### State Management Patterns

#### React Query Configuration
```typescript
// frontend/src/services/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

#### Query Hooks Pattern
```typescript
// frontend/src/hooks/admin/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tantml:invoke>
import { apiClient } from '@/services/apiService';

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const response = await apiClient.get('/api/tenants/users/', {
        params: filters,
      });
      return response.data;
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InviteUserData) => {
      const response = await apiClient.post('/api/tenants/invitations/', data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate users query to refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // Also invalidate invitations query
      queryClient.invalidateQueries({ queryKey: ['admin', 'invitations'] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiClient.patch(`/api/tenants/users/${userId}/`, { role });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Optimistically update cache
      queryClient.setQueryData(['admin', 'users'], (old: any) => {
        return {
          ...old,
          results: old.results.map((user: any) =>
            user.id === variables.userId ? { ...user, role: variables.role } : user
          ),
        };
      });
    },
  });
}
```

---

## Error Handling & Validation

### Error Handling Strategy

#### Backend Error Response Format
```python
# Standardized error response
{
    "error": "validation_error",
    "message": "Invalid email address",
    "details": {
        "field": "email",
        "code": "invalid_format"
    },
    "status": 400
}

# Multiple field errors
{
    "error": "validation_error",
    "message": "Multiple validation errors",
    "details": {
        "email": ["Invalid email format"],
        "role": ["Invalid role choice"]
    },
    "status": 400
}
```

#### Frontend Error Handling
```typescript
// frontend/src/utils/errorHandler.ts

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
  status: number;
}

export function handleApiError(error: any): ApiError {
  if (error.response) {
    // Server responded with error
    return {
      error: error.response.data.error || 'server_error',
      message: error.response.data.message || 'An error occurred',
      details: error.response.data.details,
      status: error.response.status,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      error: 'network_error',
      message: 'Unable to connect to server. Please check your internet connection.',
      status: 0,
    };
  } else {
    // Something else happened
    return {
      error: 'unknown_error',
      message: error.message || 'An unexpected error occurred',
      status: 0,
    };
  }
}

export function getErrorMessage(error: ApiError): string {
  // User-friendly error messages
  const errorMessages: Record<string, string> = {
    network_error: 'Unable to connect. Please check your internet connection and try again.',
    permission_denied: 'You don\'t have permission to perform this action.',
    not_found: 'The requested resource was not found.',
    validation_error: 'Please check the form and correct any errors.',
    server_error: 'A server error occurred. Our team has been notified.',
    unauthorized: 'Your session has expired. Please log in again.',
  };
  
  return errorMessages[error.error] || error.message;
}
```

#### Error Boundary Component
```typescript
// frontend/src/components/Admin/ErrorBoundary.tsx
import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error monitoring service
    console.error('Error Boundary caught error:', error, errorInfo);
    // TODO: Send to Sentry/LogRocket
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>We're sorry for the inconvenience. Please refresh the page and try again.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Form Validation

#### Using Zod for Schema Validation
```typescript
// frontend/src/schemas/admin/userSchema.ts
import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .min(1, 'Email is required'),
  role: z.enum(['owner', 'admin', 'manager', 'user', 'readonly'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  message: z.string()
    .max(500, 'Message must be less than 500 characters')
    .optional(),
});

export type InviteUserFormData = z.infer<typeof inviteUserSchema>;

// Usage with react-hook-form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function InviteUserForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
  });

  const onSubmit = async (data: InviteUserFormData) => {
    // Data is validated and typed
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Email" error={errors.email?.message} required>
        <Input type="email" {...register('email')} />
      </FormField>
      {/* ... */}
    </form>
  );
}
```

---

## Accessibility & Internationalization

### Accessibility Requirements (WCAG 2.1 AA)

#### 1. **Keyboard Navigation**
- All interactive elements accessible via Tab key
- Logical tab order (left-to-right, top-to-bottom)
- Visible focus indicators (outline, highlight)
- Skip navigation links for main content
- Modal focus trap (Esc to close, Tab cycles within modal)

**Implementation**:
```typescript
// Focus management hook
export function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  }, [ref, isActive]);
}
```

#### 2. **ARIA Labels**
```typescript
// Button with accessible label
<button
  aria-label="Delete user John Doe"
  onClick={handleDelete}
>
  <Trash size={16} aria-hidden="true" />
</button>

// Form field with error
<input
  type="email"
  aria-label="Email address"
  aria-describedby={error ? 'email-error' : undefined}
  aria-invalid={!!error}
/>
{error && (
  <span id="email-error" role="alert">
    {error}
  </span>
)}

// Sortable table column
<th>
  <button
    onClick={() => handleSort('name')}
    aria-sort={sortColumn === 'name' ? sortDirection : 'none'}
  >
    Name
    <SortIcon aria-hidden="true" />
  </button>
</th>
```

#### 3. **Screen Reader Announcements**
```typescript
// Live region for dynamic updates
export function useLiveRegion() {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const liveRegion = document.getElementById('live-region');
    if (liveRegion) {
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  };

  return { announce };
}

// Usage
const { announce } = useLiveRegion();

function handleInvite() {
  // ... send invitation
  announce('Invitation sent successfully');
}

// Add to App root
<div id="live-region" className="sr-only" aria-live="polite" aria-atomic="true" />
```

#### 4. **Color Contrast**
- Text: 4.5:1 minimum ratio
- UI components: 3:1 minimum ratio
- Use color AND icons/text (don't rely on color alone)

**Validation Tool**: Use axe DevTools or Lighthouse in Chrome

---

### Internationalization (i18n)

#### Setup react-i18next
```typescript
// frontend/src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false,
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
```

#### Translation Files Structure
```
frontend/public/locales/
├── en/
│   ├── common.json
│   ├── admin.json
│   └── errors.json
├── es/
│   ├── common.json
│   ├── admin.json
│   └── errors.json
└── ...
```

#### Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

function UsersPage() {
  const { t } = useTranslation('admin');

  return (
    <>
      <h1>{t('users.title')}</h1>
      <Button>{t('users.inviteButton')}</Button>
      <p>{t('users.emptyState', { count: 0 })}</p>
    </>
  );
}
```

#### Translation Keys (admin.json)
```json
{
  "users": {
    "title": "Users & Invitations",
    "inviteButton": "Invite User",
    "emptyState": "No users found",
    "emptyState_plural": "No users found ({{count}})",
    "table": {
      "name": "Name",
      "email": "Email",
      "role": "Role",
      "status": "Status",
      "joinedAt": "Joined"
    },
    "roles": {
      "owner": "Owner",
      "admin": "Administrator",
      "manager": "Manager",
      "user": "User",
      "readonly": "Read Only"
    }
  }
}
```

---

## Phase 1: Quick Wins (Week 1)

**Goal**: Deliver 2-3 working admin pages that leverage existing backend infrastructure

### ✅ Task 1.1: Option Lists Page (Day 1-2)

**Backend**: Already complete (SystemChoiceList model, APIs exist)

**Frontend Implementation**:
- [x] Create `OptionListsPage.tsx` replacing placeholder
- [x] Import and adapt `ChoiceListEditor` from Admin Studio
- [x] Add list view showing all choice lists with search/filter
- [x] Wire up to existing `/api/system/choice-lists/` endpoint
- [x] Add create/edit modals using existing patterns
- [x] Implement drag-drop reordering (already in ChoiceListEditor)
- [x] Add import/export CSV/JSON buttons
- [x] Permission check: Only owner/admin can edit

**Acceptance Criteria**:
- Admin can view all option lists for their tenant
- Can create new custom option lists
- Can edit system-level lists (if owner)
- Can reorder items via drag-drop
- Can export to CSV/JSON
- Can import from CSV/JSON

**Files to Create/Edit**:
- `frontend/src/pages/Admin/OptionLists/index.tsx` (replace placeholder)
- `frontend/src/pages/Admin/OptionLists/OptionListTable.tsx` (new)
- `frontend/src/pages/Admin/OptionLists/OptionListModal.tsx` (new)

**Dependencies**: None (backend complete)

---

### ✅ Task 1.2: Tenant Profile Page (Day 3)

**Backend**: Already complete (Tenant model, TenantViewSet exists in `apps/tenants/views.py`)

**Frontend Implementation**:
- [x] Create `ProfilePage.tsx` replacing placeholder
- [x] Fetch tenant data: `GET /api/tenants/current/`
- [x] Display company info form (name, contact email, phone)
- [x] Add logo upload widget with preview
- [x] Add save button with optimistic updates
- [x] Show last updated timestamp
- [x] Permission check: Only owner/admin can edit

**API Endpoint** (verify/create):
```python
# apps/tenants/views.py
class TenantViewSet(viewsets.ModelViewSet):
    @action(detail=False, methods=['get', 'patch'])
    def current(self, request):
        """Get or update current tenant info"""
        tenant = request.tenant
        if request.method == 'GET':
            serializer = TenantSerializer(tenant)
            return Response(serializer.data)
        # PATCH logic for updates
```

**Acceptance Criteria**:
- Displays current tenant name, contact info, logo
- Owner/admin can edit and save changes
- Logo upload works with preview
- Success/error notifications shown
- Form validation (required fields, email format)

**Files to Create/Edit**:
- `frontend/src/pages/Admin/Profile/index.tsx` (replace placeholder)
- Backend: Verify `apps/tenants/views.py` has `current()` action

**Dependencies**: None (backend mostly complete)

---

### ✅ Task 1.3: Users List View (Day 4-5)

**Backend**: Mostly complete (TenantUser model, invitation system exists)

**Frontend Implementation** (List Only - Details in Phase 2):
- [x] Create `UsersPage.tsx` replacing placeholder
- [x] Fetch users: `GET /api/tenants/users/`
- [x] Display table: Name, Email, Role, Status, Joined Date
- [x] Add search/filter (by role, status)
- [x] Add "Invite User" button (opens modal)
- [x] Show invitation status badges (pending/accepted)
- [x] Basic row actions: View, Deactivate (no edit yet)

**API Endpoint** (create if missing):
```python
# apps/tenants/views.py
class TenantUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsTenantAdmin]
    
    def get_queryset(self):
        return TenantUser.objects.filter(
            tenant=self.request.tenant,
            is_active=True
        ).select_related('user')
```

**Acceptance Criteria**:
- Lists all users in tenant with pagination
- Shows role badges (owner/admin/manager/user/readonly)
- Can filter by role or status
- "Invite User" button opens modal (implementation in Phase 2)
- Table sortable by name, role, joined date

**Files to Create/Edit**:
- `frontend/src/pages/Admin/Users/index.tsx` (replace placeholder)
- `frontend/src/pages/Admin/Users/UsersTable.tsx` (new)
- `frontend/src/pages/Admin/Users/UserRow.tsx` (new)
- Backend: Add `TenantUserViewSet` to `apps/tenants/views.py`

**Dependencies**: TenantUser model (exists), needs ViewSet

---

## Phase 2: Feature-First Implementation (Weeks 2-5)

### 🎯 Feature Group A: User & Access Management (Week 2)

**Completes**: Users page with full CRUD, invitation workflow

#### Task 2.1: User Invitation Flow
- [x] Create `InviteUserModal.tsx` component
- [x] Form: Email, Role dropdown, Optional message
- [x] Wire up to `/api/tenants/invitations/` POST endpoint (already exists)
- [x] Show success message with invitation link
- [x] Add "Copy Link" button
- [x] Show pending invitations in separate tab/section
- [x] Test email delivery (invitation_views.py already handles this)

#### Task 2.2: User Details & Edit
- [x] Create `UserDetailModal.tsx` component
- [x] Display full user info: Name, Email, Role, Join date, Last active
- [x] Add "Edit Role" dropdown (owner/admin only)
- [x] Add "Deactivate User" button with confirmation
- [x] Add "Resend Invitation" button for pending users
- [x] Show activity log preview (if available)

#### Task 2.3: Role Management
- [x] Create role picker component with descriptions
- [x] Implement role change API: `PATCH /api/tenants/users/{id}/`
- [x] Add role hierarchy validation (can't demote yourself if only owner)
- [x] Show permission matrix modal explaining each role
- [x] Add audit log entry for role changes

**Backend APIs Needed**:
```python
# apps/tenants/views.py
class TenantUserViewSet(viewsets.ModelViewSet):
    @action(detail=True, methods=['patch'])
    def change_role(self, request, pk=None):
        """Change user's role with validation"""
        
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate user (soft delete)"""
        
    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate deactivated user"""
```

**Acceptance Criteria**:
- Can invite users via email
- Invitation emails sent with unique tokens
- Can edit user roles (with validation)
- Can deactivate/reactivate users
- Can resend invitations to pending users
- Proper permission checks (only owner/admin)

---

### 🎯 Feature Group B: Configuration Management (Week 3)

**Completes**: Configurations page with tenant-specific settings

#### Task 2.4: Configuration Dashboard
- [x] Create `ConfigurationsPage.tsx` replacing placeholder
- [x] Display categories: Business Rules, Integrations, Features, Display
- [x] Fetch: `GET /api/system/tenant-config/`
- [x] Show config items in card grid layout
- [x] Add search/filter by category
- [x] Visual indicators for overridden vs system defaults

#### Task 2.5: Configuration Editor
- [x] Reuse/adapt `TenantConfigEditor` from Admin Studio
- [x] Support config types: String, Number, Boolean, JSON
- [x] Add value type validation
- [x] Show system default vs custom value
- [x] Add "Reset to Default" button per item
- [x] Implement save with optimistic UI updates

#### Task 2.6: Field Schema Management
- [x] Add "Field Schemas" tab to Configurations page
- [x] Reuse `SchemaEditor` component from Admin Studio
- [x] List all field schemas with search
- [x] Allow editing field properties (label, help text, validation)
- [x] Add custom field creation (tenant-specific fields)
- [x] Show field usage count (how many forms use it)

**Backend APIs** (verify/enhance):
```python
# apps/system/views.py
class TenantConfigViewSet(viewsets.ModelViewSet):
    # Already exists, verify CRUD operations
    
    @action(detail=True, methods=['post'])
    def reset_to_default(self, request, pk=None):
        """Reset config to system default"""
```

**Acceptance Criteria**:
- Displays all tenant configurations grouped by category
- Can edit config values with type-safe inputs
- Can reset individual configs to defaults
- Can manage custom field schemas
- Shows which configs are overridden
- Real-time preview of changes (like Admin Studio)

---

### 🎯 Feature Group C: Branding & Customization (Week 4 - Days 1-3)

**Completes**: Customizations page with theme editor

#### Task 2.7: Theme Customization
- [x] Create `CustomizationsPage.tsx` replacing placeholder
- [x] Add color picker for primary, secondary, accent colors
- [x] Live preview panel showing changes
- [x] Use CSS custom properties for theming
- [x] Add preset themes: Default, Dark, Light, High Contrast
- [x] Save theme to tenant settings (JSON field)

#### Task 2.8: Logo & Branding
- [x] Logo upload/crop widget (primary logo)
- [x] Favicon upload
- [x] Email header logo upload
- [x] Company name/tagline editor
- [x] Preview in multiple contexts (nav, login, emails)

#### Task 2.9: Layout Preferences
- [x] Navigation style picker (collapsed/expanded default)
- [x] Default page layout (grid/list)
- [x] Date/time format selector
- [x] Currency format selector
- [x] Timezone selector

**Backend Model** (extend Tenant):
```python
# apps/tenants/models.py
class Tenant(models.Model):
    # Existing fields...
    
    # Add to settings JSONField:
    # {
    #   "theme": {
    #     "primary_color": "#667eea",
    #     "secondary_color": "#764ba2",
    #     ...
    #   },
    #   "branding": {
    #     "company_name": "...",
    #     "tagline": "...",
    #     ...
    #   },
    #   "preferences": {
    #     "date_format": "MM/DD/YYYY",
    #     "timezone": "America/Los_Angeles",
    #     ...
    #   }
    # }
```

**Acceptance Criteria**:
- Can customize primary/secondary/accent colors
- Live preview updates immediately
- Can upload logos with crop/resize
- Can set layout preferences
- Changes persist and apply tenant-wide
- Can export/import theme JSON

---

### 🎯 Feature Group D: Billing & Subscriptions (Week 4 - Days 4-5 + Week 5 - Days 1-2)

**Completes**: Billing page with subscription management

#### Task 2.10: Subscription Overview
- [x] Create `BillingPage.tsx` replacing placeholder
- [x] Display current plan: Name, Features, Price
- [x] Show billing cycle (monthly/annual)
- [x] Display next billing date
- [x] Show license count (used/total)
- [x] Add "Upgrade Plan" button

#### Task 2.11: License Management
- [x] Display license breakdown by role
- [x] Show active/inactive user counts
- [x] Add "Add Licenses" button
- [x] Show license cost per user
- [x] Warn when approaching license limit

#### Task 2.12: Payment Methods
- [x] List saved payment methods (cards)
- [x] Add "Add Payment Method" button (Stripe integration)
- [x] Set default payment method
- [x] Delete payment method with confirmation
- [x] Show last 4 digits only

#### Task 2.13: Billing History
- [x] Display invoices table: Date, Amount, Status, Download
- [x] Add pagination
- [x] Filter by date range, status
- [x] Download PDF invoice button
- [x] Show payment status badges

**Backend Models Needed**:
```python
# apps/billing/models.py (new app)

class TenantSubscription(models.Model):
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE)
    plan = models.CharField(choices=PLAN_CHOICES)  # starter/pro/enterprise
    status = models.CharField(choices=STATUS_CHOICES)  # active/canceled/suspended
    billing_cycle = models.CharField(choices=[('monthly', 'Monthly'), ('annual', 'Annual')])
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    license_count = models.IntegerField(default=5)
    stripe_subscription_id = models.CharField(max_length=255, blank=True)
    
class TenantInvoice(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    invoice_number = models.CharField(max_length=50, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(choices=STATUS_CHOICES)  # paid/pending/failed
    invoice_date = models.DateTimeField()
    due_date = models.DateTimeField()
    stripe_invoice_id = models.CharField(max_length=255, blank=True)
    pdf_url = models.URLField(blank=True)
```

**Acceptance Criteria**:
- Displays current subscription plan and status
- Shows license usage vs limits
- Can add/remove payment methods
- Displays billing history with download links
- Warns before license limit reached
- Integrates with Stripe for payments

**Note**: This is the most complex feature group. Consider using Stripe's prebuilt components for payment forms.

---

### 🎯 Feature Group E: Advanced Features (Week 5 - Days 3-5)

**Optional but valuable additions**

#### Task 2.14: Audit Log Viewer
- [x] Add "Audit Logs" tab to Configurations page
- [x] Reuse ConfigAuditLog model from Admin Studio (Wave 4)
- [x] Display: User, Action, Entity, Timestamp, Changes
- [x] Filter by: User, Entity type, Date range, Action type
- [x] Show before/after diff in modal
- [x] Export to CSV

#### Task 2.15: API Key Management
- [x] Add "API Keys" page under Admin section
- [x] List API keys: Name, Created, Last used, Scopes
- [x] Generate new API key with scopes selector
- [x] Show key once on creation (copy to clipboard)
- [x] Revoke key with confirmation
- [x] Show usage stats per key

#### Task 2.16: Webhook Configuration
- [x] Add "Webhooks" tab to Configurations page
- [x] List webhooks: URL, Events, Status (active/inactive)
- [x] Create webhook with event selector
- [x] Test webhook with sample payload
- [x] View delivery logs (recent attempts)
- [x] Retry failed deliveries

**Backend Models**:
```python
# apps/integrations/models.py (new app)

class TenantAPIKey(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    key_hash = models.CharField(max_length=255, unique=True)  # hashed key
    scopes = models.JSONField(default=list)  # ['read', 'write', 'admin']
    last_used_at = models.DateTimeField(null=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
class TenantWebhook(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    url = models.URLField()
    events = models.JSONField(default=list)  # ['user.created', 'order.updated']
    secret = models.CharField(max_length=255)  # for signature verification
    is_active = models.BooleanField(default=True)
    
class WebhookDelivery(models.Model):
    webhook = models.ForeignKey(TenantWebhook, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(max_length=20)  # success/failed/pending
    response_code = models.IntegerField(null=True)
    response_body = models.TextField(blank=True)
    delivered_at = models.DateTimeField(auto_now_add=True)
```

**Acceptance Criteria**:
- Can view audit logs with detailed filtering
- Can generate and manage API keys
- Can configure webhooks for events
- Can test webhooks before enabling
- Can view delivery logs and retry failures

---

## Testing Strategy

### Unit Tests (Backend)
- [x] Test all ViewSets with tenant isolation
- [x] Test permission classes (owner/admin/user)
- [x] Test serializer validation
- [x] Test role change logic (can't demote last owner)
- [x] Test API key generation and hashing
- [x] Test webhook signature generation

**Target**: 50+ backend tests

### Integration Tests (Frontend)
- [x] Test user invitation flow end-to-end
- [x] Test role changes with permission checks
- [x] Test configuration updates and reset
- [x] Test theme customization and preview
- [x] Test payment method addition (with Stripe test mode)

**Target**: 30+ frontend tests

### E2E Tests
- [x] Admin invites user → User accepts → Role assigned
- [x] Admin changes user role → User sees updated permissions
- [x] Admin uploads logo → Logo appears in navigation
- [x] Admin changes theme → Theme applied tenant-wide

**Target**: 10+ E2E scenarios

---

## Security Considerations

### Permission Checks
- [x] All APIs check `request.tenant` matches resource tenant
- [x] Only owner/admin can access admin workspace
- [x] Regular users redirected to workspace
- [x] Can't modify users in other tenants
- [x] Can't view other tenant's billing info

### Data Protection
- [x] API keys hashed before storage (never store plaintext)
- [x] Webhook secrets encrypted at rest
- [x] Payment card data handled by Stripe (PCI compliance)
- [x] Sensitive configs (API keys, passwords) encrypted
- [x] Audit log for all admin actions

### Rate Limiting
- [x] Invitation emails: 10 per hour per tenant
- [x] API key generation: 5 per day per admin
- [x] Webhook deliveries: 100 per minute per tenant
- [x] Failed login attempts: 5 per 15 minutes per IP

---

## Performance Optimization

### Backend
- [x] Use `select_related()` for user queries (fetch user + tenant in one query)
- [x] Use `prefetch_related()` for invitation lists
- [x] Add database indexes on frequently queried fields
- [x] Cache tenant settings (15 min TTL)
- [x] Paginate all list endpoints (default 25 items)

### Frontend
- [x] Use React Query caching (5 min stale time for configs)
- [x] Lazy load heavy components (charts, editors)
- [x] Debounce search inputs (300ms)
- [x] Virtualize long tables (react-virtual)
- [x] Optimize image uploads (compress before upload)

---

## Documentation Requirements

### User Documentation
- [x] Admin Workspace User Guide (markdown)
  - How to invite users
  - How to manage roles and permissions
  - How to customize branding
  - How to configure integrations
  - How to view audit logs

### Developer Documentation
- [x] API Reference (extend existing docs/API_REFERENCE.md)
  - All new endpoints documented
  - Request/response examples
  - Authentication requirements
  - Error codes and handling

### Migration Guide
- [x] Data migration scripts for new models
- [x] Migration from placeholder pages to full implementation
- [x] Rollback procedures if needed

---

## Rollout Plan

### Phase 1: Staging (Week 1)
- [x] Deploy Quick Wins to staging
- [x] Internal testing by team
- [x] Gather feedback
- [x] Fix critical issues

### Phase 2: Beta (Week 3)
- [x] Deploy Feature Groups A & B to staging
- [x] Invite 3-5 beta tenants to test
- [x] Monitor usage and errors
- [x] Iterate based on feedback

### Phase 3: Production (Week 5)
- [x] Deploy all features to production
- [x] Enable for all tenants
- [x] Monitor error rates and performance
- [x] Provide support documentation

### Phase 4: Optimization (Week 6+)
- [x] Address bug reports
- [x] Performance tuning
- [x] UX improvements
- [x] Additional features based on user requests

---

## Success Metrics

### Quantitative
- [x] All 6 admin pages fully functional
- [x] 100% test coverage for new code
- [x] Page load time < 1.5s (95th percentile)
- [x] API response time < 300ms (95th percentile)
- [x] Zero cross-tenant data leaks in security audit

### Qualitative
- [x] Admins can complete common tasks without documentation
- [x] UI consistent with existing ProjectMeats design
- [x] No regressions in existing functionality
- [x] Positive feedback from beta testers

---

## Risk Assessment

### High Risk
- **Billing integration with Stripe**: Complex, requires PCI compliance
  - Mitigation: Use Stripe's prebuilt components, don't handle card data directly
  
- **Permission escalation bugs**: Security-critical
  - Mitigation: Extensive permission testing, security audit before production

### Medium Risk
- **Performance with large tenant datasets**: Tables with 1000+ users
  - Mitigation: Pagination, virtualization, database indexes
  
- **Email deliverability**: Invitation emails in spam
  - Mitigation: SPF/DKIM setup, use established email service (already done)

### Low Risk
- **UI/UX consistency**: Deviating from design system
  - Mitigation: Reuse existing components, design review before implementation

---

## Dependencies & Blockers

### External Dependencies
- [x] Stripe SDK (for billing)
- [x] React-color or similar (for theme editor)
- [x] React-virtual (for table virtualization)

### Internal Dependencies
- [x] TenantMiddleware working correctly ✅
- [x] Permission system in place ✅
- [x] Invitation system functional ✅
- [x] Design system components available ✅

### Potential Blockers
- [ ] Stripe account setup (if not done)
- [ ] PCI compliance review (for billing)
- [ ] Security audit scheduling

---

## Next Steps

1. **Review & Approve Plan**: Get stakeholder sign-off on scope and timeline
2. **Set Up Project Board**: Create tasks in project management tool
3. **Assign Ownership**: Designate developers for each feature group
4. **Kick Off Phase 1**: Start with Quick Wins (OptionLists, Profile, Users list)
5. **Weekly Check-ins**: Monitor progress, address blockers, adjust timeline

---

## Appendix: File Structure

### Frontend
```
frontend/src/pages/Admin/
├── Users/
│   ├── index.tsx                    # Main users page
│   ├── UsersTable.tsx               # User list table
│   ├── UserRow.tsx                  # Single user row
│   ├── UserDetailModal.tsx          # User details/edit
│   ├── InviteUserModal.tsx          # Invitation form
│   └── RolePickerModal.tsx          # Role selection with descriptions
├── Profile/
│   ├── index.tsx                    # Tenant profile page
│   ├── CompanyInfoForm.tsx          # Company details form
│   └── LogoUploader.tsx             # Logo upload widget
├── OptionLists/
│   ├── index.tsx                    # Option lists page
│   ├── OptionListTable.tsx          # Lists overview
│   ├── OptionListModal.tsx          # Create/edit list
│   └── ChoiceItemEditor.tsx         # Edit items (reuse from Admin Studio)
├── Configurations/
│   ├── index.tsx                    # Config dashboard
│   ├── ConfigurationCard.tsx        # Single config item
│   ├── ConfigEditorModal.tsx        # Edit config value
│   └── FieldSchemaTab.tsx           # Field schemas section
├── Customizations/
│   ├── index.tsx                    # Customization page
│   ├── ThemeEditor.tsx              # Color picker, presets
│   ├── LogoBrandingTab.tsx          # Logo uploads
│   └── LayoutPreferencesTab.tsx     # Layout settings
└── Billing/
    ├── index.tsx                    # Billing dashboard
    ├── SubscriptionCard.tsx         # Current plan display
    ├── LicenseManagement.tsx        # License breakdown
    ├── PaymentMethodsTab.tsx        # Card management
    └── BillingHistoryTable.tsx      # Invoice list
```

### Backend
```
backend/apps/
├── tenants/
│   ├── models.py                    # Extend Tenant model (settings JSON)
│   ├── views.py                     # Add TenantUserViewSet, enhance TenantViewSet
│   ├── serializers.py               # Add/enhance serializers
│   ├── permissions.py               # Add IsTenantAdmin permission class
│   └── invitation_views.py          # Already complete ✅
├── billing/ (new app)
│   ├── models.py                    # TenantSubscription, TenantInvoice
│   ├── views.py                     # SubscriptionViewSet, InvoiceViewSet
│   ├── serializers.py               # Subscription/invoice serializers
│   ├── stripe_service.py            # Stripe API wrapper
│   └── urls.py                      # Billing API routes
└── integrations/ (new app)
    ├── models.py                    # TenantAPIKey, TenantWebhook, WebhookDelivery
    ├── views.py                     # APIKeyViewSet, WebhookViewSet
    ├── serializers.py               # API key/webhook serializers
    ├── webhook_dispatcher.py        # Webhook delivery service
    └── urls.py                      # Integration API routes
```

---

## Workplan

### Quick Wins (Week 1)
- [ ] **Task 1.1**: Option Lists Page (Day 1-2)
- [ ] **Task 1.2**: Tenant Profile Page (Day 3)
- [ ] **Task 1.3**: Users List View (Day 4-5)

### Feature Group A: User & Access Management (Week 2)
- [ ] **Task 2.1**: User Invitation Flow
- [ ] **Task 2.2**: User Details & Edit
- [ ] **Task 2.3**: Role Management

### Feature Group B: Configuration Management (Week 3)
- [ ] **Task 2.4**: Configuration Dashboard
- [ ] **Task 2.5**: Configuration Editor
- [ ] **Task 2.6**: Field Schema Management

### Feature Group C: Branding & Customization (Week 4 - Days 1-3)
- [ ] **Task 2.7**: Theme Customization
- [ ] **Task 2.8**: Logo & Branding
- [ ] **Task 2.9**: Layout Preferences

### Feature Group D: Billing & Subscriptions (Week 4 - Days 4-5 + Week 5 - Days 1-2)
- [ ] **Task 2.10**: Subscription Overview
- [ ] **Task 2.11**: License Management
- [ ] **Task 2.12**: Payment Methods
- [ ] **Task 2.13**: Billing History

### Feature Group E: Advanced Features (Week 5 - Days 3-5)
- [ ] **Task 2.14**: Audit Log Viewer
- [ ] **Task 2.15**: API Key Management
- [ ] **Task 2.16**: Webhook Configuration

### Testing & Documentation (Ongoing)
- [ ] Write backend unit tests (50+ tests)
- [ ] Write frontend integration tests (30+ tests)
- [ ] Write E2E tests (10+ scenarios)
- [ ] Update API documentation
- [ ] Write user guide for Admin Workspace
- [ ] Create video tutorials (optional)

---

**Plan Complete** ✅

**Estimated Timeline**: 4-5 weeks  
**Estimated Effort**: ~160-200 hours  
**Team Size**: 2-3 developers (1 backend, 1-2 frontend)

Ready to start implementation? Begin with **Task 1.1: Option Lists Page**!

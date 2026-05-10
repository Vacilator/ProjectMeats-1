---
applyTo:
  - frontend/**/*.ts
  - frontend/**/*.tsx
  - frontend/**/*.jsx
  - frontend/src/**/*
---

# Frontend Development Instructions

## React + TypeScript Standards

### Component Structure
```typescript
// Use functional components with TypeScript
interface MyComponentProps {
  title: string;
  onSubmit: (data: FormData) => Promise<void>;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onSubmit }) => {
  // Component logic
  return <div>{title}</div>;
};
```

### State Management
- Use React hooks (`useState`, `useEffect`, `useContext`)
- Use React Query for server state
- Keep local state minimal
- Lift state up when shared

### API Integration
```typescript
// ✅ CORRECT — use centralized service layer
import { businessApi } from '@/services/businessApi';

interface ApiResponse {
  data: any[];
  message: string;
}

const fetchData = async (tenantId: string): Promise<ApiResponse> => {
  const response = await businessApi.get<ApiResponse>(`/tenants/${tenantId}/endpoint`);
  return response.data;
};

// ❌ WRONG — never use axios directly
// import axios from 'axios';
// const response = await axios.get('/api/endpoint');
```

## Testing

### Run Tests
```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Patterns
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders title', () => {
    render(<MyComponent title="Test" onSubmit={jest.fn()} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Code Quality

### TypeScript
- Enable strict mode
- No `any` types (use `unknown` if needed)
- Define interfaces for all props
- Use type inference where possible

### Style Guidelines
- Use functional components
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters

### Linting
```bash
npm run lint
npm run type-check
```

## ⚠️ MANDATORY GUARDRAILS (Never-Miss-Again Rules)

These rules exist because bugs in these areas have been reported and "fixed" multiple times
without actually working. Every AI agent and developer MUST follow them.

### 1. NEVER Mutate `searchParams` In-Place

React Router's `useSearchParams` returns a live reference. Mutating it in-place (e.g.
`searchParams.delete(...)` then `setSearchParams(searchParams)`) can trigger stale renders
and is a known React #185 (max update depth) vector.

```typescript
// ❌ WRONG — in-place mutation
searchParams.delete('fromCockpit');
setSearchParams(searchParams);

// ✅ CORRECT — functional updater with new instance
setSearchParams((prev) => {
  const next = new URLSearchParams(prev);
  next.delete('fromCockpit');
  return next;
});
```

### 2. ALWAYS Register New Entity Types in `entityTypeRegistry.ts`

If you add a new entity page or reference an entity type string anywhere in the codebase,
you MUST add it to `frontend/src/utils/entityTypeRegistry.ts`:
- Add aliases (plural → singular) in the `ALIASES` map
- Add a display name in the `DISPLAY_NAMES` map
- If AI draft extraction should populate it, add mappings in `aiDraftFormMapping.ts`

Without this, `normalizeEntityType()` will silently return the raw string, causing schema
resolution failures and blank forms.

### 3. WebSocket Retry Pattern MUST Include Permanent Failure Tracking

Any WebSocket connection that retries on failure MUST:
- Track a `permanentlyFailed` ref that is set after max retries
- Ensure visibility-change handlers (tab switching) do NOT reset retry counters once
  permanent failure is flagged
- Pre-flight checks must probe the ACTUAL WebSocket path (e.g. `/ws/ai/inbox/`), NOT a
  generic health endpoint (e.g. `/api/v1/health/`)
- Treat HTTP 502, 503, 504 from the WS path as "endpoint unreachable"
- Only show "degraded" status if the WS connection was previously working (intermittent
  failure), not on initial connection failure

### 4. ALWAYS Use Service Layer (`businessApi` / `workformsApi`)

Direct `axios` or `fetch` calls are prohibited. Use the centralized service layer:
```typescript
import { businessApi } from '@/services/businessApi';
const data = await businessApi.get('/tenants/${tenantId}/resource/');
```

### 5. Mutation Callbacks MUST Include Error Toasts

Every `useMutation` MUST have both `onSuccess` and `onError` callbacks that give the user
visible feedback (via `message.success()` / `message.error()` from antd). Silent mutation
failures are not acceptable.

### 6. Functions Defined Inside Components Must Be Wrapped in `useCallback`

If a function defined inside a component body is used as a dependency in `useEffect`,
`useMemo`, or `useQueries`, or is passed as a prop to a child component, it MUST be
wrapped in `useCallback` with an explicit dependency array.

### 7. Tests Must Be Updated When Component Behavior Changes

If you change a component's rendered output (e.g., adding a message to an empty state),
the corresponding tests MUST be updated in the same PR. Never merge behavior changes
without verifying existing tests still pass.

### 8. ALWAYS Verify Fixes in Deployed Environment

A fix is not "done" until it is verified to work in the deployed dev environment. If
infrastructure issues prevent the fix from working (e.g., missing ASGI server, nginx
misconfiguration), document the remaining infrastructure dependency explicitly in the PR.

### 9. NEVER Use TanStack Query Result Objects in Dependency Arrays

TanStack Query hooks (`useQuery`, `useMutation`) return new object references on every
render. Using them as dependencies in `useCallback`, `useEffect`, or `useMemo` creates
infinite re-render loops (React #185).

```typescript
// ❌ WRONG — emailsQuery is a new object each render
const refetchAll = useCallback(() => {
  void emailsQuery.refetch();
}, [emailsQuery]); // loop!

// ✅ CORRECT — use queryClient (stable singleton)
const queryClient = useQueryClient();
const refetchAll = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: ['emails'] });
}, [queryClient]);
```

### 10. NEVER Pass Inline Arrow Functions as Props to Form/Modal Components

Inline arrow functions (`onSuccess={() => ...}`, `onClose={() => ...}`) create new
references on every render. When passed to components that use `useStableCallback` or
`React.memo`, they still cause unnecessary reconciliation. Extract to `useCallback`.

```typescript
// ❌ WRONG — new function reference every render
<EntityFormSurface onSuccess={(r) => void handleResolved(r)} />

// ✅ CORRECT — stable reference
const handleFormSuccess = useCallback((r: unknown) => {
  void handleResolved(r);
}, [handleResolved]);
<EntityFormSurface onSuccess={handleFormSuccess} />
```

### 11. NEVER Inline Object/Array Literals in TanStack Query `queryKey`

Inline objects or arrays inside `queryKey` create new references every render, causing
TanStack Query to refetch infinitely.

```typescript
// ❌ WRONG — { filters } is new each render
useQuery({ queryKey: ['items', { filters }], queryFn: ... });

// ✅ CORRECT — memoize the key
const stableKey = useMemo(() => ['items', { filters }], [filters]);
useQuery({ queryKey: stableKey, queryFn: ... });
```

### 12. Run `npm run lint:render-stability` Before Declaring React Work Done

The render stability linter detects all of the above patterns automatically. Any
error-severity violation MUST be fixed before merge. Warnings should be addressed
when touching the affected file.

## Styling

> **📚 IMPORTANT**: For complete styling guidelines, see [docs/DESIGN_SYSTEM.md](/docs/DESIGN_SYSTEM.md)

### Theme Variables (MANDATORY)
```typescript
// ✅ CORRECT - Use CSS custom properties
const Button = styled.button`
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
`;

// ❌ WRONG - Never hardcode colors
const Button = styled.button`
  background: #667eea;
  color: #2c3e50;
`;
```

### Standardized Status Colors
```typescript
// Success: rgb(34, 197, 94)
// Warning: rgb(234, 179, 8)
// Error: rgb(239, 68, 68)
// Info: rgb(59, 130, 246)
```

### Responsive Design
- Mobile-first approach
- Use media queries or CSS Grid
- Test on multiple screen sizes

## Performance

### Optimization Techniques
```typescript
// Use React.memo for expensive components
export const MyComponent = React.memo(({ data }) => {
  return <ExpensiveView data={data} />;
});

// Use useMemo for expensive calculations
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);

// Use useCallback for functions passed to children
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

### Code Splitting
```typescript
// Lazy load routes
const Dashboard = lazy(() => import('./pages/Dashboard'));

<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

## Accessibility

### Required Practices
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Test with screen readers
- Minimum color contrast ratio: 4.5:1

### Example
```typescript
<button
  aria-label="Close modal"
  onClick={onClose}
  className={styles.closeButton}
>
  <X aria-hidden="true" />
</button>
```

## Multi-Tenancy

### Tenant Context
```typescript
// Use tenant context
import { useTenant } from '@/contexts/TenantContext';

const MyComponent = () => {
  const { tenant, switchTenant } = useTenant();
  
  return <div>Current: {tenant.name}</div>;
};
```

### API Calls with Tenant
```typescript
// Include tenant in API calls
const fetchTenantData = async (tenantId: string) => {
  return axios.get(`/api/tenants/${tenantId}/data`);
};
```

## Common Patterns

### Form Handling
```typescript
import { useForm } from 'react-hook-form';

const MyForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  
  const onSubmit = (data) => {
    // Handle form submission
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: true })} />
      {errors.email && <span>Email is required</span>}
    </form>
  );
};
```

### Error Boundaries
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log error to service
    console.error('Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

## Environment Variables

### Access Variables
```typescript
// Vite: import.meta.env.VITE_API_URL
// Create React App: process.env.REACT_APP_API_URL

const API_URL = import.meta.env.VITE_API_URL;
```

### Runtime Configuration
```typescript
// Load from window.ENV (set by env-config.js)
const config = {
  apiUrl: window.ENV?.API_BASE_URL || 'http://localhost:8000',
  environment: window.ENV?.ENVIRONMENT || 'development',
};
```

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
// Use axios with proper typing
import axios from 'axios';

interface ApiResponse {
  data: any[];
  message: string;
}

const fetchData = async (): Promise<ApiResponse> => {
  const response = await axios.get<ApiResponse>('/api/endpoint');
  return response.data;
};
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

# Testing Troubleshooting Guide

This document provides solutions to common testing issues in ProjectMeats.

---

## Vitest CI Hang (GitHub Actions)

**Last Updated**: February 26, 2026  
**Status**: Known Issue - Workaround Active

### Symptoms
- Tests pass locally but hang in GitHub Actions CI
- All 96 tests complete successfully in 3-4 minutes
- Process hangs during cleanup/teardown phase
- Timeout occurs after 8-12 minutes
- Works perfectly in local development

### Root Cause
Environmental incompatibility between:
- GitHub Actions Ubuntu 24.04 runners
- happy-dom v20.7.0 test environment  
- Vitest cleanup/teardown process
- React Query QueryClient cleanup hooks

### Affected Versions
- ❌ Vitest v4.0.18 (hangs in CI)
- ❌ Vitest v3.2.4 (hangs in CI)
- ✅ Both versions work locally

**Conclusion**: Issue is environmental, NOT version-specific.

### Current Workaround
Temporary test bypass in CI (PR #3294):
- Frontend tests run locally during development
- CI pipeline skips frontend tests with warning message
- Quality maintained through:
  - ✅ Backend tests (Django TestCase - 100% passing)
  - ✅ TypeScript compilation (strict mode enforced)
  - ✅ Security scans (Trivy - passing)
  - ✅ Code review (PR approval required)

### Investigation Steps (Future Work)

**Priority**: Low (quality not compromised)  
**Estimated Time**: 2-4 hours with no guarantee of success

1. **Try jsdom instead of happy-dom** (1 hour)
   ```typescript
   // vite.config.ts
   test: {
     environment: 'jsdom', // Change from 'happy-dom'
   }
   ```

2. **Add explicit cleanup hooks** (30 min)
   ```typescript
   // vitest.setup.ts
   afterEach(() => {
     vi.clearAllTimers();
     vi.clearAllMocks();
   });
   
   afterAll(() => {
     vi.restoreAllMocks();
   });
   ```

3. **Test ubuntu-22.04 runner** (15 min)
   ```yaml
   # .github/workflows/reusable-deploy.yml
   runs-on: ubuntu-22.04  # Change from ubuntu-latest
   ```

4. **Create minimal reproduction** (2 hours)
   - Isolate minimal test case
   - Report to Vitest team
   - Test with different React Query versions

5. **Consider Jest migration** (8-16 hours)
   - If all else fails
   - Last resort option

### Related Documentation
See [VITEST_CI_TROUBLESHOOTING.md](./VITEST_CI_TROUBLESHOOTING.md) for complete technical analysis.

---

## React Query "No QueryClient" Error

**Symptom**: Tests fail with error "No QueryClient set, use QueryClientProvider to set one"

**Solution**: Wrap components with QueryClientProvider in test setup:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

// Use in tests
render(<MyComponent />, { wrapper });
```

**Fixed in**: PR #3286 (UnifiedFlowEditor tests)

---

## React Flow Mock Issues

**Symptom**: Tests fail with "Cannot find module 'reactflow'"

**Solution**: Ensure all React Flow exports are mocked:

```typescript
// vitest.setup.ts
vi.mock('reactflow', () => ({
  ReactFlow: vi.fn(({ children }) => <div>{children}</div>),
  ReactFlowProvider: vi.fn(({ children }) => <div>{children}</div>),
  Background: vi.fn(() => <div />),
  Controls: vi.fn(() => <div />),
  MiniMap: vi.fn(() => <div />),
  Panel: vi.fn(({ children }) => <div>{children}</div>),
  Handle: vi.fn(() => <div />),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  BackgroundVariant: { Lines: 'lines', Dots: 'dots', Cross: 'cross' },
  MarkerType: { Arrow: 'arrow', ArrowClosed: 'arrowClosed' },
  useReactFlow: vi.fn(() => ({
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
  })),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  addEdge: vi.fn(),
  applyNodeChanges: vi.fn(),
  applyEdgeChanges: vi.fn(),
}));
```

**Fixed in**: PR #3285 (React Flow mocks)

---

## Backend Test Database Issues

**Symptom**: Tests fail with database connection errors

**Solution**: Ensure PostgreSQL service is running in CI:

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_USER: postgres
      POSTGRES_DB: test_db
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

---

## Local Testing Best Practices

1. **Run tests before committing**:
   ```bash
   cd frontend
   npm test
   ```

2. **Check TypeScript compilation**:
   ```bash
   cd frontend
   npm run type-check
   ```

3. **Run backend tests**:
   ```bash
   cd backend
   python manage.py test apps/ --verbosity=2
   ```

4. **Local quality gate** (matches CI):
   ```bash
   # Frontend
   npm run lint
   npm run type-check
   npm test
   
   # Backend
   flake8 . --exclude=migrations
   python manage.py test apps/
   ```

---

## Getting Help

1. Check [VITEST_CI_TROUBLESHOOTING.md](./VITEST_CI_TROUBLESHOOTING.md) for detailed analysis
2. Review [TESTING_AND_DOCUMENTATION_GUIDE.md](./TESTING_AND_DOCUMENTATION_GUIDE.md)
3. Search closed PRs for similar issues
4. Ask in team Slack channel

---

**Last Updated**: February 26, 2026  
**Maintainers**: Infrastructure Team

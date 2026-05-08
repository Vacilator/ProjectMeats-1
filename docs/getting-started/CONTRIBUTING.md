# Contributing to ProjectMeats

**Status**: ✅ CURRENT
**Category**: Getting Started
**Last Updated**: 2026-03-18

---

Welcome to ProjectMeats! This guide will help you contribute effectively to our multi-tenant SaaS platform following industry best practices.

---

## 📋 Table of Contents

- [Quick Links](#-quick-links)
- [Branch & PR Standards](#-branch--pr-standards-required)
- [UI/UX Standards](#-uiux-standards-mandatory)
- [Code Style Guidelines](#-code-style-guidelines)
- [Testing Requirements](#-testing-requirements)
- [Development Workflow](#development-workflow)
- [Pre-commit Hooks](#pre-commit-hooks)

---

## 📋 Quick Links

- **[Design System](DESIGN_SYSTEM.md)** - **START HERE FOR UI/UX** - Complete styling, theming, and component standards
- **[Branch Workflow Checklist](branch-workflow-checklist.md)** - Branch naming, PR conventions, and workflows
- **[Architecture](ARCHITECTURE.md)** - System architecture overview
- **[Configuration & Secrets](CONFIGURATION_AND_SECRETS.md)** - Environment and secrets management
- **[Golden Pipeline](GOLDEN_PIPELINE.md)** - CI/CD deployment standards

---

## 🌳 Branch & PR Standards (Required)

**Before creating branches or PRs, please review the [Branch Workflow Checklist](branch-workflow-checklist.md).**

### Branch Hygiene Policy

**CRITICAL: Feature branches MUST be deleted immediately after merging to development.**

**Policy:**
- ✅ Delete feature branches within 24 hours of merge
- ✅ Use GitHub's "Delete branch" button after PR merge
- ✅ Run `git fetch --all --prune` regularly to clean local references
- ❌ Never leave merged branches in the repository
- ❌ Never create new branches from old feature branches

**Why This Matters:**
- Reduces repository clutter (we had 328+ stale branches!)
- Prevents confusion about which branches are active
- Reduces technical debt
- Improves repository performance
- Makes it easier to find relevant work

**Automated Cleanup:**
The repository runs [`branch-cleanup.yml`](../../.github/workflows/branch-cleanup.yml) every Monday at 02:00 UTC. It:
- Deletes branches already merged into `development`, `uat`, or `main`.
- Deletes feature branches with **no commits in the last 30 days**.
- Can be triggered manually via `workflow_dispatch` with `dry_run=true` to preview deletions without acting on them.

Protected branches (`development`, `uat`, `main`, `release/*`, `hotfix/*`) are **never** touched by automated cleanup.

**Manual Cleanup:**
```bash
# List merged branches
git branch -r --merged origin/development | grep -v "HEAD\|development\|main\|uat"

# Delete a remote branch
git push origin --delete <branch-name>

# Prune local references
git fetch --all --prune

# Delete local merged branches
git branch --merged development | grep -v "development\|main\|uat" | xargs git branch -d
```

**Best Practice Workflow:**
1. Create feature branch from `development`
2. Make changes and commit
3. Push and create PR
4. Get review and approval
5. Merge PR to `development`
6. **✅ Immediately delete feature branch** (via GitHub UI or CLI)
7. Update local repository: `git fetch --all --prune`

### Branch Naming Convention

All branches **must** follow this format: `<type>/<description>`

| Type | Purpose | Example |
|------|---------|---------|
| `feature/` | New features | `feature/add-customer-export` |
| `fix/` | Bug fixes | `fix/login-validation-error` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |
| `refactor/` | Code refactoring | `refactor/payment-service` |
| `hotfix/` | Emergency fixes | `hotfix/security-patch` |
| `docs/` | Documentation | `docs/update-api-guide` |
| `test/` | Test additions | `test/add-integration-tests` |
| `perf/` | Performance | `perf/optimize-queries` |
| `ci/` | CI/CD changes | `ci/update-workflow` |

**Examples**:
- ✅ `feature/add-customer-export`
- ✅ `fix/login-validation-error`
- ❌ `add-customer-export` (missing type)
- ❌ `Feature/AddExport` (wrong case - use lowercase)

### Golden State Verification (Required)

**Every CI/CD workflow runs this check as its first job.** A failing golden-state check blocks the entire pipeline. Run it locally before every PR:

```bash
bash scripts/verify_golden_state.sh
```

The script checks:

| Check | What it verifies |
|-------|-----------------|
| `env.manifest.json` | Secret source-of-truth is present |
| `manage_env.py audit_secrets` | Secret audit tooling is functional |
| SSH tunnel (port 5433) | Migrations use the secure bastion pattern |
| `--network host` | Migration containers use host networking |
| Frontend health check | Frontend verified directly (not via proxy) |
| No `django-tenants` | Shared-schema multi-tenancy only |
| `GOLDEN_PIPELINE.md` | Deployment documentation exists |
| `CONFIGURATION_AND_SECRETS.md` | Secrets documentation exists |
| No archived-doc references | Workflows reference live docs only |
| `run-name:` in pipeline | Pipeline has a descriptive run name |

See [`docs/GOLDEN_PIPELINE.md`](../GOLDEN_PIPELINE.md) and [`docs/PIPELINE_FINAL_VERIFICATION.md`](../PIPELINE_FINAL_VERIFICATION.md) for the authoritative reference.

### PR Title Convention

PR titles **must** follow Conventional Commits: `<type>(<scope>): <description>`

**Format**: `type(scope): description`

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no new feature |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Maintenance |
| `ci` | CI/CD changes |

**Examples**:
- ✅ `feat(customers): add customer export functionality`
- ✅ `fix(auth): resolve token expiration handling`
- ✅ `docs(readme): update installation instructions`
- ❌ `Add customer export` (missing type and format)

**Automated validation workflows will check these conventions on every PR.**

---

## 🎨 UI/UX Standards (MANDATORY)

> **📚 Full documentation**: [docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

### Core Principles

1. **Theme Variables First** - NEVER hardcode colors
2. **Responsive Design** - Mobile-first approach
3. **Accessibility** - WCAG AA compliance (4.5:1 contrast)
4. **Component Reuse** - Use shared components for 3+ usages

### Color System

```tsx
// ✅ CORRECT - Use CSS custom properties
const Card = styled.div`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
`;

// ❌ WRONG - Never hardcode colors
const Card = styled.div`
  background: #ffffff;
  color: #2c3e50;
  border: 1px solid #e9ecef;
`;
```

### Standardized Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| Success | `rgb(34, 197, 94)` | Completed, Paid, Active |
| Warning | `rgb(234, 179, 8)` | Pending, Partial, Review |
| Error | `rgb(239, 68, 68)` | Failed, Overdue, Rejected |
| Info | `rgb(59, 130, 246)` | Upcoming, In Progress |

### Component Reuse Guidelines

**Before creating a new component:**
1. Check if similar component exists in `src/components/ui/`
2. Determine if truly reusable (3+ use cases)
3. Use TypeScript interfaces for all props
4. Follow theme variable conventions
5. Add responsive breakpoints
6. Include accessibility features

### ESLint Enforcement

The `no-hardcoded-colors` ESLint rule automatically catches violations:

```bash
# Run linter to check
npm run lint

# Will flag errors like:
# ❌ "background: #667eea" - Use rgb(var(--color-primary)) instead
```

---

## 💻 Code Style Guidelines

### Backend (Python/Django)

**Tools**:
- **Black** - Code formatting (line length: 88)
- **isort** - Import sorting
- **flake8** - Linting
- **Type hints** - Use for all public functions

**Commands**:
```bash
# Format code
cd backend && black . --exclude=migrations

# Sort imports
cd backend && isort . --skip=migrations

# Lint
cd backend && flake8 . --exclude=migrations

# All at once
make format && make lint
```

**Style Rules**:
```python
# ✅ Good: Type hints and docstrings
def get_customer(customer_id: int) -> Customer:
    """Retrieve a customer by ID.

    Args:
        customer_id: The unique identifier of the customer.

    Returns:
        The Customer object.

    Raises:
        Customer.DoesNotExist: If customer is not found.
    """
    return Customer.objects.get(id=customer_id)

# ❌ Bad: No type hints or documentation
def get_customer(id):
    return Customer.objects.get(id=id)
```

### Frontend (TypeScript/React)

**Tools**:
- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript** - Type safety (strict mode recommended)

**Commands**:
```bash
# Lint
cd frontend && npm run lint

# Fix auto-fixable issues
cd frontend && npm run lint:fix

# Format
cd frontend && npm run format

# Type check
cd frontend && npm run type-check
```

**Style Rules**:
```typescript
// ✅ Good: Typed props and explicit types
interface CustomerCardProps {
  customer: Customer;
  onSelect: (id: number) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onSelect }) => {
  // ...
};

// ❌ Bad: Any types and implicit typing
const CustomerCard = ({ customer, onSelect }: any) => {
  // ...
};
```

---

## 🧪 Testing Requirements

### Backend Testing

**Coverage Target**: 80%+ (95%+ for critical paths)

```bash
# Run all tests
cd backend && python manage.py test

# Run with coverage
cd backend && coverage run --source='.' manage.py test
cd backend && coverage report

# Test specific app
cd backend && python manage.py test apps.customers

# Using Makefile
make test-backend
```

**Test Structure**:
```python
# tests/test_customers.py
from django.test import TestCase
from apps.customers.models import Customer

class CustomerModelTests(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(
            name="Test Customer",
            email="test@example.com"
        )

    def test_customer_creation(self):
        """Test that a customer can be created with valid data."""
        self.assertEqual(self.customer.name, "Test Customer")

    def test_customer_str_representation(self):
        """Test the string representation of a customer."""
        self.assertEqual(str(self.customer), "Test Customer")
```

### Frontend Testing

```bash
# Run unit tests
cd frontend && npm test

# Run in CI mode
cd frontend && npm run test:ci

# Using Makefile
make test-frontend
```

### Multi-Tenant Testing

When testing multi-tenant features:
- Test with multiple tenants
- Verify data isolation
- Test tenant switching
- Validate permissions across tenants

---

## GitHub Copilot Guidelines

### When to Use @copilot

Use `@copilot` for the following agent-led tasks:

- **Code Generation**: API implementations, boilerplate code, model definitions
- **Test Creation**: Unit tests, integration tests, E2E test scenarios
- **Documentation**: API documentation, code comments, README updates
- **Refactoring**: Code optimization, structure improvements
- **Migration Scripts**: Database migrations, data transformations

### Human Review Required

The following tasks require human review and strategic decision-making:

- **Architecture Decisions**: Multi-tenancy patterns, database design choices
- **Security Implementations**: Authentication, authorization, data isolation
- **CI/CD Configuration**: Deployment strategies, environment configurations
- **Business Logic**: Core domain logic, complex validation rules
- **Performance Optimization**: Database queries, caching strategies

## Task Delegation via Issues

### Issue Templates

When creating issues for Copilot to handle, use these templates:

#### API Implementation Template
```markdown
## API Implementation Request

**Endpoint**: `POST /api/v1/[resource]`
**Description**: [Brief description of what this endpoint should do]

**Requirements**:
- [ ] Django model if needed
- [ ] Serializer with validation
- [ ] ViewSet with CRUD operations
- [ ] URL configuration
- [ ] Basic unit tests
- [ ] API documentation

**Acceptance Criteria**:
- Follows existing API patterns
- Includes proper error handling
- Has tenant isolation (if applicable)
- Passes all tests

**Labels**: `enhancement`, `api`, `copilot-ready`
```

#### Bug Fix Template
```markdown
## Bug Fix Request

**Issue**: [Description of the bug]
**Steps to Reproduce**:
1. [Step one]
2. [Step two]
3. [Expected vs actual behavior]

**Affected Files**: [List of files that might need changes]

**Requirements**:
- [ ] Root cause analysis
- [ ] Fix implementation
- [ ] Test to prevent regression
- [ ] Update documentation if needed

**Labels**: `bug`, `copilot-ready`
```

#### Feature Implementation Template
```markdown
## Feature Implementation

**Feature**: [Feature name]
**Description**: [Detailed description]

**Technical Requirements**:
- [ ] Frontend components (if applicable)
- [ ] Backend API endpoints (if applicable)
- [ ] Database changes (if applicable)
- [ ] Tests for all new code
- [ ] Documentation updates

**User Stories**:
- As a [user type], I want [goal] so that [benefit]

**Labels**: `enhancement`, `feature`, `copilot-ready`
```

## Development Workflow

### 1. Setup Development Environment

**Recommended Setup (using centralized config):**
```bash
# Use centralized environment manager
python config/manage_env.py setup development

# Install backend dependencies
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Install frontend dependencies (separate terminal)
cd frontend
npm install
npm start
```

**Alternative Setup (using Makefile):**
```bash
# Complete setup (backend + frontend)
make setup

# Run development servers
make dev

# Or run individually
make backend   # Backend only
make frontend  # Frontend only
```

**See [Environment Guide](docs/ENVIRONMENT_GUIDE.md) for detailed environment configuration.**

### 2. Making Changes

1. **Create Feature Branch**: `git checkout -b feature/your-feature-name`
2. **Use Copilot**: For implementation tasks, tag issues with `copilot-ready`
3. **Follow TDD**: Write tests first, then implement
4. **Code Review**: All PRs require human review
5. **Test Coverage**: Aim for 80%+ coverage (95%+ for critical paths)
6. **Documentation**: Update relevant docs with your changes
7. **Commit Messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) format

**Example Commit Message:**
```
feat(customers): add customer export functionality

Add CSV and Excel export options for customer data.
Includes filtering and custom field selection.

Closes #123
```

**See [Repository Best Practices](docs/REPOSITORY_BEST_PRACTICES.md) for detailed workflow guidelines.**

### 3. Multi-Tenancy Considerations

When working on tenant-aware features:

- **Models**: Add `tenant_id` field to all tenant-specific models
- **Views**: Use tenant-aware querysets
- **APIs**: Ensure proper tenant isolation
- **Tests**: Test with multiple tenants
- **Migrations**: Consider impact on existing tenants

### 4. Code Style

**Backend (Python):**
- Follow PEP 8 style guide
- Use `black` for formatting: `cd backend && black . --exclude=migrations`
- Use `flake8` for linting: `flake8 . --exclude=migrations`
- Use `isort` for import sorting: `isort . --skip=migrations`
- Add type hints where appropriate
- Write Google-style docstrings

**Frontend (TypeScript/React):**
- Use TypeScript for type safety
- Follow React best practices and hooks patterns
- Use `eslint` for linting: `npm run lint`
- Use `prettier` for formatting: `npm run format`
- Write comprehensive prop types
- Follow component composition patterns

**Database:**
- Use descriptive migration names
- Add comments for complex migrations
- Test migrations with rollback scenarios

**APIs:**
- Follow RESTful conventions (see [Backend Architecture](docs/BACKEND_ARCHITECTURE.md))
- Use proper HTTP methods and status codes
- Implement pagination for list endpoints
- Add filtering and search capabilities
- Document all endpoints with OpenAPI/Swagger

**See [Repository Best Practices](docs/REPOSITORY_BEST_PRACTICES.md) for complete code quality guidelines.**

## Architecture Guidelines

### Current Stack
- **Backend**: Django + Django REST Framework
- **Frontend**: React + TypeScript
- **Database**: PostgreSQL (multi-tenant ready)
- **Deployment**: DigitalOcean Apps Platform
- **CI/CD**: GitHub Actions

### Multi-Tenancy Pattern
- **Shared Database, Shared Schema**: Using tenant_id for isolation
- **Tenant Model**: Central tenant management
- **Middleware**: Tenant detection and setting
- **API**: Tenant-aware endpoints

### Plugin Architecture
- **Django Apps**: Modular feature apps
- **Extension Points**: Django signals and hooks
- **Sandboxing**: Isolated plugin environments
- **APIs**: Well-defined extension interfaces

## Testing Strategy

### Pre-commit Hooks

We use pre-commit hooks to ensure code quality and consistency. To set up:

```bash
# Install pre-commit (included in backend/requirements.txt)
pip install pre-commit

# Install the git hook scripts
pre-commit install

# (Optional) Run against all files to verify setup
pre-commit run --all-files
```

Pre-commit hooks will automatically:
- Format Python code with Black
- Sort imports with isort
- Lint Python code with flake8
- Fix trailing whitespace and line endings
- Check for large files and merge conflicts

**Optional Frontend Hooks**: Additional hooks for TypeScript/JavaScript formatting with Prettier are available in `.pre-commit-config-frontend.yaml`. These can be merged into the main config if needed.

### Backend Testing
```bash
# Run all tests
cd backend && python manage.py test

# Run with coverage
coverage run --source='.' manage.py test
coverage report

# Test specific app
python manage.py test apps.customers

# Using Makefile
make test-backend
```

### Frontend Testing
```bash
# Run unit tests
cd frontend && npm test

# Run in CI mode (no watch)
npm run test:ci

# Using Makefile
make test-frontend
```

### Multi-Tenant Testing
- Test with multiple tenants
- Verify data isolation
- Test tenant switching
- Validate permissions

**See [Testing Strategy](docs/TESTING_STRATEGY.md) for comprehensive testing guidelines, examples, and best practices.**

## Deployment Process

### Staging Deployment
- Automatic deployment on PR merge to `develop`
- Runs full test suite
- Deployed to staging environment

### Production Deployment
- Manual trigger from `main` branch
- Requires approval from maintainers
- Blue-green deployment strategy
- Rollback capability

## Security Considerations

- **Tenant Isolation**: Strict data separation
- **Authentication**: Token-based auth with tenant context
- **Authorization**: Role-based access control
- **Rate Limiting**: Per-tenant rate limiting
- **Data Encryption**: Encrypt sensitive data at rest

## Performance Guidelines

- **Database**: Use indexes, avoid N+1 queries
- **API**: Implement pagination and filtering
- **Frontend**: Code splitting and lazy loading
- **Caching**: Use Redis for frequently accessed data

## Documentation

### Documentation Structure

ProjectMeats maintains comprehensive documentation in the `docs/` directory:

- **[Documentation Index](docs/DOCUMENTATION_INDEX.md)** - **START HERE** - Complete navigation guide for all 127+ docs
- **[Copilot Instructions](.github/copilot-instructions.md)** - **ESSENTIAL** - Coding standards and best practices
- **[Backend Architecture](docs/BACKEND_ARCHITECTURE.md)** - Django backend structure and patterns
- **[Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)** - React frontend structure and components
- **[Testing Strategy](docs/TESTING_STRATEGY.md)** - Comprehensive testing guide
- **[Repository Best Practices](docs/REPOSITORY_BEST_PRACTICES.md)** - Development workflow and standards
- **[Environment Guide](docs/ENVIRONMENT_GUIDE.md)** - Environment configuration
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Deployment procedures
- **[Migration Best Practices](docs/MIGRATION_BEST_PRACTICES.md)** - Database migration guidelines

### Documentation Requirements

When contributing:
- **API Documentation**: Auto-generated with DRF Spectacular at `/api/schema/swagger-ui/`
- **Code Documentation**: Docstrings for all public functions (Google-style for Python, JSDoc for TypeScript)
- **Architecture Documentation**: Keep ADRs (Architecture Decision Records) in `docs/architecture/`
- **User Documentation**: Maintain user guides and tutorials
- **Update Docs**: Always update relevant documentation with code changes (same PR, not separate)
- **Implementation Summaries**: Document significant features in `docs/implementation-summaries/`
- **Last Updated Dates**: Add "Last Updated: YYYY-MM-DD" to all documentation files
- **Cross-References**: Link related documentation files to improve discoverability
- **Fix Documentation**: Create fix summaries in root for active bugs, move to `archived/docs/fixes/` after 3+ months of stability

### Documentation Best Practices

1. **Keep it current**: Update docs in the same PR as code changes
2. **Use consistent formatting**: Follow existing markdown style and structure
3. **Include code examples**: Real, working code snippets are more valuable than explanations alone
4. **Add visual aids**: Diagrams, flowcharts, and screenshots enhance understanding
5. **Write for your audience**: Technical docs for developers, user guides for end-users
6. **Test your links**: Verify all cross-references work before committing
7. **Date your updates**: Always include "Last Updated" dates
8. **Use the index**: Reference docs/DOCUMENTATION_INDEX.md for navigation and organization

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for complete documentation standards.

## Getting Help

- **Documentation**: Check the [Documentation Index](docs/DOCUMENTATION_INDEX.md) first - comprehensive navigation for all 127+ docs
- **Issues**: Create detailed issues using templates above
- **Discussions**: Use GitHub Discussions for questions
- **Deployment**: See [Deployment Troubleshooting](docs/DEPLOYMENT_TROUBLESHOOTING.md) for common issues
- **Migrations**: See [Migration Best Practices](docs/MIGRATION_BEST_PRACTICES.md) for database migration help
- **Code Review**: Tag appropriate reviewers
- **Copilot Log**: Check [copilot-log.md](copilot-log.md) for similar past issues and solutions

## Labels for Issues

- `copilot-ready`: Can be handled by GitHub Copilot
- `human-review`: Requires human decision-making
- `api`: API-related changes
- `frontend`: React/TypeScript changes
- `backend`: Django changes
- `database`: Database changes
- `deployment`: CI/CD and infrastructure
- `security`: Security-related issues
- `performance`: Performance optimization
- `documentation`: Documentation updates

Remember: GitHub Copilot is a powerful tool for implementation, but human judgment is essential for architectural decisions, security reviews, and strategic planning.

---
name: Pull Request
about: Propose changes to ProjectMeats codebase
title: ''
labels: ''
assignees: ''

---

## 📋 Description

<!-- Provide a clear and concise description of your changes -->

## 🎯 Type of Change

<!-- Mark the relevant option with an 'x' -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 UI/UX improvement
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 🧪 Test coverage improvement
- [ ] 🔧 Configuration/infrastructure change

## 🔗 Related Issue

<!-- Link to the related issue(s) -->

Closes #

## 🧪 Testing

<!-- Describe the tests you ran and how to reproduce them -->

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed
- [ ] Test coverage maintained or improved

**Test commands:**
```bash
# Backend
python manage.py test apps/ --verbosity=2

# Frontend
npm run test

# E2E
npm run test:e2e
```

## 🗄️ Database Changes

<!-- **REQUIRED** for any backend changes that affect models or data -->

### Migration Verification

- [ ] **No database changes** in this PR
- [ ] I have run `python manage.py makemigrations` locally
- [ ] All new migration files are committed
- [ ] **✅ Migration Idempotency Checked**: Uses `--fake-initial` safe patterns (MANDATORY)
- [ ] Migration is reversible (`python manage.py migrate app_name previous_migration`)
- [ ] I have tested migration on a fresh database
- [ ] Migration follows additive-only rule (no removed/renamed fields)

**Migration plan verified:**
```bash
python manage.py migrate --plan
```

### Row-Level Security (RLS) Impact

- [ ] **No RLS changes** in this PR
- [ ] **✅ RLS Verified**: Checked `manifests/RLS_POLICIES.md` for compliance (MANDATORY for schema changes)
- [ ] New tenant-aware model created → RLS policy added via `RunSQL`
- [ ] RLS policy follows naming convention: `{tablename}_tenant_isolation`
- [ ] Policy uses `current_setting('app.current_tenant')::uuid` pattern
- [ ] Reverse SQL provided for rollback
- [ ] Policy verified in `manifests/RLS_POLICIES.md`

**RLS verification:**
```bash
# Check RLS is enabled
psql -d projectmeats -c "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE rowsecurity = true;"

# Verify policy exists
psql -d projectmeats -c "SELECT tablename, policyname FROM pg_policies WHERE policyname LIKE '%tenant_isolation';"
```

## 🏗️ Architecture & Design

<!-- Check all that apply -->

### Code Quality

- [ ] Code follows PEP 8 (Python) or ESLint config (TypeScript)
- [ ] No hardcoded values (uses environment variables/configuration)
- [ ] No secrets committed (checked with `git grep -E '(password|secret|key).*=.*["\']'`)
- [ ] All functions have docstrings/JSDoc comments
- [ ] Type hints added (Python) or TypeScript interfaces defined

### Multi-Tenancy

- [ ] **Not applicable** (no business logic changes)
- [ ] All models inherit from `TenantAwareModel`
- [ ] ViewSets filter by `tenant=request.tenant` in `get_queryset()`
- [ ] `perform_create()` assigns `tenant=request.tenant`
- [ ] No direct ORM queries bypass tenant filtering
- [ ] Frontend API calls use `businessApi` or `workformsApi` services

### Theme & Styling

- [ ] **Not applicable** (no UI changes)
- [ ] All colors use theme tokens (no hardcoded hex values)
- [ ] Status colors use standardized RGB values (success/warning/error/info)
- [ ] Components use CSS custom properties from `theme.ts`
- [ ] Responsive design tested (mobile, tablet, desktop)

### Performance

- [ ] No N+1 queries (verified with Django Debug Toolbar)
- [ ] `select_related()` or `prefetch_related()` used for foreign keys
- [ ] Database indexes added for frequently queried fields
- [ ] React components use `React.memo` where appropriate
- [ ] Large lists use virtualization

## 🔒 Security Review

<!-- **REQUIRED** for changes to authentication, permissions, or sensitive data -->

- [ ] **Not security-sensitive** (no auth/permissions/data changes)
- [ ] No new endpoints without authentication
- [ ] Input validation implemented (serializers for backend, zod/react-hook-form for frontend)
- [ ] No SQL injection vulnerabilities (using ORM or parameterized queries)
- [ ] No XSS vulnerabilities (proper escaping, using `dangerouslySetInnerHTML` safely)
- [ ] CSRF protection enabled for state-changing operations
- [ ] Sensitive data properly encrypted/hashed

## 📚 Documentation

- [ ] README updated (if setup/deployment changes)
- [ ] API documentation updated (if endpoints added/modified)
- [ ] `docs/ARCHITECTURE.md` updated (if architectural changes)
- [ ] **✅ Manifest Updated**: Updated `manifests/GOLDEN_FILES.md` or related manifests (MANDATORY for config/schema changes)
- [ ] Inline code comments added for complex logic

## ♿ Accessibility

<!-- **REQUIRED** for UI changes -->

- [ ] **Not applicable** (no UI changes)
- [ ] Semantic HTML used (`<button>`, `<nav>`, `<main>`, etc.)
- [ ] ARIA labels added for screen readers
- [ ] Keyboard navigation works (Tab, Enter, Esc, Arrow keys)
- [ ] Color contrast meets WCAG 2.1 AA standards (4.5:1 minimum)
- [ ] Focus indicators visible
- [ ] Tested with screen reader (NVDA, JAWS, or VoiceOver)

## 📸 Screenshots/Videos

<!-- For UI changes, include before/after screenshots or demo video -->

**Before:**
<!-- Screenshot or description -->

**After:**
<!-- Screenshot or description -->

## 🚀 Deployment Notes

<!-- Any special instructions for deploying this PR? -->

- [ ] No special deployment steps required
- [ ] Requires environment variable changes (documented in `manifests/env.manifest.json`)
- [ ] Requires database migration (documented above)
- [ ] Requires cache invalidation
- [ ] Requires server restart
- [ ] Requires dependency updates (`npm install` or `pip install -r requirements.txt`)

**Deployment command:**
```bash
# If special commands needed, document here
```

## ✅ Final Checklist

<!-- All items must be checked before merging -->

- [ ] I have read and followed the `.github/copilot-instructions.md` standards
- [ ] I have reviewed my own code for quality and security
- [ ] I have tested these changes locally (dev environment)
- [ ] I have updated `MASTER_PLAN.md` and/or `.github/MASTER_PLAN.md` if this changes canonical status or shipped evidence
- [ ] I have added this PR to the relevant GitHub Project board
- [ ] I have assigned appropriate reviewers
- [ ] All CI/CD checks are passing
- [ ] No merge conflicts with target branch

---

## 🔍 For Reviewers

### Review Focus Areas

<!-- What should reviewers pay special attention to? -->

-
-
-

### Review Checklist

- [ ] Code quality and style guidelines followed
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities introduced
- [ ] Documentation is clear and complete
- [ ] Migration strategy is sound (if applicable)
- [ ] RLS policies are correct (if applicable)
- [ ] Performance impact is acceptable

---

**Note**: This PR template enforces ProjectMeats quality standards. If any section is marked "Not applicable", please provide a brief explanation in the Description section.

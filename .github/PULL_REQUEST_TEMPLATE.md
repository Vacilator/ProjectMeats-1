<!-- 
  Pull Request Template for ProjectMeats
  Please fill out this template completely to help reviewers understand your changes.
  Delete sections that are not applicable to your PR.
-->

## 📝 Description

<!-- Provide a clear and concise description of the changes in this PR -->

### What does this PR do?
<!-- Describe the main purpose of this PR -->

### Why is this change needed?
<!-- Explain the problem this PR solves or the feature it adds -->

## 🔗 Related Issues

<!-- Link to related issues using keywords like: Closes #123, Fixes #456, Relates to #789 -->
Closes #

## 🏷️ Type of Change

<!-- Mark the appropriate option with an 'x' -->
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 UI/UX improvement
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security enhancement
- [ ] 🗄️ Database migration
- [ ] 🔧 Configuration change
- [ ] 🚀 Deployment/Infrastructure change

## 🔄 Changes Made

### Summary of Changes
<!-- List the main changes in this PR -->
- 
- 
- 

### Files Changed
<!-- Highlight the most important files changed and why -->
- **File/Component**: Description of change
- **File/Component**: Description of change

## 🧪 Testing

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed
- [ ] No tests needed (explain why below)

### Testing Checklist
<!-- Mark all that apply with an 'x' -->
- [ ] Frontend tests pass (`npm run test:ci`)
- [ ] Backend tests pass (`python manage.py test`)
- [ ] Type checking passes (`npm run type-check` for frontend)
- [ ] Linting passes (frontend and/or backend)
- [ ] Build succeeds without errors
- [ ] No console errors or warnings
- [ ] Tested in development environment
- [ ] Tested in UAT environment (if applicable)
- [ ] Tested on multiple browsers (Chrome, Firefox, Safari)
- [ ] Tested on mobile devices
- [ ] Tested with different user roles/permissions

### Test Instructions
<!-- Provide step-by-step instructions for reviewers to test your changes -->
1. 
2. 
3. 

## 🗄️ Database Changes

<!-- If this PR includes database changes, complete this section -->
- [ ] No database changes
- [ ] Migrations included
- [ ] Migration is backward compatible
- [ ] Migration tested with existing data
- [ ] Rollback procedure documented

### Migration Details
<!-- If migrations are included, describe what they do -->

## 🔒 Security Considerations

<!-- Address any security implications -->
- [ ] No security implications
- [ ] Security review completed
- [ ] No new dependencies added
- [ ] New dependencies security-scanned
- [ ] No sensitive data exposed
- [ ] Authentication/authorization properly implemented
- [ ] Input validation added
- [ ] XSS protection implemented
- [ ] CSRF protection maintained
- [ ] SQL injection prevention verified

### Security Notes
<!-- Describe any security considerations or improvements -->

## 📊 Performance Impact

<!-- Describe any performance implications -->
- [ ] No performance impact
- [ ] Performance testing completed
- [ ] Database queries optimized
- [ ] API response time acceptable
- [ ] Frontend bundle size checked
- [ ] Lazy loading implemented where appropriate

### Performance Notes
<!-- Describe any performance considerations or improvements -->

## 🚀 Deployment Notes

### Breaking Changes
<!-- List any breaking changes that require special attention during deployment -->
- [ ] No breaking changes
- [ ] Breaking changes documented below

### Configuration Changes
<!-- List any required configuration or environment variable changes -->
**Authority**: `/manifests/env.manifest.json` (Version 5.1 - DO NOT guess secret names)
- [ ] No configuration changes
- [ ] Environment variables added/changed (documented below AND in `/manifests/env.manifest.json`)
- [ ] Secrets need to be updated in GitHub Environments

### Deployment Requirements
- [ ] No special deployment requirements
- [ ] Requires database migration
- [ ] Requires data migration/seeding
- [ ] Requires cache clearing
- [ ] Requires service restart
- [ ] Requires third-party service configuration
- [ ] Deployment should be during low-traffic period

### Rollback Plan
<!-- Describe how to rollback if issues arise after deployment -->

## 📸 Screenshots/Videos

<!-- If this PR includes UI changes, add screenshots or videos -->
### Before
<!-- Screenshot of the UI before changes -->

### After
<!-- Screenshot of the UI after changes -->

## 📋 Pre-Merge Checklist

### ⚠️ CRITICAL: Workflow Changes (if `.github/workflows/**` modified)
**MANDATORY checks - failure caused 40-day pipeline outage (Jan 8 - Feb 17, 2026)**
- [ ] ✅ Validated with `actionlint` locally
- [ ] ✅ NO `environment:` on jobs with `uses:` (INVALID SYNTAX)
- [ ] ✅ Reusable workflows use `secrets: inherit`
- [ ] ✅ Environment context set on JOBS inside reusable workflow, not caller
- [ ] ✅ All secret names match `config/env.manifest.json`
- [ ] ✅ Tested workflow in feature branch
- [ ] ✅ Reviewed `docs/reference/GOLDEN_PIPELINE.md`
- [ ] ✅ Team lead approval obtained

### ⚠️ CRITICAL: Django Settings Changes (if `settings/**` modified)
**MANDATORY checks - ModuleNotFoundError causes deployment failures**
- [ ] ✅ All INSTALLED_APPS exist in `backend/` directory
- [ ] ✅ No archived apps in INSTALLED_APPS
- [ ] ✅ URLs match installed apps
- [ ] ✅ `python manage.py migrate --check` passes
- [ ] ✅ No ModuleNotFoundError on Django startup

### Code Quality
- [ ] Self-review completed
- [ ] Code follows project style guidelines
- [ ] Comments added for complex logic
- [ ] No commented-out code or debug statements
- [ ] No unnecessary console.log statements
- [ ] Error handling implemented appropriately
- [ ] Edge cases handled
- [ ] Code is DRY (Don't Repeat Yourself)

### Documentation
- [ ] README updated (if needed)
- [ ] API documentation updated (if applicable)
- [ ] Inline code documentation added
- [ ] Migration guide created (for breaking changes)
- [ ] Deployment notes added above

### Testing & Quality
- [ ] All tests pass locally
- [ ] CI/CD pipeline passes
- [ ] No merge conflicts
- [ ] Branch is up to date with base branch
- [ ] Code coverage maintained or improved

### Multi-Tenancy (if applicable)
- [ ] Tenant isolation verified
- [ ] Tenant-aware queries implemented
- [ ] Tested with multiple tenants
- [ ] No cross-tenant data leakage

### 🔒 Row-Level Security (RLS) - MANDATORY for Database Changes
**⚠️ CRITICAL: All tenant-aware tables MUST have RLS policies**
**Authority**: `/manifests/RLS_POLICIES.md` (33 policies across 25 tables)
- [ ] Model inherits from `backend/apps/core/models.py:TenantAwareModel` (or has `tenant` ForeignKey)
- [ ] Migration includes `RunSQL` operation for PostgreSQL RLS policy (if creating tenant-aware table)
- [ ] RLS policy uses `current_setting('app.current_tenant')::uuid` pattern
- [ ] Policy named following `{tablename}_tenant_isolation` convention
- [ ] Reverse SQL provided for migration rollback
- [ ] ViewSet filters by `tenant=request.tenant` in `get_queryset()`
- [ ] `perform_create()` assigns `tenant=request.tenant`
- [ ] No direct ORM queries bypass tenant filtering
- [ ] Tested RLS enforcement with `psql` queries
- [ ] Updated `/manifests/RLS_POLICIES.md` with new policy details (if applicable)

### 🎨 UI Styling Standards (for Frontend Changes)
- [ ] All colors use theme tokens from `theme.ts` or CSS custom properties (`rgb(var(--color-*))`)
- [ ] No hardcoded hex/RGB values in component styles
- [ ] AntD components use proper theme configuration
- [ ] Standardized status colors used (success: `rgb(34, 197, 94)`, warning: `rgb(234, 179, 8)`, error: `rgb(239, 68, 68)`, info: `rgb(59, 130, 246)`)

### 🌐 API Service Layer (for Frontend API Calls)
- [ ] Uses `businessApi` or `workformsApi` service (NOT direct axios)
- [ ] TypeScript interfaces defined for all API request/response types
- [ ] Error handling follows service layer patterns
- [ ] Token refresh logic not bypassed

### 🔄 Migration Safety (Additive-Only Rule)
**⚠️ CRITICAL: NEVER break existing workflows (5+ months of production data)**
- [ ] No removed/renamed node types (use deprecation + alias pattern)
- [ ] No deleted schema fields (mark as deprecated with fallback)
- [ ] No removed API endpoints (deprecate + redirect for 6 months minimum)
- [ ] No deleted database fields (mark unused, hide from API)
- [ ] Migration logic provided for schema evolution (if changing field types)
- [ ] Backward compatibility verified with existing workflow data

### Accessibility (for UI changes)
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] ARIA labels added where needed
- [ ] Color contrast meets WCAG standards
- [ ] Focus indicators visible

## 👥 Reviewers

<!-- Tag specific reviewers or teams -->
<!-- Use @username or @org/team-name -->

### Review Focus Areas
<!-- Help reviewers know what to focus on -->
Please review:
- 
- 
- 

## 📝 Additional Notes

<!-- Any additional information that reviewers should know -->

---

**PR Checklist Summary:**
- [ ] All required sections completed
- [ ] All checkboxes reviewed and marked appropriately
- [ ] Tests pass locally and in CI
- [ ] Ready for review

<!-- 
  For auto-promotion PRs, this template is automatically filled by the workflow.
  For manual PRs, please complete all relevant sections.
-->

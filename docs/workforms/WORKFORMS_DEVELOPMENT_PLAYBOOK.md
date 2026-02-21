# Workforms Development Playbook

**Purpose**: Streamlined SDLC for Intelligent Workform Editor development  
**Owner**: Development Team  
**Last Updated**: February 21, 2026  
**Version**: 1.0

---

## Overview

This playbook provides a **repeatable, time-boxed process** for Workforms Editor development, cutting bug-to-fix time from hours to **<30 minutes** through standardized diagnostics, surgical fixes, and automated verification.

**Key Principles**:
- ✅ **Diagnostic-First**: Always run diagnostics before coding
- ✅ **Surgical Changes**: Minimal, targeted edits only
- ✅ **Type-Safe**: TypeScript strict mode + full type checking
- ✅ **Test-Driven**: Verify in browser before merging
- ✅ **Golden Pipeline**: Follow existing CI/CD standards

---

## Streamlined SDLC Framework

| Stage              | Duration | Mandatory Steps                                                                 | Success Gate                          |
|--------------------|----------|----------------------------------------------------------------------------------|---------------------------------------|
| **Bug Discovery**  | 2 min    | Run diagnostic prompt → Screenshot + console logs                               | Issue created with template           |
| **Triage**         | 3 min    | Label `workforms-bug` + assign to board column "In Progress"                   | Priority set (P0–P2)                  |
| **Diagnosis**      | 5 min    | Copilot diagnostic prompt (full file search + logs)                             | Exact files + root cause confirmed    |
| **Fix**            | 10 min   | Surgical Copilot delegation prompt                                              | Type-check + build pass               |
| **Verification**   | 5 min    | Run local tests + browser checklist                                             | No console errors + feature works     |
| **PR & Deploy**    | 5 min    | Commit with exact format → auto-PR → merge after CI                             | Live on `dev.meatscentral.com`        |

**Total Time**: ~30 minutes from bug to production

---

## Quick Reference Commands

```bash
# Frontend
cd frontend
npm run type-check          # TypeScript validation
npm run build               # Production build
npm run dev -- --force      # Dev server with cache clear
rm -rf node_modules/.vite   # Clear Vite cache

# Backend
cd backend
python manage.py test apps/workflows --verbosity=2
python manage.py makemigrations --check
python manage.py migrate

# Search
grep -r --include="*.tsx" "[PATTERN]" src/components/FlowEditor/
find src/components/FlowEditor -name "*[NAME]*"

# Git
git checkout -b feature/[BRANCH_NAME]
git add -A
git commit -m "feat(scope): description"
git push upstream HEAD:[BRANCH_NAME]
gh pr create --base development --title "..." --body "..."
```

---

## Commit & PR Standards

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`  
**Scopes**: `flow`, `form`, `config`, `palette`, `modal`, `api`

---

## Verification Checklist

**Before Creating PR**:
- [ ] `npm run type-check` (frontend) - 0 errors
- [ ] `npm run build` (frontend) - successful
- [ ] Browser console: 0 errors after testing feature
- [ ] Hard refresh tested (Ctrl+Shift+R)

**Browser Testing Steps**:
1. Login to dev.meatscentral.com as admin_test_development_1
2. Navigate to Workflows → Edit
3. Test changed functionality
4. Open DevTools (F12) → Console → verify no errors

---

## Related Documentation

- **Testing Guide**: `docs/workforms/FORM_PROCESS_TESTING_GUIDE.md`
- **Golden Pipeline**: `docs/GOLDEN_PIPELINE.md`
- **Configuration**: `docs/CONFIGURATION_AND_SECRETS.md`

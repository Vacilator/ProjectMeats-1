# Pipeline Failure Prevention Guide

**Date:** February 17, 2026  
**Version:** 1.0.0  
**Status:** 🛡️ CRITICAL - MANDATORY READING

---

## 🚨 What Happened (Jan 8 - Feb 17, 2026)

### The Outage
- **Duration:** 40 days (200+ failed deployments)
- **Cause:** Two preventable mistakes in workflow configuration
- **Impact:** Zero deployments to any environment, blocked feature releases

### Root Causes

#### Issue #1: Invalid Workflow Syntax
```yaml
# ❌ INVALID: This breaks GitHub Actions
deploy-dev:
  environment: dev-backend
  uses: ./.github/workflows/reusable-deploy.yml
```

**Error:** `Required property is missing: runs-on`

**Why:** GitHub Actions does NOT allow `environment:` on jobs that call reusable workflows with `uses:`. The `environment:` property is ONLY for jobs with `runs-on:`.

#### Issue #2: Archived Code Still Referenced
```python
# ❌ INVALID: App was archived but still in settings
INSTALLED_APPS = [
    "shared_apps.system_config",  # This directory doesn't exist!
]
```

**Error:** `ModuleNotFoundError: No module named 'shared_apps.system_config'`

**Why:** Phase 2 cleanup archived the code but forgot to remove references from INSTALLED_APPS and urls.py.

---

## 🛡️ PREVENTION MEASURES

### 1. Automated Validation (NEW)

**Three new workflows prevent these issues:**

#### A. `validate-workflows.yml` (NEW)
- Runs `actionlint` on all workflow changes
- Checks for `environment:` used with `uses:` (INVALID)
- Verifies INSTALLED_APPS match codebase
- **Trigger:** Any PR touching `.github/workflows/**`

#### B. `pre-merge-checks.yml` (NEW)
- Detects breaking changes in PRs
- Validates Django settings changes
- Checks for django-tenants references (prohibited)
- Scans for hardcoded secrets
- **Trigger:** All PRs to development/uat/main

#### C. Enhanced PR Template
- MANDATORY checklist for workflow changes
- MANDATORY checklist for settings changes
- Both must be checked or PR is rejected

### 2. CI/CD Guardrails

**Before Merge:**
```bash
# Local validation (required)
actionlint .github/workflows/*.yml
python manage.py check
python manage.py migrate --check
```

**In CI:**
- ✅ Workflow syntax validation
- ✅ INSTALLED_APPS verification
- ✅ Architecture compliance check
- ✅ Secret leak scanning

### 3. Documentation Updates

**Updated Files:**
- `.github/workflows/validate-workflows.yml` (NEW)
- `.github/workflows/pre-merge-checks.yml` (NEW)
- `.github/PULL_REQUEST_TEMPLATE.md` (enhanced)
- `docs/reference/GOLDEN_PIPELINE.md` (section 8)
- `GOLDEN_PIPELINE_RESTORED.md` (lessons learned)

---

## 📋 MANDATORY CHECKLISTS

### For Workflow Changes (`.github/workflows/**`)

**STOP! Before modifying workflows:**

1. **Read Golden Pipeline Docs**
   ```bash
   cat docs/reference/GOLDEN_PIPELINE.md | less
   ```

2. **Understand the Rules**
   - ❌ NO `environment:` on jobs with `uses:`
   - ✅ YES `secrets: inherit` for reusable workflows
   - ✅ YES `environment:` on jobs INSIDE reusable workflows
   - ✅ YES match secrets to `config/env.manifest.json`

3. **Validate Locally**
   ```bash
   # Install actionlint
   brew install actionlint  # macOS
   # OR
   curl -sSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash | bash
   
   # Run validation
   actionlint .github/workflows/*.yml
   ```

4. **Test in Feature Branch**
   - Create test PR from feature branch
   - Verify workflow runs successfully
   - Check all jobs complete
   - Review logs for warnings

5. **Get Approval**
   - Tag team lead for review
   - Explain what changed and why
   - Document testing performed
   - Confirm secrets are correct

6. **Merge Carefully**
   - Monitor first deployment after merge
   - Watch all jobs complete
   - Verify health checks pass
   - Roll back if ANY issues

### For Django Settings Changes (`settings/**`)

**STOP! Before modifying settings:**

1. **Verify All Apps Exist**
   ```bash
   # Extract INSTALLED_APPS
   grep -A 100 "INSTALLED_APPS" backend/projectmeats/settings/base.py
   
   # Check each app directory exists
   for app in $(grep "\".*\"," backend/projectmeats/settings/base.py | grep -v "#"); do
     app_path=$(echo "$app" | tr -d ' ",' | tr '.' '/')
     if [ ! -d "backend/$app_path" ]; then
       echo "❌ Missing: backend/$app_path"
     fi
   done
   ```

2. **Check Archived Apps**
   ```bash
   # List archived apps
   ls -la backend/archived/
   
   # Ensure none are in INSTALLED_APPS
   grep -f <(ls backend/archived/) backend/projectmeats/settings/base.py
   ```

3. **Validate Migrations**
   ```bash
   cd backend
   python manage.py migrate --check
   python manage.py check
   ```

4. **Test Django Startup**
   ```bash
   cd backend
   python manage.py shell <<EOF
   print("✅ Django starts successfully")
   EOF
   ```

5. **Update URLs**
   - If app removed from INSTALLED_APPS
   - Remove from `backend/projectmeats/urls.py`
   - Remove any app-specific URL includes

---

## 🔍 CODE REVIEW GUIDELINES

### For Reviewers: Workflow Changes

**Critical Questions:**
1. ❓ Does any job have BOTH `environment:` AND `uses:`?
   - **If YES:** ❌ REJECT - Invalid syntax

2. ❓ Are secrets passed to reusable workflows?
   - **If YES:** Verify `secrets: inherit` OR explicit list

3. ❓ Do reusable workflow jobs set `environment:`?
   - **If NO:** ⚠️  Secrets may not be accessible

4. ❓ Do secret names match `config/env.manifest.json`?
   - **If NO:** ❌ REJECT - Secrets won't be found

5. ❓ Was this tested in a feature branch first?
   - **If NO:** ❌ REJECT - Test before merging to main branches

### For Reviewers: Settings Changes

**Critical Questions:**
1. ❓ Were any apps removed from INSTALLED_APPS?
   - **If YES:** Verify they're also removed from urls.py

2. ❓ Do all apps in INSTALLED_APPS exist?
   - **If NO:** ❌ REJECT - Will cause ModuleNotFoundError

3. ❓ Are archived apps still referenced?
   - **If YES:** ❌ REJECT - Remove references

4. ❓ Do migrations run successfully?
   - **If NO:** ❌ REJECT - Fix migrations first

5. ❓ Does Django start without errors?
   - **If NO:** ❌ REJECT - Fix startup errors

---

## 🏗️ CORRECT PATTERNS

### Workflow Pattern (CORRECT)

**main-pipeline.yml (caller):**
```yaml
deploy-dev:
  uses: ./.github/workflows/reusable-deploy.yml
  secrets: inherit  # ← Pass secrets
  with:
    environment: 'development'
    backend_environment: 'dev-backend'   # ← Environment name as input
    frontend_environment: 'dev-frontend'
```

**reusable-deploy.yml (callee):**
```yaml
on:
  workflow_call:
    inputs:
      backend_environment:
        required: true
        type: string

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ inputs.backend_environment }}  # ← Set HERE
    steps:
      - name: Run migrations
        run: python manage.py migrate
```

### Settings Pattern (CORRECT)

**When archiving an app:**

1. Move code to `backend/archived/`
   ```bash
   mv backend/shared_apps/system_config backend/archived/shared_apps_system_config_$(date +%Y_%m_%d)/
   ```

2. Remove from INSTALLED_APPS
   ```python
   INSTALLED_APPS = [
       # "shared_apps.system_config",  # ARCHIVED 2026-02-14
   ]
   ```

3. Remove from URLs
   ```python
   urlpatterns = [
       # path("admin/system-config/", include("shared_apps.system_config.urls")),  # ARCHIVED
   ]
   ```

4. Document in archive README
   ```markdown
   # Archived: shared_apps/system_config
   **Archive Date**: 2026-02-14
   **Reason**: Superseded by apps/system
   ```

---

## 🚨 EMERGENCY ROLLBACK

### If Deployment Fails After Merge

**Immediate Actions:**

1. **Identify Last Good Commit**
   ```bash
   gh run list --repo Meats-Central/ProjectMeats --workflow="main-pipeline.yml" --json conclusion,headSha,createdAt
   ```

2. **Revert Problematic Commit**
   ```bash
   git revert <bad-commit-sha>
   git push origin development
   ```

3. **Or Cherry-Pick Fix**
   ```bash
   git cherry-pick <fix-commit-sha>
   git push origin development
   ```

4. **Monitor New Deployment**
   ```bash
   gh run watch --repo Meats-Central/ProjectMeats
   ```

### If Environment Secrets Missing

1. **Verify Environments Exist**
   ```bash
   gh api repos/Meats-Central/ProjectMeats/environments --jq '.environments[] | .name'
   ```

2. **Create Missing Environments**
   ```bash
   for env in dev-backend dev-frontend uat-backend uat-frontend production-backend production-frontend; do
     gh api -X PUT repos/Meats-Central/ProjectMeats/environments/$env
   done
   ```

3. **Verify Secrets Exist**
   ```bash
   gh secret list --env dev-backend --repo Meats-Central/ProjectMeats
   ```

---

## 📚 TRAINING & ONBOARDING

### New Team Members

**Required Reading (in order):**
1. This document (`docs/PIPELINE_FAILURE_PREVENTION.md`)
2. Golden Pipeline docs (`docs/reference/GOLDEN_PIPELINE.md`)
3. Configuration guide (`docs/CONFIGURATION_AND_SECRETS.md`)
4. Restoration report (`GOLDEN_PIPELINE_RESTORED.md`)

**Hands-On Training:**
1. Review failed workflow runs (Jan 8 - Feb 17)
2. Compare broken vs fixed workflow syntax
3. Practice local validation with actionlint
4. Test workflow changes in feature branch
5. Shadow experienced developer during deployment

### Knowledge Transfer

**Key Concepts to Master:**
1. GitHub Actions `environment:` syntax restrictions
2. `secrets: inherit` behavior with reusable workflows
3. Environment-scoped vs repository-scoped secrets
4. Django INSTALLED_APPS validation
5. Parallel swimlane deployment architecture

---

## 📊 METRICS & MONITORING

### Success Metrics

**Track These:**
- Days since last deployment failure
- Workflow run success rate
- Time from PR merge to production
- Number of rollbacks required

**Current Status (Feb 17, 2026):**
- ✅ Deployment success rate: 100% (1/1 since fix)
- ✅ Time to deployment: ~7 minutes
- ✅ Days without incident: 1
- ✅ Rollbacks in last 30 days: 0

### Alert Thresholds

**Set Up Alerts For:**
- Workflow failure rate > 10%
- Deployment time > 15 minutes
- Migration failures
- Secret access errors

---

## 🎓 LESSONS LEARNED

### What Went Wrong

1. **No Validation:** Workflow syntax not validated before merge
2. **No Testing:** Changes not tested in feature branch
3. **Incomplete Cleanup:** Archived code but left references
4. **No Documentation:** Golden Pipeline rules not written down
5. **No Reviews:** Workflow changes not reviewed by multiple people

### What We Fixed

1. ✅ Automated validation (actionlint in CI)
2. ✅ PR template with mandatory checklists
3. ✅ Pre-merge checks for breaking changes
4. ✅ Comprehensive documentation
5. ✅ Team lead approval required for workflow changes

### What To Remember

**Golden Rules:**
1. 🚫 Never merge workflow changes without testing
2. 🚫 Never use `environment:` with `uses:`
3. 🚫 Never skip PR checklist items
4. 🚫 Never reference archived code
5. ✅ Always validate locally first
6. ✅ Always test in feature branch
7. ✅ Always get approval for CI/CD changes
8. ✅ Always monitor first deployment after merge

---

## 📞 CONTACTS & ESCALATION

### When To Escalate

**Contact Team Lead If:**
- Workflow changes needed
- Deployment failing repeatedly
- Secrets missing or incorrect
- Environment configuration issues
- Unsure about any change

### Emergency Contacts

**Pipeline Issues:**
- DevOps Lead: @team-lead
- CI/CD Channel: #infrastructure

**Django Issues:**
- Backend Lead: @backend-lead
- Backend Channel: #backend-dev

---

## ✅ VERIFICATION CHECKLIST

**Before Merging ANY PR:**

- [ ] Read relevant prevention guide sections
- [ ] Completed all mandatory checklists
- [ ] Validated changes locally
- [ ] Tested in feature branch (if workflow/settings changed)
- [ ] Got approval from team lead (if CI/CD changed)
- [ ] No checklist items skipped
- [ ] Deployment plan documented
- [ ] Rollback plan documented
- [ ] Ready to monitor deployment

**After Merging:**

- [ ] Monitored deployment start
- [ ] Verified all jobs succeed
- [ ] Checked health endpoints
- [ ] Confirmed in dev environment
- [ ] Ready to promote to UAT

---

**Document Status:** ✅ ACTIVE - Version 1.0.0  
**Last Updated:** February 17, 2026  
**Next Review:** March 17, 2026  
**Owner:** Infrastructure Team

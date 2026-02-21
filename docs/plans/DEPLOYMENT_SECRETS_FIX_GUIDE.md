# Deployment Secrets Fix Guide

**Issue**: All recent deployments (last 3-5 runs) are failing with:
```
##[error]Username and password required
```

**Root Cause**: `DO_ACCESS_TOKEN` must be a **REPOSITORY-LEVEL** secret, not environment-level.

## ⚠️ CRITICAL: Secret Scope Requirements

The `build-backend` and `build-frontend` jobs in the pipeline **do NOT** have `environment:` set, which means they can **ONLY** access repository-level secrets.

If you added `DO_ACCESS_TOKEN` to an environment (like `dev-backend`), the build jobs **cannot see it**.

---

## Quick Diagnosis

```bash
# Verify no secrets exist
gh secret list --repo Vacilator/ProjectMeats-1
# Output: no secrets found ❌

# Run audit to see what's missing
python config/manage_env.py audit
# Output: 0 secrets validated (all environments) ❌
```

---

## Required Secrets Configuration

### Step 1: Set Global Repository Secrets

These secrets are shared across ALL environments and workflows:

```bash
# 1. DigitalOcean Container Registry Token
gh secret set DO_ACCESS_TOKEN --repo Vacilator/ProjectMeats-1
# When prompted, paste your DigitalOcean API token (dop_v1_...)

# 2. GitHub Personal Access Token (for PR automation)
gh secret set PAT --repo Vacilator/ProjectMeats-1
# When prompted, paste a GitHub PAT with repo permissions
```

**How to get DO_ACCESS_TOKEN:**
1. Go to DigitalOcean Console: https://cloud.digitalocean.com/
2. Click API → Tokens/Keys
3. Click "Generate New Token"
4. Name: "ProjectMeats CI/CD"
5. Scopes: ✅ Read, ✅ Write
6. Expiration: 90 days (or custom)
7. Copy the `dop_v1_...` token immediately (can't view again)

---

### Step 2: Create GitHub Environments

Before setting environment secrets, you must create the environments:

```bash
# Create all 6 environments
gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/dev-backend
gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/dev-frontend
gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/uat-backend
gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/uat-frontend
gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/production-backend
gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/production-frontend
```

---

### Step 3: Set Environment Secrets (Development)

**For `dev-backend` environment:**

```bash
# Infrastructure (SSH access to deployment server)
gh secret set SSH_HOST --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Your dev server IP (e.g., 157.245.114.182)

gh secret set SSH_USER --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: SSH username (e.g., django or root)

gh secret set SSH_PASSWORD --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: SSH password for the user

# Database Credentials
gh secret set DB_HOST --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Database host (localhost if on same server, or RDS endpoint)

gh secret set DB_PORT --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: 5432

gh secret set DB_NAME --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: projectmeats_dev

gh secret set DB_USER --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Database username

gh secret set DB_PASSWORD --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Database password

# Django Configuration
gh secret set DJANGO_SECRET_KEY --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

gh secret set DJANGO_SETTINGS_MODULE --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: config.settings.development

gh secret set ALLOWED_HOSTS --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: dev.meatscentral.com,*.meatscentral.com

gh secret set DEBUG --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: True

gh secret set BACKEND_HOST --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Same as SSH_HOST (server IP)

gh secret set DOMAIN_NAME --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: dev.meatscentral.com

# Email (SendGrid)
gh secret set EMAIL_HOST_PASSWORD --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: SendGrid API key (SG....)

# Django Superuser (created on first deployment)
gh secret set DJANGO_SUPERUSER_USERNAME --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: admin

gh secret set DJANGO_SUPERUSER_PASSWORD --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: Strong password

gh secret set DJANGO_SUPERUSER_EMAIL --env dev-backend --repo Vacilator/ProjectMeats-1
# Value: admin@meatscentral.com
```

**For `dev-frontend` environment:**

```bash
gh secret set SSH_HOST --env dev-frontend --repo Vacilator/ProjectMeats-1
# Value: Same as dev-backend SSH_HOST

gh secret set SSH_USER --env dev-frontend --repo Vacilator/ProjectMeats-1
# Value: Same as dev-backend SSH_USER

gh secret set SSH_PASSWORD --env dev-frontend --repo Vacilator/ProjectMeats-1
# Value: Same as dev-backend SSH_PASSWORD

gh secret set REACT_APP_API_BASE_URL --env dev-frontend --repo Vacilator/ProjectMeats-1
# Value: https://dev.meatscentral.com

gh secret set BACKEND_HOST --env dev-frontend --repo Vacilator/ProjectMeats-1
# Value: Same as dev-backend BACKEND_HOST

gh secret set DOMAIN_NAME --env dev-frontend --repo Vacilator/ProjectMeats-1
# Value: dev.meatscentral.com
```

---

### Step 4: Repeat for UAT and Production

**UAT Environments** (`uat-backend`, `uat-frontend`):
- Use same secrets as dev, but with UAT-specific values
- Replace `dev.meatscentral.com` with `uat.meatscentral.com`
- Use separate database credentials

**Production Environments** (`production-backend`, `production-frontend`):
- Use production-grade credentials
- Replace `dev.meatscentral.com` with `meatscentral.com` or `app.meatscentral.com`
- Enable SSL certificate validation
- Set `DEBUG=False` for backend

---

## Quick Setup Script (Copy-Paste Ready)

**WARNING**: Replace all `PLACEHOLDER_*` values with real credentials before running!

```bash
#!/bin/bash
set -e

echo "Setting up GitHub Secrets for ProjectMeats..."

# Global Secrets
gh secret set DO_ACCESS_TOKEN --body "PLACEHOLDER_DO_TOKEN" --repo Vacilator/ProjectMeats-1
gh secret set PAT --body "PLACEHOLDER_GITHUB_PAT" --repo Vacilator/ProjectMeats-1

# Create environments
for env in dev-backend dev-frontend uat-backend uat-frontend production-backend production-frontend; do
  echo "Creating environment: $env"
  gh api -X PUT repos/Vacilator/ProjectMeats-1/environments/$env
done

# Dev Backend Secrets
gh secret set SSH_HOST --env dev-backend --body "PLACEHOLDER_DEV_IP" --repo Vacilator/ProjectMeats-1
gh secret set SSH_USER --env dev-backend --body "django" --repo Vacilator/ProjectMeats-1
gh secret set SSH_PASSWORD --env dev-backend --body "PLACEHOLDER_SSH_PASS" --repo Vacilator/ProjectMeats-1
gh secret set DB_HOST --env dev-backend --body "localhost" --repo Vacilator/ProjectMeats-1
gh secret set DB_PORT --env dev-backend --body "5432" --repo Vacilator/ProjectMeats-1
gh secret set DB_NAME --env dev-backend --body "projectmeats_dev" --repo Vacilator/ProjectMeats-1
gh secret set DB_USER --env dev-backend --body "PLACEHOLDER_DB_USER" --repo Vacilator/ProjectMeats-1
gh secret set DB_PASSWORD --env dev-backend --body "PLACEHOLDER_DB_PASS" --repo Vacilator/ProjectMeats-1
gh secret set DJANGO_SECRET_KEY --env dev-backend --body "PLACEHOLDER_DJANGO_SECRET" --repo Vacilator/ProjectMeats-1
gh secret set DJANGO_SETTINGS_MODULE --env dev-backend --body "config.settings.development" --repo Vacilator/ProjectMeats-1
gh secret set ALLOWED_HOSTS --env dev-backend --body "dev.meatscentral.com,*.meatscentral.com" --repo Vacilator/ProjectMeats-1
gh secret set DEBUG --env dev-backend --body "True" --repo Vacilator/ProjectMeats-1
gh secret set BACKEND_HOST --env dev-backend --body "PLACEHOLDER_DEV_IP" --repo Vacilator/ProjectMeats-1
gh secret set DOMAIN_NAME --env dev-backend --body "dev.meatscentral.com" --repo Vacilator/ProjectMeats-1
gh secret set EMAIL_HOST_PASSWORD --env dev-backend --body "PLACEHOLDER_SENDGRID_KEY" --repo Vacilator/ProjectMeats-1
gh secret set DJANGO_SUPERUSER_USERNAME --env dev-backend --body "admin" --repo Vacilator/ProjectMeats-1
gh secret set DJANGO_SUPERUSER_PASSWORD --env dev-backend --body "PLACEHOLDER_ADMIN_PASS" --repo Vacilator/ProjectMeats-1
gh secret set DJANGO_SUPERUSER_EMAIL --env dev-backend --body "admin@meatscentral.com" --repo Vacilator/ProjectMeats-1

# Dev Frontend Secrets
gh secret set SSH_HOST --env dev-frontend --body "PLACEHOLDER_DEV_IP" --repo Vacilator/ProjectMeats-1
gh secret set SSH_USER --env dev-frontend --body "django" --repo Vacilator/ProjectMeats-1
gh secret set SSH_PASSWORD --env dev-frontend --body "PLACEHOLDER_SSH_PASS" --repo Vacilator/ProjectMeats-1
gh secret set REACT_APP_API_BASE_URL --env dev-frontend --body "https://dev.meatscentral.com" --repo Vacilator/ProjectMeats-1
gh secret set BACKEND_HOST --env dev-frontend --body "PLACEHOLDER_DEV_IP" --repo Vacilator/ProjectMeats-1
gh secret set DOMAIN_NAME --env dev-frontend --body "dev.meatscentral.com" --repo Vacilator/ProjectMeats-1

echo "✅ Secrets configured! Run audit to verify:"
echo "   python config/manage_env.py audit"
```

---

## Verification

After setting secrets, verify the configuration:

```bash
# 1. Check global secrets exist
gh secret list --repo Vacilator/ProjectMeats-1
# Expected: DO_ACCESS_TOKEN, PAT

# 2. Check environment secrets
gh secret list --env dev-backend --repo Vacilator/ProjectMeats-1
# Expected: 17 secrets

gh secret list --env dev-frontend --repo Vacilator/ProjectMeats-1
# Expected: 6 secrets

# 3. Run manifest audit
cd /workspaces/ProjectMeats
python config/manage_env.py audit
# Expected: ✅ AUDIT PASSED
```

---

## Test Deployment

Once secrets are configured, trigger a test deployment:

```bash
# Option 1: Push to development branch (auto-deploys)
git push origin development

# Option 2: Manual trigger via workflow_dispatch
gh workflow run main-pipeline.yml --ref development --field environment=development

# Monitor the run
gh run watch
```

---

## Common Issues

### Issue: "Username and password required"
**Cause**: `DO_ACCESS_TOKEN` not set or expired  
**Fix**: Set/regenerate the token (Step 1 above)

### Issue: "SSH connection refused"
**Cause**: Incorrect SSH credentials or firewall blocking  
**Fix**: Verify SSH_HOST, SSH_USER, SSH_PASSWORD are correct

### Issue: "Database connection failed"
**Cause**: Database not accessible or wrong credentials  
**Fix**: Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD

### Issue: Audit shows "0 secrets"
**Cause**: Environments don't exist yet  
**Fix**: Create environments first (Step 2 above)

---

## Security Best Practices

1. **Never commit secrets** to git (use `.gitignore`)
2. **Rotate tokens regularly** (DO tokens expire after 90 days by default)
3. **Use separate credentials** for each environment (dev/uat/prod)
4. **Restrict SSH access** to GitHub Actions IP ranges if possible
5. **Use strong passwords** for database and Django superuser
6. **Enable 2FA** on DigitalOcean and GitHub accounts

---

## Next Steps

After secrets are configured:

1. ✅ Run `python config/manage_env.py audit` to verify
2. ✅ Trigger test deployment to development
3. ✅ Monitor deployment logs for any issues
4. ✅ Configure UAT and production secrets
5. ✅ Update documentation with any environment-specific notes

---

## Need Help?

**Reference Documentation:**
- Configuration Guide: `docs/reference/CONFIGURATION_AND_SECRETS.md`
- Development Workflow: `docs/guides/DEVELOPMENT_WORKFLOW.md`
- Manifest File: `config/env.manifest.json`

**Useful Commands:**
```bash
# View workflow runs
gh run list --repo Vacilator/ProjectMeats-1 --limit 10

# View failed logs
gh run view <RUN_ID> --log-failed

# View specific job logs
gh run view <RUN_ID> --job <JOB_ID> --log
```

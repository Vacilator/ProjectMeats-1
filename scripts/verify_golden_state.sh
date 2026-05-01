#!/usr/bin/env bash
# scripts/verify_golden_state.sh
# Verifies Golden Pipeline and authoritative doc drift invariants.

set -euo pipefail

echo "🔍 Verifying Golden Pipeline State..."
echo ""

ERRORS=0

pass() {
    echo "✅ $1"
}

fail() {
    echo "❌ $1"
    ERRORS=$((ERRORS + 1))
}

check_file_exists() {
    local path="$1"
    local label="$2"
    if [[ -f "$path" ]]; then
        pass "$label"
    else
        fail "$label"
    fi
}

check_no_pattern() {
    local path="$1"
    local pattern="$2"
    local message="$3"
    if grep -Eq "$pattern" "$path" 2>/dev/null; then
        fail "$path: $message"
    else
        pass "$path: $message"
    fi
}

check_pattern() {
    local path="$1"
    local pattern="$2"
    local message="$3"
    if grep -Eq "$pattern" "$path" 2>/dev/null; then
        pass "$path: $message"
    else
        fail "$path: $message"
    fi
}

check_required_pattern() {
    check_pattern "$@"
}

check_doc_workflow_refs() {
    local path="$1"
    if [[ ! -f "$path" ]]; then
        fail "$path missing while validating workflow references"
        return
    fi

    local refs
    refs=$(grep -oE '\.github/workflows/[A-Za-z0-9._-]+\.yml' "$path" 2>/dev/null | sort -u || true)
    local missing=0

    if [[ -z "$refs" ]]; then
        fail "$path does not contain explicit .github/workflows/*.yml references"
        return
    fi

    while IFS= read -r ref; do
        [[ -z "$ref" ]] && continue
        if [[ ! -f "$ref" ]]; then
            fail "$path references missing workflow $ref"
            missing=1
        fi
    done <<< "$refs"

    if [[ $missing -eq 0 ]]; then
        pass "$path workflow references resolve"
    fi
}

check_reference_golden_pipeline_pointer_mode() {
    local path="docs/reference/GOLDEN_PIPELINE.md"

    if [[ ! -f "$path" ]]; then
        fail "$path missing while validating reference-doc pointer mode"
        return
    fi

    check_required_pattern "$path" '^> \*\*Reference-only companion\.\*\* For authoritative rules, use `docs/GOLDEN_PIPELINE\.md`\.$' \
        "must declare docs/GOLDEN_PIPELINE.md as the sole authority"
    check_required_pattern "$path" '^> \*\*Guarded sections\*\* such as deploy method, health-check targets, and secret source-of-truth must stay in parity with `docs/GOLDEN_PIPELINE\.md`, `scripts/verify_golden_state\.sh`, and `\.github/scripts/check_infrastructure\.sh`\.$' \
        "must declare guarded-section parity with the canonical doc and validators"
    check_required_pattern "$path" '`docs/GOLDEN_PIPELINE\.md`' \
        "must link to the canonical Golden Pipeline doc"
    check_required_pattern "$path" '`scripts/verify_golden_state\.sh`' \
        "must link to the golden-state validator"
    check_required_pattern "$path" '`\.github/scripts/check_infrastructure\.sh`' \
        "must link to the infrastructure drift gate"
    check_no_pattern "$path" '^## (🏆 What Changed in V2\.0\.0 \(Golden Standard\)|Architecture|Workflow Files \(Source of Truth\)|Critical Guardrails|Secret Management)' \
        "must stay pointer-only and avoid independent operational sections"
    check_no_pattern "$path" 'Lint Documentation|Security Scan Documentation|Check Deployment Configs|Validate Environment Variables' \
        "must not define its own PR-validation job inventory"
}

# 1. Check canonical manifest exists
if [[ -f "manifests/env.manifest.json" ]]; then
    pass "manifests/env.manifest.json exists"
else
    fail "env.manifest.json NOT FOUND (expected: manifests/env.manifest.json)"
fi

# 2. Check manage_env.py supports audit
if grep -q "def audit_secrets" config/manage_env.py 2>/dev/null; then
    pass "manage_env.py has audit_secrets method"
else
    fail "manage_env.py missing audit_secrets"
fi

# 3. Check workflow has bastion tunnel (in reusable-deploy.yml)
if grep -q "ssh.*5433" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    pass "reusable-deploy.yml uses SSH tunnel (port 5433)"
else
    fail "reusable-deploy.yml missing SSH tunnel"
fi

# 4. Check workflow uses --network host
if grep -q "\\-\\-network host" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    pass "reusable-deploy.yml uses Docker host networking"
else
    fail "reusable-deploy.yml missing --network host"
fi

# 5. Check frontend health check
if grep -q "127.0.0.1:8080" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    pass "reusable-deploy.yml checks frontend container directly"
else
    fail "reusable-deploy.yml frontend check incorrect"
fi

# 5b. Check non-dev backend readiness gate
if grep -q "require_redis_readiness" .github/workflows/reusable-deploy.yml 2>/dev/null && \
   grep -q "/api/v1/ready/" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    pass "reusable-deploy.yml enforces non-dev backend readiness via /api/v1/ready/"
else
    fail "reusable-deploy.yml missing non-dev backend readiness gate"
fi

if grep -q "REDIS_URL=" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    pass "reusable-deploy.yml propagates REDIS_URL into backend runtime env"
else
    fail "reusable-deploy.yml missing REDIS_URL backend propagation"
fi

# 6. Check for prohibited dependencies
if grep -Eq '^[[:space:]]*django-tenants([<=>[:space:]]|$)' backend/requirements.txt 2>/dev/null; then
    fail "CRITICAL: django-tenants found in requirements.txt"
else
    pass "No django-tenants in requirements.txt"
fi

# 7. Check documentation exists
if [[ -f "docs/GOLDEN_PIPELINE.md" ]] || [[ -f "docs/reference/GOLDEN_PIPELINE.md" ]]; then
    pass "GOLDEN_PIPELINE documentation exists"
else
    fail "GOLDEN_PIPELINE documentation NOT FOUND"
fi

if [[ -f "docs/CONFIGURATION_AND_SECRETS.md" ]] || [[ -f "docs/reference/CONFIGURATION_AND_SECRETS.md" ]]; then
    pass "CONFIGURATION_AND_SECRETS documentation exists"
else
    fail "CONFIGURATION_AND_SECRETS documentation NOT FOUND"
fi

# 8. Check for archived documentation references
if grep -rq "docs/archive/" .github/workflows/*.yml 2>/dev/null; then
    fail "Workflows reference archived documentation"
else
    pass "No references to archived docs in workflows"
fi

# 9. Check workflow naming conventions
if grep -q "run-name:" .github/workflows/main-pipeline.yml 2>/dev/null; then
    pass "main-pipeline.yml has dynamic run-name"
else
    fail "main-pipeline.yml missing dynamic run-name"
fi

# 10. Check authoritative/current docs against real workflow files
check_doc_workflow_refs ".github/workflows/README.md"
check_doc_workflow_refs "docs/guides/BRANCH_PROTECTION_SETUP.md"
check_doc_workflow_refs "docs/reference/GOLDEN_PIPELINE.md"

# 11. Check CURRENT workflow docs for canonical branch/deploy guidance
check_required_pattern ".github/workflows/README.md" '^- Branches: `development`, `uat`, `main`$' \
    "must document the canonical protected branch set"
check_no_pattern ".github/workflows/README.md" 'docker-compose|docker compose|:latest|https://[^[:space:]]+/api/v1/(health|ready)/' \
    "must avoid forbidden deployment-pattern guidance"

# 12. Check branch protection guide for obsolete branch names and checks
check_no_pattern "docs/guides/BRANCH_PROTECTION_SETUP.md" 'Branch name pattern:[[:space:]]*`UAT`|development\.\.UAT|UAT\.\.main' \
    "BRANCH_PROTECTION_SETUP.md uses canonical lowercase uat branch references"
check_no_pattern "docs/guides/BRANCH_PROTECTION_SETUP.md" '`build-and-push`|`test-frontend`|`test-backend`' \
    "BRANCH_PROTECTION_SETUP.md avoids obsolete status check names"

# 13. Check reference Golden Pipeline companion for canonical secret path + pointer-only parity
if grep -q '`manifests/env.manifest.json`' docs/reference/GOLDEN_PIPELINE.md 2>/dev/null; then
    pass "docs/reference/GOLDEN_PIPELINE.md uses manifests/env.manifest.json"
else
    fail "docs/reference/GOLDEN_PIPELINE.md must reference manifests/env.manifest.json"
fi

check_reference_golden_pipeline_pointer_mode
check_no_pattern "docs/reference/GOLDEN_PIPELINE.md" 'ALWAYS[[:space:]]+use[[:space:]]+`docker-compose`[[:space:]]+\(hyphen\)[[:space:]]+for[[:space:]]+other[[:space:]]+Docker[[:space:]]+management[[:space:]]+commands' \
    "docs/reference/GOLDEN_PIPELINE.md does not prescribe docker-compose"
check_no_pattern "docs/reference/GOLDEN_PIPELINE.md" '`config/env\.manifest\.json`' \
    "docs/reference/GOLDEN_PIPELINE.md avoids legacy config/env.manifest.json references"
check_no_pattern "docs/reference/GOLDEN_PIPELINE.md" 'https://domain\.com/api/v1/(health|ready)/|Health check \(15 retries, 5s intervals\)' \
    "docs/reference/GOLDEN_PIPELINE.md avoids non-canonical reverse-proxy health-check guidance"

# 14. Check rollback script and docs align with non-dev immutable rollback governance
check_pattern ".github/scripts/deployment-rollback.sh" 'BACKEND_IMAGE_REF' \
    "deployment-rollback.sh requires explicit backend immutable refs for non-dev rollback"
check_pattern ".github/scripts/deployment-rollback.sh" 'FRONTEND_IMAGE_REF' \
    "deployment-rollback.sh requires explicit frontend immutable refs for non-dev rollback"
check_pattern ".github/scripts/deployment-rollback.sh" '/api/v1/ready/' \
    "deployment-rollback.sh verifies non-dev backend rollback via /api/v1/ready/"
check_pattern "docs/GOLDEN_PIPELINE.md" 'BACKEND_IMAGE_REF.*FRONTEND_IMAGE_REF|FRONTEND_IMAGE_REF.*BACKEND_IMAGE_REF' \
    "docs/GOLDEN_PIPELINE.md documents explicit immutable rollback refs for non-dev"
check_pattern "docs/GOLDEN_PIPELINE.md" 'check_infrastructure --require-redis-readiness' \
    "docs/GOLDEN_PIPELINE.md documents the non-dev rollback observability drill"
check_pattern "docs/runbooks/INCIDENT_RESPONSE.md" 'integration_summary.*integration_warnings|integration_warnings.*integration_summary' \
    "INCIDENT_RESPONSE.md documents backend observability review fields"
check_pattern "docs/runbooks/INCIDENT_RESPONSE.md" 'check_infrastructure --require-redis-readiness' \
    "INCIDENT_RESPONSE.md includes the non-dev rollback diagnostics command"
check_pattern "manifests/GOLDEN_FILES.md" 'Rollback automation' \
    "GOLDEN_FILES.md registers rollback automation as an authoritative source"
check_pattern "manifests/GOLDEN_FILES.md" 'Non-dev observability ownership' \
    "GOLDEN_FILES.md registers non-dev observability ownership"
check_file_exists "docs/runbooks/DISASTER_RECOVERY.md" "docs/runbooks/DISASTER_RECOVERY.md exists"
check_pattern "manifests/GOLDEN_FILES.md" 'Disaster recovery' \
    "GOLDEN_FILES.md registers disaster recovery as an authoritative source"
check_pattern "docs/GOLDEN_PIPELINE.md" 'DISASTER_RECOVERY\.md' \
    "docs/GOLDEN_PIPELINE.md links to the disaster recovery runbook"
check_pattern "docs/runbooks/INCIDENT_RESPONSE.md" 'DISASTER_RECOVERY\.md' \
    "INCIDENT_RESPONSE.md links to the disaster recovery runbook"
check_pattern ".github/workflows/reusable-deploy.yml" 'pg_restore --list' \
    "reusable-deploy.yml verifies backup archives with pg_restore --list"
check_no_pattern "docs/guides/DATABASE_SYNC_GUIDE.md" 'PROD_DB_|UAT_DB_|prod-backend' \
    "DATABASE_SYNC_GUIDE.md uses manifest-defined DB_* secrets and canonical environment lanes"
check_no_pattern ".github/workflows/99-ops-management-command.yml" 'environment:[[:space:]]+\$\{\{ inputs\.environment \}\}-backend' \
    "99-ops-management-command.yml must map prod to production-backend explicitly"
check_no_pattern ".github/workflows/98-ops-db-surgery.yml" 'environment:[[:space:]]+\$\{\{ inputs\.environment \}\}-backend' \
    "98-ops-db-surgery.yml must map prod to production-backend explicitly"

# 15. Check GA-02.1 desired-state scaffold exists and is registered
check_file_exists "deploy/terraform/README.md" "deploy/terraform/README.md exists"
check_file_exists "deploy/terraform/versions.tf" "deploy/terraform/versions.tf exists"
check_file_exists "deploy/terraform/main.tf" "deploy/terraform/main.tf exists"
check_file_exists "deploy/terraform/variables.tf" "deploy/terraform/variables.tf exists"
check_file_exists "deploy/terraform/outputs.tf" "deploy/terraform/outputs.tf exists"
check_pattern "deploy/terraform/README.md" '^## Manual vs\. codified ownership$' \
    "deploy/terraform/README.md defines manual vs. codified ownership"
check_pattern "manifests/GOLDEN_FILES.md" 'Infrastructure desired state / IaC scaffold' \
    "GOLDEN_FILES.md registers the infrastructure desired-state scaffold"

# 16. Check GA-02.3 queue contract + worker envelope are explicit
check_pattern "backend/projectmeats/settings/base.py" "CELERY_TASK_DEFAULT_QUEUE = 'pm\\.ops'" \
    "base.py defines pm.ops as the explicit default Celery queue"
check_pattern "backend/projectmeats/settings/base.py" "CELERY_TASK_CREATE_MISSING_QUEUES = False" \
    "base.py disables implicit Celery queue creation"
check_pattern "backend/projectmeats/settings/base.py" "Queue\\('pm\\.ops'\\)" \
    "base.py declares the pm.ops queue"
check_pattern "backend/projectmeats/settings/base.py" "Queue\\('pm\\.email'\\)" \
    "base.py declares the pm.email queue"
check_pattern "backend/projectmeats/settings/base.py" "Queue\\('pm\\.workforms'\\)" \
    "base.py declares the pm.workforms queue"
check_pattern "backend/projectmeats/settings/base.py" "Queue\\('pm\\.ai'\\)" \
    "base.py declares the pm.ai queue"
check_pattern "backend/projectmeats/settings/base.py" "Queue\\('pm\\.etl'\\)" \
    "base.py declares the pm.etl queue"
check_pattern "backend/projectmeats/settings/base.py" "CELERY_WORKER_PREFETCH_MULTIPLIER = 1" \
    "base.py lowers Celery prefetch to 1 for worker fairness"
check_pattern "backend/projectmeats/celery.py" "'queue': 'pm\\.ops'" \
    "celery.py routes beat fan-out into the pm.ops queue"
check_pattern "backend/projectmeats/celery.py" "'queue': 'pm\\.ai'" \
    "celery.py routes AI beat tasks into the pm.ai queue"
check_pattern "deploy/terraform/README.md" 'pm-worker-workforms|pm-worker-realtime|pm-worker-ai|pm-worker-etl' \
    "deploy/terraform/README.md documents the worker envelope lanes"
check_pattern "docs/architecture/INFRASTRUCTURE_ARCHITECTURE.md" 'pm\.workforms|pm\.email|pm\.ai|pm\.etl' \
    "INFRASTRUCTURE_ARCHITECTURE.md documents the async queue topology"
check_pattern "docs/runbooks/DISASTER_RECOVERY.md" 'pm\.workforms|pm\.email|pm\.ai|pm\.etl' \
    "DISASTER_RECOVERY.md documents queue saturation guardrails"

echo ""
echo "────────────────────────────────────"
if [[ $ERRORS -eq 0 ]]; then
    echo "✅ All checks passed! Golden Pipeline verified."
    exit 0
else
    echo "❌ $ERRORS check(s) failed. Review errors above."
    exit 1
fi

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
        fail "$message"
    else
        pass "$message"
    fi
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

# 11. Check branch protection guide for obsolete branch names and checks
check_no_pattern "docs/guides/BRANCH_PROTECTION_SETUP.md" 'Branch name pattern:[[:space:]]*`UAT`|development\.\.UAT|UAT\.\.main' \
    "BRANCH_PROTECTION_SETUP.md uses canonical lowercase uat branch references"
check_no_pattern "docs/guides/BRANCH_PROTECTION_SETUP.md" '`build-and-push`|`test-frontend`|`test-backend`' \
    "BRANCH_PROTECTION_SETUP.md avoids obsolete status check names"

# 12. Check reference Golden Pipeline companion for canonical secret path and no docker-compose guidance
if grep -q '`manifests/env.manifest.json`' docs/reference/GOLDEN_PIPELINE.md 2>/dev/null; then
    pass "docs/reference/GOLDEN_PIPELINE.md uses manifests/env.manifest.json"
else
    fail "docs/reference/GOLDEN_PIPELINE.md must reference manifests/env.manifest.json"
fi

check_no_pattern "docs/reference/GOLDEN_PIPELINE.md" 'ALWAYS[[:space:]]+use[[:space:]]+`docker-compose`[[:space:]]+\(hyphen\)[[:space:]]+for[[:space:]]+other[[:space:]]+Docker[[:space:]]+management[[:space:]]+commands' \
    "docs/reference/GOLDEN_PIPELINE.md does not prescribe docker-compose"
check_no_pattern "docs/reference/GOLDEN_PIPELINE.md" '`config/env\.manifest\.json`' \
    "docs/reference/GOLDEN_PIPELINE.md avoids legacy config/env.manifest.json references"

echo ""
echo "────────────────────────────────────"
if [[ $ERRORS -eq 0 ]]; then
    echo "✅ All checks passed! Golden Pipeline verified."
    exit 0
else
    echo "❌ $ERRORS check(s) failed. Review errors above."
    exit 1
fi

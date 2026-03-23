#!/bin/bash
# scripts/verify_golden_state.sh
# Verifies the Golden Pipeline implementation

echo "🔍 Verifying Golden Pipeline State..."
echo ""

ERRORS=0

# 1. Check manifest exists (canonical: manifests/env.manifest.json; legacy: config/env.manifest.json)
MANIFEST_PATH=""
if [ -f "manifests/env.manifest.json" ]; then
    MANIFEST_PATH="manifests/env.manifest.json"
elif [ -f "config/env.manifest.json" ]; then
    MANIFEST_PATH="config/env.manifest.json"
fi

if [ -n "$MANIFEST_PATH" ]; then
    echo "✅ $MANIFEST_PATH exists"
else
    echo "❌ env.manifest.json NOT FOUND (expected: manifests/env.manifest.json)"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check manage_env.py supports audit
if grep -q "def audit_secrets" config/manage_env.py 2>/dev/null; then
    echo "✅ manage_env.py has audit_secrets method"
else
    echo "❌ manage_env.py missing audit_secrets"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check workflow has bastion tunnel (in reusable-deploy.yml)
if grep -q "ssh.*5433" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    echo "✅ reusable-deploy.yml uses SSH tunnel (port 5433)"
else
    echo "❌ reusable-deploy.yml missing SSH tunnel"
    ERRORS=$((ERRORS + 1))
fi

# 4. Check workflow uses --network host
if grep -q "\\-\\-network host" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    echo "✅ reusable-deploy.yml uses Docker host networking"
else
    echo "❌ reusable-deploy.yml missing --network host"
    ERRORS=$((ERRORS + 1))
fi

# 5. Check frontend health check
if grep -q "127.0.0.1:8080" .github/workflows/reusable-deploy.yml 2>/dev/null; then
    echo "✅ reusable-deploy.yml checks frontend container directly"
else
    echo "❌ reusable-deploy.yml frontend check incorrect"
    ERRORS=$((ERRORS + 1))
fi

# 6. Check for prohibited patterns (must be an actual dependency, not just a comment)
if grep -Eq '^[[:space:]]*django-tenants([<=>[:space:]]|$)' backend/requirements.txt 2>/dev/null; then
    echo "❌ CRITICAL: django-tenants found in requirements.txt"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No django-tenants in requirements.txt"
fi

# 7. Check documentation exists (allow canonical docs/reference/*, with optional top-level wrappers)
if [ -f "docs/GOLDEN_PIPELINE.md" ] || [ -f "docs/reference/GOLDEN_PIPELINE.md" ]; then
    echo "✅ GOLDEN_PIPELINE documentation exists"
else
    echo "❌ GOLDEN_PIPELINE documentation NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "docs/CONFIGURATION_AND_SECRETS.md" ] || [ -f "docs/reference/CONFIGURATION_AND_SECRETS.md" ]; then
    echo "✅ CONFIGURATION_AND_SECRETS documentation exists"
else
    echo "❌ CONFIGURATION_AND_SECRETS documentation NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# 8. Check for archived documentation references
if grep -rq "docs/archive/" .github/workflows/*.yml 2>/dev/null; then
    echo "⚠️  WARNING: Workflows reference archived documentation"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No references to archived docs in workflows"
fi

# 9. Check workflow naming conventions
if grep -q "run-name:" .github/workflows/main-pipeline.yml 2>/dev/null; then
    echo "✅ main-pipeline.yml has dynamic run-name"
else
    echo "❌ main-pipeline.yml missing dynamic run-name"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "────────────────────────────────────"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Golden Pipeline verified."
    exit 0
else
    echo "❌ $ERRORS check(s) failed. Review errors above."
    exit 1
fi

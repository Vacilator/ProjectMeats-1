#!/bin/bash
# Environment validation script for deployments
# Validates manifest-derived required secrets for a lane and optionally
# performs advisory runtime configuration checks for values that are present.

set -euo pipefail

ENVIRONMENT=""
WORKFLOW_NAME=""
SHOW_USAGE=0
ERRORS=0

usage() {
    cat <<'EOF'
Usage: .github/scripts/validate-environment.sh --environment <lane> [--workflow <workflow-name>]

Examples:
  .github/scripts/validate-environment.sh --environment dev-backend --workflow reusable-deploy.yml
  .github/scripts/validate-environment.sh --environment dev-frontend --workflow reusable-deploy.yml

This script validates manifest-derived required secrets for the provided lane
using config/manage_env.py. Runtime config checks are advisory and only run for
 variables already present in the environment.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --environment)
            ENVIRONMENT="${2:-}"
            shift 2
            ;;
        --workflow)
            WORKFLOW_NAME="${2:-}"
            shift 2
            ;;
        -h|--help)
            SHOW_USAGE=1
            shift
            ;;
        *)
            echo "❌ ERROR: Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

if [[ "$SHOW_USAGE" == "1" ]]; then
    usage
    exit 0
fi

if [[ -z "$ENVIRONMENT" ]]; then
    echo "❌ ERROR: --environment is required"
    usage
    exit 1
fi

echo "=== Environment Validation Script ==="
echo "Lane: $ENVIRONMENT"
if [[ -n "$WORKFLOW_NAME" ]]; then
    echo "Workflow: $WORKFLOW_NAME"
fi
echo ""

python_args=(config/manage_env.py validate-required --environment "$ENVIRONMENT")
if [[ -n "$WORKFLOW_NAME" ]]; then
    python_args+=(--workflow "$WORKFLOW_NAME")
fi

python "${python_args[@]}"

validate_url_list() {
    local var_name="$1"
    local var_value="${!var_name:-}"
    local local_errors=0

    if [[ -z "$var_value" ]]; then
        echo "ℹ️  $var_name not set; skipping URL format check"
        return 0
    fi

    IFS=',' read -ra URLS <<< "$var_value"
    for url in "${URLS[@]}"; do
        local trimmed
        trimmed="$(echo "$url" | xargs)"
        if [[ ! "$trimmed" =~ ^https?:// ]]; then
            echo "❌ ERROR: Invalid URL in $var_name: $trimmed"
            ERRORS=$((ERRORS + 1))
            local_errors=$((local_errors + 1))
        fi
    done

    if [[ $local_errors -eq 0 ]]; then
        echo "✅ $var_name has valid URL format"
    fi
}

echo ""
echo "Checking optional runtime configuration..."

if [[ -n "${DATABASE_URL:-}" ]]; then
    if [[ "$DATABASE_URL" =~ ^postgresql:// ]]; then
        echo "✅ DATABASE_URL uses PostgreSQL"
    elif [[ "$DATABASE_URL" =~ ^sqlite:// ]]; then
        echo "⚠️  WARNING: DATABASE_URL uses SQLite (not recommended for deploy lanes)"
    else
        echo "❌ ERROR: DATABASE_URL has unexpected format"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "ℹ️  DATABASE_URL not set; skipping database URL format check"
fi

validate_url_list "CORS_ALLOWED_ORIGINS"
validate_url_list "CSRF_TRUSTED_ORIGINS"

if [[ -n "${CORS_ALLOWED_ORIGINS:-}" && -n "${CSRF_TRUSTED_ORIGINS:-}" && "${CORS_ALLOWED_ORIGINS}" != "${CSRF_TRUSTED_ORIGINS}" ]]; then
    echo "⚠️  WARNING: CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS differ"
    echo "   CORS: $CORS_ALLOWED_ORIGINS"
    echo "   CSRF: $CSRF_TRUSTED_ORIGINS"
fi

if [[ "${DEBUG:-False}" == "True" ]]; then
    echo "⚠️  WARNING: DEBUG is enabled"
fi

if [[ -n "${SESSION_COOKIE_SECURE:-}" && "${SESSION_COOKIE_SECURE}" == "False" ]]; then
    echo "⚠️  WARNING: SESSION_COOKIE_SECURE is False"
fi

if [[ -n "${CSRF_COOKIE_SECURE:-}" && "${CSRF_COOKIE_SECURE}" == "False" ]]; then
    echo "⚠️  WARNING: CSRF_COOKIE_SECURE is False"
fi

echo ""
echo "=== Validation Summary ==="
if [[ $ERRORS -eq 0 ]]; then
    echo "✅ Environment validation passed"
    exit 0
fi

echo "❌ Found $ERRORS runtime configuration validation error(s)"
exit 1

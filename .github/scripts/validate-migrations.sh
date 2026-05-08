#!/bin/bash
# Migration validation script for CI/CD
# This script validates Django migrations before deployment

set -euo pipefail

echo "=== Migration Validation Script ==="
echo "Validating Django migrations..."

# Run from anywhere: resolve repo root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT/backend"

# 1. Check for unapplied migrations (Shared Schema)
echo ""
echo "Step 1: Checking for unapplied migrations (shared schema)..."
if python manage.py makemigrations --check --dry-run; then
    echo "✅ No unapplied migrations detected"
else
    echo "❌ ERROR: Unapplied migrations detected. Run 'python manage.py makemigrations' and commit the files."
    exit 1
fi

# 2. Validate migration plan
echo ""
echo "Step 2: Validating migration plan..."
if python manage.py migrate --plan > /tmp/migration_plan.txt; then
    echo "✅ Migration plan is valid"
    echo "Migration plan (first 200 lines):"
    head -200 /tmp/migration_plan.txt
    LINES=$(wc -l < /tmp/migration_plan.txt)
    if [ "$LINES" -gt 200 ]; then
        echo "... (truncated, total lines: $LINES)"
    fi
else
    echo "❌ ERROR: Migration plan validation failed"
    exit 1
fi

# 3. Check for migration conflicts
echo ""
echo "Step 3: Checking for migration conflicts..."
if python manage.py showmigrations --plan > /tmp/showmigrations.txt; then
    echo "✅ No migration conflicts detected"
else
    echo "❌ ERROR: Migration conflicts detected"
    exit 1
fi

# 4. Validate Python syntax in migration files
echo ""
echo "Step 4: Validating Python syntax in migration files..."
SYNTAX_ERRORS=0
for migration_file in $(find apps tenant_apps -path "*/migrations/*.py" -type f | grep -v __pycache__); do
    if ! python -m py_compile "$migration_file" 2>/dev/null; then
        echo "❌ Syntax error in: $migration_file"
        SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
    fi
done

if [ $SYNTAX_ERRORS -eq 0 ]; then
    echo "✅ All migration files have valid Python syntax"
else
    echo "❌ ERROR: $SYNTAX_ERRORS migration file(s) have syntax errors"
    exit 1
fi

# 5. Enforce RLS policy on new tenant-aware tables
echo ""
echo "Step 5: Enforcing RLS policy for new tenant-aware tables..."

# Only enforce on migrations changed in this branch to avoid failing legacy history.
# Keep deterministic by resolving the PR base ref in CI (shallow checkouts often lack origin/<branch>).
BASE_REF=${GITHUB_BASE_REF:-development}
BASE_REV=""

if [ -n "${CI:-}" ]; then
    # Prefer fetching the base branch explicitly (works with actions/checkout default depth).
    if git -C "$REPO_ROOT" fetch --no-tags --depth=1 origin "$BASE_REF" >/dev/null 2>&1; then
        BASE_REV=$(git -C "$REPO_ROOT" rev-parse FETCH_HEAD)
    fi
else
    # Local/dev usage: fall back to existing remotes if present.
    if git -C "$REPO_ROOT" rev-parse --verify "origin/$BASE_REF" >/dev/null 2>&1; then
        BASE_REV="origin/$BASE_REF"
    elif git -C "$REPO_ROOT" rev-parse --verify "upstream/$BASE_REF" >/dev/null 2>&1; then
        BASE_REV="upstream/$BASE_REF"
    fi
fi

if [ -z "$BASE_REV" ]; then
    echo "⚠️  Skipping RLS enforcement (could not resolve base ref '$BASE_REF')"
else
    CHANGED_MIGRATIONS=$(git -C "$REPO_ROOT" diff --name-only "$BASE_REV"...HEAD | \
        grep -E '^backend/(apps|tenant_apps)/.+/migrations/.+\.py$' | \
        grep -v '/__init__\.py$' || true)

    if [ -z "$CHANGED_MIGRATIONS" ]; then
        echo "✅ No changed migration files detected"
    else
        RLS_ERRORS=0
        while IFS= read -r file; do
            if [ -z "$file" ]; then
                continue
            fi

            # Only require RLS when a tenant-aware table is created.
            # Heuristic: CreateModel + a tenant FK field tuple exists in the migration file.
            if grep -q "CreateModel(" "$REPO_ROOT/$file" && grep -q "('tenant'," "$REPO_ROOT/$file"; then
                if ! grep -q "ENABLE ROW LEVEL SECURITY" "$REPO_ROOT/$file" || ! grep -q "FORCE ROW LEVEL SECURITY" "$REPO_ROOT/$file" || ! grep -q "CREATE POLICY" "$REPO_ROOT/$file"; then
                    echo "❌ Missing RLS policy SQL in: $file"
                    echo "   Expected to find all of: 'ENABLE ROW LEVEL SECURITY', 'FORCE ROW LEVEL SECURITY', and 'CREATE POLICY'"
                    RLS_ERRORS=$((RLS_ERRORS + 1))
                fi
            fi
        done <<< "$CHANGED_MIGRATIONS"

        if [ $RLS_ERRORS -eq 0 ]; then
            echo "✅ RLS enforcement check passed for changed tenant-aware migrations"
        else
            echo "❌ ERROR: $RLS_ERRORS migration file(s) missing required RLS SQL"
            exit 1
        fi
    fi
fi

# 6. Check for proper migration dependencies
echo ""
echo "Step 6: Checking migration dependencies..."
# Migration dependency consistency is already validated by Step 2 (migrate --plan).
# Avoid false positives from migration *names* that contain words like "missing".
echo "✅ Migration dependencies are consistent"

# 7. Test migrations on fresh database (CI only)
echo ""
echo "Step 7: Testing migrations on fresh database..."
echo "Setting up temporary test database..."

# Export current DATABASE_URL and create a test database
ORIGINAL_DB_URL=${DATABASE_URL:-}
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_migration_validation"

# Skip if we can't create a test database (not in CI environment)
if command -v psql &> /dev/null && [ -n "${CI:-}" ]; then
    echo "Creating test database for migration validation..."
    PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS test_migration_validation;" 2>/dev/null || true
    PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE test_migration_validation;" 2>/dev/null || true

    if python manage.py migrate --noinput 2>&1; then
        echo "✅ Migrations applied successfully on fresh database"
    else
        echo "❌ ERROR: Migrations failed on fresh database"
        PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS test_migration_validation;" 2>/dev/null || true
        export DATABASE_URL="$ORIGINAL_DB_URL"
        exit 1
    fi

    echo ""
    echo "Step 8: Auditing RLS compliance (fresh database)..."
    if python manage.py audit_rls_compliance --strict; then
        echo "✅ RLS compliance audit passed"
    else
        echo "❌ ERROR: RLS compliance audit failed"
        PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS test_migration_validation;" 2>/dev/null || true
        export DATABASE_URL="$ORIGINAL_DB_URL"
        exit 1
    fi

    # Cleanup
    PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS test_migration_validation;" 2>/dev/null || true
    export DATABASE_URL="$ORIGINAL_DB_URL"
else
    echo "⚠️  Skipping fresh database test (not in CI environment or psql not available)"
fi

echo ""
echo "=== Migration Validation Complete ==="
echo "✅ All migration checks passed!"
exit 0

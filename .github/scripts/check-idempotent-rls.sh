#!/usr/bin/env bash
# check-idempotent-rls.sh — Lint: ensure new migrations wrap CREATE POLICY idempotently
# Usage: check-idempotent-rls.sh [--all | --changed [BASE_REF]]
set -euo pipefail

TARGET="${1:---changed}"
EXIT_CODE=0

if [ "$TARGET" = "--all" ]; then
  mapfile -t FILES < <(grep -rl "CREATE POLICY" backend/ --include="*.py" 2>/dev/null | grep "migrations/" | grep -v "__pycache__" || true)
else
  BASE="${2:-upstream/development}"
  mapfile -t CHANGED < <(git diff --name-only "$BASE"...HEAD -- 'backend/*/migrations/*.py' 'backend/tenant_apps/*/migrations/*.py' 2>/dev/null || true)
  FILES=()
  for f in "${CHANGED[@]}"; do
    [ -f "$f" ] && grep -q "CREATE POLICY" "$f" 2>/dev/null && FILES+=("$f")
  done
fi

for file in "${FILES[@]}"; do
  cp_count=$(grep -cF "CREATE POLICY" "$file" 2>/dev/null || true)
  exception_count=$(grep -cF "EXCEPTION WHEN duplicate_object" "$file" 2>/dev/null || true)
  cp_count=${cp_count:-0}
  exception_count=${exception_count:-0}
  if [ "$exception_count" -lt "$cp_count" ]; then
    echo "❌ $file: $cp_count CREATE POLICY but only $exception_count EXCEPTION guards"
    echo "   Wrap each in: DO \$\$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;"
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ All CREATE POLICY statements in scope are idempotent"
fi
exit $EXIT_CODE

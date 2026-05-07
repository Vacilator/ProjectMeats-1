#!/usr/bin/env bash
# OpenAPI Schema Regression Gate
# Generates the current OpenAPI schema and compares against the committed snapshot.
# Fails if there are undeclared changes (protects against accidental breaking changes).
#
# Usage:
#   ./check-openapi-schema.sh          # Check for drift (CI mode)
#   ./check-openapi-schema.sh --update # Regenerate the snapshot

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
SNAPSHOT_FILE="$REPO_ROOT/manifests/openapi-schema.yaml"
TEMP_FILE="/tmp/openapi-schema-current.yaml"

cd "$BACKEND_DIR"

# Ensure virtual env is active
if [ -z "${VIRTUAL_ENV:-}" ] && [ -f /venv/bin/activate ]; then
  source /venv/bin/activate
fi

echo "🔍 Generating current OpenAPI schema..."
python manage.py spectacular --file "$TEMP_FILE" 2>/dev/null || {
  echo "⚠️  Schema generation failed"
  python manage.py spectacular --file "$TEMP_FILE" 2>&1 | tail -20
  exit 1
}

# Update mode
if [ "${1:-}" = "--update" ]; then
  cp "$TEMP_FILE" "$SNAPSHOT_FILE"
  echo "✅ Schema snapshot updated: $SNAPSHOT_FILE"
  rm -f "$TEMP_FILE"
  exit 0
fi

# Check mode
if [ ! -f "$SNAPSHOT_FILE" ]; then
  echo "❌ No schema snapshot found at $SNAPSHOT_FILE"
  echo "   Run: .github/scripts/check-openapi-schema.sh --update"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Compare
if diff -q "$SNAPSHOT_FILE" "$TEMP_FILE" > /dev/null 2>&1; then
  echo "✅ OpenAPI schema is unchanged"
  rm -f "$TEMP_FILE"
  exit 0
else
  echo "❌ OpenAPI schema has changed!"
  echo ""
  echo "Diff (first 50 lines):"
  diff --unified=3 "$SNAPSHOT_FILE" "$TEMP_FILE" | head -50
  echo ""
  echo "To approve these changes, run:"
  echo "  .github/scripts/check-openapi-schema.sh --update"
  echo ""
  rm -f "$TEMP_FILE"
  exit 1
fi

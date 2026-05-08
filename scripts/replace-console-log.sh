#!/bin/bash
# Replace console.log with logger utility
# Usage: ./replace-console-log.sh

set -euo pipefail

FRONTEND_DIR="frontend/src"
LOGGER_IMPORT="import { logger } from '@/utils/logger';"

# Files to process (top 15 offenders)
FILES=(
  "components/FlowEditor/UnifiedFlowEditor.tsx"
  "pages/WorkForms/Editor.tsx"
  "components/FlowEditor/utils/containerLayout.ts"
  "pages/WorkForms/Catalog.tsx"
  "utils/searchDiagnostic.ts"
  "services/tenantFormService.ts"
  "pages/Suppliers.tsx"
  "components/WorkForms/FormPreviewModal.tsx"
  "components/FlowEditor/utils/workflowPersistence.ts"
  "components/FlowEditor/nodes/FormProcessGroupNode.tsx"
  "components/FlowEditor/config/nodeConfigSchemas.ts"
  "components/Shared/EntityDetailModal.tsx"
  "components/FormSubmission/FormSubmissionModal.tsx"
  "components/FlowEditor/hooks/useUndoRedo.ts"
  "services/schemaService.ts"
)

count=0

for file in "${FILES[@]}"; do
  filepath="$FRONTEND_DIR/$file"

  if [[ ! -f "$filepath" ]]; then
    echo "⚠️  Skipping $file (not found)"
    continue
  fi

  # Count console.log occurrences
  before=$(grep -c "console\.log" "$filepath" || echo 0)

  if [[ $before -eq 0 ]]; then
    echo "✓ $file (already clean)"
    continue
  fi

  # Create backup
  cp "$filepath" "$filepath.bak"

  # Replace console.log with logger.debug
  sed -i 's/console\.log(/logger.debug(/g' "$filepath"

  # Replace console.warn with logger.warn
  sed -i 's/console\.warn(/logger.warn(/g' "$filepath"

  # Replace console.error with logger.error
  sed -i 's/console\.error(/logger.error(/g' "$filepath"

  # Add logger import if not present
  if ! grep -q "from '@/utils/logger'" "$filepath" && ! grep -q "from '.*utils/logger'" "$filepath"; then
    # Find first import statement
    first_import=$(grep -n "^import" "$filepath" | head -1 | cut -d: -f1)
    if [[ -n "$first_import" ]]; then
      sed -i "${first_import}i\\$LOGGER_IMPORT" "$filepath"
    else
      # No imports, add at top after comments
      sed -i "1i\\$LOGGER_IMPORT" "$filepath"
    fi
  fi

  after=$(grep -c "console\." "$filepath" || echo 0)
  replaced=$((before - after))
  count=$((count + replaced))

  echo "✓ $file: replaced $replaced console statements"
done

echo ""
echo "✅ Total console statements replaced: $count"

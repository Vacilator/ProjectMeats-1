#!/bin/bash
# Phase 1 Integration Verification Script

echo "=============================================="
echo "Phase 1: TaskRenderer Integration Verification"
echo "=============================================="
echo ""

cd /workspaces/ProjectMeats/frontend

# 1. Check files exist
echo "✓ Checking files exist..."
if [ -f "src/components/FormSubmission/utils/legacyShim.ts" ]; then
  echo "  ✅ legacyShim.ts exists"
else
  echo "  ❌ legacyShim.ts NOT FOUND"
  exit 1
fi

if grep -q "createLinearGraph" src/components/FormSubmission/FormSubmissionModal.tsx; then
  echo "  ✅ FormSubmissionModal imports legacyShim"
else
  echo "  ❌ FormSubmissionModal does NOT import legacyShim"
  exit 1
fi

# 2. Check feature flag
echo ""
echo "✓ Checking feature flag..."
if grep -q "useTaskRenderer.*useState(false)" src/components/FormSubmission/FormSubmissionModal.tsx; then
  echo "  ✅ Feature flag defaults to FALSE (safe)"
else
  echo "  ⚠️  Feature flag not set to false - check manually"
fi

# 3. Check workflow context integration
echo ""
echo "✓ Checking workflow context integration..."
if grep -q "useWorkflowContext" src/components/FormSubmission/FormSubmissionModal.tsx; then
  echo "  ✅ useWorkflowContext imported"
else
  echo "  ❌ useWorkflowContext NOT imported"
  exit 1
fi

if grep -q "workflowContext.setNodeData" src/components/FormSubmission/FormSubmissionModal.tsx; then
  echo "  ✅ handleChange syncs with workflow context"
else
  echo "  ❌ handleChange does NOT sync with workflow context"
  exit 1
fi

# 4. Check conditional renderer
echo ""
echo "✓ Checking conditional renderer..."
if grep -q "useTaskRenderer && currentNode" src/components/FormSubmission/FormSubmissionModal.tsx; then
  echo "  ✅ Conditional TaskRenderer rendering exists"
else
  echo "  ❌ Conditional TaskRenderer rendering NOT FOUND"
  exit 1
fi

# 5. TypeScript check (quick)
echo ""
echo "✓ Running TypeScript check on modified files..."
npx tsc --noEmit --skipLibCheck src/components/FormSubmission/utils/legacyShim.ts 2>&1 | grep -q "error" && {
  echo "  ❌ TypeScript errors in legacyShim.ts"
  exit 1
} || echo "  ✅ legacyShim.ts compiles"

# 6. Build check
echo ""
echo "✓ Testing production build..."
npm run build > /dev/null 2>&1 && {
  echo "  ✅ Production build succeeds"
} || {
  echo "  ❌ Production build FAILED"
  exit 1
}

# Summary
echo ""
echo "=============================================="
echo "✅ PHASE 1 INTEGRATION VERIFIED"
echo "=============================================="
echo ""
echo "Status: All checks passed ✅"
echo ""
echo "Next steps:"
echo "1. Test form submission in browser"
echo "2. Enable feature flag (useTaskRenderer = true)"
echo "3. Verify TaskRenderer renders correctly"
echo "4. Proceed to Phase 2: Shadow State"
echo ""
echo "To enable TaskRenderer:"
echo "  Edit: src/components/FormSubmission/FormSubmissionModal.tsx"
echo "  Change: const [useTaskRenderer] = useState(false);"
echo "  To:     const [useTaskRenderer] = useState(true);"
echo ""

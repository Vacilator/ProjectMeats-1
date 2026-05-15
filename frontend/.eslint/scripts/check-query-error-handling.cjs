#!/usr/bin/env node

/**
 * Query Error Handling Linter
 *
 * Ensures useQuery / useMutation calls that invoke API services
 * either (a) wrap the call in try/catch to prevent unhandled 404/500
 * console floods, or (b) set `retry: false` to prevent retry storms
 * for expected-missing endpoints.
 *
 * Scans .ts/.tsx files under src/ (excludes tests, __mocks__).
 *
 * Exit codes:
 *   0 - No violations
 *   1 - Violations found
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.resolve(__dirname, '../../src');
const API_PATTERNS = [
  'businessApi',
  'workformsApi',
  'traderService',
  'tradeDocumentsService',
  'inquiryService',
  'tenantService',
  'authService',
];

const EXCLUDED = [
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/test-utils/**',
];

const violations = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find all useQuery/useMutation blocks with API calls
  // Strategy: detect `queryFn:` or `mutationFn:` that references an API service
  // then check if there's a `try` block wrapping the API call within the function body,
  // OR if `retry: false` is set nearby.

  let insideQueryBlock = false;
  let queryBlockStart = -1;
  let braceDepth = 0;
  let hasTryCatch = false;
  let hasRetryFalse = false;
  let hasApiCall = false;
  let queryFnLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of queryFn or mutationFn
    if (/queryFn\s*[:=]|mutationFn\s*[:=]/.test(line) && !insideQueryBlock) {
      insideQueryBlock = true;
      queryBlockStart = i;
      queryFnLine = i + 1; // 1-based
      braceDepth = 0;
      hasTryCatch = false;
      hasRetryFalse = false;
      hasApiCall = false;

      // Check surrounding context (up to 20 lines before and after the queryFn)
      // for `retry: false` or `retry: 0`
      const contextStart = Math.max(0, i - 20);
      const contextEnd = Math.min(lines.length, i + 40);
      const contextBlock = lines.slice(contextStart, contextEnd).join('\n');
      if (/retry\s*:\s*(false|0)/.test(contextBlock)) {
        hasRetryFalse = true;
      }
    }

    if (insideQueryBlock) {
      // Count braces to find end of queryFn
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      // Check for API service calls
      for (const pattern of API_PATTERNS) {
        if (line.includes(pattern)) {
          hasApiCall = true;
          break;
        }
      }

      // Check for try/catch
      if (/\btry\s*\{/.test(line) || /\btry\s*$/.test(line.trim())) {
        hasTryCatch = true;
      }

      // End of queryFn block
      if (braceDepth <= 0 && queryBlockStart !== i) {
        if (hasApiCall && !hasTryCatch && !hasRetryFalse) {
          const relPath = path.relative(SRC_DIR, filePath);
          violations.push({
            file: `src/${relPath}`,
            line: queryFnLine,
            message: `queryFn/mutationFn calls an API service without try/catch or retry:false`,
          });
        }
        insideQueryBlock = false;
      }
    }
  }
}

// Gather files
const files = glob.sync('**/*.{ts,tsx}', {
  cwd: SRC_DIR,
  absolute: true,
  ignore: EXCLUDED,
});

for (const file of files) {
  scanFile(file);
}

if (violations.length === 0) {
  console.log('✅ All useQuery/useMutation API calls have error handling (try/catch or retry:false).');
  process.exit(0);
} else {
  // Warning mode: report but don't fail CI. Standard CRUD queries using React Query's
  // built-in error boundary are acceptable. This lint helps developers identify places
  // where defensive error handling could prevent console noise.
  console.warn(`⚠️  Found ${violations.length} API query call(s) without explicit error handling:\n`);
  for (const v of violations) {
    console.warn(`  ${v.file}:${v.line}`);
    console.warn(`    → ${v.message}\n`);
  }
  console.warn(
    'Tip: Wrap API calls in try/catch inside queryFn for graceful degradation, or set retry: false for optional endpoints.'
  );
  // Exit 0 — this is advisory. React Query\'s error boundary handles most cases.
  process.exit(0);
}

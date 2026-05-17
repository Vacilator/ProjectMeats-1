#!/usr/bin/env node

/**
 * Query Error Handling Linter
 *
 * Detects the "error-swallowing" anti-pattern: queryFn/mutationFn that catch
 * errors and return empty defaults ([], {}, null) instead of letting them
 * propagate to React Query. This hides backend failures from users — pages
 * show "No data" instead of error states.
 *
 * Good: let errors propagate so React Query's retry + isError work.
 * Bad:  catch { return []; }  — silently hides failures.
 *
 * Exit codes:
 *   0 - No violations (or advisory only)
 *   1 - Blocking violations found
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.resolve(__dirname, '../../src');

const EXCLUDED = [
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/test-utils/**',
];

// Patterns that indicate a catch block is returning a default value
const SWALLOW_PATTERNS = [
  /catch\s*(?:\([^)]*\))?\s*\{[^}]*return\s+\[\]/,     // return []
  /catch\s*(?:\([^)]*\))?\s*\{[^}]*return\s+\{\}/,      // return {}
  /catch\s*(?:\([^)]*\))?\s*\{[^}]*return\s+null/,      // return null
  /catch\s*(?:\([^)]*\))?\s*\{[^}]*return\s+0[;\s]/,    // return 0
  /catch\s*(?:\([^)]*\))?\s*\{[^}]*return\s+''|return\s+""/,  // return ''
];

const violations = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Only scan files that have queryFn or mutationFn
  if (!content.includes('queryFn') && !content.includes('mutationFn')) return;

  const lines = content.split('\n');

  let insideQueryBlock = false;
  let queryBlockStart = -1;
  let braceDepth = 0;
  let blockLines = [];
  let queryFnLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/queryFn\s*[:=]|mutationFn\s*[:=]/.test(line) && !insideQueryBlock) {
      insideQueryBlock = true;
      queryBlockStart = i;
      queryFnLine = i + 1;
      braceDepth = 0;
      blockLines = [];
    }

    if (insideQueryBlock) {
      blockLines.push(line);
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      if (braceDepth <= 0 && queryBlockStart !== i) {
        // Block complete — check for error-swallowing
        const block = blockLines.join('\n');
        for (const pattern of SWALLOW_PATTERNS) {
          if (pattern.test(block)) {
            const relPath = path.relative(SRC_DIR, filePath);
            violations.push({
              file: `src/${relPath}`,
              line: queryFnLine,
              message: `queryFn catches errors and returns a default value — errors should propagate to React Query`,
            });
            break;
          }
        }
        insideQueryBlock = false;
        blockLines = [];
      }
    }
  }
}

const files = glob.sync('**/*.{ts,tsx}', {
  cwd: SRC_DIR,
  absolute: true,
  ignore: EXCLUDED,
});

for (const file of files) {
  scanFile(file);
}

if (violations.length === 0) {
  console.log('✅ No error-swallowing queryFn patterns detected.');
  process.exit(0);
} else {
  console.warn(`⚠️  Found ${violations.length} queryFn(s) that swallow errors:\n`);
  for (const v of violations) {
    console.warn(`  ${v.file}:${v.line}`);
    console.warn(`    → ${v.message}\n`);
  }
  console.warn(
    'Fix: Remove try/catch from queryFn and let errors propagate to React Query.\n' +
    'React Query handles retries (4x backoff for 5xx) and exposes isError for UI.'
  );
  // Advisory for now — upgrade to exit(1) when all existing violations are cleared
  process.exit(0);
}

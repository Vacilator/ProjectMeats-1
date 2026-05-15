#!/usr/bin/env node

/**
 * Query Key Tenant Scoping Linter
 *
 * Ensures all React Query `queryKey` usages are tenant-scoped via
 * `withTenantQueryKey()` from `@/utils/queryKeys`.
 *
 * Detected violations:
 *   1. Bare queryKey arrays: `queryKey: ['something', ...]`
 *   2. Bare invalidation keys: `invalidateQueries({ queryKey: ['something'] })`
 *
 * Allowed patterns:
 *   - `queryKey: withTenantQueryKey(...)` — properly scoped
 *   - Files in __tests__, __mocks__, *.test.* — excluded
 *   - Files that define withTenantQueryKey itself — excluded
 *
 * Usage:
 *   node .eslint/scripts/check-query-key-scoping.cjs
 *   node .eslint/scripts/check-query-key-scoping.cjs src/pages/Home.tsx
 *
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found (blocks CI)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

const EXCLUDE_PATTERNS = [
  '**/*.test.tsx',
  '**/*.test.ts',
  '**/*.spec.tsx',
  '**/*.spec.ts',
  '**/__mocks__/**',
  '**/__tests__/**',
  '**/node_modules/**',
  '**/utils/queryKeys.ts',
];

// Match bare array literals assigned to queryKey
// e.g. queryKey: ['something'] or queryKey: ["something"]
const BARE_QUERY_KEY_PATTERN = /queryKey\s*:\s*\[/g;

// Match properly scoped pattern
const SCOPED_PATTERN = /queryKey\s*:\s*withTenantQueryKey\s*\(/;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  // Skip files that don't use queryKey at all
  if (!content.includes('queryKey')) return violations;

  // Check if file imports withTenantQueryKey — if it does, each usage must use it
  const hasImport = content.includes('withTenantQueryKey');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for bare queryKey: [...] pattern
    if (BARE_QUERY_KEY_PATTERN.test(line)) {
      // Reset lastIndex for global regex
      BARE_QUERY_KEY_PATTERN.lastIndex = 0;

      // Skip if it's a comment line
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      // Skip if it actually uses withTenantQueryKey on same line
      if (SCOPED_PATTERN.test(line)) {
        continue;
      }

      // Skip if the variable is later wrapped (e.g. `const key = withTenantQueryKey(...)`)
      // This is a heuristic — check surrounding context
      const prevLine = i > 0 ? lines[i - 1] : '';
      if (prevLine.includes('withTenantQueryKey')) continue;

      violations.push({
        file: filePath,
        line: lineNum,
        text: line.trim(),
        message: 'Bare queryKey array literal — use withTenantQueryKey() for tenant isolation',
      });
    }
  }

  return violations;
}

function main() {
  const targetFiles = process.argv.slice(2);
  let files;

  if (targetFiles.length > 0) {
    files = targetFiles.map(f => path.resolve(f));
  } else {
    files = glob.sync('**/*.{ts,tsx}', {
      cwd: SRC_DIR,
      absolute: true,
      ignore: EXCLUDE_PATTERNS,
    });
  }

  let totalViolations = 0;
  const allViolations = [];

  for (const file of files) {
    // Skip excluded patterns for explicit file args too
    const rel = path.relative(SRC_DIR, file);
    if (rel.includes('__tests__') || rel.includes('__mocks__') || rel.includes('.test.')) continue;
    if (rel.includes('utils/queryKeys.ts')) continue;

    const violations = scanFile(file);
    if (violations.length > 0) {
      totalViolations += violations.length;
      allViolations.push(...violations);
    }
  }

  if (totalViolations === 0) {
    console.log('✅ All queryKey usages are tenant-scoped via withTenantQueryKey()');
    process.exit(0);
  }

  console.error(`\n❌ Found ${totalViolations} bare queryKey usage(s) missing tenant scoping:\n`);
  for (const v of allViolations) {
    const rel = path.relative(process.cwd(), v.file);
    console.error(`  ${rel}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    → ${v.message}\n`);
  }

  console.error('Fix: Import { withTenantQueryKey } from "@/utils/queryKeys" and wrap all queryKey arrays.');
  console.error('Example: queryKey: withTenantQueryKey("purchase-orders")\n');
  process.exit(1);
}

main();

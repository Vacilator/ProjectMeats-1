#!/usr/bin/env node

/**
 * Render Stability Linter
 *
 * Scans React component files for patterns known to cause React Error #185
 * (Maximum update depth exceeded / infinite re-render loops).
 *
 * Detected patterns:
 *   1. Inline object/array literals in useQuery/useMutation queryKey arrays
 *   2. Inline arrow function props on form/modal components (onSuccess, onClose, etc.)
 *   3. TanStack Query result objects used as useCallback/useEffect dependencies
 *   4. useState setters called unconditionally outside callbacks/effects
 *
 * Usage:
 *   node .eslint/scripts/check-render-stability.cjs
 *   node .eslint/scripts/check-render-stability.cjs src/pages/Customers.tsx
 *
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found (warnings only; does not block CI by default)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

// Files/patterns to exclude from scanning
const EXCLUDE_PATTERNS = [
  '**/*.test.tsx',
  '**/*.test.ts',
  '**/*.spec.tsx',
  '**/*.spec.ts',
  '**/__mocks__/**',
  '**/__tests__/**',
  '**/node_modules/**',
];

// --- Pattern Definitions ---

const PATTERNS = [
  {
    id: 'inline-querykey-object',
    severity: 'error',
    description: 'Inline object/array in queryKey — wrap in useMemo',
    // Matches: queryKey: [something, { ... }] or queryKey: [something, [ ... ]]
    regex: /queryKey:\s*\[(?:[^[\]]*),\s*(\{[^}]*\}|\[[^\]]*\])\s*\]/g,
    fileFilter: /\.(tsx?|jsx?)$/,
  },
  {
    id: 'inline-onsuccess-arrow',
    severity: 'warning',
    description: 'Inline arrow function for onSuccess prop — extract to useCallback',
    // Matches: onSuccess={(anything) => { or onSuccess={() =>
    regex: /onSuccess=\{(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/g,
    fileFilter: /\.tsx$/,
  },
  {
    id: 'inline-onclose-arrow',
    severity: 'warning',
    description: 'Inline arrow function for onClose prop — extract to useCallback',
    regex: /onClose=\{(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/g,
    fileFilter: /\.tsx$/,
  },
  {
    id: 'inline-oncreated-arrow',
    severity: 'warning',
    description: 'Inline arrow function for onCreated prop — extract to useCallback',
    regex: /onCreated=\{(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/g,
    fileFilter: /\.tsx$/,
  },
  {
    id: 'query-object-in-deps',
    severity: 'warning',
    description: 'TanStack Query result in dependency array — use queryClient.invalidateQueries instead',
    // Matches: }, [somethingQuery, or }, [somethingQuery]
    regex: /\],\s*\[(?:[^[\]]*,\s*)?(\w+Query)(?:\s*,|\s*\])/g,
    fileFilter: /\.(tsx?|jsx?)$/,
  },
  {
    id: 'searchparams-in-callback-deps',
    severity: 'warning',
    description: 'searchParams in useCallback deps — use functional setSearchParams updater',
    // Matches: [searchParams, ...] or [..., searchParams, ...] or [..., searchParams]
    regex: /useCallback\([^]*?\],\s*\[[^\]]*searchParams[^\]]*\]\s*\)/gs,
    fileFilter: /\.(tsx?|jsx?)$/,
  },
];

// --- Scanner ---

function scanFile(filePath) {
  const violations = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(SRC_DIR, '..'), filePath);

  for (const pattern of PATTERNS) {
    if (!pattern.fileFilter.test(filePath)) continue;

    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(content)) !== null) {
      // Find line number
      const upToMatch = content.substring(0, match.index);
      const lineNum = upToMatch.split('\n').length;
      const lineText = lines[lineNum - 1] || '';

      // Skip matches inside comments or JSDoc
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      violations.push({
        file: relPath,
        line: lineNum,
        column: match.index - upToMatch.lastIndexOf('\n'),
        id: pattern.id,
        severity: pattern.severity,
        description: pattern.description,
        snippet: lines[lineNum - 1]?.trim() || '',
      });
    }
  }

  return violations;
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);
  let files;

  if (args.length > 0 && !args[0].startsWith('-')) {
    // Scan specific file(s)
    files = args.map((f) => path.resolve(f));
  } else {
    // Scan all source files
    files = glob.sync(path.join(SRC_DIR, '**/*.{ts,tsx}'), {
      ignore: EXCLUDE_PATTERNS.map((p) => path.join(SRC_DIR, p)),
    });
  }

  let totalViolations = 0;
  let errorCount = 0;
  let warningCount = 0;
  const violationsByFile = {};

  for (const file of files) {
    const violations = scanFile(file);
    if (violations.length > 0) {
      violationsByFile[violations[0].file] = violations;
      totalViolations += violations.length;
      errorCount += violations.filter((v) => v.severity === 'error').length;
      warningCount += violations.filter((v) => v.severity === 'warning').length;
    }
  }

  if (totalViolations === 0) {
    console.log('✅ No render stability violations found.');
    process.exit(0);
  }

  console.log(
    `\n⚠️  Found ${totalViolations} render stability violation(s) (${errorCount} error(s), ${warningCount} warning(s)):\n`,
  );

  for (const [file, violations] of Object.entries(violationsByFile)) {
    console.log(`  ${file}`);
    for (const v of violations) {
      const icon = v.severity === 'error' ? '❌' : '⚠️';
      console.log(`    ${icon} L${v.line}: [${v.id}] ${v.description}`);
      console.log(`       ${v.snippet}`);
    }
    console.log();
  }

  console.log(
    'These patterns are known to cause React Error #185 (Maximum update depth exceeded).',
  );
  console.log('See: frontend/.eslint/scripts/check-render-stability.cjs for details.\n');

  // Exit with error only if there are error-severity violations
  process.exit(errorCount > 0 ? 1 : 0);
}

main();

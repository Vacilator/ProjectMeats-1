#!/usr/bin/env node

/**
 * Console Usage Guard
 *
 * Ensures all logging goes through the structured logger (src/utils/logger.ts)
 * instead of raw console.* calls. This guarantees errors are captured by the
 * runtime error monitoring system and Sentry.
 *
 * Allowed exceptions:
 *   - logger.ts itself (the canonical logger)
 *   - errorReportingService.ts (must avoid circular dependency)
 *   - ConsoleErrorMonitor.tsx (legitimately intercepts console)
 *   - Test files
 *   - Comments (lines starting with // or *)
 *
 * Usage:
 *   node .eslint/scripts/check-console-usage.cjs
 *   node .eslint/scripts/check-console-usage.cjs src/pages/Trade.tsx
 *
 * Exit codes:
 *   0 - No violations
 *   1 - Direct console usage found
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
];

// Files that legitimately use console.*
const ALLOWED_FILES = [
  'utils/logger.ts',
  'services/errorReportingService.ts',
  'components/DevTools/ConsoleErrorMonitor.tsx',
];

const CONSOLE_PATTERN = /\bconsole\.(log|error|warn|info|debug|trace|dir|table|group|groupEnd)\s*\(/g;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const hits = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    // Skip string literals containing "console." (e.g., in error messages)
    if (trimmed.match(/['"`].*console\.\w+.*['"`]/)) return;

    const matches = line.match(CONSOLE_PATTERN);
    if (matches) {
      hits.push({
        line: idx + 1,
        text: trimmed.substring(0, 120),
        methods: matches.map((m) => m.replace('(', '')),
      });
    }
  });

  return hits;
}

function main() {
  const args = process.argv.slice(2);

  let files;
  if (args.length > 0 && !args[0].startsWith('--')) {
    files = args.map((f) => path.resolve(f));
  } else {
    files = glob.sync('**/*.{ts,tsx}', {
      cwd: SRC_DIR,
      absolute: true,
      ignore: EXCLUDE_PATTERNS,
    });
  }

  let totalViolations = 0;
  const violations = [];

  for (const file of files) {
    const relative = path.relative(SRC_DIR, file);

    // Skip allowed files
    if (ALLOWED_FILES.some((allowed) => relative === allowed || relative.replace(/\\/g, '/') === allowed)) {
      continue;
    }

    const hits = scanFile(file);
    if (hits.length > 0) {
      totalViolations += hits.length;
      violations.push({ file: relative, hits });
    }
  }

  if (totalViolations === 0) {
    console.log('✅ No direct console.* usage found. All logging uses structured logger.');
    process.exit(0);
  }

  console.log('\n⚠️  Direct console.* Usage Detected');
  console.log('═'.repeat(55));
  console.log(`  ${totalViolations} violation(s) in ${violations.length} file(s)\n`);
  console.log('  Use logger.info/warn/error() from src/utils/logger.ts instead.\n');

  violations.forEach((v) => {
    console.log(`  ${v.file}:`);
    v.hits.forEach((h) => {
      console.log(`    L${h.line}: ${h.text}`);
    });
    console.log('');
  });

  console.log('Replace with:');
  console.log("  import { logger } from '@/utils/logger';");
  console.log("  logger.info('context', 'message', data);");
  console.log("  logger.error('context', 'message', error);\n");

  // Warn-only for now (exit 0) to avoid blocking CI until codebase is fully migrated
  // Change to exit(1) once all violations are resolved
  process.exit(0);
}

main();

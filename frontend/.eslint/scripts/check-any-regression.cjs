#!/usr/bin/env node

/**
 * Type Safety Regression Guard
 *
 * Counts explicit `any` type annotations across the frontend codebase and
 * fails CI if the count exceeds the recorded baseline. This prevents new
 * `any` usage from creeping in after sweeps.
 *
 * Tracked patterns:
 *   - `as any` casts
 *   - `: any` type annotations
 *   - `<any>` generic parameters
 *   - `any[]` array types
 *
 * Usage:
 *   node .eslint/scripts/check-any-regression.cjs          # check against baseline
 *   node .eslint/scripts/check-any-regression.cjs --update  # update baseline file
 *   node .eslint/scripts/check-any-regression.cjs --report  # detailed report only
 *
 * Exit codes:
 *   0 - Count at or below baseline
 *   1 - Regression detected (count exceeds baseline)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');
const BASELINE_FILE = path.join(__dirname, '..', 'baselines', 'any-count.json');

const EXCLUDE_PATTERNS = [
  '**/*.test.tsx',
  '**/*.test.ts',
  '**/*.spec.tsx',
  '**/*.spec.ts',
  '**/__mocks__/**',
  '**/__tests__/**',
  '**/node_modules/**',
];

// Patterns that indicate explicit `any` usage
const ANY_PATTERNS = [
  { name: 'as any', regex: /\bas\s+any\b/g },
  { name: ': any', regex: /:\s*any\b(?!\w)/g },
  { name: '<any>', regex: /<any>/g },
  { name: 'any[]', regex: /\bany\[\]/g },
  { name: 'Record<string, any>', regex: /Record<string,\s*any>/g },
];

// Files/directories with known structural `any` that require major refactors
const KNOWN_EXCEPTIONS = [
  'src/components/FlowEditor/', // 8000+ line monolith — XL sprint
];

function isExcluded(filePath) {
  const relative = path.relative(SRC_DIR, filePath);
  return KNOWN_EXCEPTIONS.some((exc) => relative.startsWith(exc.replace('src/', '')));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const hits = [];

  lines.forEach((line, idx) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    for (const pattern of ANY_PATTERNS) {
      const matches = line.match(pattern.regex);
      if (matches) {
        hits.push({
          line: idx + 1,
          pattern: pattern.name,
          count: matches.length,
          text: trimmed.substring(0, 120),
        });
      }
    }
  });

  return hits;
}

function main() {
  const args = process.argv.slice(2);
  const updateMode = args.includes('--update');
  const reportMode = args.includes('--report');

  const files = glob.sync('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    absolute: true,
    ignore: EXCLUDE_PATTERNS,
  });

  let totalCount = 0;
  let totalExcepted = 0;
  const fileResults = [];

  for (const file of files) {
    const hits = scanFile(file);
    if (hits.length === 0) continue;

    const count = hits.reduce((sum, h) => sum + h.count, 0);
    const relative = path.relative(SRC_DIR, file);
    const excepted = isExcluded(file);

    if (excepted) {
      totalExcepted += count;
    } else {
      totalCount += count;
    }

    fileResults.push({ file: relative, count, hits, excepted });
  }

  // Sort by count descending
  fileResults.sort((a, b) => b.count - a.count);

  if (reportMode) {
    console.log('\n📊 Type Safety Report');
    console.log('═'.repeat(60));
    console.log(`  Total \`any\` annotations: ${totalCount} (tracked)`);
    console.log(`  FlowEditor (excepted):    ${totalExcepted}`);
    console.log(`  Files with \`any\`:          ${fileResults.filter((f) => !f.excepted).length}`);
    console.log('');

    const tracked = fileResults.filter((f) => !f.excepted);
    if (tracked.length > 0) {
      console.log('Top files:');
      tracked.slice(0, 20).forEach((f) => {
        console.log(`  ${f.count.toString().padStart(4)} │ ${f.file}`);
      });
    }

    console.log('');
    process.exit(0);
  }

  if (updateMode) {
    const baselineDir = path.dirname(BASELINE_FILE);
    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }

    const baseline = {
      tracked_count: totalCount,
      excepted_count: totalExcepted,
      updated_at: new Date().toISOString(),
      note: 'Auto-generated baseline. Run with --update to refresh after intentional changes.',
    };

    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`✅ Baseline updated: ${totalCount} tracked, ${totalExcepted} excepted`);
    console.log(`   Saved to: ${BASELINE_FILE}`);
    process.exit(0);
  }

  // Check mode (default)
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('❌ No baseline file found. Run with --update first:');
    console.error('   node .eslint/scripts/check-any-regression.cjs --update');
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
  const baselineCount = baseline.tracked_count;

  console.log('\n🔍 Type Safety Regression Check');
  console.log('═'.repeat(50));
  console.log(`  Baseline:  ${baselineCount}`);
  console.log(`  Current:   ${totalCount}`);
  console.log(`  Excepted:  ${totalExcepted} (FlowEditor)`);

  if (totalCount > baselineCount) {
    const delta = totalCount - baselineCount;
    console.log(`\n❌ REGRESSION: ${delta} new \`any\` annotation(s) detected!`);
    console.log('');

    // Show new violations (non-excepted files)
    const tracked = fileResults.filter((f) => !f.excepted);
    tracked.slice(0, 10).forEach((f) => {
      console.log(`  ${f.file}:`);
      f.hits.forEach((h) => {
        console.log(`    L${h.line}: [${h.pattern}] ${h.text}`);
      });
    });

    console.log('\nTo fix: Replace `any` with proper types (unknown, specific interfaces, etc.)');
    console.log('If intentional: Run with --update to accept the new baseline.\n');
    process.exit(1);
  } else if (totalCount < baselineCount) {
    const improvement = baselineCount - totalCount;
    console.log(`\n✅ IMPROVED: ${improvement} fewer \`any\` annotations! Consider updating baseline:`);
    console.log('   node .eslint/scripts/check-any-regression.cjs --update\n');
    process.exit(0);
  } else {
    console.log('\n✅ No regression detected.\n');
    process.exit(0);
  }
}

main();

#!/usr/bin/env node
/**
 * Pre-Deploy Console Error Audit
 *
 * Runs ALL lint checks + TypeScript + circular dep detection in a single pass.
 * Designed to be run before every deployment. Exit code 1 = deploy blocked.
 *
 * Usage:
 *   node .eslint/scripts/pre-deploy-audit.cjs
 *   npm run lint:pre-deploy
 *
 * Categories:
 *   BLOCKING  — must pass or deploy is blocked
 *   WARNING   — logged but won't block deploy
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const CHECKS = [
  // BLOCKING checks
  { name: 'TypeScript Compilation',   cmd: 'npx tsc --noEmit',                          blocking: true },
  { name: 'Circular Dependencies',    cmd: 'node .eslint/scripts/check-circular-deps.cjs', blocking: true },
  { name: 'API Import Boundaries',    cmd: 'node .eslint/scripts/check-api-import-boundaries.cjs', blocking: true },
  { name: 'Hardcoded Colors',         cmd: 'node .eslint/scripts/check-colors.cjs',       blocking: true },
  { name: 'Render Stability',         cmd: 'node .eslint/scripts/check-render-stability.cjs', blocking: true },
  { name: 'Query Key Scoping',        cmd: 'node .eslint/scripts/check-query-key-scoping.cjs', blocking: true },
  { name: 'Any Type Regression',      cmd: 'node .eslint/scripts/check-any-regression.cjs', blocking: true },
  // WARNING checks (best-effort)
  { name: 'Console Usage',            cmd: 'node .eslint/scripts/check-console-usage.cjs', blocking: false },
  { name: 'Query Error Handling',     cmd: 'node .eslint/scripts/check-query-error-handling.cjs', blocking: false },
];

const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠️  WARN\x1b[0m';
const SKIP = '\x1b[90m⏭  SKIP\x1b[0m';

console.log('\n\x1b[1m╔══════════════════════════════════════════════╗');
console.log('║        PRE-DEPLOY CONSOLE ERROR AUDIT        ║');
console.log('╚══════════════════════════════════════════════╝\x1b[0m\n');

let blockingFailures = 0;
let warnings = 0;
const results = [];

for (const check of CHECKS) {
  const label = check.blocking ? '[BLOCKING]' : '[WARNING]';
  process.stdout.write(`  ${label} ${check.name} ... `);
  try {
    execSync(check.cmd, { cwd: ROOT, stdio: 'pipe', timeout: 120_000 });
    console.log(PASS);
    results.push({ name: check.name, status: 'pass' });
  } catch (err) {
    const output = (err.stdout || '').toString().trim() + '\n' + (err.stderr || '').toString().trim();
    if (check.blocking) {
      console.log(FAIL);
      blockingFailures++;
      results.push({ name: check.name, status: 'fail', output });
    } else {
      console.log(WARN);
      warnings++;
      results.push({ name: check.name, status: 'warn', output });
    }
  }
}

// Print detailed output for failures/warnings
const issues = results.filter((r) => r.status !== 'pass');
if (issues.length) {
  console.log('\n\x1b[1m── Detailed Output ──\x1b[0m\n');
  for (const issue of issues) {
    const icon = issue.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${issue.name}:`);
    if (issue.output) {
      const lines = issue.output.split('\n').filter(Boolean).slice(0, 20);
      for (const line of lines) {
        console.log(`   ${line}`);
      }
      if (issue.output.split('\n').filter(Boolean).length > 20) {
        console.log('   ... (truncated)');
      }
    }
    console.log('');
  }
}

// Summary
console.log('\x1b[1m── Summary ──\x1b[0m');
console.log(`  Total checks:      ${CHECKS.length}`);
console.log(`  Passed:            ${results.filter((r) => r.status === 'pass').length}`);
console.log(`  Blocking failures: ${blockingFailures}`);
console.log(`  Warnings:          ${warnings}`);

if (blockingFailures > 0) {
  console.log('\n\x1b[31m\x1b[1m🚫 DEPLOY BLOCKED — Fix the above blocking issues before deploying.\x1b[0m\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n\x1b[33m\x1b[1m⚠️  Deploy allowed, but please address the warnings above.\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n\x1b[32m\x1b[1m✅ All checks passed — safe to deploy.\x1b[0m\n');
  process.exit(0);
}

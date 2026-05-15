#!/usr/bin/env node

/**
 * API Import Boundary Linter
 *
 * Ensures components and pages never import the raw API client directly.
 * Only files inside `src/services/` are allowed to import `apiClient`,
 * `apiService`, or `axios`.
 *
 * This prevents bypassing the centralized service layer which provides:
 * - Tenant-aware request headers
 * - Automatic token refresh
 * - Centralized error handling
 * - Easy mocking for tests
 *
 * Allowed:
 *   - src/services/ files — they define the service layer
 *   - test files, __tests__, __mocks__ — excluded
 *
 * Forbidden in components/pages:
 *   - import { apiClient } from ...
 *   - import axios from 'axios'
 *   - from '@/services/apiService' (use named service modules instead)
 *   - from './apiService' in non-service files
 *
 * Usage:
 *   node .eslint/scripts/check-api-import-boundaries.cjs
 *
 * Exit codes:
 *   0 - No violations
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
  // Service modules ARE the boundary — they're allowed to import apiClient
  '**/services/**',
];

// Patterns that indicate direct API client usage outside the service layer
const FORBIDDEN_PATTERNS = [
  {
    regex: /import\s+.*\baxios\b.*from\s+['"]axios['"]/,
    message: 'Direct axios import — use a service module (businessApi, workformsApi, etc.) instead',
  },
  {
    regex: /^(?!.*\btype\b).*import\s+.*\bapiClient\b.*from\s+['"]@\/services\/apiService['"]/,
    message: 'Direct apiClient import — use a domain service (businessApi, inquiryService, etc.) instead',
  },
  {
    regex: /^(?!.*\btype\b).*import\s+.*\bapiClient\b.*from\s+['"]\.\.?\/.*apiService['"]/,
    message: 'Direct apiClient import via relative path — use a domain service instead',
  },
];

// Some files legitimately need apiClient (admin studio uses adminClient)
const ALLOWED_EXCEPTIONS = [
  'apps/admin-studio/', // Admin studio has its own admin client pattern
];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  const rel = path.relative(SRC_DIR, filePath);

  // Check if file is in an allowed exception path
  for (const exception of ALLOWED_EXCEPTIONS) {
    if (rel.includes(exception)) return violations;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          text: trimmed,
          message: pattern.message,
        });
        break; // One violation per line is enough
      }
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
    const rel = path.relative(SRC_DIR, file);
    // Double-check exclusions for explicit file args
    if (rel.includes('__tests__') || rel.includes('__mocks__') || rel.includes('.test.')) continue;
    if (rel.startsWith('services/') || rel.startsWith('services\\')) continue;

    const violations = scanFile(file);
    if (violations.length > 0) {
      totalViolations += violations.length;
      allViolations.push(...violations);
    }
  }

  if (totalViolations === 0) {
    console.log('✅ All API imports respect service-layer boundaries');
    process.exit(0);
  }

  console.error(`\n❌ Found ${totalViolations} direct API client import(s) outside the service layer:\n`);
  for (const v of allViolations) {
    const rel = path.relative(process.cwd(), v.file);
    console.error(`  ${rel}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    → ${v.message}\n`);
  }

  console.error('Fix: Import from a domain service module instead of the raw API client.');
  console.error('Example: import { businessApi } from "@/services/businessApi"\n');
  process.exit(1);
}

main();

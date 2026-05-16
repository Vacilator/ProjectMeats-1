#!/usr/bin/env node

/**
 * Circular Dependency Detector
 *
 * Scans the frontend service/utility layer for import cycles that can cause
 * undefined module exports at runtime (the "No data" class of bugs).
 *
 * Only scans files in critical paths:
 *   - src/services/   (API layer — circular deps here break ALL data loading)
 *   - src/utils/      (shared utilities imported by services)
 *   - src/config/     (runtime config imported by services)
 *
 * Usage:
 *   node .eslint/scripts/check-circular-deps.cjs
 *
 * Exit codes:
 *   0 - No circular dependencies found
 *   1 - Circular dependency detected (blocks CI)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

// Only scan critical paths where circular deps cause runtime failures
const SCAN_DIRS = ['services', 'utils', 'config'];

// Resolve an import specifier to a file path
function resolveImport(importPath, fromFile) {
  const fromDir = path.dirname(fromFile);

  // Handle @/ alias
  let resolved = importPath;
  if (resolved.startsWith('@/')) {
    resolved = path.join(SRC_DIR, resolved.slice(2));
  } else if (resolved.startsWith('.')) {
    resolved = path.resolve(fromDir, resolved);
  } else {
    // External package — skip
    return null;
  }

  // Try extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) return candidate;
  }

  // Try index files
  for (const ext of extensions) {
    const candidate = path.join(resolved, 'index' + ext);
    if (fs.existsSync(candidate)) return candidate;
  }

  // Already has extension
  if (fs.existsSync(resolved)) return resolved;

  return null;
}

// Extract import paths from a file
function getImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = [];

  // Match: import ... from 'path'  /  import ... from "path"
  const importRegex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const resolved = resolveImport(match[1], filePath);
    if (resolved) imports.push(resolved);
  }

  // Match: import('path') — dynamic imports
  const dynamicRegex = /import\(['"]([^'"]+)['"]\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    const resolved = resolveImport(match[1], filePath);
    if (resolved) imports.push(resolved);
  }

  return imports;
}

// Check if a file is in one of the scanned directories
function isInScanDir(filePath) {
  const relative = path.relative(SRC_DIR, filePath);
  return SCAN_DIRS.some((dir) => relative.startsWith(dir + path.sep) || relative.startsWith(dir + '/'));
}

// DFS cycle detection
function findCycles(startFile, graph) {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();
  const pathStack = [];

  function dfs(file) {
    if (stack.has(file)) {
      // Found cycle — extract it
      const cycleStart = pathStack.indexOf(file);
      if (cycleStart !== -1) {
        const cycle = pathStack.slice(cycleStart).concat(file);
        cycles.push(cycle);
      }
      return;
    }

    if (visited.has(file)) return;

    visited.add(file);
    stack.add(file);
    pathStack.push(file);

    const deps = graph.get(file) || [];
    for (const dep of deps) {
      dfs(dep);
    }

    stack.delete(file);
    pathStack.pop();
  }

  dfs(startFile);
  return cycles;
}

function main() {
  // Collect all files in scanned directories
  const files = [];
  for (const dir of SCAN_DIRS) {
    const dirFiles = glob.sync('**/*.{ts,tsx}', {
      cwd: path.join(SRC_DIR, dir),
      absolute: true,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/__mocks__/**'],
    });
    files.push(...dirFiles);
  }

  // Build import graph
  const graph = new Map();
  for (const file of files) {
    const imports = getImports(file).filter(isInScanDir);
    if (imports.length > 0) {
      graph.set(file, imports);
    }
  }

  // Find all cycles
  const allCycles = [];
  const seenCycleKeys = new Set();

  for (const file of files) {
    const cycles = findCycles(file, graph);
    for (const cycle of cycles) {
      // Normalize cycle key to avoid duplicates
      const relativeCycle = cycle.map((f) => path.relative(SRC_DIR, f));
      const key = [...relativeCycle].sort().join(' → ');
      if (!seenCycleKeys.has(key)) {
        seenCycleKeys.add(key);
        allCycles.push(relativeCycle);
      }
    }
  }

  if (allCycles.length === 0) {
    console.log('✅ No circular dependencies detected in service/utility layer.');
    process.exit(0);
  }

  console.log(`\n❌ ${allCycles.length} Circular Dependency Chain(s) Detected`);
  console.log('═'.repeat(60));
  console.log('');

  for (let i = 0; i < allCycles.length; i++) {
    console.log(`  Chain ${i + 1}:`);
    console.log(`    ${allCycles[i].join('\n    → ')}`);
    console.log('');
  }

  console.log('Circular imports in services/utils/config can cause undefined');
  console.log('module exports at runtime, breaking ALL data loading.');
  console.log('');
  console.log('Fix: Use standalone imports (e.g., direct axios) or lazy imports');
  console.log('to break the cycle. See errorReportingService.ts for an example.\n');
  process.exit(1);
}

main();

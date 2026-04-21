#!/usr/bin/env node

/**
 * Color Linter Script
 * 
 * Scans frontend files for hardcoded hex colors and reports violations.
 * This script enforces the use of theme variables and standardized color palette.
 * 
 * Usage:
 *   node .eslint/scripts/check-colors.js
 *   node .eslint/scripts/check-colors.js --fix (shows suggestions)
 *   node .eslint/scripts/check-colors.js src/pages/Login.tsx (check specific file)
 * 
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found
 * 
 * @author ProjectMeats UI Standardization Team
 * @date 2026-01-10
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Standardized color mappings
const STANDARDIZED_COLORS = {
  '#22c55e': 'rgb(34, 197, 94)',
  '#16a34a': 'rgb(34, 197, 94)',
  '#10b981': 'rgb(34, 197, 94)',
  '#eab308': 'rgb(234, 179, 8)',
  '#ffc107': 'rgb(234, 179, 8)',
  '#f59e0b': 'rgb(234, 179, 8)',
  '#ef4444': 'rgb(239, 68, 68)',
  '#dc2626': 'rgb(239, 68, 68)',
  '#dc3545': 'rgb(239, 68, 68)',
  '#ff4d4f': 'rgb(239, 68, 68)',
  '#c82333': 'rgb(239, 68, 68)',
  '#3b82f6': 'rgb(59, 130, 246)',
  '#3498db': 'rgb(59, 130, 246)',
  '#2980b9': 'rgb(59, 130, 246)',
  '#667eea': 'rgb(var(--color-primary))',
  '#5a67d8': 'rgb(var(--color-primary))',
  '#764ba2': 'rgb(var(--color-primary))',
  '#e9ecef': 'rgb(var(--color-border))',
  '#f1f3f4': 'rgb(var(--color-border))',
  '#495057': 'rgb(var(--color-text-secondary))',
  '#5a6268': 'rgb(var(--color-text-secondary))',
  '#f0fdf4': 'rgba(34, 197, 94, 0.15)',
  '#fef2f2': 'rgba(239, 68, 68, 0.15)',
  '#bbf7d0': 'rgba(34, 197, 94, 0.2)',
  '#fecaca': 'rgba(239, 68, 68, 0.2)',
  '#d4edda': 'rgba(34, 197, 94, 0.15)',
  '#f8d7da': 'rgba(239, 68, 68, 0.15)'
};

// Match standard CSS hex colors only: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
// (Avoids false positives like order numbers "#12345".)
const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

// Match hardcoded comma-based rgb()/rgba() colors.
// NOTE: We scope enforcement to FlowEditor + WorkForms to avoid mass legacy churn.
const RGB_COLOR_REGEX = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)/g;

function isNumericOnlyShortHex(color) {
  // Heuristic: ignore short numeric-only tokens like "#405" in names (not actual colors).
  // We still catch #000000/#111111 etc.
  if (typeof color !== 'string') return false;
  if (color.length !== 4 && color.length !== 5) return false; // #RGB or #RGBA
  return !/[a-fA-F]/.test(color);
}

function getSuggestion(color) {
  const normalized = color.toLowerCase();
  return STANDARDIZED_COLORS[normalized] || 'rgb(var(--color-primary)), rgb(var(--color-border)), or standardized palette color';
}

function checkFile(filePath) {
  const repoRoot = path.join(__dirname, '../..');
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const enforceRgb =
    relativePath.includes('src/components/FlowEditor/') ||
    relativePath.includes('src/components/WorkForms/');

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    let match;

    const hexRegex = new RegExp(HEX_COLOR_REGEX, 'g');
    while ((match = hexRegex.exec(line)) !== null) {
      const color = match[0];
      const columnIndex = match.index;

      if (isNumericOnlyShortHex(color)) {
        continue;
      }

      violations.push({
        line: lineIndex + 1,
        column: columnIndex + 1,
        color,
        suggestion: getSuggestion(color),
        lineContent: trimmed,
      });
    }

    if (!enforceRgb) {
      return;
    }

    const rgbRegex = new RegExp(RGB_COLOR_REGEX, 'g');
    while ((match = rgbRegex.exec(line)) !== null) {
      const color = match[0];
      const columnIndex = match.index;

      violations.push({
        line: lineIndex + 1,
        column: columnIndex + 1,
        color,
        suggestion:
          'Use theme tokens (e.g. rgb(var(--color-text-primary)) or rgba(var(--color-overlay), 0.5)).',
        lineContent: trimmed,
      });
    }
  });

  return violations;
}

async function main() {
  const args = process.argv.slice(2);
  const specificFile = args.find(arg => !arg.startsWith('--'));
  const showSuggestions = args.includes('--fix');
  
  console.log('🔍 Checking for hardcoded colors...\n');
  
  let files;
  if (specificFile) {
    files = [path.resolve(specificFile)];
  } else {
    files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      cwd: path.join(__dirname, '../..'),
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/build/**', '**/coverage/**', '**/*.test.*', '**/*.spec.*']
    });
  }
  
  let totalViolations = 0;
  const fileViolations = new Map();
  
  for (const file of files) {
    try {
      const violations = checkFile(file);
      if (violations.length > 0) {
        fileViolations.set(file, violations);
        totalViolations += violations.length;
      }
    } catch (err) {
      console.error(`❌ Error checking ${file}: ${err.message}`);
    }
  }
  
  if (totalViolations === 0) {
    console.log('✅ No hardcoded colors found! All files are compliant.\n');
    process.exit(0);
  }
  
  console.log(`❌ Found ${totalViolations} hardcoded color(s) in ${fileViolations.size} file(s):\n`);
  
  for (const [file, violations] of fileViolations.entries()) {
    const relativePath = path.relative(path.join(__dirname, '../..'), file);
    console.log(`📄 ${relativePath}`);
    
    violations.forEach(v => {
      console.log(`   Line ${v.line}:${v.column} - ${v.color}`);
      if (showSuggestions) {
        console.log(`      Suggestion: ${v.suggestion}`);
      }
      console.log(`      ${v.lineContent}`);
      console.log('');
    });
  }
  
  console.log('\n💡 To fix these violations:');
  console.log('   1. Replace hardcoded colors with theme variables');
  console.log('   2. Or use standardized palette colors (see UI_STANDARDS.md)');
  console.log('   3. Run this script again with --fix to see suggestions\n');
  
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

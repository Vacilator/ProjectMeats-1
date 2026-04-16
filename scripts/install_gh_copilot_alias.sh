#!/usr/bin/env bash
set -euo pipefail

# This creates a local gh alias so `gh copilot ...` works without a gh extension.
# It is intentionally opt-in.

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required" >&2
  exit 2
fi

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

chmod +x scripts/gh-copilot

gh alias set copilot '!./scripts/gh-copilot'

echo "Installed gh alias: 'gh copilot' -> ./scripts/gh-copilot"

echo "Try: gh copilot squad list"

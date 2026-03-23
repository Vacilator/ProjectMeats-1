#!/usr/bin/env bash
set -euo pipefail

# Infrastructure drift gate for CI/CD
#
# Purpose:
# - Provide a single, consistent entrypoint that every workflow can run
# - Fail fast on Golden Pipeline drift (docs, manifest, workflow invariants)
# - Keep checks lightweight (no DB, no Docker daemon required)

echo "=== Infrastructure Check (Golden Drift Gate) ==="

echo "\n[1/2] Verify golden state..."
bash scripts/verify_golden_state.sh

echo "\n[2/2] Validate workflow structure..."

# validate-workflows.sh uses PyYAML for YAML parsing
python -m pip install --quiet --disable-pip-version-check --root-user-action=ignore pyyaml >/dev/null
bash .github/scripts/validate-workflows.sh

echo "\n✅ Infrastructure check passed."

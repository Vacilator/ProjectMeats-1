#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "❌ $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "Missing file: $1"
}

require_dir() {
  [ -d "$1" ] || fail "Missing dir: $1"
}

require_heading() {
  local file="$1"; local heading="$2"
  # Use POSIX grep for CI portability (ripgrep isn't guaranteed on runners)
  grep -Fnq "$heading" "$file" || fail "Missing heading '$heading' in $file"
}

require_dir .copilot/squad
require_dir .copilot/squad/roles
require_dir .copilot/squad/tasks

require_file .copilot/squad/squad.json
python -m json.tool .copilot/squad/squad.json >/dev/null || fail "Invalid JSON: .copilot/squad/squad.json"

# role files
for f in \
  architect lead-engineer backend-lead frontend-lead mobile-lead devops-engineer tester documentation-steward project-manager
do
  file=".copilot/squad/roles/$f.md"
  require_file "$file"
  require_heading "$file" "## Purpose"
  require_heading "$file" "## Responsibilities"
  require_heading "$file" "## Constraints / Must-Nots"
  require_heading "$file" "## Decision rules"
  require_heading "$file" "## Required references"
done

# task playbooks
for f in \
  add-backend-endpoint add-frontend-component add-mobile-feature update-documentation add-test-coverage update-golden-files multi-tenant-safe-migration ci-cd-workflow-changes cross-agent-architectural-review
do
  file=".copilot/squad/tasks/$f.md"
  require_file "$file"
  require_heading "$file" "## Purpose"
  require_heading "$file" "## Inputs"
  require_heading "$file" "## Outputs"
  require_heading "$file" "## Step-by-step execution"
  require_heading "$file" "## Risks & rollback"
  require_heading "$file" "## Handoff checklist"
done

# copilot agent profiles
require_dir .github/agents
count_agents=$(ls -1 .github/agents/projectmeats-*.agent.md 2>/dev/null | wc -l | tr -d ' ')
[ "$count_agents" -ge 9 ] || fail "Expected >=9 projectmeats-* agents; found $count_agents"

# skills
require_dir .github/skills
count_skills=$(find .github/skills -name SKILL.md | wc -l | tr -d ' ')
[ "$count_skills" -ge 9 ] || fail "Expected >=9 skills; found $count_skills"

# wrapper script
require_file scripts/gh-copilot
require_file scripts/install_gh_copilot_alias.sh

echo "✅ Copilot Squad structure validated"

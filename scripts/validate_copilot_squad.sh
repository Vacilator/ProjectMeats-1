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

# Semantic validation: ensure squad.json references are consistent and files exist.
python - <<'PY' || fail "Invalid squad.json references"
import json
import os
import re
import sys

p = '.copilot/squad/squad.json'
with open(p, 'r', encoding='utf-8') as f:
  data = json.load(f)

errors: list[str] = []

def req_path(path: str | None, ctx: str) -> None:
  if not path or not isinstance(path, str):
    errors.append(f"Missing path for {ctx}")
    return
  if not os.path.exists(path):
    errors.append(f"Missing path for {ctx}: {path}")

ver = str(data.get('version', ''))
if not re.match(r'^\d+\.\d+\.\d+$', ver):
  errors.append(f"Invalid version (expected semver): {ver}")

refs = data.get('authoritative_refs') or {}
if not isinstance(refs, dict):
  errors.append('authoritative_refs must be an object')
else:
  for k, paths in refs.items():
    if not isinstance(paths, list):
      errors.append(f"authoritative_refs.{k} must be an array")
      continue
    for rp in paths:
      req_path(rp if isinstance(rp, str) else None, f"authoritative_refs.{k}")

agents = data.get('agents') or []
tasks = data.get('tasks') or []

if not isinstance(agents, list):
  errors.append('agents must be an array')
  agents = []
if not isinstance(tasks, list):
  errors.append('tasks must be an array')
  tasks = []

agent_ids: list[str] = []
for a in agents:
  if not isinstance(a, dict):
    errors.append('agent entry must be an object')
    continue
  aid = a.get('id')
  if not isinstance(aid, str) or not aid:
    errors.append('agent.id must be a non-empty string')
    continue
  agent_ids.append(aid)
  req_path(a.get('role_file') if isinstance(a.get('role_file'), str) else None, f"agent.{aid}.role_file")
  req_path(
    a.get('copilot_agent_profile') if isinstance(a.get('copilot_agent_profile'), str) else None,
    f"agent.{aid}.copilot_agent_profile",
  )

if len(agent_ids) != len(set(agent_ids)):
  errors.append('Duplicate agent IDs found in squad.json')

task_ids: list[str] = []
for t in tasks:
  if not isinstance(t, dict):
    errors.append('task entry must be an object')
    continue
  tid = t.get('id')
  if not isinstance(tid, str) or not tid:
    errors.append('task.id must be a non-empty string')
    continue
  task_ids.append(tid)
  req_path(t.get('playbook_file') if isinstance(t.get('playbook_file'), str) else None, f"task.{tid}.playbook_file")

  da = t.get('default_agent')
  if isinstance(da, str) and da and da not in set(agent_ids):
    errors.append(f"task.{tid}.default_agent references unknown agent: {da}")

  for ra in (t.get('required_agents') or []):
    if isinstance(ra, str) and ra not in set(agent_ids):
      errors.append(f"task.{tid}.required_agents references unknown agent: {ra}")

  skill_id = t.get('skill_id')
  if isinstance(skill_id, str) and skill_id:
    req_path(f".github/skills/{skill_id}/SKILL.md", f"task.{tid}.skill_id")

if len(task_ids) != len(set(task_ids)):
  errors.append('Duplicate task IDs found in squad.json')

known_tasks = set(task_ids)
for a in agents:
  if not isinstance(a, dict):
    continue
  aid = a.get('id')
  if not isinstance(aid, str) or not aid:
    continue
  for rt in (a.get('review_required_for') or []):
    if isinstance(rt, str) and rt not in known_tasks:
      errors.append(f"agent.{aid}.review_required_for references unknown task: {rt}")

if errors:
  for e in errors:
    print(f"ERROR: {e}", file=sys.stderr)
  raise SystemExit(1)
PY

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

# wrapper smoke tests (must not require copilot to be installed)
bash scripts/gh-copilot squad list >/dev/null || fail "gh-copilot squad list failed"
while IFS= read -r tid; do
  bash scripts/gh-copilot squad show "$tid" >/dev/null || fail "gh-copilot squad show failed for task: $tid"
done < <(bash scripts/gh-copilot squad list)

echo "✅ Copilot Squad structure validated"

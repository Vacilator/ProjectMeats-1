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

# Semantic validation: ensure squad.json references are consistent, correctly typed, and paths exist.
python - <<'PY' || fail "Invalid squad.json references"
import glob
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

def list_of_str(value, ctx: str, *, allow_empty: bool = True) -> list[str]:
  if value is None:
    return []
  if not isinstance(value, list):
    errors.append(f"{ctx} must be an array of strings")
    return []

  out: list[str] = []
  for i, item in enumerate(value):
    if not isinstance(item, str) or not item.strip():
      errors.append(f"{ctx}[{i}] must be a non-empty string")
      continue
    out.append(item)

  if not allow_empty and not out:
    errors.append(f"{ctx} must be a non-empty array")

  return out

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

agent_set = set(agent_ids)

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
  if not isinstance(da, str) or not da:
    errors.append(f"task.{tid}.default_agent must be a non-empty string")
  elif da not in agent_set:
    errors.append(f"task.{tid}.default_agent references unknown agent: {da}")

  required_agents = list_of_str(t.get('required_agents'), f"task.{tid}.required_agents")
  for ra in required_agents:
    if ra not in agent_set:
      errors.append(f"task.{tid}.required_agents references unknown agent: {ra}")

  required_checks = list_of_str(t.get('required_checks'), f"task.{tid}.required_checks")

  risk = t.get('risk_level')
  if risk not in ('low', 'medium', 'high'):
    errors.append(f"task.{tid}.risk_level must be one of: low, medium, high")

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

  review_required_for = list_of_str(a.get('review_required_for'), f"agent.{aid}.review_required_for")
  for rt in review_required_for:
    if rt not in known_tasks:
      errors.append(f"agent.{aid}.review_required_for references unknown task: {rt}")

collab = data.get('collaboration') or {}
if not isinstance(collab, dict):
  errors.append('collaboration must be an object')
else:
  blocking = collab.get('blocking_rules') or {}
  if not isinstance(blocking, dict):
    errors.append('collaboration.blocking_rules must be an object')
  else:
    for rule_name, rule in blocking.items():
      if not isinstance(rule, dict):
        errors.append(f"collaboration.blocking_rules.{rule_name} must be an object")
        continue

      paths = list_of_str(rule.get('paths'), f"collaboration.blocking_rules.{rule_name}.paths", allow_empty=False)
      requires = list_of_str(rule.get('requires'), f"collaboration.blocking_rules.{rule_name}.requires", allow_empty=False)

      for req in requires:
        if req not in agent_set:
          errors.append(f"collaboration.blocking_rules.{rule_name}.requires references unknown agent: {req}")

      for path in paths:
        if any(ch in path for ch in ('*', '?', '[')):
          if not glob.glob(path, recursive=True):
            errors.append(f"collaboration.blocking_rules.{rule_name}.paths has no matches: {path}")
        else:
          if not os.path.exists(path):
            errors.append(f"collaboration.blocking_rules.{rule_name}.paths missing path: {path}")

if errors:
  for e in errors:
    print(f"ERROR: {e}", file=sys.stderr)
  raise SystemExit(1)
PY

# Enforce canonical env manifest reference inside squad-owned instructions.
if [ -f manifests/env.manifest.json ] && [ ! -f config/env.manifest.json ]; then
  legacy_refs=$(grep -RIn "config/env\.manifest\.json" .copilot/squad .github/agents || true)
  [ -z "$legacy_refs" ] || fail "Legacy env manifest path referenced (use manifests/env.manifest.json):\n$legacy_refs"
fi


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

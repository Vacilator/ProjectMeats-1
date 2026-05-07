#!/bin/bash
# Workflow Validation Script
# Validates GitHub Actions workflow syntax and configuration

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fail if archived workflows directory exists (prevents bypassing guardrails)
check_no_archived_workflows_dir() {
    log_info "Checking no archived workflows directory exists..."

    if [[ -d .github/workflows/archived ]]; then
        log_error "Archived workflows directory detected at .github/workflows/archived"
        log_error "Move archived workflows out of .github/workflows/ so they cannot be executed by GitHub Actions."
        return 1
    fi

    return 0
}

# Check YAML syntax
validate_yaml_syntax() {
    log_info "Validating YAML syntax..."
    
    local failed=0
    
    for workflow in .github/workflows/*.yml; do
        if [[ -f "$workflow" ]]; then
            if ! python -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
                log_error "Invalid YAML syntax in $workflow"
                ((failed++))
            else
                log_info "✓ $workflow"
            fi
        fi
    done
    
    if [[ $failed -gt 0 ]]; then
        log_error "$failed workflow files have syntax errors"
        return 1
    fi
    
    log_info "✓ All workflow files have valid YAML syntax"
    return 0
}

# Check workflow secrets against env manifest (all workflows)
check_manifest_secrets_for_all_workflows() {
    local report_only="${WORKFLOW_SECRETS_MANIFEST_REPORT_ONLY:-0}"

    if [[ "$report_only" == "1" ]]; then
        log_warn "Checking workflow secrets against manifests/env.manifest.json (ALL workflows, report-only)..."
    else
        log_info "Checking workflow secrets against manifests/env.manifest.json (ALL workflows)..."
    fi

    if ! python - <<'PY'
import json
import re
import sys
import os
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

report_only = os.environ.get('WORKFLOW_SECRETS_MANIFEST_REPORT_ONLY') == '1'

manifest_path = Path('manifests/env.manifest.json')
if not manifest_path.exists():
    manifest_path = Path('config/env.manifest.json')

if not manifest_path.exists():
    print('ERROR: env manifest not found at manifests/env.manifest.json (or legacy config/env.manifest.json)', file=sys.stderr)
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

allowed = set((manifest.get('repository_secrets') or {}).keys())
env_secrets = manifest.get('environment_secrets') or {}
for _cat, items in env_secrets.items():
    if isinstance(items, dict):
        allowed |= set(items.keys())

# GitHub-provided token is always available
allowed |= {'GITHUB_TOKEN'}

# Scan only inside GitHub Actions expression blocks (${{ ... }}) to avoid false positives in comments.
expr_block_re = re.compile(r"\$\{\{.*?\}\}", re.DOTALL)
secret_dot_re = re.compile(r"\bsecrets\.([A-Z0-9_]+)\b")
secret_bracket_re = re.compile(r"secrets\[['\"]([A-Z0-9_]+)['\"]\]")
secret_dynamic_index_re = re.compile(r"\bsecrets\[(?!['\"]).+?\]")

wf_dir = Path('.github/workflows')
workflow_files = sorted([p for p in wf_dir.rglob('*.yml')] + [p for p in wf_dir.rglob('*.yaml')])
workflow_files = [p for p in workflow_files if 'archived' not in p.parts]

errors = []
for wf_path in workflow_files:
    text = wf_path.read_text(encoding='utf-8', errors='ignore')

    referenced = set()
    has_dynamic_index = False

    for block in expr_block_re.findall(text):
        referenced |= set(secret_dot_re.findall(block))
        referenced |= set(secret_bracket_re.findall(block))
        if secret_dynamic_index_re.search(block):
            has_dynamic_index = True

    # Validate reusable workflow contract secrets: on.workflow_call.secrets (YAML keys)
    try:
        data = yaml.safe_load(text) or {}
    except Exception as e:
        errors.append(f"{wf_path.name}: failed to parse YAML for secrets contract validation: {e}")
        continue

    on_section = None
    if isinstance(data, dict):
        on_section = data.get('on') if 'on' in data else data.get(True)

    if isinstance(on_section, dict):
        workflow_call = on_section.get('workflow_call')
        if isinstance(workflow_call, dict):
            declared_secrets = workflow_call.get('secrets')
            if isinstance(declared_secrets, dict):
                for k in declared_secrets.keys():
                    if isinstance(k, str):
                        referenced.add(k)

    missing = sorted(referenced - allowed)
    if missing:
        errors.append(f"{wf_path.name}: missing from manifest: {', '.join(missing)}")

    if has_dynamic_index:
        errors.append(f"{wf_path.name}: dynamic secrets[...] indexing detected (not allowed)")

if errors:
    for e in errors:
        level = 'WARN' if report_only else 'ERROR'
        print(f"{level}: {e}", file=sys.stderr)

    if report_only:
        raise SystemExit(0)

    raise SystemExit(1)

print('✓ All workflow secrets are manifest-defined')
PY
    then
        return 1
    fi

    return 0
}

# Check for cache configuration
check_cache_config() {
    log_info "Checking Docker cache configuration..."

    local workflows=()
    for wf in .github/workflows/reusable-deploy.yml .github/workflows/main-pipeline.yml; do
        [[ -f "$wf" ]] && workflows+=("$wf")
    done

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No deploy workflows found (skipping cache checks)"
        return 0
    fi

    local failed=0

    for workflow in "${workflows[@]}"; do
        if ! grep -q "actions/cache@" "$workflow"; then
            log_warn "No cache configuration in $workflow"
            ((failed++))
        fi
        
        if ! grep -q "buildx-cache" "$workflow"; then
            log_warn "No BuildKit cache in $workflow"
            ((failed++))
        fi
    done
    
    if [[ $failed -eq 0 ]]; then
        log_info "✓ All deployment workflows have cache configured"
    fi
    
    return 0
}

# Check for health checks
check_health_checks() {
    log_info "Checking for health check steps..."

    local workflows=()
    for wf in .github/workflows/reusable-deploy.yml; do
        [[ -f "$wf" ]] && workflows+=("$wf")
    done

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No deploy workflows found (skipping health check discovery)"
        return 0
    fi

    for workflow in "${workflows[@]}"; do
        if ! grep -q "health" "$workflow"; then
            log_warn "No health check found in $workflow"
        else
            log_info "✓ Health check found in $workflow"
        fi
    done

    return 0
}

# Check for fetch-depth configuration
check_fetch_depth() {
    log_info "Checking fetch-depth configuration..."
    
    local workflows=(.github/workflows/*.yml)
    local issues=0
    
    for workflow in "${workflows[@]}"; do
        # Check if using checkout action (any version)
        if grep -qE "actions/checkout@" "$workflow"; then
            # Check if fetch-depth is set near checkout steps
            if ! grep -A 6 -E "actions/checkout@" "$workflow" | grep -q "fetch-depth"; then
                log_warn "No fetch-depth set in $workflow (will use default history depth)"
                ((issues++))
            fi
        fi
    done
    
    if [[ $issues -eq 0 ]]; then
        log_info "✓ All checkouts have fetch-depth configured"
    fi
    
    return 0
}

# Check for error handling
check_error_handling() {
    log_info "Checking error handling in deployment scripts..."
    
    local scripts=(.github/scripts/*.sh)
    
    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            if ! grep -q "set -euo pipefail" "$script"; then
                log_warn "Missing 'set -euo pipefail' in $script"
            else
                log_info "✓ $script has error handling"
            fi
        fi
    done
    
    return 0
}

# Check for timeout configurations
check_timeouts() {
    log_info "Checking workflow timeouts..."

    local failed=0

    # Enforce timeouts for critical jobs in the canonical deploy workflow.
    if [[ -f .github/workflows/reusable-deploy.yml ]]; then
        if python - <<'PY'
import sys
from pathlib import Path

import yaml

wf = Path('.github/workflows/reusable-deploy.yml')
data = yaml.safe_load(wf.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}

required = [
    'check_infrastructure',
    'build-backend',
    'security-scan-backend',
    'test-backend',
    'check-migrations',
    'migrate',
    'deploy-backend',
    'build-frontend',
    'security-scan-frontend',
    'test-frontend',
    'deploy-frontend',
]

missing_jobs = [j for j in required if j not in jobs]
if missing_jobs:
    print(f"ERROR: reusable-deploy.yml missing expected jobs for timeout enforcement: {', '.join(missing_jobs)}", file=sys.stderr)
    raise SystemExit(1)

missing_timeouts = []
for j in required:
    tm = (jobs.get(j) or {}).get('timeout-minutes')
    if tm is None:
        missing_timeouts.append(j)

if missing_timeouts:
    print(
        "ERROR: reusable-deploy.yml missing timeout-minutes for critical jobs: " + ", ".join(missing_timeouts),
        file=sys.stderr,
    )
    raise SystemExit(1)

print('✓ reusable-deploy.yml has timeout-minutes for all critical jobs')
PY
        then
            log_info "✓ Timeout enforcement passed for reusable-deploy.yml"
        else
            ((failed++))
        fi
    fi

    # Soft-check that other key workflows have at least one timeout (informational only).
    for wf in .github/workflows/main-pipeline.yml .github/workflows/pr-validation.yml; do
        if [[ -f "$wf" ]]; then
            if ! grep -q "timeout-minutes" "$wf"; then
                log_warn "No timeout configured in $wf"
            else
                log_info "✓ Timeout configured in $wf"
            fi
        fi
    done

    if [[ $failed -gt 0 ]]; then
        return 1
    fi

    return 0
}

# Check for retry logic
check_docker_port_bindings() {
    log_info "Checking docker port bindings (frontend must bind to 127.0.0.1:8080)..."

    local workflows=(.github/workflows/*.yml)
    local failed=0

    for workflow in "${workflows[@]}"; do
        # Skip archived workflows
        if [[ "$workflow" == *"/archived/"* ]]; then
            continue
        fi

        # Prohibit exposing frontend container on all interfaces
        # (match both "-p 8080:80" and "-p8080:80")
        if grep -Eq -- "-p[[:space:]]*8080:80" "$workflow"; then
            log_error "Prohibited port mapping found in $workflow: '-p 8080:80' (must be 127.0.0.1:8080:80)"
            ((failed++))
        fi

        if grep -Eq -- "-p[[:space:]]*0\.0\.0\.0:8080:80" "$workflow"; then
            log_error "Prohibited port mapping found in $workflow: '-p 0.0.0.0:8080:80' (must be 127.0.0.1:8080:80)"
            ((failed++))
        fi
    done

    # Require the golden binding in the canonical deploy workflow
    if [[ -f .github/workflows/reusable-deploy.yml ]]; then
        if ! grep -q "127.0.0.1:8080:80" .github/workflows/reusable-deploy.yml; then
            log_error "reusable-deploy.yml must bind frontend to 127.0.0.1:8080:80"
            ((failed++))
        else
            log_info "✓ reusable-deploy.yml binds frontend to 127.0.0.1:8080:80"
        fi
    fi

    if [[ $failed -gt 0 ]]; then
        return 1
    fi

    return 0
}

check_golden_workflow_topology() {
    log_info "Checking golden workflow topology..."

    local failed=0

    # Ban docker-compose / docker compose and ban :latest tags.
    # - Deployments must use `docker run` on remote hosts (no compose)
    # - Image tags must be immutable (no :latest)
    # Scan both workflows and .github/scripts (excluding this validator script itself).
    if ! python - <<'PY'
import re
import sys
from pathlib import Path

paths = [Path('.github/workflows'), Path('.github/scripts')]

# Exclude self, otherwise we'd match the validator's own "docker-compose" / ":latest" strings.
exclude = {Path('.github/scripts/validate-workflows.sh').resolve()}

files = []
for base in paths:
    if not base.exists():
        continue
    for p in base.rglob('*'):
        if not p.is_file():
            continue
        if p.suffix not in {'.yml', '.yaml', '.sh'}:
            continue
        if p.resolve() in exclude:
            continue
        files.append(p)

compose_re = re.compile(r"\bdocker-compose\b|\bdocker\s+compose\b")
latest_re = re.compile(r":latest\b")

errors = []
for p in sorted(files):
    text = p.read_text(encoding='utf-8', errors='ignore').splitlines()
    for i, line in enumerate(text, start=1):
        if compose_re.search(line):
            errors.append(f"{p}: {i}: docker compose usage detected (prohibited): {line.strip()}")
        if latest_re.search(line):
            errors.append(f"{p}: {i}: ':latest' tag detected (prohibited): {line.strip()}")

if errors:
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ No docker compose usage and no :latest tags detected')
PY
    then
        ((failed++))
    fi

    # Enforce backend .env uses manifest-defined EMAIL_HOST_PASSWORD (not legacy SENDGRID_API_KEY)
    if [[ -f .github/workflows/reusable-deploy.yml ]]; then
        if grep -q "SENDGRID_API_KEY=" .github/workflows/reusable-deploy.yml; then
            log_error "reusable-deploy.yml writes SENDGRID_API_KEY into backend.env (must use EMAIL_HOST_PASSWORD from env manifest)"
            ((failed++))
        fi

        # Disallow known "tests bypass" markers
        if grep -qi "temporarily bypassed\|skip tests temporarily" .github/workflows/reusable-deploy.yml; then
            log_error "reusable-deploy.yml still contains test bypass markers"
            grep -ni "temporarily bypassed\|skip tests temporarily" .github/workflows/reusable-deploy.yml || true
            ((failed++))
        fi

        # Validate job dependency topology via YAML parse (enforce golden graph invariants)
        if ! python - <<'PY'
import re
import sys
from pathlib import Path

import yaml

wf = Path('.github/workflows/reusable-deploy.yml')
data = yaml.safe_load(wf.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}

required_jobs = {
    # Gate
    'check_infrastructure',

    # Backend swimlane
    'build-backend',
    'security-scan-backend',
    'test-backend',
    'check-migrations',
    'migrate',
    'deploy-backend',

    # Frontend swimlane
    'build-frontend',
    'security-scan-frontend',
    'test-frontend',
    'deploy-frontend',
}

missing = sorted(required_jobs - set(jobs.keys()))
if missing:
    print(f"ERROR: reusable-deploy.yml missing expected jobs: {', '.join(missing)}", file=sys.stderr)
    raise SystemExit(1)


def needs_set(job_name: str) -> set[str]:
    job = jobs.get(job_name) or {}
    needs = job.get('needs')
    if needs is None:
        return set()
    if isinstance(needs, str):
        return {needs}
    if isinstance(needs, list):
        return {n for n in needs if isinstance(n, str)}
    return set()


def assert_needs_exact(job: str, expected: set[str]):
    got = needs_set(job)
    if got != expected:
        print(f"ERROR: {job}.needs must be exactly {sorted(expected)} (found {sorted(got)})", file=sys.stderr)
        raise SystemExit(1)

# -----------------------------
# Parallel swimlanes (topology)
# -----------------------------
# Build jobs start in parallel right after infra gate.
assert_needs_exact('build-backend', {'check_infrastructure'})
assert_needs_exact('build-frontend', {'check_infrastructure'})

# Security scan and tests stay within their swimlane.
assert_needs_exact('security-scan-backend', {'build-backend'})
assert_needs_exact('test-backend', {'build-backend'})

assert_needs_exact('security-scan-frontend', {'build-frontend'})
assert_needs_exact('test-frontend', {'build-frontend'})

# Backend preflight: check migrations after backend build (not test-backend,
# so the migration safety gate still runs when skip_tests_in_deploy is true).
assert_needs_exact('check-migrations', {'build-backend'})

# Tests gating is re-enabled: migrations are gated on BOTH backend and frontend test tracks.
# We also allow (and prefer) additionally gating mutations on security scans to avoid
# "DB advanced but deploy blocked" failure modes.
allowed_migrate_needs = [
    {'build-backend', 'check-migrations', 'test-frontend'},
    {'build-backend', 'check-migrations', 'test-frontend', 'security-scan-backend', 'security-scan-frontend'},
]
if needs_set('migrate') not in allowed_migrate_needs:
    print(
        f"ERROR: migrate.needs must be one of {sorted([sorted(s) for s in allowed_migrate_needs])} (found {sorted(needs_set('migrate'))})",
        file=sys.stderr,
    )
    raise SystemExit(1)

# Deploy backend is gated on migrations + its own security scan + the built backend artifact.
assert_needs_exact('deploy-backend', {'build-backend', 'migrate', 'security-scan-backend'})

# Deploy frontend must synchronize on migrations, its own test/security lane, and the built frontend artifact.
assert_needs_exact('deploy-frontend', {'build-frontend', 'migrate', 'test-frontend', 'security-scan-frontend'})

# Explicitly forbid accidental cross-lane coupling (beyond the migrate barrier).
deploy_frontend_needs = needs_set('deploy-frontend')
for forbidden in ('deploy-backend', 'deploy-dev', 'deploy-uat', 'deploy-prod', 'check-migrations', 'test-backend', 'security-scan-backend', 'build-backend'):
    if forbidden in deploy_frontend_needs:
        print(f"ERROR: deploy-frontend must not depend on {forbidden} (swimlane independence)", file=sys.stderr)
        raise SystemExit(1)

# -----------------------------------------
# Runner-driven migrations (implementation)
# -----------------------------------------
migrate_job = jobs.get('migrate') or {}
if migrate_job.get('runs-on') != 'ubuntu-latest':
    print(f"ERROR: migrate must be runner-based (runs-on: ubuntu-latest). Found: {migrate_job.get('runs-on')}", file=sys.stderr)
    raise SystemExit(1)

steps = migrate_job.get('steps') or []
run_text = "\n".join([s.get('run','') for s in steps if isinstance(s, dict) and isinstance(s.get('run'), str)])

# Must use SSH tunnel (bastion) via composite action or inline sshpass + bind to local 5433
uses_ssh_tunnel_action = any(
    isinstance(s, dict) and 'actions/ssh-tunnel' in str(s.get('uses', ''))
    for s in steps
)
if uses_ssh_tunnel_action:
    pass  # SSH tunnel handled by composite action (includes sshpass + -L 5433 internally)
elif 'sshpass' not in run_text or '-L 5433:' not in run_text:
    print("ERROR: migrate must establish an SSH tunnel (-L 5433:...) using sshpass or .github/actions/ssh-tunnel", file=sys.stderr)
    raise SystemExit(1)

# Must run migrations in Docker with host networking so container can reach localhost tunnel.
if '--network host' not in run_text:
    print("ERROR: migrate must run docker with --network host", file=sys.stderr)
    raise SystemExit(1)

# Must use --fake-initial (runner-driven migrations invariant)
if 'python manage.py migrate --fake-initial --noinput' not in run_text:
    print("ERROR: migrate must run: python manage.py migrate --fake-initial --noinput", file=sys.stderr)
    raise SystemExit(1)

print('✓ reusable-deploy.yml golden topology + migration contract OK')
PY
        then
            ((failed++))
        fi
    fi

    if [[ $failed -gt 0 ]]; then
        return 1
    fi

    log_info "✓ Golden workflow topology validated"
    return 0
}

check_retry_logic() {
    log_info "Checking retry logic in health checks..."

    local workflows=()
    for wf in .github/workflows/reusable-deploy.yml; do
        [[ -f "$wf" ]] && workflows+=("$wf")
    done

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No deploy workflows found (skipping retry checks)"
        return 0
    fi

    local has_retry=0

    for workflow in "${workflows[@]}"; do
        if grep -q "for i in" "$workflow" || grep -q "MAX_ATTEMPTS" "$workflow"; then
            ((has_retry++))
        fi
    done

    if [[ $has_retry -gt 0 ]]; then
        log_info "✓ Retry logic found in $has_retry workflows"
    else
        log_warn "No retry logic found in workflows"
    fi

    return 0
}

# Check for migration safety
check_migration_safety() {
    log_info "Checking migration safety (golden runner-driven migrations + no dynamic generation)..."

    if [[ ! -f .github/workflows/reusable-deploy.yml ]]; then
        log_info "No reusable-deploy.yml found (skipping migration-safety checks)"
        return 0
    fi

    # 1) Allow ONLY "makemigrations --check --dry-run" (no dynamic migration generation in CI)
    # 2) Require migrate uses --fake-initial (runner-driven contract)
    # 3) Require backend mutation commands to reuse one resolved backend ref
    if ! python - <<'PY'
import sys
from pathlib import Path

wf = Path('.github/workflows/reusable-deploy.yml')
lines = wf.read_text(encoding='utf-8', errors='ignore').splitlines()

bad = []
for i, line in enumerate(lines, start=1):
    stripped = line.lstrip()
    if stripped.startswith('echo '):
        continue

    if 'manage.py makemigrations' in line:
        if '--check' not in line or '--dry-run' not in line:
            bad.append(f"{wf}: {i}: makemigrations must be check-only (require --check --dry-run): {line.strip()}")

text = "\n".join(lines)
if 'python manage.py migrate --fake-initial --noinput' not in text:
    bad.append("reusable-deploy.yml: migrate must run with --fake-initial --noinput")

if 'BACKEND_RUN_REF' not in text:
    bad.append("reusable-deploy.yml: backend mutation steps must resolve and reuse BACKEND_RUN_REF")

required_backend_commands = [
    'python manage.py migrate --fake-initial --noinput',
    'python manage.py collectstatic --noinput --clear',
    'python manage.py setup_superuser',
    'python manage.py seed_system_products',
]
for command in required_backend_commands:
    idx = text.find(command)
    if idx == -1:
        bad.append(f"reusable-deploy.yml: missing expected backend mutation command: {command}")
        continue

    window = text[max(0, idx - 500):idx]
    if '"$BACKEND_RUN_REF"' not in window:
        bad.append(f"reusable-deploy.yml: backend mutation command must use BACKEND_RUN_REF: {command}")

if bad:
    for e in bad:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Migration safety checks passed')
PY
    then
        return 1
    fi

    return 0
}

# Check for proper concurrency control
check_concurrency() {
    log_info "Checking concurrency control..."

    local workflows=()
    for wf in .github/workflows/main-pipeline.yml; do
        [[ -f "$wf" ]] && workflows+=("$wf")
    done

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No target workflows found (skipping concurrency checks)"
        return 0
    fi

    for workflow in "${workflows[@]}"; do
        if grep -q "concurrency:" "$workflow"; then
            log_info "✓ Concurrency control in $workflow"
        else
            log_warn "No concurrency control in $workflow"
        fi
    done

    return 0
}

# Check for floating action refs (supply chain)
check_no_floating_action_refs() {
    log_info "Checking for floating action refs (no @master/@main/@HEAD)..."

    local workflows=(.github/workflows/*.yml .github/workflows/*.yaml)
    local failed=0

    for workflow in "${workflows[@]}"; do
        [[ -f "$workflow" ]] || continue
        if grep -nE "^\s*uses:\s+[^\s]+@(master|main|HEAD)\b" "$workflow" >/dev/null; then
            log_error "Floating action ref found in $workflow"
            grep -nE "^\s*uses:\s+[^\s]+@(master|main|HEAD)\b" "$workflow" || true
            ((failed++))
        fi
    done

    if [[ $failed -gt 0 ]]; then
        log_error "Found $failed workflow(s) with floating action refs"
        return 1
    fi

    log_info "✓ No floating action refs detected"
    return 0
}

# Enforce pinned action SHAs (supply chain)
check_actions_pinned_to_sha() {
    log_info "Checking GitHub Actions 'uses:' are pinned to commit SHAs (excluding archived)..."

    if ! python - <<'PY'
import re
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

sha_re = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)

def walk(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k, v
            yield from walk(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from walk(item)

errors = []
wf_dir = Path('.github/workflows')
workflow_files = sorted([p for p in wf_dir.rglob('*.yml')] + [p for p in wf_dir.rglob('*.yaml')])
workflow_files = [p for p in workflow_files if 'archived' not in p.parts]

for wf_path in workflow_files:
    text = wf_path.read_text(encoding='utf-8', errors='ignore')
    try:
        data = yaml.safe_load(text) or {}
    except Exception as e:
        errors.append(f"{wf_path.name}: failed to parse YAML: {e}")
        continue

    for k, v in walk(data):
        if k != 'uses' or not isinstance(v, str):
            continue

        uses = v.strip()

        # Local actions / reusable workflows are allowed.
        if uses.startswith('./'):
            continue

        # Disallow dynamic uses (breaks governance + auditing).
        if '${{' in uses:
            errors.append(f"{wf_path.name}: dynamic uses not allowed: {uses}")
            continue

        if '@' not in uses:
            errors.append(f"{wf_path.name}: uses missing @ref (must pin to SHA): {uses}")
            continue

        ref = uses.rsplit('@', 1)[-1]
        if not sha_re.match(ref):
            errors.append(f"{wf_path.name}: action ref must be a 40-char SHA (found '{ref}') for: {uses}")

if errors:
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ All actions are pinned to commit SHAs')
PY
    then
        return 1
    fi

    return 0
}

# Check workflow_run targets exist (promotion reliability)
check_digest_pinned_workflow_images() {
    log_info "Checking workflow service/container images are digest-pinned (@sha256:...)..."

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_dir = Path('.github/workflows')
workflow_files = sorted([p for p in wf_dir.rglob('*.yml')] + [p for p in wf_dir.rglob('*.yaml')])
workflow_files = [p for p in workflow_files if 'archived' not in p.parts]

errors = []

for wf_path in workflow_files:
    data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
    jobs = data.get('jobs') or {}
    if not isinstance(jobs, dict):
        continue

    for job_name, job in jobs.items():
        if not isinstance(job, dict):
            continue

        # jobs.<job>.services.*.image
        services = job.get('services')
        if isinstance(services, dict):
            for svc_name, svc in services.items():
                if not isinstance(svc, dict):
                    continue
                image = svc.get('image')
                if isinstance(image, str) and image.strip():
                    img = image.strip()
                    if '@sha256:' not in img:
                        errors.append(f"{wf_path.name}: jobs.{job_name}.services.{svc_name}.image must be digest-pinned (found '{img}')")

        # jobs.<job>.container.image
        container = job.get('container')
        if isinstance(container, dict):
            image = container.get('image')
            if isinstance(image, str) and image.strip():
                img = image.strip()
                if '@sha256:' not in img:
                    errors.append(f"{wf_path.name}: jobs.{job_name}.container.image must be digest-pinned (found '{img}')")

if errors:
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Workflow service/container images are digest-pinned')
PY
    then
        return 1
    fi

    return 0
}

check_immutable_deploy_tags() {
    log_info "Checking deploy image tags are SHA-derived (github.sha)..."

    if [[ ! -f .github/workflows/reusable-deploy.yml ]]; then
        log_info "No reusable-deploy.yml found (skipping immutable deploy tag checks)"
        return 0
    fi

    if ! python - <<'PY'
import re
import sys
from pathlib import Path

wf_path = Path('.github/workflows/reusable-deploy.yml')
text = wf_path.read_text(encoding='utf-8', errors='ignore')

errors = []

# 1) Hard block any env-only tag usage in reusable-deploy.yml.
# Require tags that include both inputs.environment and github.sha.
env_only_tag_re = re.compile(r":\s*\$\{\{\s*inputs\.environment\s*\}\}(?!\s*-\s*\$\{\{\s*github\.sha\s*\}\})")
if env_only_tag_re.search(text):
    errors.append(f"{wf_path.name}: env-only image tag detected (must include github.sha)")

# 2) Require explicit SHA-derived tag variables or build-exported tag refs in key locations.
sha_tag_expr = r"\$\{\{\s*inputs\.environment\s*\}\}\s*-\s*\$\{\{\s*github\.sha\s*\}\}"

tag_pat = re.compile(r"\bTAG\s*=\s*['\"]" + sha_tag_expr + r"['\"]")
image_tag_pat = re.compile(r"\bIMAGE_TAG\s*=\s*['\"]" + sha_tag_expr + r"['\"]")

if not tag_pat.search(text):
    errors.append(f"{wf_path.name}: missing SHA-derived TAG assignment (expected TAG=\"${{ inputs.environment }}-${{ github.sha }}\")")

if len(image_tag_pat.findall(text)) < 1:
    errors.append(
        f"{wf_path.name}: missing SHA-derived IMAGE_TAG assignment for frontend deploy flow"
    )

if errors:
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Deploy image tags are SHA-derived (inputs.environment-github.sha)')
PY
    then
        return 1
    fi

    return 0
}

# Check workflow_run targets exist (promotion reliability)
check_workflow_run_targets_exist() {

    log_info "Checking workflow_run referenced workflow names exist..."

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_dir = Path('.github/workflows')
workflow_files = sorted([p for p in wf_dir.glob('*.yml')] + [p for p in wf_dir.glob('*.yaml')])

names = set()
for p in workflow_files:
    data = yaml.safe_load(p.read_text(encoding='utf-8', errors='ignore')) or {}
    name = data.get('name')
    if isinstance(name, str) and name.strip():
        names.add(name.strip())

errors = []
for p in workflow_files:
    data = yaml.safe_load(p.read_text(encoding='utf-8', errors='ignore')) or {}
    on = data.get('on') or {}
    wr = on.get('workflow_run') if isinstance(on, dict) else None
    if not isinstance(wr, dict):
        continue
    targets = wr.get('workflows')
    if not isinstance(targets, list):
        continue
    for t in targets:
        if isinstance(t, str) and t.strip() and t.strip() not in names:
            errors.append(f"{p.name}: workflow_run references missing workflow name: {t}")

if errors:
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ All workflow_run targets exist')
PY
    then
        return 1
    fi

    return 0
}

# Check for environment-specific configurations
check_env_separation() {
    log_info "Checking environment separation..."
    
    # Check for env-specific secret usage
    local envs=("DEV" "UAT" "STAGING" "PROD")
    
    for env in "${envs[@]}"; do
        if grep -r "${env}_" .github/workflows/*.yml >/dev/null 2>&1; then
            log_info "✓ Found ${env}-specific configuration"
        fi
    done
    
    return 0
}

# Guardrail: PR validation must enforce frontend type-check (Sprint 1 CI gate)
check_pr_validation_frontend_typecheck_gate() {
    log_info "Checking PR validation includes frontend type-check gate..."

    if [[ ! -f .github/workflows/pr-validation.yml ]]; then
        log_info "No pr-validation.yml found (skipping PR frontend type-check gate)"
        return 0
    fi

    if [[ ! -f frontend/package.json ]]; then
        log_error "frontend/package.json missing (cannot validate verify-standards/type-check gate)"
        return 1
    fi

    # Validate intent, not job naming. Pass if PR validation:
    # - runs frontend type-check directly, OR
    # - runs frontend verify-standards AND verify-standards includes type-check.
    if ! python - <<'PY'
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_path = Path('.github/workflows/pr-validation.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}

run_blobs = []
for _job_name, job in (jobs.items() if isinstance(jobs, dict) else []):
    if not isinstance(job, dict):
        continue
    for step in (job.get('steps') or []):
        if not isinstance(step, dict):
            continue
        run = step.get('run')
        if not isinstance(run, str):
            continue
        wd = step.get('working-directory')
        wd = wd.strip() if isinstance(wd, str) else ""
        run_blobs.append((wd, run))


def is_frontend_context(wd: str, run: str) -> bool:
    if re.search(r"(^|/)\.?frontend$", wd) or wd in ("./frontend", "frontend"):
        return True
    if re.search(r"\bnpm\s+--prefix\s+frontend\b", run):
        return True
    return False


has_direct_typecheck = any(
    is_frontend_context(wd, run) and re.search(r"\bnpm\b.*\brun\b.*\btype-check\b", run)
    for wd, run in run_blobs
)

has_verify_standards = any(
    is_frontend_context(wd, run) and re.search(r"\bnpm\b.*\brun\b.*\bverify-standards\b", run)
    for wd, run in run_blobs
)

pkg = json.loads(Path('frontend/package.json').read_text(encoding='utf-8'))
vs = (((pkg.get('scripts') or {}).get('verify-standards')) or "")
vs_has_typecheck = bool(re.search(r"\btype-check\b", vs))

if has_direct_typecheck:
    print("✓ PR validation runs frontend type-check directly")
    raise SystemExit(0)

if has_verify_standards and vs_has_typecheck:
    print("✓ PR validation runs verify-standards and verify-standards includes type-check")
    raise SystemExit(0)

msg = []
if not (has_direct_typecheck or has_verify_standards):
    msg.append("missing frontend type-check/verify-standards invocation in pr-validation.yml")
if has_verify_standards and not vs_has_typecheck:
    msg.append("frontend/package.json scripts.verify-standards does not include type-check")
print(
    f"ERROR: PR validation frontend type-check gate not satisfied: {', '.join(msg)}",
    file=sys.stderr,
)
raise SystemExit(1)
PY
    then
        return 1
    fi

    return 0
}

check_pr_validation_security_gates() {
    log_info "Checking PR validation includes supply-chain security gates..."

    if [[ ! -f .github/workflows/pr-validation.yml ]]; then
        log_info "No pr-validation.yml found (skipping PR security gate checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_path = Path('.github/workflows/pr-validation.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}

has_dependency_review = False
has_actionlint = False
hadolint_targets = set()

for _job_name, job in (jobs.items() if isinstance(jobs, dict) else []):
    if not isinstance(job, dict):
        continue
    for step in (job.get('steps') or []):
        if not isinstance(step, dict):
            continue

        uses = step.get('uses')
        if isinstance(uses, str):
            if 'actions/dependency-review-action@' in uses:
                has_dependency_review = True
            if 'hadolint/hadolint-action@' in uses:
                dockerfile = ((step.get('with') or {}).get('dockerfile') or '').strip()
                if dockerfile:
                    hadolint_targets.add(dockerfile)

        run = step.get('run')
        if isinstance(run, str) and 'actionlint' in run:
            has_actionlint = True

errors = []
if not has_dependency_review:
    errors.append(f"{wf_path.name}: missing dependency-review-action PR gate")
if not has_actionlint:
    errors.append(f"{wf_path.name}: missing actionlint PR gate")

required_hadolint_targets = {'backend/Dockerfile', 'frontend/Dockerfile'}
missing_hadolint_targets = sorted(required_hadolint_targets - hadolint_targets)
if missing_hadolint_targets:
    errors.append(
        f"{wf_path.name}: missing hadolint PR gates for: {', '.join(missing_hadolint_targets)}"
    )

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ PR validation includes dependency review, workflow lint, and Dockerfile lint gates')
PY
    then
        return 1
    fi

    return 0
}

# Check workflow environment lanes match env manifest (prevents secret-scope typos)
check_environment_lanes_match_manifest() {
    log_info "Checking workflow environment lanes against manifests/env.manifest.json..."

    if [[ ! -f .github/workflows/main-pipeline.yml ]]; then
        log_info "No main-pipeline.yml found (skipping environment lane validation)"
        return 0
    fi

    if ! python - <<'PY'
import json
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

manifest_path = Path('manifests/env.manifest.json')
if not manifest_path.exists():
    manifest_path = Path('config/env.manifest.json')

if not manifest_path.exists():
    print('ERROR: env manifest not found at manifests/env.manifest.json (or legacy config/env.manifest.json)', file=sys.stderr)
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
lanes = set((manifest.get('environments') or {}).keys())
if not lanes:
    print('ERROR: manifest has no environments.* lane keys to validate against', file=sys.stderr)
    raise SystemExit(1)

wf_path = Path('.github/workflows/main-pipeline.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}

referenced = set()
for _job_name, job in jobs.items():
    if not isinstance(job, dict):
        continue
    with_section = job.get('with')
    if not isinstance(with_section, dict):
        continue

    for k in ('backend_environment', 'frontend_environment'):
        v = with_section.get(k)
        if isinstance(v, str) and v.strip():
            referenced.add(v.strip())

if not referenced:
    print('ERROR: main-pipeline.yml references no backend_environment/frontend_environment lanes (validator may be out of date)', file=sys.stderr)
    raise SystemExit(1)

missing = sorted(referenced - lanes)
if missing:
    print(f"ERROR: main-pipeline.yml references environment lanes missing from manifest: {', '.join(missing)}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Workflow environment lanes are manifest-defined')
PY
    then
        return 1
    fi

    return 0
}

check_dependabot_auto_merge_scope() {
    log_info "Checking Dependabot auto-merge stays dependency-only..."

    if [[ ! -f .github/workflows/15-dependabot-merge-when-green.yml ]]; then
        log_info "No Dependabot auto-merge workflow found (skipping scope checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_path = Path('.github/workflows/15-dependabot-merge-when-green.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
job = (data.get('jobs') or {}).get('merge-dependabot') or {}
steps = job.get('steps') or []
step = next((s for s in steps if isinstance(s, dict) and s.get('name') == 'Merge if safe'), None)
if step is None:
    print(f"ERROR: {wf_path.name}: missing 'Merge if safe' step", file=sys.stderr)
    raise SystemExit(1)

run_script = step.get('run') or ''

forbidden_tokens = [
    '.github/workflows/*',
    '.github/dependabot.yml',
    '.pre-commit-config.yaml',
    'backend/Dockerfile',
    'frontend/Dockerfile',
    'mobile/Dockerfile',
    'Dockerfile)',
    '.github/scripts/',
    'deploy/',
    'config/',
    'manifests/',
    'scripts/verify_golden_state.sh',
    '*/package.json',
    '*/package-lock.json',
    '*/yarn.lock',
    '*/pnpm-lock.yaml',
]

required_tokens = [
    'package.json|package-lock.json|yarn.lock|pnpm-lock.yaml',
    'frontend/package.json|frontend/package-lock.json|frontend/yarn.lock|frontend/pnpm-lock.yaml',
    'mobile/package.json|mobile/package-lock.json|mobile/yarn.lock|mobile/pnpm-lock.yaml',
    'backend/requirements*.txt|backend/pyproject.toml|backend/poetry.lock',
]

errors = []
for token in forbidden_tokens:
    if token in run_script:
        errors.append(f"{wf_path.name}: Dependabot auto-merge allowlist must not include {token}")

for token in required_tokens:
    if token not in run_script:
        errors.append(f"{wf_path.name}: Dependabot auto-merge allowlist missing expected dependency surface {token}")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Dependabot auto-merge scope is limited to explicit dependency manifests and lockfiles')
PY
    then
        return 1
    fi

    return 0
}

check_reusable_workflow_required_secret_contract() {
    log_info "Checking reusable-deploy manifest-derived required secret contract..."

    if [[ ! -f .github/workflows/reusable-deploy.yml ]]; then
        log_info "No reusable-deploy.yml found (skipping required secret contract checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

sys.path.insert(0, str(Path('.').resolve()))
from config.manage_env import EnvironmentManager

wf_path = Path('.github/workflows/reusable-deploy.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}
manager = EnvironmentManager(repo='local/local')

expectations = [
    ('migrate', 'Fail fast if required backend secrets are missing', 'dev-backend', '${{ inputs.backend_environment }}'),
    ('migrate', 'Fail fast if required backend secrets are missing', 'uat-backend', '${{ inputs.backend_environment }}'),
    ('deploy-backend', 'Fail fast if required backend secrets are missing', 'dev-backend', '${{ inputs.backend_environment }}'),
    ('deploy-backend', 'Fail fast if required backend secrets are missing', 'uat-backend', '${{ inputs.backend_environment }}'),
    ('deploy-frontend', 'Fail fast if required frontend secrets are missing', 'dev-frontend', '${{ inputs.frontend_environment }}'),
]

errors = []
for job_name, step_name, manifest_env, input_ref in expectations:
    job = jobs.get(job_name)
    if not isinstance(job, dict):
        errors.append(f"{wf_path.name}: jobs.{job_name} missing")
        continue

    steps = job.get('steps') or []
    step = next((s for s in steps if isinstance(s, dict) and s.get('name') == step_name), None)
    if step is None:
        errors.append(f"{wf_path.name}: jobs.{job_name} missing step '{step_name}'")
        continue

    env_keys = set((step.get('env') or {}).keys())
    expected = set(manager.required_secrets_for_environment(manifest_env, workflow_name='reusable-deploy.yml'))
    missing_env = sorted(expected - env_keys)
    if missing_env:
        errors.append(
            f"{wf_path.name}: jobs.{job_name} fail-fast env mapping missing manifest-required secrets: {', '.join(missing_env)}"
        )

    run_script = step.get('run') or ''
    if '.github/scripts/validate-environment.sh' not in run_script:
        errors.append(f"{wf_path.name}: jobs.{job_name} fail-fast step must call .github/scripts/validate-environment.sh")
    if '--workflow reusable-deploy.yml' not in run_script:
        errors.append(f"{wf_path.name}: jobs.{job_name} fail-fast step must pass --workflow reusable-deploy.yml")
    if input_ref not in run_script:
        errors.append(f"{wf_path.name}: jobs.{job_name} fail-fast step must validate manifest requirements for {input_ref}")
    if 'EnvironmentManager' in run_script or 'required_secrets_for_environment' in run_script or 'required_secrets_file' in run_script:
        errors.append(f"{wf_path.name}: jobs.{job_name} fail-fast step must not embed inline secret-derivation logic")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ reusable-deploy required secret contract is manifest-derived')
PY
    then
        return 1
    fi

    return 0
}

check_validate_environment_manifest_mode() {
    log_info "Checking validate-environment.sh stays manifest-driven..."

    if [[ ! -f .github/scripts/validate-environment.sh ]]; then
        log_error "Missing .github/scripts/validate-environment.sh"
        return 1
    fi

    local script_path=".github/scripts/validate-environment.sh"
    local failed=0

    if ! grep -q "config/manage_env.py validate-required" "$script_path"; then
        log_error "validate-environment.sh must delegate required-secret checks to config/manage_env.py validate-required"
        failed=1
    fi

    if grep -q 'check_var "SECRET_KEY"' "$script_path"; then
        log_error "validate-environment.sh must not hardcode legacy required SECRET_KEY checks"
        failed=1
    fi

    if grep -q 'check_var "ALLOWED_HOSTS"' "$script_path"; then
        log_error "validate-environment.sh must not hardcode ALLOWED_HOSTS as required"
        failed=1
    fi

    if [[ $failed -eq 0 ]]; then
        log_info "✓ validate-environment.sh is manifest-driven"
    fi

    return $failed
}

check_codeowners_security_overrides() {
    log_info "Checking CODEOWNERS critical security overrides..."

    if [[ ! -f .github/CODEOWNERS ]]; then
        log_error "Missing .github/CODEOWNERS"
        return 1
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

codeowners_path = Path('.github/CODEOWNERS')
entries = {}

for raw_line in codeowners_path.read_text(encoding='utf-8', errors='ignore').splitlines():
    line = raw_line.strip()
    if not line or line.startswith('#'):
        continue
    parts = line.split()
    if len(parts) < 2:
        continue
    entries[parts[0]] = set(parts[1:])

required_entries = {
    '/.github/workflows/pr-validation.yml': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/.github/workflows/main-pipeline.yml': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/.github/workflows/reusable-deploy.yml': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/.github/workflows/15-dependabot-merge-when-green.yml': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/.github/dependabot.yml': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/.github/scripts/check_infrastructure.sh': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/.github/scripts/validate-workflows.sh': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/scripts/verify_golden_state.sh': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/backend/Dockerfile': {'@Meats-Central/devops-team', '@Meats-Central/security-team'},
    '/frontend/Dockerfile': {'@Meats-Central/devops-team', '@Meats-Central/security-team'},
    '/deploy/': {'@Meats-Central/devops-team', '@Meats-Central/security-team', '@Meats-Central/senior-team'},
    '/config/': {'@Meats-Central/devops-team', '@Meats-Central/security-team'},
    '/manifests/env.manifest.json': {'@Meats-Central/devops-team', '@Meats-Central/security-team'},
}

errors = []
for path, owners in required_entries.items():
    present = entries.get(path)
    if present is None:
        errors.append(f"{codeowners_path.name}: missing critical CODEOWNERS entry for {path}")
        continue
    missing_owners = sorted(owners - present)
    if missing_owners:
        errors.append(
            f"{codeowners_path.name}: {path} missing required owners: {', '.join(missing_owners)}"
        )

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ CODEOWNERS critical security overrides are present')
PY
    then
        return 1
    fi

    return 0
}

check_reusable_frontend_ssh_failfast() {
    log_info "Checking reusable-deploy frontend SSH setup fails fast..."

    if [[ ! -f .github/workflows/reusable-deploy.yml ]]; then
        log_info "No reusable-deploy.yml found (skipping frontend SSH fail-fast checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_path = Path('.github/workflows/reusable-deploy.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}
job = jobs.get('deploy-frontend')
errors = []

if not isinstance(job, dict):
    errors.append(f"{wf_path.name}: jobs.deploy-frontend missing")
else:
    steps = job.get('steps') or []
    setup_step = next((s for s in steps if isinstance(s, dict) and s.get('name') == 'Setup SSH'), None)
    deploy_step = next((s for s in steps if isinstance(s, dict) and s.get('name') == 'Deploy frontend container'), None)

    if setup_step is None:
        errors.append(f"{wf_path.name}: jobs.deploy-frontend missing step 'Setup SSH'")
    else:
        run_script = setup_step.get('run') or ''
        required_tokens = [
            'timeout 30 sshpass -e ssh',
            'UserKnownHostsFile=/dev/null',
            'ConnectTimeout=10',
            'ServerAliveInterval=10',
            'ServerAliveCountMax=3',
        ]
        for token in required_tokens:
            if token not in run_script:
                errors.append(f"{wf_path.name}: jobs.deploy-frontend Setup SSH must include '{token}'")
        import re
        if re.search(r'(^|\n)\s*ssh-keyscan\b', run_script):
            errors.append(f"{wf_path.name}: jobs.deploy-frontend Setup SSH must not use raw ssh-keyscan")

    if deploy_step is None:
        errors.append(f"{wf_path.name}: jobs.deploy-frontend missing step 'Deploy frontend container'")
    else:
        run_script = deploy_step.get('run') or ''
        required_tokens = [
            'UserKnownHostsFile=/dev/null',
            'ConnectTimeout=10',
            'ServerAliveInterval=60',
            'ServerAliveCountMax=10',
        ]
        for token in required_tokens:
            if token not in run_script:
                errors.append(f"{wf_path.name}: jobs.deploy-frontend Deploy frontend container must include '{token}'")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ reusable-deploy frontend SSH setup is fail-fast')
PY
    then
        return 1
    fi

    return 0
}

check_digest_artifact_alignment() {
    log_info "Checking digest deploy defaults and artifact alignment..."

    if [[ ! -f .github/workflows/reusable-deploy.yml || ! -f .github/workflows/main-pipeline.yml ]]; then
        log_info "Deploy workflows not found (skipping digest alignment checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

main_path = Path('.github/workflows/main-pipeline.yml')
reusable_path = Path('.github/workflows/reusable-deploy.yml')
main_data = yaml.safe_load(main_path.read_text(encoding='utf-8', errors='ignore')) or {}
reusable_data = yaml.safe_load(reusable_path.read_text(encoding='utf-8', errors='ignore')) or {}

main_jobs = main_data.get('jobs') or {}
reusable_jobs = reusable_data.get('jobs') or {}
errors = []

for job_name in ('deploy-uat', 'deploy-prod'):
    job = main_jobs.get(job_name)
    with_section = (job or {}).get('with') or {}
    if with_section.get('deploy_by_digest') is not True:
        errors.append(f"{main_path.name}: jobs.{job_name}.with.deploy_by_digest must be true")

build_backend = reusable_jobs.get('build-backend') or {}
build_frontend = reusable_jobs.get('build-frontend') or {}

if (build_backend.get('outputs') or {}).get('image_digest_ref') != '${{ steps.backend_image_refs.outputs.digest_ref }}':
    errors.append(f"{reusable_path.name}: jobs.build-backend.outputs.image_digest_ref must export steps.backend_image_refs.outputs.digest_ref")
if (build_frontend.get('outputs') or {}).get('image_digest_ref') != '${{ steps.frontend_image_refs.outputs.digest_ref }}':
    errors.append(f"{reusable_path.name}: jobs.build-frontend.outputs.image_digest_ref must export steps.frontend_image_refs.outputs.digest_ref")

def ensure_need(job_name, need_name):
    needs = (reusable_jobs.get(job_name) or {}).get('needs') or []
    if need_name not in needs:
        errors.append(f"{reusable_path.name}: jobs.{job_name} must depend on {need_name} for digest alignment")

ensure_need('migrate', 'build-backend')
ensure_need('deploy-backend', 'build-backend')
ensure_need('deploy-frontend', 'build-frontend')

def step(job_name, step_name):
    steps = (reusable_jobs.get(job_name) or {}).get('steps') or []
    return next((s for s in steps if isinstance(s, dict) and s.get('name') == step_name), None)

migrate_resolve_step = step('migrate', 'Resolve backend image reference')
migrate_step = step('migrate', 'Run migrations via Docker with tunnel')
backend_deploy_step = step('deploy-backend', 'Deploy backend container')
frontend_deploy_step = step('deploy-frontend', 'Deploy frontend container')

expected_env_refs = [
    (migrate_resolve_step, 'BACKEND_TAG_REF', '${{ needs.build-backend.outputs.image_tag_ref }}', 'jobs.migrate step Resolve backend image reference'),
    (migrate_resolve_step, 'BACKEND_DIGEST_REF', '${{ needs.build-backend.outputs.image_digest_ref }}', 'jobs.migrate step Resolve backend image reference'),
    (backend_deploy_step, 'BACKEND_TAG_REF', '${{ needs.build-backend.outputs.image_tag_ref }}', 'jobs.deploy-backend step Deploy backend container'),
    (backend_deploy_step, 'BACKEND_DIGEST_REF', '${{ needs.build-backend.outputs.image_digest_ref }}', 'jobs.deploy-backend step Deploy backend container'),
    (frontend_deploy_step, 'FRONTEND_TAG_REF', '${{ needs.build-frontend.outputs.image_tag_ref }}', 'jobs.deploy-frontend step Deploy frontend container'),
    (frontend_deploy_step, 'FRONTEND_DIGEST_REF', '${{ needs.build-frontend.outputs.image_digest_ref }}', 'jobs.deploy-frontend step Deploy frontend container'),
]

for step_obj, env_key, expected_value, label in expected_env_refs:
    if step_obj is None:
        errors.append(f"{reusable_path.name}: missing {label}")
        continue
    env_map = step_obj.get('env') or {}
    if env_map.get(env_key) != expected_value:
        errors.append(f"{reusable_path.name}: {label} env.{env_key} must be {expected_value}")

# Migrate: digest resolution is now in the Resolve step (uses composite action for pull)
if migrate_resolve_step is not None and 'IMAGE_REF="$BACKEND_DIGEST_REF"' not in (migrate_resolve_step.get('run') or ''):
    errors.append(f"{reusable_path.name}: migrate resolve step must switch to BACKEND_DIGEST_REF when digest deploy is enabled")
if backend_deploy_step is not None and 'RUN_REF="${BACKEND_DIGEST_REF}"' not in (backend_deploy_step.get('run') or ''):
    errors.append(f"{reusable_path.name}: deploy-backend step must run the build-exported backend digest ref")
if frontend_deploy_step is not None and 'RUN_REF="${FRONTEND_DIGEST_REF}"' not in (frontend_deploy_step.get('run') or ''):
    errors.append(f"{reusable_path.name}: deploy-frontend step must run the build-exported frontend digest ref")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Digest deploy defaults and artifact alignment are enforced')
PY
    then
        return 1
    fi

    return 0
}

check_reusable_workflow_callers() {
    log_info "Checking main-pipeline reusable workflow callers..."

    if [[ ! -f .github/workflows/main-pipeline.yml ]]; then
        log_info "No main-pipeline.yml found (skipping reusable workflow caller checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

wf_path = Path('.github/workflows/main-pipeline.yml')
data = yaml.safe_load(wf_path.read_text(encoding='utf-8', errors='ignore')) or {}
jobs = data.get('jobs') or {}

errors = []
checked = 0

for job_name, job in jobs.items():
    if not isinstance(job, dict):
        continue

    uses = job.get('uses')
    if not (isinstance(uses, str) and 'reusable-deploy.yml' in uses):
        continue

    checked += 1

    if 'environment' in job:
        errors.append(f"{wf_path.name}: jobs.{job_name} must not set environment when using reusable workflows")

    secrets = job.get('secrets')
    if secrets != 'inherit':
        errors.append(f"{wf_path.name}: jobs.{job_name}.secrets must be 'inherit' for reusable workflow calls")

    with_section = job.get('with')
    if not isinstance(with_section, dict):
        errors.append(f"{wf_path.name}: jobs.{job_name} missing with: block for reusable workflow call")
        continue

    for k in ('backend_environment', 'frontend_environment'):
        v = with_section.get(k)
        if not (isinstance(v, str) and v.strip()):
            errors.append(f"{wf_path.name}: jobs.{job_name}.with.{k} must be set for reusable workflow call")

    if job_name == 'deploy-dev' and with_section.get('deploy_by_digest') is True:
        errors.append(f"{wf_path.name}: jobs.deploy-dev must not default deploy_by_digest to true")
    if 'require_redis_readiness' not in with_section:
        errors.append(f"{wf_path.name}: jobs.{job_name}.with.require_redis_readiness must be set for reusable workflow call")
    elif job_name == 'deploy-dev' and with_section.get('require_redis_readiness') is not False:
        errors.append(f"{wf_path.name}: jobs.deploy-dev.with.require_redis_readiness must be false")
    elif job_name in {'deploy-uat', 'deploy-prod'} and with_section.get('require_redis_readiness') is not True:
        errors.append(f"{wf_path.name}: jobs.{job_name}.with.require_redis_readiness must be true")

    if job_name in {'deploy-uat', 'deploy-prod'} and with_section.get('deploy_by_digest') is not True:
        errors.append(f"{wf_path.name}: jobs.{job_name}.with.deploy_by_digest must be true")

if checked == 0:
    errors.append(f"{wf_path.name}: no reusable workflow caller jobs found (validator may be out of date)")

if errors:
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    raise SystemExit(1)

print('✓ main-pipeline reusable workflow caller invariants OK')
PY
    then
        return 1
    fi

    return 0
}

check_non_dev_redis_readiness_gate() {
    log_info "Checking non-dev Redis readiness gate contract..."

    if [[ ! -f .github/workflows/reusable-deploy.yml || ! -f .github/workflows/reusable-postdeploy-smoke.yml ]]; then
        log_info "Reusable deploy workflows not found (skipping Redis readiness gate checks)"
        return 0
    fi

    if ! python - <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as e:
    print(f"ERROR: pyyaml not available: {e}", file=sys.stderr)
    raise SystemExit(1)

reusable_path = Path('.github/workflows/reusable-deploy.yml')
smoke_path = Path('.github/workflows/reusable-postdeploy-smoke.yml')
reusable = yaml.safe_load(reusable_path.read_text(encoding='utf-8', errors='ignore')) or {}
smoke = yaml.safe_load(smoke_path.read_text(encoding='utf-8', errors='ignore')) or {}
errors = []

workflow_call = ((reusable.get('on') or reusable.get(True) or {}).get('workflow_call') or {})
inputs = workflow_call.get('inputs') or {}
secrets = workflow_call.get('secrets') or {}

redis_input = inputs.get('require_redis_readiness') or {}
if redis_input.get('type') != 'boolean':
    errors.append(f"{reusable_path.name}: workflow_call input require_redis_readiness must be boolean")
if redis_input.get('default') is not False:
    errors.append(f"{reusable_path.name}: workflow_call input require_redis_readiness must default to false")
if 'REDIS_URL' not in secrets:
    errors.append(f"{reusable_path.name}: workflow_call secrets must declare REDIS_URL")

jobs = reusable.get('jobs') or {}

def find_step(job_name, step_name):
    steps = (jobs.get(job_name) or {}).get('steps') or []
    return next((step for step in steps if isinstance(step, dict) and step.get('name') == step_name), None)

migrate_step = find_step('migrate', 'Run migrations via Docker with tunnel')
envfile_step = find_step('deploy-backend', 'Create Backend .env File Locally')
deploy_backend_step = find_step('deploy-backend', 'Deploy backend container')
migrate_secret_gate_step = find_step('migrate', 'Fail fast if required backend secrets are missing')
deploy_secret_gate_step = find_step('deploy-backend', 'Fail fast if required backend secrets are missing')
post_deploy_smoke = jobs.get('post-deploy-smoke') or {}

for label, step_obj in (
    ('jobs.migrate step Run migrations via Docker with tunnel', migrate_step),
    ('jobs.migrate step Fail fast if required backend secrets are missing', migrate_secret_gate_step),
    ('jobs.deploy-backend step Create Backend .env File Locally', envfile_step),
    ('jobs.deploy-backend step Fail fast if required backend secrets are missing', deploy_secret_gate_step),
    ('jobs.deploy-backend step Deploy backend container', deploy_backend_step),
):
    if step_obj is None:
        errors.append(f"{reusable_path.name}: missing {label}")

for label, step_obj in (
    ('jobs.migrate step Fail fast if required backend secrets are missing', migrate_secret_gate_step),
    ('jobs.deploy-backend step Fail fast if required backend secrets are missing', deploy_secret_gate_step),
):
    if step_obj is None:
        continue
    env_map = step_obj.get('env') or {}
    if env_map.get('REQUIRE_REDIS_READINESS') != '${{ inputs.require_redis_readiness }}':
        errors.append(
            f"{reusable_path.name}: {label} env.REQUIRE_REDIS_READINESS must be "
            "${{ inputs.require_redis_readiness }}"
        )

if migrate_step is not None:
    env_map = migrate_step.get('env') or {}
    for key, expected in {
        'REDIS_URL': '${{ secrets.REDIS_URL }}',
        'REQUIRE_REDIS_READINESS': '${{ inputs.require_redis_readiness }}',
    }.items():
        if env_map.get(key) != expected:
            errors.append(f"{reusable_path.name}: jobs.migrate step env.{key} must be {expected}")
    run_script = migrate_step.get('run') or ''
    required_tokens = [
        'REDIS_GATE_ARGS="--require-redis-readiness"',
        'python manage.py check_infrastructure $REDIS_GATE_ARGS',
        '-e REDIS_URL="$REDIS_URL"',
        '-e REQUIRE_REDIS_READINESS="$REQUIRE_REDIS_READINESS"',
    ]
    for token in required_tokens:
        if token not in run_script:
            errors.append(f"{reusable_path.name}: jobs.migrate step must include '{token}'")

if envfile_step is not None:
    run_script = envfile_step.get('run') or ''
    required_tokens = [
        'REDIS_URL=${{ secrets.REDIS_URL }}',
        'REQUIRE_REDIS_READINESS=${{ inputs.require_redis_readiness }}',
    ]
    for token in required_tokens:
        if token not in run_script:
            errors.append(f"{reusable_path.name}: jobs.deploy-backend Create Backend .env File must include '{token}'")

if deploy_backend_step is not None:
    env_map = deploy_backend_step.get('env') or {}
    if env_map.get('REQUIRE_REDIS_READINESS') != '${{ inputs.require_redis_readiness }}':
        errors.append(
            f"{reusable_path.name}: jobs.deploy-backend step Deploy backend container env.REQUIRE_REDIS_READINESS must be "
            "${{ inputs.require_redis_readiness }}"
        )
    run_script = deploy_backend_step.get('run') or ''
    for token in ('HEALTH_PATH="/api/v1/ready/"', 'REQUIRE_REDIS_READINESS'):
        if token not in run_script:
            errors.append(f"{reusable_path.name}: jobs.deploy-backend step must include '{token}'")

with_section = post_deploy_smoke.get('with') or {}
if with_section.get('require_redis_readiness') != '${{ inputs.require_redis_readiness }}':
    errors.append(
        f"{reusable_path.name}: jobs.post-deploy-smoke.with.require_redis_readiness must pass through "
        "${{ inputs.require_redis_readiness }}"
    )

smoke_inputs = (((smoke.get('on') or smoke.get(True) or {}).get('workflow_call') or {}).get('inputs') or {})
if (smoke_inputs.get('require_redis_readiness') or {}).get('type') != 'boolean':
    errors.append(f"{smoke_path.name}: workflow_call input require_redis_readiness must be boolean")

smoke_jobs = smoke.get('jobs') or {}
smoke_backend_steps = (smoke_jobs.get('smoke-backend-container') or {}).get('steps') or []
backend_step = next((step for step in smoke_backend_steps if isinstance(step, dict) and step.get('name') == 'Verify backend health (direct-to-container)'), None)
if backend_step is None:
    errors.append(f"{smoke_path.name}: missing smoke-backend-container backend verification step")
else:
    run_script = backend_step.get('run') or ''
    for token in ('${{ inputs.require_redis_readiness }}', 'URL="http://127.0.0.1:8000/api/v1/ready/"'):
        if token not in run_script:
            errors.append(f"{smoke_path.name}: backend smoke step must include '{token}'")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print('✓ Non-dev Redis readiness gate contract is enforced')
PY
    then
        return 1
    fi

    return 0
}

check_current_docs_manifest_path_drift() {
    log_info "Checking CURRENT docs use canonical env manifest path..."

    if ! python - <<'PY'
import sys
from pathlib import Path

bad_refs = []
for doc_path in Path('docs').rglob('*.md'):
    text = doc_path.read_text(encoding='utf-8', errors='ignore')
    lines = text.splitlines()
    header = '\n'.join(lines[:10])
    if '**Status**: ✅ CURRENT' not in header:
        continue

    for line_number, line in enumerate(lines, start=1):
        if 'config/env.manifest.json' in line:
            bad_refs.append(f"{doc_path}:{line_number}")

if bad_refs:
    for ref in bad_refs:
        print(
            f"ERROR: CURRENT docs must reference manifests/env.manifest.json, not legacy config/env.manifest.json ({ref})",
            file=sys.stderr,
        )
    raise SystemExit(1)

print('✓ CURRENT docs reference the canonical env manifest path')
PY
    then
        return 1
    fi

    return 0
}

check_current_docs_golden_pipeline_drift() {
    log_info "Checking CURRENT docs avoid forbidden Golden pipeline drift..."

    if ! python - <<'PY'
import sys
from pathlib import Path

rules = {
    'docs/reference/FRONTEND_ENVIRONMENT_VARIABLES.md': {
        'forbidden': [
            (
                'dev-backend.meatscentral.com',
                'Development frontend docs must use same-origin API routing (https://dev.meatscentral.com/api/v1).',
            ),
            (
                'frontend:latest',
                'Frontend deployment examples must use immutable image refs, not :latest.',
            ),
        ],
        'required': [
            (
                'https://dev.meatscentral.com/api/v1',
                'Development frontend docs must show the same-origin /api/v1 endpoint.',
            ),
        ],
    },
    'docs/reference/ENVIRONMENT_VARS.md': {
        'forbidden': [
            (
                'https://dev-backend.meatscentral.com',
                'Environment variable reference must not point frontend API examples at a separate dev-backend host.',
            ),
        ],
        'required': [
            (
                'https://dev.meatscentral.com/api/v1',
                'Environment variable reference must show the same-origin dev API base URL.',
            ),
        ],
    },
    'docs/guides/DEVELOPMENT_WORKFLOW.md': {
        'forbidden': [
            (
                'docker stack deploy -c docker-compose.prod.yml projectmeats',
                'Current development workflow docs must not recommend Docker Swarm/stack deploy for the Golden pipeline.',
            ),
        ],
    },
    'docs/reference/GOLDEN_PIPELINE.md': {
        'forbidden': [
            (
                'docker-compose up -d backend',
                'Reference Golden pipeline docs must not include compose-based remote deploy commands.',
            ),
            (
                'ALWAYS use `docker-compose` (hyphen) for other Docker management commands',
                'Reference Golden pipeline docs must align remote lifecycle guidance to docker pull/run/rm/exec commands.',
            ),
        ],
        'required': [
            (
                'manifests/env.manifest.json',
                'Reference Golden pipeline docs must point to the canonical manifests/env.manifest.json path.',
            ),
        ],
    },
}

errors = []
for rel_path, expectations in rules.items():
    path = Path(rel_path)
    if not path.exists():
        errors.append(f'{rel_path}: expected doc not found')
        continue

    text = path.read_text(encoding='utf-8', errors='ignore')
    header = '\n'.join(text.splitlines()[:10])
    if '**Status**: ✅ CURRENT' not in header and rel_path != 'docs/reference/GOLDEN_PIPELINE.md':
        continue

    for needle, message in expectations.get('forbidden', []):
        if needle in text:
            errors.append(f'{rel_path}: {message}')

    for needle, message in expectations.get('required', []):
        if needle not in text:
            errors.append(f'{rel_path}: {message}')

if errors:
    for error in errors:
        print(f'ERROR: {error}', file=sys.stderr)
    raise SystemExit(1)

print('✓ CURRENT docs avoid forbidden Golden pipeline drift')
PY
    then
        return 1
    fi

    return 0
}

check_ops_dr_workflow_alignment() {
    log_info "Checking ops workflow environment mapping and DR backup verification..."

    local failed=0

    if grep -Eq 'environment:[[:space:]]+\$\{\{ inputs\.environment \}\}-backend' .github/workflows/99-ops-management-command.yml; then
        log_error "99-ops-management-command.yml must map prod to production-backend explicitly"
        ((failed++))
    fi

    if grep -Eq 'environment:[[:space:]]+\$\{\{ inputs\.environment \}\}-backend' .github/workflows/98-ops-db-surgery.yml; then
        log_error "98-ops-db-surgery.yml must map prod to production-backend explicitly"
        ((failed++))
    fi

    if ! grep -q 'pg_restore --list' .github/workflows/reusable-deploy.yml; then
        log_error "reusable-deploy.yml must verify backup archives with pg_restore --list"
        ((failed++))
    fi

    if grep -Eq 'PROD_DB_|UAT_DB_|prod-backend' docs/guides/DATABASE_SYNC_GUIDE.md; then
        log_error "DATABASE_SYNC_GUIDE.md still contains stale secret names or non-canonical environment references"
        ((failed++))
    fi

    if [[ ! -f docs/runbooks/DISASTER_RECOVERY.md ]]; then
        log_error "docs/runbooks/DISASTER_RECOVERY.md is required for DR guidance"
        ((failed++))
    fi

    if [[ $failed -gt 0 ]]; then
        return 1
    fi

    log_info "✓ Ops workflows and DR docs are aligned"
    return 0
}

# Main validation
main() {
    log_info "========================================="
    log_info "GitHub Actions Workflow Validation"
    log_info "========================================="
    
    local failed=0
    
    check_no_archived_workflows_dir || ((failed++))
    validate_yaml_syntax || ((failed++))
    check_manifest_secrets_for_all_workflows || ((failed++))
    check_environment_lanes_match_manifest || ((failed++))
    check_reusable_workflow_required_secret_contract || ((failed++))
    check_validate_environment_manifest_mode || ((failed++))
    check_reusable_frontend_ssh_failfast || ((failed++))
    check_digest_artifact_alignment || ((failed++))
    check_reusable_workflow_callers || ((failed++))
    check_non_dev_redis_readiness_gate || ((failed++))
    check_current_docs_manifest_path_drift || ((failed++))
    check_current_docs_golden_pipeline_drift || ((failed++))
    check_ops_dr_workflow_alignment || ((failed++))
    check_cache_config || ((failed++))
    check_health_checks || ((failed++))
    check_fetch_depth || ((failed++))
    check_error_handling || ((failed++))
    check_timeouts || ((failed++))
    check_docker_port_bindings || ((failed++))
    check_golden_workflow_topology || ((failed++))
    check_retry_logic || ((failed++))
    check_migration_safety || ((failed++))
    check_concurrency || ((failed++))
    check_actions_pinned_to_sha || ((failed++))
    check_no_floating_action_refs || ((failed++))
    check_digest_pinned_workflow_images || ((failed++))
    check_immutable_deploy_tags || ((failed++))
    check_workflow_run_targets_exist || ((failed++))
    check_pr_validation_frontend_typecheck_gate || ((failed++))
    check_pr_validation_security_gates || ((failed++))
    check_env_separation || ((failed++))
    check_dependabot_auto_merge_scope || ((failed++))
    check_codeowners_security_overrides || ((failed++))
    
    log_info "========================================="
    
    if [[ $failed -gt 0 ]]; then
        log_error "Validation completed with $failed failures"
        return 1
    fi
    
    log_info "✓ All validations passed"
    log_info "========================================="
    return 0
}

main "$@"

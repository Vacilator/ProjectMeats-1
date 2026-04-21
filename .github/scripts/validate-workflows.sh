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
    shopt -s nullglob
    workflows=(.github/workflows/*-deployment.yml)
    shopt -u nullglob

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No *-deployment.yml workflows found (skipping cache checks)"
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
    shopt -s nullglob
    workflows=(.github/workflows/*-deployment.yml)
    shopt -u nullglob

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No *-deployment.yml workflows found (skipping health check discovery)"
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

    local workflows=()
    shopt -s nullglob
    workflows=(.github/workflows/*-deployment.yml)
    shopt -u nullglob

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No *-deployment.yml workflows found (skipping timeout checks)"
        return 0
    fi

    for workflow in "${workflows[@]}"; do
        if ! grep -q "timeout-minutes" "$workflow"; then
            log_warn "No timeout configured in $workflow"
        else
            log_info "✓ Timeout configured in $workflow"
        fi
    done

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

# Backend preflight: check migrations after backend tests.
assert_needs_exact('check-migrations', {'test-backend'})

# Tests gating is re-enabled: migrations are gated on BOTH backend and frontend test tracks.
assert_needs_exact('migrate', {'check-migrations', 'test-frontend'})

# Deploy backend is gated on migrations + its own security scan.
assert_needs_exact('deploy-backend', {'migrate', 'security-scan-backend'})

# Deploy frontend must synchronize on migrations, but must not depend on deploy-backend.
assert_needs_exact('deploy-frontend', {'migrate', 'test-frontend', 'security-scan-frontend'})

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

# Must use SSH tunnel (bastion) and bind to local 5433
if 'sshpass' not in run_text or '-L 5433:' not in run_text:
    print("ERROR: migrate must establish an SSH tunnel (-L 5433:...) using sshpass", file=sys.stderr)
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
    shopt -s nullglob
    workflows=(.github/workflows/*-deployment.yml)
    shopt -u nullglob

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No *-deployment.yml workflows found (skipping retry checks)"
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
    shopt -s nullglob
    workflows=(.github/workflows/*-deployment.yml)
    shopt -u nullglob

    if [[ ${#workflows[@]} -eq 0 ]]; then
        log_info "No *-deployment.yml workflows found (skipping concurrency checks)"
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

# Main validation
main() {
    log_info "========================================="
    log_info "GitHub Actions Workflow Validation"
    log_info "========================================="
    
    local failed=0
    
    validate_yaml_syntax || ((failed++))
    check_manifest_secrets_for_all_workflows || ((failed++))
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
    check_workflow_run_targets_exist || ((failed++))
    check_env_separation || ((failed++))
    
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

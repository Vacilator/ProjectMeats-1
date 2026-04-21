#!/usr/bin/env bash
# Lint Docker port bindings to prevent privileged host port usage (<1024)
# Scans:
#   - .github/workflows/*.yml|yaml (docker run -p ...)
#   - docker-compose*.yml|yaml     (ports: "HOST:CONTAINER")
set -euo pipefail

MIN_PORT=1024
FAILED=0

log_err() { echo "[lint-docker-ports][ERROR] $*" >&2; }
log_ok()  { echo "[lint-docker-ports][OK] $*"; }

list_files() {
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git ls-files \
      '.github/workflows/*.yml' '.github/workflows/*.yaml' \
      'docker-compose*.yml' 'docker-compose*.yaml' \
      2>/dev/null || true
  else
    find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null || true
    find . -maxdepth 1 -type f \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \) 2>/dev/null || true
  fi
}

check_host_port() {
  local file="$1"
  local line="$2"
  local host_port="$3"

  if ! [[ "$host_port" =~ ^[0-9]+$ ]]; then
    return 0
  fi

  if (( host_port > 0 && host_port < MIN_PORT )); then
    log_err "${file}: privileged host port binding detected: ${host_port} (<${MIN_PORT})"
    log_err "  line: ${line}"
    FAILED=1
  fi
}

scan_file() {
  local file="$1"

  # 1) docker run: -p 8080:80 or -p 127.0.0.1:8080:80
  while IFS= read -r match; do
    local line="${match#*:}"

    local host_port
    host_port="$(printf '%s\n' "$line" | sed -nE 's/.*[[:space:]]-p[[:space:]]+"?([0-9]{1,5}):.*/\1/p')"
    if [[ -n "${host_port:-}" ]]; then
      check_host_port "$file" "$line" "$host_port"
      continue
    fi

    host_port="$(printf '%s\n' "$line" | sed -nE 's/.*[[:space:]]-p[[:space:]]+"?([0-9]{1,3}(\.[0-9]{1,3}){3}):([0-9]{1,5}):.*/\3/p')"
    if [[ -n "${host_port:-}" ]]; then
      check_host_port "$file" "$line" "$host_port"
    fi
  done < <(grep -nE -- '[[:space:]]-p[[:space:]]+' "$file" 2>/dev/null || true)

  # 2) docker-compose ports: - "8080:80" or - 127.0.0.1:8080:80
  while IFS= read -r match; do
    local line="${match#*:}"
    local host_port
    host_port="$(printf '%s\n' "$line" | sed -nE 's/^[[:space:]]*-[[:space:]]*"?([0-9]{1,3}(\.[0-9]{1,3}){3}:)?([0-9]{1,5}):[0-9]{1,5}.*"?$/\3/p')"
    if [[ -n "${host_port:-}" ]]; then
      check_host_port "$file" "$line" "$host_port"
    fi
  done < <(grep -nE -- '^[[:space:]]*-[[:space:]]*"?([0-9]{1,3}(\.[0-9]{1,3}){3}:)?[0-9]{1,5}:[0-9]{1,5}' "$file" 2>/dev/null || true)
}

main() {
  local files
  files="$(list_files)"

  if [[ -z "${files:-}" ]]; then
    log_ok "No workflow/compose files found to scan (skipping)."
    exit 0
  fi

  while IFS= read -r f; do
    [[ -z "${f:-}" ]] && continue
    [[ -f "$f" ]] || continue
    scan_file "$f"
  done <<< "$files"

  if (( FAILED == 1 )); then
    exit 1
  fi

  log_ok "No privileged host port bindings detected."
}

main "$@"

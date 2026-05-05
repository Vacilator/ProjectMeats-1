#!/usr/bin/env bash
# Bundle the next unchecked AI task, schema digest, and rules into the clipboard.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EPIC_TICKETS_PATH="$ROOT_DIR/.github/EPIC_TICKETS.md"
CURSOR_RULES_PATH="$ROOT_DIR/.cursorrules"
SCHEMA_DIR="$ROOT_DIR/backend/apps/system/models"
OUTPUT_PATH="${AI_CONTEXT_BUNDLE_OUTPUT:-}"
SKIP_CLIPBOARD="${AI_CONTEXT_BUNDLE_SKIP_CLIPBOARD:-0}"

extract_next_ticket() {
  python - "$EPIC_TICKETS_PATH" <<'PY'
from pathlib import Path
import re
import sys

lines = Path(sys.argv[1]).read_text(encoding='utf-8').splitlines()
ticket_index = None
for idx, line in enumerate(lines):
    if re.match(r'- \[ \] ', line):
        ticket_index = idx
        break

if ticket_index is None:
    raise SystemExit('No unchecked ticket found in .github/EPIC_TICKETS.md')

phase_header = ''
epic_header = ''
for idx in range(ticket_index - 1, -1, -1):
    if not epic_header and lines[idx].startswith('### '):
        epic_header = lines[idx]
    if not phase_header and lines[idx].startswith('## '):
        phase_header = lines[idx]
    if phase_header and epic_header:
        break

end_index = len(lines)
for idx in range(ticket_index + 1, len(lines)):
    if re.match(r'- \[[ x]\] ', lines[idx]):
        end_index = idx
        break

sections = [value for value in (phase_header, epic_header) if value]
sections.extend(lines[ticket_index:end_index])
print('\n'.join(section.rstrip() for section in sections).strip())
PY
}

build_schema_digest() {
  python - "$SCHEMA_DIR" <<'PY'
from pathlib import Path
import re
import sys

schema_dir = Path(sys.argv[1])
if not schema_dir.exists():
    raise SystemExit('Golden schema directory is missing: backend/apps/system/models')

docstring_summary = ''
init_file = schema_dir / '__init__.py'
if init_file.exists():
    init_text = init_file.read_text(encoding='utf-8')
    match = re.search(r'"""(.*?)"""', init_text, re.DOTALL)
    if match:
        lines = [line.strip() for line in match.group(1).splitlines() if line.strip()]
        docstring_summary = ' '.join(lines[:4])

rows = []
for path in sorted(schema_dir.glob('*.py')):
    if path.name == '__init__.py':
        continue
    classes = re.findall(r'^class\s+([A-Za-z0-9_]+)\s*\(', path.read_text(encoding='utf-8'), re.MULTILINE)
    if classes:
        rows.append(f'- `{path.relative_to(schema_dir.parents[3])}`: {", ".join(classes)}')

if docstring_summary:
    print(f'Authority summary: {docstring_summary}\n')
print('Golden schema files:')
print('\n'.join(rows))
PY
}

copy_with_osc52() {
  python - "$1" <<'PY'
import base64
from pathlib import Path
import sys

data = Path(sys.argv[1]).read_text(encoding='utf-8').encode('utf-8')
sys.stdout.write(f'\033]52;c;{base64.b64encode(data).decode()}\a')
PY
}

copy_to_clipboard() {
  local source_file="$1"
  if [[ "$SKIP_CLIPBOARD" == "1" ]]; then
    return 0
  fi

  if command -v pbcopy >/dev/null 2>&1; then
    pbcopy < "$source_file"
    echo "Copied AI task bundle to clipboard via pbcopy."
    return 0
  fi

  if command -v clip.exe >/dev/null 2>&1; then
    clip.exe < "$source_file"
    echo "Copied AI task bundle to clipboard via clip.exe."
    return 0
  fi

  if command -v wl-copy >/dev/null 2>&1; then
    wl-copy < "$source_file"
    echo "Copied AI task bundle to clipboard via wl-copy."
    return 0
  fi

  if command -v xclip >/dev/null 2>&1; then
    xclip -selection clipboard < "$source_file"
    echo "Copied AI task bundle to clipboard via xclip."
    return 0
  fi

  if command -v xsel >/dev/null 2>&1; then
    xsel --clipboard --input < "$source_file"
    echo "Copied AI task bundle to clipboard via xsel."
    return 0
  fi

  if [[ -t 1 ]]; then
    copy_with_osc52 "$source_file"
    echo
    echo "Copied AI task bundle to clipboard via OSC52."
    return 0
  fi

  if [[ -w /dev/tty ]]; then
    copy_with_osc52 "$source_file" > /dev/tty
    printf '\nCopied AI task bundle to clipboard via OSC52.\n' > /dev/tty
    return 0
  fi

  echo "No supported clipboard command found (tried pbcopy, clip.exe, wl-copy, xclip, xsel, OSC52)." >&2
  return 1
}

NEXT_TICKET="$(extract_next_ticket)"
CURSOR_RULES="$(cat "$CURSOR_RULES_PATH")"
SCHEMA_DIGEST="$(build_schema_digest)"

BUNDLE_FILE="$(mktemp)"
trap 'rm -f "$BUNDLE_FILE"' EXIT

cat > "$BUNDLE_FILE" <<EOF
# PROJECTMEATS AI TASK BUNDLE

You are continuing work in ProjectMeats. Treat this bundle as your startup context.

## Mandatory reads before coding
1. Read \`.github/SDLC_PROTOCOLS.md\`.
2. Read \`.github/EPIC_TICKETS.md\`.
3. Use \`backend/apps/system/models/\` as the Golden Schema authority before proposing schema changes.
4. Follow the rules in \`.cursorrules\`.

## Core rules from .cursorrules
$CURSOR_RULES

## Active epic ticket
$NEXT_TICKET

## Golden schema digest
$SCHEMA_DIGEST

## Execution directive
- Do not invent schema or roadmap details.
- Preserve Golden Pipeline, tenant safety, and service-layer discipline.
- If you propose a major architectural change, generate a new ADR in \`docs/adr/\`.
EOF

if [[ -n "$OUTPUT_PATH" ]]; then
  cp "$BUNDLE_FILE" "$OUTPUT_PATH"
fi

copy_to_clipboard "$BUNDLE_FILE"
cat "$BUNDLE_FILE"

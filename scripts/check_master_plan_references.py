#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from fnmatch import fnmatch
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_PATTERN = re.compile(r"(?<![A-Za-z0-9_])(?:UI_)?ROADMAP\.md(?![A-Za-z0-9_])")
ALLOWED_PATTERNS = (
    "ROADMAP.md",
    "UI_ROADMAP.md",
    "MASTER_PLAN.md",
    ".github/MASTER_PLAN.md",
    ".github/copilot-instructions.md",
    ".github/instructions/copilot-squad.instructions.md",
    ".github/agents/projectmeats-documentation-steward.agent.md",
    ".copilot/**",
    "manifests/GOLDEN_FILES.md",
    "docs/plans/**",
    "docs/ROADMAP.md",
    "docs/WHATS_NEW.md",
    "docs/PHASE7_RECOVERY_COMPLETE.md",
    "docs/PROJECT_STATUS_REPORT_2026-02-09.md",
    "scripts/check_master_plan_references.py",
)
SKIP_PREFIXES = (".git/", "node_modules/", "_worktrees/")


def is_allowed(relative_path: str) -> bool:
    return any(fnmatch(relative_path, pattern) for pattern in ALLOWED_PATTERNS)


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def main() -> int:
    violations: list[str] = []

    for relative_path in tracked_files():
        if relative_path.startswith(SKIP_PREFIXES) or is_allowed(relative_path):
            continue

        file_path = REPO_ROOT / relative_path
        try:
            content = file_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        for line_number, line in enumerate(content.splitlines(), start=1):
            if REFERENCE_PATTERN.search(line):
                violations.append(f"{relative_path}:{line_number}:{line.strip()}")

    if violations:
        print("Found archived roadmap references outside the allowlist:", file=sys.stderr)
        for violation in violations:
            print(f"  {violation}", file=sys.stderr)
        print(
            "\nUse MASTER_PLAN.md for active planning/status links, or add a narrow archival allowlist entry "
            "in scripts/check_master_plan_references.py if the reference is intentionally historical.",
            file=sys.stderr,
        )
        return 1

    print("MASTER_PLAN reference guard passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

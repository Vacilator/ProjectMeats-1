#!/usr/bin/env python3
"""remove_debug_logging.py

Remove temporary [STAGING DEBUG] / [UAT DEBUG] logging blocks from middleware.

This script is a one-off helper and should be run from the repository root.

Usage:
  python scripts/maintenance/remove_debug_logging.py --help
  python scripts/maintenance/remove_debug_logging.py --middleware-file backend/apps/tenants/middleware.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def remove_debug_logging(middleware_file: Path, dry_run: bool) -> bool:
    backup_file = middleware_file.with_suffix(middleware_file.suffix + '.backup')

    if not middleware_file.exists():
        print(f'❌ Middleware file not found at {middleware_file}')
        return False

    original_content = middleware_file.read_text(encoding='utf-8')

    if not dry_run:
        print(f'Creating backup at {backup_file}...')
        backup_file.write_text(original_content, encoding='utf-8')

    lines = original_content.split('\n')
    cleaned_lines: list[str] = []
    skip_block = False
    block_indent: int | None = None

    for line in lines:
        # Start of debug host block
        if (
            'is_debug_host' in line
            and '=' in line
            and ('staging.meatscentral.com' in line or 'uat.meatscentral.com' in line)
        ):
            skip_block = True
            block_indent = len(line) - len(line.lstrip())
            continue

        if 'debug_prefix' in line and '=' in line and ('[STAGING DEBUG]' in line or '[UAT DEBUG]' in line):
            skip_block = True
            block_indent = len(line) - len(line.lstrip())
            continue

        if 'if is_debug_host:' in line:
            skip_block = True
            block_indent = len(line) - len(line.lstrip())
            continue

        if skip_block:
            current_indent = len(line) - len(line.lstrip())

            # Skip empty lines or deeper indentation
            if line.strip() == '' or (block_indent is not None and current_indent > block_indent):
                continue

            # Dedented: stop skipping and keep processing this line
            skip_block = False
            block_indent = None

        cleaned_lines.append(line)

    cleaned_content = '\n'.join(cleaned_lines)

    # Remove any remaining single-line debug statements
    cleaned_content = re.sub(
        r'\s*logger\.(info|error)\([^)]*\[(STAGING|UAT) DEBUG\][^)]*\)\s*',
        '',
        cleaned_content,
    )

    if dry_run:
        print('✓ Dry run: no files written')
        return True

    middleware_file.write_text(cleaned_content, encoding='utf-8')

    print(f'✓ Debug logging removed from {middleware_file}')
    print(f'✓ Backup saved to {backup_file}')
    print('\nNext steps:')
    print(f'1. Review the changes: git diff {middleware_file}')
    print('2. Test the application to ensure it still works')
    print("3. Commit the changes: git add <file> && git commit -m 'Remove temporary debug logging'")
    print(f'4. Remove backup if satisfied: rm {backup_file}')

    return True


def main() -> int:
    parser = argparse.ArgumentParser(description='Remove temporary staging/UAT debug logging blocks.')
    parser.add_argument(
        '--middleware-file',
        type=Path,
        default=Path('backend/apps/tenants/middleware.py'),
        help='Path to tenants middleware.py (default: backend/apps/tenants/middleware.py)',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Do not write any files; only validate that the file can be read',
    )

    args = parser.parse_args()

    try:
        ok = remove_debug_logging(args.middleware_file, args.dry_run)
        return 0 if ok else 1
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback

        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

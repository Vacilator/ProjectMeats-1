#!/usr/bin/env python3
"""ProjectMeats Environment & Secret Manager.

Canonical source of truth:
- manifests/env.manifest.json (v5.x)

Legacy fallback (supported for older checkouts):
- config/env.manifest.json

This tool audits GitHub Secrets (repository + environment-scoped) against the
manifest requirements.

Notes:
- This tool never prints secret VALUES.
- By default it prints only missing/zombie secret NAMES (actionable), not the
  full inventory of configured secrets.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple


REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_CANDIDATES = [
    REPO_ROOT / 'manifests' / 'env.manifest.json',  # canonical (v5.x)
    Path(__file__).resolve().parent / 'env.manifest.json',  # legacy
]


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    END = '\033[0m'
    BOLD = '\033[1m'


def _parse_major_version(version_value: Any) -> int:
    """Parse manifest version into a major integer (best effort)."""
    if version_value is None:
        return 0
    try:
        s = str(version_value).strip()
        major = s.split('.', 1)[0]
        return int(major)
    except Exception:
        return 0


class EnvironmentManager:
    def __init__(self, manifest_path: Optional[Path] = None):
        self.manifest_path, self.manifest = self._load_manifest(manifest_path)
        self.manifest_version = self.manifest.get('version')
        self.manifest_major = _parse_major_version(self.manifest_version)

    def _load_manifest(self, manifest_path: Optional[Path]) -> Tuple[Path, Dict[str, Any]]:
        candidates = [manifest_path] if manifest_path else []
        candidates.extend(MANIFEST_CANDIDATES)

        for candidate in candidates:
            if not candidate:
                continue
            if candidate.exists():
                with candidate.open('r', encoding='utf-8') as f:
                    return candidate, json.load(f)

        print(f"{Colors.RED}CRITICAL: Manifest not found. Tried:{Colors.END}")
        for c in MANIFEST_CANDIDATES:
            print(f"  - {c}")
        sys.exit(1)

    def _get_secrets(self, env_name: Optional[str] = None) -> Set[str]:
        """Fetch secret names from GitHub via gh.

        - env_name=None => repository secrets
        - env_name=str  => environment secrets for that environment
        """
        cmd = ['gh', 'secret', 'list', '--json', 'name', '-q', '.[].name']
        if env_name:
            cmd.extend(['--env', env_name])

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return set(filter(None, result.stdout.strip().split('\n')))
        except subprocess.CalledProcessError:
            # Environment might not exist or have no secrets yet
            return set()
        except FileNotFoundError:
            print(f"{Colors.RED}Error: GitHub CLI ('gh') is not installed.{Colors.END}")
            sys.exit(1)

    def _manifest_all_secret_names_v5(self) -> Tuple[Set[str], Set[str]]:
        repo_defs = self.manifest.get('repository_secrets', {})
        env_defs = self.manifest.get('environment_secrets', {})

        repo_names = set(repo_defs.keys())
        env_names: Set[str] = set()
        for category_vars in env_defs.values():
            env_names |= set(category_vars.keys())
        return repo_names, env_names

    def _required_repo_secrets_v5(self) -> Set[str]:
        repo_defs = self.manifest.get('repository_secrets', {})
        return {name for name, d in repo_defs.items() if d.get('required', False)}

    def _required_env_secrets_for_env_v5(self, env_key: str, env_cfg: Dict[str, Any]) -> Set[str]:
        env_type = env_cfg.get('type')
        env_defs = self.manifest.get('environment_secrets', {})

        required: Set[str] = set()
        for _category, vars_in_cat in env_defs.items():
            for secret_name, secret_def in vars_in_cat.items():
                if not secret_def.get('required', False):
                    continue

                applies_to = secret_def.get('applies_to')
                if not applies_to:
                    required.add(secret_name)
                    continue

                applies = False
                for item in applies_to:
                    if item == env_key:
                        applies = True
                        break
                    if item == 'backend environments' and env_type == 'backend':
                        applies = True
                        break
                    if item == 'frontend environments' and env_type == 'frontend':
                        applies = True
                        break

                if applies:
                    required.add(secret_name)

        return required

    def audit_secrets(self, exit_on_error: bool = True, verbose: bool = False):
        """Audit GitHub secrets against manifest requirements."""
        print(
            f"{Colors.BOLD}Starting Secret Audit (manifest v{self.manifest_version}, "
            f"loaded from {self.manifest_path})...{Colors.END}\n"
        )

        if self.manifest_major >= 5:
            return self._audit_v5(exit_on_error=exit_on_error, verbose=verbose)

        print(
            f"{Colors.RED}Unsupported manifest version: {self.manifest_version}. "
            f"Expected v5.x manifest at manifests/env.manifest.json.{Colors.END}"
        )
        if exit_on_error:
            sys.exit(1)
        return {'passed': False, 'reason': 'unsupported_manifest_version'}

    def _audit_v5(self, exit_on_error: bool, verbose: bool):
        environments = self.manifest.get('environments', {})
        required_repo = self._required_repo_secrets_v5()
        all_repo_names, all_env_names = self._manifest_all_secret_names_v5()
        all_manifest_names = all_repo_names | all_env_names

        repo_present = self._get_secrets(None)
        print(f"{Colors.CYAN}✓ Fetched {len(repo_present)} repository secret(s){Colors.END}")

        missing_any = False

        missing_repo = sorted(required_repo - repo_present)
        zombie_repo = sorted(repo_present - all_manifest_names)

        if missing_repo:
            missing_any = True
            print(f"\n{Colors.RED}❌ Missing required repository secrets ({len(missing_repo)}):{Colors.END}")
            for s in missing_repo:
                print(f"  • {Colors.BOLD}{s}{Colors.END}")
        else:
            print(f"{Colors.GREEN}✓ Required repository secrets present ({len(required_repo)}){Colors.END}")

        if zombie_repo:
            print(f"\n{Colors.YELLOW}🧟 Zombie repository secrets (not in manifest) ({len(zombie_repo)}):{Colors.END}")
            for s in zombie_repo:
                print(f"  • {Colors.BOLD}{s}{Colors.END}")

        env_results = {}
        for env_key, env_cfg in environments.items():
            gh_env = env_cfg.get('github_environment') or env_key
            env_present = self._get_secrets(gh_env)

            required_env = self._required_env_secrets_for_env_v5(env_key, env_cfg)
            available = env_present | repo_present

            missing_env = sorted(required_env - available)
            zombie_env = sorted(env_present - all_env_names)

            env_results[env_key] = {
                'github_environment': gh_env,
                'type': env_cfg.get('type'),
                'required_env': sorted(required_env),
                'missing': missing_env,
                'zombie': zombie_env,
            }

            print(f"\n{Colors.BOLD}Environment: {env_key}{Colors.END} (gh env: {gh_env})")
            print(f"  Required env secrets: {len(required_env)}")
            print(f"  Environment secrets present: {len(env_present)}")

            if missing_env:
                missing_any = True
                print(f"  {Colors.RED}❌ Missing ({len(missing_env)}):{Colors.END}")
                for s in missing_env:
                    print(f"    • {Colors.BOLD}{s}{Colors.END}")
            else:
                print(f"  {Colors.GREEN}✅ All required secrets present{Colors.END}")

            if zombie_env:
                print(f"  {Colors.YELLOW}🧟 Zombie env secrets ({len(zombie_env)}):{Colors.END}")
                for s in zombie_env:
                    print(f"    • {Colors.BOLD}{s}{Colors.END}")

            if verbose:
                # Only in verbose mode do we print inventory-ish info.
                print(f"  Available secrets (repo + env): {len(available)}")

        print(f"\n{Colors.BOLD}{'=' * 70}{Colors.END}")
        if missing_any:
            print(f"{Colors.RED}❌ AUDIT FAILED{Colors.END}")
            if exit_on_error:
                sys.exit(1)
        else:
            print(f"{Colors.GREEN}✅ AUDIT PASSED{Colors.END}")

        return {
            'passed': not missing_any,
            'manifest_path': str(self.manifest_path),
            'manifest_version': self.manifest_version,
            'missing_repo': missing_repo,
            'zombie_repo': zombie_repo,
            'environments': env_results,
        }


def main():
    parser = argparse.ArgumentParser(description='Environment & Secret Manager')
    parser.add_argument('command', choices=['audit'], help='Command to run')
    parser.add_argument(
        '--no-exit',
        action='store_true',
        help='Do not exit non-zero on missing required secrets (report only).',
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Print additional diagnostic information (never prints secret values).',
    )
    parser.add_argument(
        '--manifest',
        type=str,
        default=None,
        help='Optional path to a manifest JSON file (overrides default search).',
    )

    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve() if args.manifest else None
    manager = EnvironmentManager(manifest_path=manifest_path)

    if args.command == 'audit':
        manager.audit_secrets(exit_on_error=not args.no_exit, verbose=args.verbose)


if __name__ == '__main__':
    main()

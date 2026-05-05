#!/usr/bin/env python3
"""AI-backed pull request gatekeeper for Golden Rule violations."""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error, parse, request


MARKER = '<!-- ai-pr-gatekeeper -->'
BOT_LOGIN = 'github-actions[bot]'
MAX_DIFF_CHARS = 90_000
ALLOWED_RULE_IDS = (
    'DYNAMIC_FORM_USEQUERIES',
    'MODAL_COMPLEX_FORM',
    'UNMEMOIZED_USEEFFECT_ARRAY',
)
FRONTEND_CODE_EXTENSIONS = ('.ts', '.tsx', '.js', '.jsx')


@dataclass(frozen=True)
class Finding:
    rule_id: str
    summary: str
    evidence: str


def load_text(path: str) -> str:
    return Path(path).read_text(encoding='utf-8').strip()


def require_env(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError(f'Missing required environment variable: {name}')
    return value


def read_event_payload() -> dict[str, Any]:
    event_path = require_env('GITHUB_EVENT_PATH')
    return json.loads(Path(event_path).read_text(encoding='utf-8'))


def github_request(method: str, path: str, *, token: str, data: dict[str, Any] | None = None) -> Any:
    api_base = os.environ.get('GITHUB_API_URL', 'https://api.github.com').rstrip('/')
    url = f'{api_base}{path}'
    payload = None
    headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': f'Bearer {token}',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'projectmeats-ai-pr-gatekeeper',
    }
    if data is not None:
        payload = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = request.Request(url, data=payload, headers=headers, method=method)
    try:
        with request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            return json.loads(body) if body else None
    except error.HTTPError as exc:  # pragma: no cover - exercised via workflow
        detail = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'GitHub API {method} {path} failed: {exc.code} {detail}') from exc


def fetch_pull_files(repo: str, pull_number: int, token: str) -> list[dict[str, Any]]:
    page = 1
    files: list[dict[str, Any]] = []
    while True:
        query = parse.urlencode({'per_page': 100, 'page': page})
        batch = github_request(
            'GET',
            f'/repos/{repo}/pulls/{pull_number}/files?{query}',
            token=token,
        )
        if not isinstance(batch, list):
            raise RuntimeError('Pull request files response had an invalid shape.')
        files.extend(batch)
        if len(batch) < 100:
            return files
        page += 1


def extract_message_text(message: Any) -> str:
    content = getattr(message, 'content', '')
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        fragments: list[str] = []
        for item in content:
            if isinstance(item, str):
                fragments.append(item)
            elif isinstance(item, dict):
                text = item.get('text')
                if isinstance(text, str):
                    fragments.append(text)
        return '\n'.join(fragment for fragment in fragments if fragment)
    return str(content or '')


def is_frontend_code_path(path: str) -> bool:
    return path.startswith('frontend/') and path.endswith(FRONTEND_CODE_EXTENSIONS)


def added_lines(patch: str) -> str:
    return '\n'.join(
        line[1:]
        for line in patch.splitlines()
        if line.startswith('+') and not line.startswith('+++')
    )


def build_diff_payload(files: list[dict[str, Any]]) -> str:
    sections: list[str] = []
    current_size = 0
    for file_info in files:
        patch = str(file_info.get('patch') or '').strip()
        if not patch:
            continue
        filename = str(file_info.get('filename') or '')
        section = (
            f'### {filename}\n'
            f'Status: {file_info.get("status")}\n'
            f'Additions: {file_info.get("additions")} | Deletions: {file_info.get("deletions")}\n'
            f'```diff\n{patch}\n```\n'
        )
        if current_size + len(section) > MAX_DIFF_CHARS:
            break
        sections.append(section)
        current_size += len(section)
    return '\n'.join(sections)


def has_unmemoized_useeffect_dependency_literal(patch: str) -> bool:
    compact = re.sub(r'\s+', '', patch)
    search_start = 0
    while True:
        effect_index = compact.find('useEffect(', search_start)
        if effect_index == -1:
            return False
        depth = 1
        index = effect_index + len('useEffect(')
        dependency_start = -1
        while index < len(compact) and depth > 0:
            char = compact[index]
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
            elif char == '[' and depth == 1 and index > 0 and compact[index - 1] == ',':
                dependency_start = index
                break
            index += 1
        if dependency_start == -1:
            search_start = effect_index + len('useEffect(')
            continue

        bracket_depth = 1
        dependency_end = dependency_start + 1
        while dependency_end < len(compact) and bracket_depth > 0:
            char = compact[dependency_end]
            if char == '[':
                bracket_depth += 1
            elif char == ']':
                bracket_depth -= 1
            dependency_end += 1

        dependency_inner = compact[dependency_start + 1 : dependency_end - 1]
        if '[' in dependency_inner or '{' in dependency_inner:
            return True
        search_start = dependency_end


def collect_deterministic_findings(files: list[dict[str, Any]]) -> list[Finding]:
    findings: list[Finding] = []
    for file_info in files:
        filename = str(file_info.get('filename') or '')
        patch = str(file_info.get('patch') or '')
        if not patch or not is_frontend_code_path(filename):
            continue
        added = added_lines(patch)
        combined = f'{filename}\n{patch}'
        if 'useQueries' in added and re.search(r'DynamicForm|UniversalEntityForm|EntityFormSurface|schema', combined, re.IGNORECASE):
            findings.append(
                Finding(
                    rule_id='DYNAMIC_FORM_USEQUERIES',
                    summary='`useQueries` was added inside a dynamic-form context.',
                    evidence=f'{filename}: added `useQueries` alongside dynamic-form markers.',
                )
            )
        if ('<Modal' in added or 'Modal.' in added) and (
            len(re.findall(r'Form\.Item', patch)) >= 3 or re.search(r'dynamic schema|DynamicForm|UniversalEntityForm', combined, re.IGNORECASE)
        ):
            findings.append(
                Finding(
                    rule_id='MODAL_COMPLEX_FORM',
                    summary='A modal-wrapped complex form was introduced.',
                    evidence=f'{filename}: modal usage appears next to multi-field or dynamic-form code.',
                )
            )
        if has_unmemoized_useeffect_dependency_literal(patch):
            findings.append(
                Finding(
                    rule_id='UNMEMOIZED_USEEFFECT_ARRAY',
                    summary='A `useEffect` dependency array includes a fresh array or object literal.',
                    evidence=f'{filename}: added `useEffect` dependency array contains a nested literal.',
                )
            )
    return findings


def load_system_prompt() -> str:
    cursorrules = load_text('.cursorrules')
    sdlc_protocols = load_text('.github/SDLC_PROTOCOLS.md')
    return (
        'You are the ProjectMeats AI PR Gatekeeper. Review only the provided pull request diff.\n'
        'Use the authoritative rules below and reject only when the violation is clearly present in the diff.\n'
        'Focus on these hard-fail conditions:\n'
        '1. `useQueries` inside a dynamic form context.\n'
        '2. Complex form elements wrapped directly in an Ant Design `<Modal>` instead of the Air Gap component-swap pattern.\n'
        '3. Unmemoized arrays or inline objects passed to React `useEffect` dependency arrays.\n\n'
        'Return JSON only using the provided schema. If no violation is present, set approved=true and findings=[].\n\n'
        f'.cursorrules:\n{cursorrules}\n\n'
        f'.github/SDLC_PROTOCOLS.md:\n{sdlc_protocols}\n'
    )


def run_ai_review(*, diff_payload: str, pull_title: str, pull_body: str) -> list[Finding]:
    openai_api_key = require_env('OPENAI_API_KEY')
    from openai import OpenAI

    client = OpenAI(
        api_key=openai_api_key,
        organization=os.environ.get('OPENAI_ORG_ID') or None,
    )
    response_schema = {
        'type': 'json_schema',
        'json_schema': {
            'name': 'ai_pr_gatekeeper_review',
            'strict': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'approved': {'type': 'boolean'},
                    'findings': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'rule_id': {'type': 'string', 'enum': list(ALLOWED_RULE_IDS)},
                                'summary': {'type': 'string'},
                                'evidence': {'type': 'string'},
                            },
                            'required': ['rule_id', 'summary', 'evidence'],
                            'additionalProperties': False,
                        },
                    },
                },
                'required': ['approved', 'findings'],
                'additionalProperties': False,
            },
        },
    }
    completion = client.chat.completions.create(
        model=os.environ.get('AI_PR_REVIEW_MODEL') or os.environ.get('OPENAI_MODEL') or 'gpt-4o-mini',
        temperature=0,
        response_format=response_schema,
        messages=[
            {'role': 'system', 'content': load_system_prompt()},
            {
                'role': 'user',
                'content': (
                    f'PR title: {pull_title}\n\n'
                    f'PR body:\n{pull_body or "(empty)"}\n\n'
                    'Review the diff below against the hard-fail conditions only.\n'
                    f'{diff_payload}'
                ),
            },
        ],
    )
    message = completion.choices[0].message if completion.choices else None
    content = extract_message_text(message).strip()
    if not content:
        raise RuntimeError('AI PR gatekeeper returned an empty response.')
    parsed = json.loads(content)
    findings: list[Finding] = []
    for item in parsed.get('findings', []):
        rule_id = str(item.get('rule_id') or '').strip()
        if rule_id not in ALLOWED_RULE_IDS:
            continue
        findings.append(
            Finding(
                rule_id=rule_id,
                summary=str(item.get('summary') or '').strip(),
                evidence=str(item.get('evidence') or '').strip(),
            )
        )
    return findings


def dedupe_findings(*groups: list[Finding]) -> list[Finding]:
    seen: set[tuple[str, str, str]] = set()
    merged: list[Finding] = []
    for group in groups:
        for finding in group:
            key = (finding.rule_id, finding.summary, finding.evidence)
            if key in seen:
                continue
            seen.add(key)
            merged.append(finding)
    return merged


def build_review_body(findings: list[Finding], head_sha: str) -> str:
    lines = [
        MARKER,
        '## AI PR Gatekeeper rejection',
        '',
        f'Head SHA: `{head_sha}`',
        '',
        'This pull request violates one or more Golden Rule hard-fail conditions:',
    ]
    for finding in findings:
        lines.extend(
            [
                '',
                f'- **{finding.rule_id}**: {finding.summary}',
                f'  - Evidence: {finding.evidence}',
            ]
        )
    lines.extend(
        [
            '',
            'Fix the violations and push again. The gatekeeper will automatically dismiss this review after a clean re-scan.',
        ]
    )
    return '\n'.join(lines)


def list_reviews(repo: str, pull_number: int, token: str) -> list[dict[str, Any]]:
    reviews = github_request('GET', f'/repos/{repo}/pulls/{pull_number}/reviews', token=token)
    if not isinstance(reviews, list):
        raise RuntimeError('Pull request reviews response had an invalid shape.')
    return reviews


def dismiss_stale_reviews(repo: str, pull_number: int, token: str, head_sha: str) -> None:
    for review in list_reviews(repo, pull_number, token):
        user_login = str((review.get('user') or {}).get('login') or '')
        body = str(review.get('body') or '')
        state = str(review.get('state') or '').upper()
        review_id = review.get('id')
        if user_login != BOT_LOGIN or MARKER not in body or state != 'CHANGES_REQUESTED' or not review_id:
            continue
        github_request(
            'PUT',
            f'/repos/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
            token=token,
            data={'message': f'AI PR Gatekeeper re-scan passed for `{head_sha}`.'},
        )


def ensure_change_request_review(repo: str, pull_number: int, token: str, head_sha: str, body: str) -> None:
    for review in reversed(list_reviews(repo, pull_number, token)):
        user_login = str((review.get('user') or {}).get('login') or '')
        existing_body = str(review.get('body') or '')
        state = str(review.get('state') or '').upper()
        if user_login != BOT_LOGIN or MARKER not in existing_body or state != 'CHANGES_REQUESTED':
            continue
        review_id = review.get('id')
        if existing_body == body:
            return
        if review_id:
            github_request(
                'PUT',
                f'/repos/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
                token=token,
                data={'message': f'Replacing stale AI PR Gatekeeper review for `{head_sha}`.'},
            )
    github_request(
        'POST',
        f'/repos/{repo}/pulls/{pull_number}/reviews',
        token=token,
        data={
            'event': 'REQUEST_CHANGES',
            'commit_id': head_sha,
            'body': body,
        },
    )


def main() -> int:
    token = require_env('GITHUB_TOKEN')
    repo = require_env('GITHUB_REPOSITORY')
    event = read_event_payload()
    pull_number = int(os.environ.get('PR_NUMBER') or (event.get('pull_request') or {}).get('number') or 0)
    if pull_number <= 0:
        raise RuntimeError('PR number is missing from the workflow context.')

    pull = github_request('GET', f'/repos/{repo}/pulls/{pull_number}', token=token)
    if not isinstance(pull, dict):
        raise RuntimeError('Pull request metadata response had an invalid shape.')
    head_sha = str(((pull.get('head') or {}).get('sha')) or '')
    if not head_sha:
        raise RuntimeError('Pull request head SHA is missing.')

    files = fetch_pull_files(repo, pull_number, token)
    diff_payload = build_diff_payload(files)
    if not diff_payload:
        dismiss_stale_reviews(repo, pull_number, token, head_sha)
        print('No textual diff payload was available for AI review.')
        return 0

    local_findings = collect_deterministic_findings(files)
    ai_findings = run_ai_review(
        diff_payload=diff_payload,
        pull_title=str(pull.get('title') or ''),
        pull_body=str(pull.get('body') or ''),
    )
    findings = dedupe_findings(local_findings, ai_findings)
    if findings:
        review_body = build_review_body(findings, head_sha)
        ensure_change_request_review(repo, pull_number, token, head_sha, review_body)
        print(review_body)
        return 1

    dismiss_stale_reviews(repo, pull_number, token, head_sha)
    print('AI PR Gatekeeper approved the diff.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - workflow-only failure path
        print(f'AI PR Gatekeeper failed: {exc}', file=sys.stderr)
        raise SystemExit(1) from exc

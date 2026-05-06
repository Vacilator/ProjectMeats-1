from __future__ import annotations

import hmac
import json
from hashlib import sha256
from typing import Any


def stable_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(',', ':'), sort_keys=True, default=str)


def sign_timestamped_body(secret: str, timestamp: str, body: str | bytes) -> str:
    body_bytes = body if isinstance(body, bytes) else body.encode('utf-8')
    message = f'{timestamp}.'.encode('utf-8') + body_bytes
    digest = hmac.new(secret.encode('utf-8'), msg=message, digestmod=sha256).hexdigest()
    return f'v1={digest}'


def verify_timestamped_signature(secret: str, timestamp: str, body: bytes, signature: str) -> bool:
    expected = sign_timestamped_body(secret, timestamp, body)
    return hmac.compare_digest(expected, signature)

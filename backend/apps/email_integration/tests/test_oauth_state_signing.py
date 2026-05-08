from django.core.signing import BadSignature
from django.test import TestCase

from apps.email_integration.views.oauth_views import _sign_oauth_state, _unsign_oauth_state


class OAuthStateSigningTests(TestCase):
    def test_signed_state_round_trips(self):
        state = _sign_oauth_state({"user_id": 123, "tenant_id": "tenant-1", "provider": "gmail"})
        payload = _unsign_oauth_state(state)
        self.assertEqual(payload.get("user_id"), 123)
        self.assertEqual(payload.get("tenant_id"), "tenant-1")
        self.assertEqual(payload.get("provider"), "gmail")

    def test_signed_state_rejects_tampering(self):
        state = _sign_oauth_state({"user_id": 123, "tenant_id": "tenant-1", "provider": "outlook"})
        tampered = state[:-1] + ("a" if state[-1] != "a" else "b")
        with self.assertRaises(BadSignature):
            _unsign_oauth_state(tampered)

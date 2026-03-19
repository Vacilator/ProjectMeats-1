# Guest Mode Implementation

## Overview

Guest mode allows unauthenticated users to browse a ProjectMeats workspace in **read-only** mode without creating an account. This is useful for:

- Vendor/supplier self-service portals
- Public product catalogue viewing
- Demo environments for sales teams
- Auditor access without account creation

---

## Architecture

### Backend: Guest Session API

Guest sessions are short-lived, tenant-scoped tokens issued by the backend. They do not create Django user objects.

#### Endpoint

```
POST /api/v1/auth/guest-session/
```

**Request body:**
```json
{
  "tenant_slug": "acme-meats",
  "access_code": "PUBLIC123"   // optional, required when tenant has guest_require_code=true
}
```

**Success response (200):**
```json
{
  "guest_token": "gt_abc123...",
  "tenant_id": "uuid-...",
  "tenant_name": "ACME Meats",
  "tenant_slug": "acme-meats",
  "expires_at": "2026-03-19T19:49:10Z",
  "permissions": ["view_workforms", "view_customers", "view_products"]
}
```

**Error responses:**
- `404` – Tenant not found
- `403` – Guest access disabled for this tenant, or invalid access code

#### Token Lifetime

Guest tokens expire after **24 hours** by default. Tenants can configure shorter expiry via `settings.guest_session_ttl_hours`.

#### Authentication Header

Guest requests use a distinct scheme to differentiate from regular users:

```
Authorization: GuestToken gt_abc123...
```

#### Tenant Settings

Tenant admins control guest access via the tenant `settings` JSONB field:

| Setting key                  | Type    | Default | Description                          |
|------------------------------|---------|---------|--------------------------------------|
| `guest_access_enabled`       | boolean | `false` | Master switch for guest mode         |
| `guest_require_code`         | boolean | `false` | Require an access code               |
| `guest_access_code`          | string  | `null`  | The required access code (hashed)    |
| `guest_session_ttl_hours`    | integer | `24`    | Session lifetime in hours            |
| `guest_permissions`          | list    | `[]`    | Explicit permission list for guests  |

#### Django Permission Checking

A custom DRF permission class enforces guest restrictions:

```python
# backend/apps/core/permissions.py

class IsAuthenticatedOrGuest(BasePermission):
    """Allows fully authenticated users and valid guest sessions."""

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True
        guest_token = self._extract_guest_token(request)
        if guest_token:
            return self._validate_guest_token(guest_token, request)
        return False

    def _extract_guest_token(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if auth.startswith('GuestToken '):
            return auth[len('GuestToken '):]
        return None

    def _validate_guest_token(self, token, request):
        from apps.tenants.models import GuestSessionToken
        try:
            session = GuestSessionToken.objects.get(token=token, is_active=True)
            if session.is_expired():
                return False
            request.tenant = session.tenant
            request.is_guest = True
            request.guest_permissions = session.permissions
            return True
        except GuestSessionToken.DoesNotExist:
            return False
```

#### Read-Only Enforcement

ViewSets that support guest access use `IsAuthenticatedOrGuest` and block mutations for guest sessions:

```python
class WorkFormViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrGuest]

    def get_permissions(self):
        if getattr(self.request, 'is_guest', False):
            if self.action not in ('list', 'retrieve'):
                raise PermissionDenied("Guests have read-only access.")
        return super().get_permissions()
```

---

## Mobile Implementation

### Screens

| Screen             | File                                      | Purpose                                 |
|--------------------|-------------------------------------------|-----------------------------------------|
| `GuestLoginScreen` | `mobile/src/screens/GuestLoginScreen.tsx` | Workspace name + optional access code  |
| `WorkFormsScreen`  | `mobile/src/screens/WorkFormsScreen.tsx`  | List workforms (read-only for guests)   |
| `HomeScreen`       | `mobile/src/screens/HomeScreen.tsx`       | Dashboard (limited for guests)          |

### Navigation Flow

```
LoginScreen
  └── "Browse as Guest" button
        └── GuestLoginScreen
              └── [POST /auth/guest-session/]
                    └── HomeScreen (isGuest=true)
                          └── WorkForms button → WorkFormsScreen (isGuest=true)
```

### Guest State in App.tsx

```typescript
const [isGuest, setIsGuest] = useState(false);
const [guestSession, setGuestSession] = useState<GuestSession | null>(null);

const handleGuestLogin = (session: GuestSession) => {
  // Build a minimal Tenant object from the session data
  const guestTenant: Tenant = { id: session.tenant_id, ... };
  setGuestSession(session);
  setCurrentTenant(guestTenant);
  setIsGuest(true);
  setIsAuthenticated(true);   // reuses same auth-gating logic
};
```

### API Token Header

```typescript
// ApiService.ts
setGuestToken(guestToken: string) {
  this.api.defaults.headers.common['Authorization'] = `GuestToken ${guestToken}`;
}
```

### Guest UX Indicators

- Orange **GUEST** badge in `WorkFormsScreen` header
- Orange sticky footer: "Browsing as guest · Read-only access"
- "View only" label on each workform card
- Alert explaining read-only limitations when user taps a workform
- "Switch Organization" button signs out entirely (no tenant-switching for guests)

---

## Web Frontend Implementation

Guest mode is gated behind the same backend session token. The web app should:

1. Accept a `?guest_token=...` query parameter on protected routes
2. Store the token in `sessionStorage` (not `localStorage`) so it clears on tab close
3. Hide write-action buttons (Create, Edit, Delete) when `isGuest === true`
4. Show a dismissible banner: "You are browsing as a guest (read-only)"

---

## Security Considerations

- Guest tokens are **single-tenant** and cannot be used to access other workspaces
- Tokens are stored in-memory only on mobile (not in AsyncStorage)
- The `GuestSessionToken` Django model should include `tenant`, `token` (hashed), `expires_at`, `created_from_ip`, and `is_active`
- Rate-limit the `POST /auth/guest-session/` endpoint to prevent brute-force of access codes
- Rotate the token on each session start (tokens are one-time-use by session, not reusable)

---

## Testing

### Unit Tests

```typescript
// mobile/src/screens/__tests__/GuestLoginScreen.test.tsx
it('shows error when tenant not found (404)', async () => { ... });
it('shows error when access code is wrong (403)', async () => { ... });
it('calls onGuestLogin with session data on success', async () => { ... });
```

### Backend Tests

```python
# backend/apps/tenants/tests/test_guest_session.py
class GuestSessionTests(APITestCase):
    def test_guest_session_created_successfully(self): ...
    def test_guest_session_rejected_when_disabled(self): ...
    def test_guest_session_requires_access_code(self): ...
    def test_guest_session_expired(self): ...
    def test_guest_cannot_mutate_data(self): ...
```

---

## Future Enhancements

- [ ] Web frontend guest banner and read-only enforcement
- [ ] Configurable per-entity permissions (e.g., guest can view customers but not pricing)
- [ ] Guest session analytics (views, duration) for tenant admins
- [ ] Magic-link guest invitations (pre-populate access code via email)
- [ ] Guest-to-registered conversion flow (CTA to create a full account)

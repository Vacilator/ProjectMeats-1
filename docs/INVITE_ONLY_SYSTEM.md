# Invite-Only System

## Overview

The invite-only system controls workspace onboarding for ProjectMeats. Workspace admins send targeted email invitations; users cannot self-register without a valid invite token. This ensures that every user in a workspace is explicitly authorized by an admin.

---

## User Flows

### Admin: Sending an Invite

1. Admin opens **Admin → Team Members → Invite User** in the web frontend
2. Admin enters the invitee's email address and selects a role
3. System generates a one-time `InvitationToken` (UUID) and sends an email containing:
   - A deep link: `https://app.meatscentral.com/invite/TOKEN`
   - A mobile deep link: `projectmeats://invite/TOKEN`
   - Plain-text token for manual entry

### User: Accepting an Invite

#### Web
1. User clicks the email link → opens the web app at `/invite/TOKEN`
2. App calls `GET /api/v1/auth/invites/TOKEN/` to validate
3. If valid, displays workspace name, inviting admin, and assigned role
4. User fills in username/password → calls `POST /api/v1/auth/invites/accept/`
5. Backend creates the user account, adds them to the workspace with the specified role, and returns an auth token
6. App stores the token and redirects to the Home dashboard

#### Mobile
1. User taps the `projectmeats://invite/TOKEN` deep link or manually enters the token in the **Accept an Invite** screen
2. App validates the token via `GET /api/v1/auth/invites/TOKEN/`
3. InviteScreen shows workspace details and a form to set username/password
4. On submit, `POST /api/v1/auth/invites/accept/` creates the account and logs in
5. User lands on the Tenants screen (or directly on Home if single-tenant)

---

## Backend API

### Data Model

```python
# backend/apps/tenants/models.py

class TenantInvitation(TimestampModel):
    """One-time invitation token for workspace onboarding."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='invitations')
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    invited_email = models.EmailField()
    role = models.CharField(
        max_length=20,
        choices=[('admin', 'Admin'), ('manager', 'Manager'), ('user', 'User'), ('readonly', 'Read-Only')],
        default='user',
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='accepted_invitations'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self) -> bool:
        return self.expires_at < timezone.now()

    @property
    def is_accepted(self) -> bool:
        return self.accepted_at is not None
```

### Endpoints

#### Validate Invite

```
GET /api/v1/auth/invites/{token}/
```

No authentication required.

**Success (200):**
```json
{
  "token": "uuid-...",
  "tenant_id": "uuid-...",
  "tenant_name": "ACME Meats",
  "tenant_slug": "acme-meats",
  "invited_by": "jane.admin",
  "invited_email": "newuser@example.com",
  "role": "user",
  "expires_at": "2026-03-25T19:49:10Z",
  "is_expired": false,
  "is_accepted": false
}
```

**Errors:**
- `404` – Token not found
- `200` with `is_expired: true` – Invite has expired
- `200` with `is_accepted: true` – Already used

#### Accept Invite (Create Account)

```
POST /api/v1/auth/invites/accept/
```

No authentication required.

**Request body:**
```json
{
  "token": "uuid-...",
  "username": "newuser",
  "password": "securepassword123",
  "first_name": "New",
  "last_name": "User"
}
```

**Success (201):**
```json
{
  "token": "auth-token-abc...",
  "user": {
    "id": 42,
    "username": "newuser",
    "email": "newuser@example.com",
    "first_name": "New",
    "last_name": "User",
    "is_active": true,
    "date_joined": "2026-03-18T19:49:10Z"
  }
}
```

**Errors:**
- `400` – Validation errors (e.g., username taken, weak password)
- `404` – Token not found
- `410` – Token expired or already accepted

#### Send Invite (Admin Only)

```
POST /api/v1/tenants/{tenant_id}/invitations/
```

Requires `IsAuthenticated` + `IsTenantAdmin`.

**Request body:**
```json
{
  "email": "colleague@example.com",
  "role": "manager"
}
```

**Success (201):**
```json
{
  "id": "uuid-...",
  "invited_email": "colleague@example.com",
  "role": "manager",
  "expires_at": "2026-03-25T19:49:10Z",
  "invite_url": "https://app.meatscentral.com/invite/TOKEN",
  "mobile_deep_link": "projectmeats://invite/TOKEN"
}
```

---

## Mobile Implementation

### Screens

| Screen        | File                                  | Purpose                               |
|---------------|---------------------------------------|---------------------------------------|
| `InviteScreen`| `mobile/src/screens/InviteScreen.tsx` | Token validation + account creation   |

### Navigation

Deep links open the `Invite` screen directly:

```typescript
// app.json / linking config
const linking = {
  prefixes: ['projectmeats://', 'https://app.meatscentral.com'],
  config: {
    screens: {
      Invite: 'invite/:token',
    },
  },
};
```

In `App.tsx`, the `Invite` screen is accessible **before** authentication:

```typescript
<Stack.Screen name="Invite">
  {(props) => (
    <InviteScreen {...props} onInviteAccepted={handleLogin} />
  )}
</Stack.Screen>
```

### InviteScreen Flow

```
[Enter token manually or arrive via deep link]
         ↓
[Validate token → GET /auth/invites/TOKEN/]
         ↓ success
[Show invite details: workspace, role, inviter]
         ↓
[User fills username / password / name]
         ↓
[Accept → POST /auth/invites/accept/]
         ↓ success
[handleLogin(token, user) → TenantsScreen → HomeScreen]
```

### TypeScript Types

```typescript
// mobile/src/types/index.ts

interface TenantInvite {
  token: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  invited_by: string;
  invited_email: string;
  role: 'admin' | 'manager' | 'user' | 'readonly';
  expires_at: string;
  is_expired: boolean;
  is_accepted: boolean;
}

interface InviteAcceptRequest {
  token: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}
```

---

## Email Template

The invitation email should contain:

```
Subject: You've been invited to join {Tenant Name} on ProjectMeats

Hi,

{Invited By} has invited you to join {Tenant Name} as a {Role}.

Click the link below to accept your invitation (expires {Expires At}):

  {Invite URL}

Or open the ProjectMeats mobile app and enter this code:
  {Token}

This invitation will expire on {Expires At}.
```

---

## Security Considerations

- Tokens are UUIDs (128 bits), generated with `uuid.uuid4()` — sufficient entropy to prevent brute-force
- Tokens are **single-use**: marked as accepted after first use
- Token expiry default: **7 days** from issuance; configurable per tenant via `settings.invite_ttl_days`
- Invited email is recorded and validated during acceptance to prevent token sharing
- Rate-limit invite acceptance (`POST /auth/invites/accept/`) to prevent automated account creation
- Invitations are soft-deleted (set `is_active=False`) rather than hard-deleted for audit purposes
- Backend validates that the accepting user's email matches `invited_email` (or allows mismatch for team-invite use cases — configurable)

---

## Admin Management (Web)

Tenant admins can:
- View all pending, accepted, and expired invitations
- Revoke pending invitations (sets `is_active=False`)
- Re-send expired invitations (creates a new token, invalidates the old one)
- View which users were invited by whom and when they joined

---

## Testing

### Unit Tests

```typescript
// mobile/src/screens/__tests__/InviteScreen.test.tsx
it('shows token entry step by default', () => { ... });
it('shows account creation step after successful validation', () => { ... });
it('shows error when token is expired', () => { ... });
it('shows error when token is already accepted', () => { ... });
it('calls onInviteAccepted with token and user on success', async () => { ... });
it('shows password length validation error', async () => { ... });
```

### Backend Tests

```python
# backend/apps/tenants/tests/test_invitations.py
class InvitationTests(APITestCase):
    def test_validate_invite_success(self): ...
    def test_validate_invite_not_found(self): ...
    def test_validate_invite_expired(self): ...
    def test_accept_invite_creates_user_and_tenant_membership(self): ...
    def test_accept_invite_cannot_reuse_token(self): ...
    def test_accept_invite_expired_token_rejected(self): ...
    def test_send_invite_requires_admin_role(self): ...
```

---

## Future Enhancements

- [ ] Bulk invite (CSV upload of emails)
- [ ] SSO-linked invites (map email domain to identity provider)
- [ ] Public invite links (any user with the link can join, with optional access code)
- [ ] Invite analytics (sent, opened, accepted, expired counts)
- [ ] Invite reminder emails (T-3 days before expiry)
- [ ] Joining an existing account via invite (link invite to existing username instead of creating new)

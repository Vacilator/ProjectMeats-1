# Phase 6: Email Integrations (Microsoft Outlook)

This document tracks the Phase 6 email integration UX + OAuth flow for Microsoft Outlook / Microsoft 365.

## Vanguard Updates

- **Vanguard: Microsoft Outlook Connect Button – Fixed for admin_test_development_1 (full OAuth flow)**
  - Ensures the **Connect to Microsoft Outlook** button works reliably in **development** for multi-tenant dev domains.
  - OAuth authorize endpoint now correctly resolves tenant context using:
    - explicit `tenant_id` query param (validated against authenticated tenant membership), or
    - fallback to the user’s first active tenant membership.
  - OAuth callback redirects include `provider=microsoft` so the frontend can show provider-specific success/error feedback.
  - Scopes expanded to include Mail + Calendar + Contacts permissions required for future extensibility.

## UX Expectations

- Button is visible and clickable for all accounts (including test users).
- Shows a connecting state while redirecting.
- On return, settings page displays a clear toast:
  - **“Outlook Connected!”** on success
  - **“Outlook connection failed: …”** on error

## Notes

- Redirect URI is constructed using the request host and `/api/v1/integrations/oauth/callback/microsoft/` to support `dev.meatscentral.com` and other environments consistently.
- Changes are additive-only and do not break existing workflows.

## Gmail (Starter MVP)

### What ships (backend)
- `GET /api/v1/workflows/email/email/gmail/auth/init/` (authenticated) returns `{ auth_url, provider }`.
- `GET /api/v1/workflows/email/email/gmail/auth/callback/` (anonymous) exchanges the auth code and stores tokens in `EmailAccount`.
- OAuth `state` is now **signed + time-limited** and includes `user_id` + `tenant_id` to prevent tampering.

### What you (user) must configure in Google Cloud (required)
1. Create/choose a **Google Cloud project**.
2. Enable **Gmail API**.
3. Configure **OAuth consent screen** (add test users if not publishing).
4. Create **OAuth Client ID** → type **Web application**.
5. Add an authorized redirect URI that matches the backend callback exactly, e.g.:
   - `https://<YOUR_BACKEND_DOMAIN>/api/v1/workflows/email/email/gmail/auth/callback/`
6. Provide the following secrets to the target environment:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (must match the redirect URI configured in Google)

### Expected behavior
- If Gmail OAuth secrets are missing, init returns a clear `not_configured` error and lists required keys.
- On success, the callback redirects back to the frontend with `oauth_success=gmail&email=<address>`.

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

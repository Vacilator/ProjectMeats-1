# Email Integrations

Workflow automation with email triggers and actions for Outlook and Gmail.

## Features

- **OAuth2 Authentication**: Secure connection to Outlook and Gmail
- **Email Triggers**: New email, reply, thread, attachment triggers
- **Email Actions**: Send, reply, forward emails
- **Audit Logging**: Complete email activity history
- **Token Management**: Automatic token refresh and webhook renewal

## Models

### EmailAccount
OAuth-connected email account with encrypted token storage.

### EmailTrigger
Configure email-based workflow triggers with filters.

### EmailAction  
Send automated emails from workflow nodes.

### EmailLog
Complete audit trail of all email operations.

## API Endpoints

See `/api/v1/workflows/email/` for documentation.

## Configuration

1. Set up OAuth credentials in GitHub Secrets
2. Add `apps.workflows` to INSTALLED_APPS
3. Run migrations: `python manage.py migrate`
4. Configure webhook endpoints

## Security

- Tokens stored encrypted
- HTTPS required for webhooks
- Per-user account isolation
- Rate limiting on API calls

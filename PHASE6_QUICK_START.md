# Phase 6: Email Integration - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
cd backend
pip install cryptography>=42.0.0
```

### 2. Run Migrations

```bash
python manage.py migrate integrations
```

### 3. Generate Encryption Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 4. Set Environment Variables

```bash
# .env file
MICROSOFT_CLIENT_ID=your_azure_app_client_id
MICROSOFT_CLIENT_SECRET=your_azure_app_client_secret
OAUTH_ENCRYPTION_KEY=generated_fernet_key_from_step_3
```

### 5. Register Azure AD App

1. Go to [Azure Portal](https://portal.azure.com/) → Azure Active Directory
2. Navigate to "App registrations" → "New registration"
3. **Name**: ProjectMeats Email Integration
4. **Redirect URI**: `https://your-domain.com/api/v1/integrations/oauth/callback/microsoft/`
5. Click "Register"
6. Copy **Application (client) ID** → `MICROSOFT_CLIENT_ID`
7. Go to "Certificates & secrets" → "New client secret"
8. Copy secret value → `MICROSOFT_CLIENT_SECRET`
9. Go to "API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions"
10. Add these permissions:
    - **Mail.Send**
    - **Mail.ReadWrite**
    - **User.Read**
    - **offline_access**
11. Click "Grant admin consent"

### 6. Test Connection

1. Start backend: `python manage.py runserver`
2. Start frontend: `npm start`
3. Navigate to **Settings → Integrations**
4. Click **Connect** on Microsoft Outlook
5. Complete OAuth flow
6. Verify connection status shows ✅ Connected

### 7. Create Workflow with Email Node

1. Go to **Workflows** → **New Workflow**
2. Drag **Send Email (Outlook)** node onto canvas
3. Configure:
   - **To**: `customer@example.com` or `{{customer.email}}`
   - **Subject**: `Order Confirmation #{{order.number}}`
   - **Body**: `Thank you for your order!`
4. Save and test workflow

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL INTEGRATION ARCHITECTURE                │
└─────────────────────────────────────────────────────────────────┘

Frontend (React)                Backend (Django)               External
─────────────────              ──────────────────            ────────

IntegrationSettings.tsx
       │
       │ 1. Connect Button
       │ ──────────────────────> OAuth Views
       │                              │
       │                              │ 2. Generate Auth URL
       │                              │ ──────────────────> Microsoft
       │                              │                     OAuth Server
       │                              │ 3. Redirect User
       │ <────────────────────────────────────────────────
       │                              │
       │                              │ 4. OAuth Callback
       │ ──────────────────────────> │
       │                              │
       │                         Token Exchange
       │                         Encrypt & Store
       │                              │
       │                         ExternalAuthProvider
       │                         (PostgreSQL)
       │
       │
FlowEditor/
OutlookEmailNode.tsx
       │
       │ Configure Node
       │ (to, subject, body)
       │
       │ Execute Workflow
       │ ──────────────────────> WorkflowEngine
                                      │
                                 OutlookEmailNode
                                 .execute()
                                      │
                                      │ 1. Get Auth Provider
                                      │ 2. Check Token Expiry
                                      │ 3. Refresh if Needed
                                      │ 4. Decrypt Token
                                      │ 5. Render Templates
                                      │ 6. Send Email
                                      │ ──────────────────> Microsoft
                                      │                     Graph API
                                      │ <──────────────────
                                      │ 7. Return Result
                                      │
                                 WorkflowExecution
                                 (Audit Trail)
```

---

## 🔐 Security Best Practices

### ✅ DO

- ✅ Store encryption key in environment variable
- ✅ Use HTTPS for OAuth redirects
- ✅ Rotate encryption keys periodically
- ✅ Monitor token refresh failures
- ✅ Log email sending events (without token data)
- ✅ Validate all email addresses before sending
- ✅ Implement rate limiting on email nodes
- ✅ Use tenant isolation for multi-tenant security

### ❌ DON'T

- ❌ Log access tokens or refresh tokens
- ❌ Store encryption key in code or database
- ❌ Use HTTP for OAuth redirects
- ❌ Share encryption keys across environments
- ❌ Allow unlimited email sending (implement quotas)
- ❌ Send emails without user consent
- ❌ Store plain text tokens
- ❌ Skip CSRF validation in OAuth flow

---

## 🧪 Testing

### Unit Tests

```python
# backend/apps/integrations/tests.py
from django.test import TestCase
from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant

class ExternalAuthProviderTestCase(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name='Test Tenant')
    
    def test_token_encryption(self):
        provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            token_expiry=timezone.now() + timedelta(hours=1)
        )
        
        # Set encrypted token
        provider.set_encrypted_token('access', 'my_secret_token')
        provider.save()
        
        # Retrieve and decrypt
        provider.refresh_from_db()
        decrypted = provider.get_decrypted_token('access')
        
        self.assertEqual(decrypted, 'my_secret_token')
```

### Integration Tests

```bash
# Test OAuth flow
pytest backend/apps/integrations/tests/test_oauth_flow.py -v

# Test email sending
pytest backend/tenant_apps/workflows/tests/test_outlook_email_node.py -v
```

### Manual Testing

See **Manual Testing** section in PHASE6_EMAIL_INTEGRATION_COMPLETE.md

---

## 🐛 Troubleshooting

### Issue: "Microsoft account not connected"

**Solution**: Navigate to Settings → Integrations and connect your Microsoft account.

### Issue: "Token expired"

**Solution**: Automatic refresh should handle this. If it persists:
1. Check `token_expiry` in database
2. Verify `refresh_token` is stored
3. Check Microsoft app permissions
4. Reconnect account

### Issue: "Invalid email address"

**Solution**: Verify email addresses in node configuration:
- Check for typos
- Ensure template variables resolve to valid emails
- Test with hardcoded email first

### Issue: "Encryption key not set"

**Solution**: 
```bash
export OAUTH_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

### Issue: "OAuth callback failed"

**Solution**:
1. Verify redirect URI matches Azure AD app registration
2. Check CSRF state validation
3. Ensure HTTPS is used in production
4. Check browser console for errors

---

## 📚 API Reference

### EmailProvider Interface

```python
class EmailProvider(ABC):
    def get_auth_url(self, redirect_uri: str, state: str) -> AuthUrlResponse
    def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse
    def refresh_token(self, refresh_token: str) -> TokenResponse
    def send_email(self, access_token: str, params: EmailParams) -> Dict[str, Any]
    def validate_token(self, access_token: str) -> bool
    def get_user_info(self, access_token: str) -> Dict[str, Any]
```

### EmailParams TypedDict

```python
EmailParams = {
    'to': List[str],              # Required
    'subject': str,               # Required
    'body': str,                  # Required
    'cc': List[str],              # Optional
    'bcc': List[str],             # Optional
    'body_html': str,             # Optional
    'reply_to': str,              # Optional
    'importance': str,            # Optional: 'low', 'normal', 'high'
    'attachments': List[Dict],    # Optional (future)
}
```

### OutlookEmailNode.execute()

```python
def execute(self, context: Dict[str, Any], tenant_id: int) -> Dict[str, Any]:
    """
    Args:
        context: Workflow execution context with variables
        tenant_id: Tenant ID for OAuth credentials
    
    Returns:
        {
            'status': 'success' | 'error',
            'message': str,
            'node_id': str,
            'data': {...}
        }
    """
```

---

## 🎓 Learning Resources

### Microsoft Graph API
- [Mail API Overview](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Send Mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail)
- [OAuth 2.0 Code Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

### Django
- [Django Models](https://docs.djangoproject.com/en/5.0/topics/db/models/)
- [Django REST Framework](https://www.django-rest-framework.org/)

### React
- [React Hooks](https://react.dev/reference/react)
- [Styled Components](https://styled-components.com/)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

## 📈 Performance Optimization

### Database Indexes

```sql
-- Already created by migration
CREATE INDEX idx_tenant_provider ON integrations_externalauthprovider(tenant_id, provider_type);
CREATE INDEX idx_tenant_active ON integrations_externalauthprovider(tenant_id, is_active);
```

### Caching Token Lookups

```python
from django.core.cache import cache

def get_cached_provider(tenant_id):
    cache_key = f'auth_provider_{tenant_id}_microsoft'
    provider = cache.get(cache_key)
    
    if not provider:
        provider = ExternalAuthProvider.objects.get(
            tenant_id=tenant_id,
            provider_type='microsoft',
            is_active=True
        )
        cache.set(cache_key, provider, timeout=3600)
    
    return provider
```

### Async Email Sending (Future)

```python
# Use Celery for async email sending
from celery import shared_task

@shared_task
def send_email_async(node_id, context, tenant_id):
    node = OutlookEmailNode(node_id, config)
    return node.execute(context, tenant_id)
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Environment variables set correctly
- [ ] Azure AD app registered
- [ ] Migrations applied
- [ ] Encryption key rotated for production
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Monitoring setup (email send rates, failures)
- [ ] Backup encryption key securely
- [ ] Document rollback procedure

### Health Check

```bash
# Check integration app health
curl https://your-domain.com/api/v1/health/detailed/ | jq '.integrations'
```

### Monitoring

```python
# Log email events
import logging
logger = logging.getLogger('integrations.email')

logger.info(
    f"Email sent: tenant={tenant_id}, "
    f"to={email_params['to']}, "
    f"provider=microsoft, "
    f"status=success"
)
```

---

## 📞 Support

### Common Questions

**Q: Can I use multiple Microsoft accounts per tenant?**  
A: Currently, only one account per tenant. Disconnect and reconnect to switch.

**Q: How long are tokens valid?**  
A: Access tokens: 1 hour. Refresh tokens: 90 days (with regular use).

**Q: Is Gmail supported?**  
A: Not yet. Planned for Phase 6.1.

**Q: Can I send attachments?**  
A: Not yet. Planned for Phase 6.5.

**Q: What's the email rate limit?**  
A: Microsoft Graph: 10,000 requests/day per app. Configure quotas per tenant.

### Getting Help

- **Documentation**: See PHASE6_EMAIL_INTEGRATION_COMPLETE.md
- **Issues**: Check GitHub Issues for known problems
- **Contact**: Reach out to infrastructure team

---

**Last Updated**: February 14, 2026  
**Version**: 1.0  
**Status**: Production Ready ✅

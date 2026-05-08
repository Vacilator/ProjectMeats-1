# Environment-Specific Authentication Configuration

**Status**: ✅ CURRENT
**Category**: Architecture
**Last Updated**: 2026-02-01

---

## 🔐 How Authentication Works Across Environments

The authentication system in ProjectMeats uses **environment-aware configuration** controlled by the `DEBUG` setting. Here's a detailed breakdown:

---

## 📊 Environment Configuration Matrix

| Feature | Development | Staging/UAT | Production |
|---------|------------|-------------|------------|
| **DEBUG Setting** | `True` | `False` | `False` |
| **Authentication** | ❌ Optional (Bypassed) | ✅ Required | ✅ Required |
| **Permissions** | `AllowAny` | `IsAuthenticated` | `IsAuthenticated` |
| **Tenant Auto-Creation** | ✅ Yes (Development Tenant) | ❌ No | ❌ No |
| **Tenant Isolation** | ❌ Disabled (all data visible) | ✅ Strict | ✅ Strict |
| **Token Validation** | ❌ Skipped | ✅ Enforced | ✅ Enforced |
| **Security Level** | 🟡 Low (intentional) | 🟢 High | 🟢 High |

---

## 🔍 Detailed Environment Breakdown

### 1️⃣ Development Environment (`DEBUG=True`)

**Settings File**: `backend/projectmeats/settings/development.py`

```python
DEBUG = True  # Hardcoded
```

**Authentication Flow**:
```
User Request (Frontend)
    ↓
    | Authorization: Bearer <invalid-token>  ← Token is IGNORED
    ↓
Django Backend
    ↓
get_authenticators() → Returns []  ← Empty list = NO authentication
    ↓
get_permissions() → Returns [AllowAny()]  ← No restrictions
    ↓
perform_create()
    ↓
    | No tenant? Auto-create "Development Tenant"
    ↓
Supplier Created Successfully ✅
```

**Code Implementation**:
```python
# In SupplierViewSet
def get_authenticators(self):
    if settings.DEBUG:  # True in development
        logger.debug('Development mode: Authentication disabled')
        return []  # ← Bypass ALL authentication
    return super().get_authenticators()

def get_permissions(self):
    if settings.DEBUG:  # True in development
        return [AllowAny()]  # ← Allow anyone
    return [IsAuthenticated()]

def perform_create(self, serializer):
    if not tenant and settings.DEBUG:  # True in development
        # Auto-create development tenant
        tenant, created = Tenant.objects.get_or_create(
            slug='development',
            defaults={
                'name': 'Development Tenant',
                'contact_email': 'dev@projectmeats.local',
                'is_active': True,
            }
        )
```

**Why It's Insecure** (intentionally):
- ❌ No authentication = Anyone can access
- ❌ No token validation = Invalid tokens ignored
- ❌ No tenant isolation = All data visible
- ❌ Auto-tenant creation = No ownership tracking

**Why It's OK**:
- ✅ Only runs on local machines (localhost)
- ✅ Speeds up development workflow
- ✅ No production data at risk
- ✅ Easier testing without auth setup

---

### 2️⃣ Staging/UAT Environment (`DEBUG=False`)

**Settings File**: `backend/projectmeats/settings/staging.py`

```python
DEBUG = config("DEBUG", default=False, cast=bool)  # Defaults to False
```

**Authentication Flow**:
```
User Request (Frontend)
    ↓
    | Authorization: Bearer <token>  ← Token MUST be valid
    ↓
Django Backend
    ↓
get_authenticators() → Returns [SessionAuth, TokenAuth]  ← Full auth
    ↓
    | Token validation happens HERE
    | Invalid token → 401 Unauthorized ❌
    ↓
get_permissions() → Returns [IsAuthenticated()]  ← Must be logged in
    ↓
    | User authenticated?
    | No → 403 Forbidden ❌
    | Yes → Continue ✅
    ↓
perform_create()
    ↓
    | Tenant from middleware OR user association
    | No tenant → ValidationError ❌
    ↓
Supplier Created with Proper Tenant ✅
```

**Code Implementation**:
```python
# In SupplierViewSet
def get_authenticators(self):
    if settings.DEBUG:  # False in staging
        return []
    return super().get_authenticators()  # ← Returns default authenticators
    # Default = [SessionAuthentication, TokenAuthentication]

def get_permissions(self):
    if settings.DEBUG:  # False in staging
        return [AllowAny()]
    return [IsAuthenticated()]  # ← Must be authenticated

def perform_create(self, serializer):
    # Tenant resolution from middleware or user
    if not tenant and settings.DEBUG:  # False in staging - SKIPPED
        # Auto-create code NOT executed
        pass

    if not tenant:  # No tenant in staging = ERROR
        raise ValidationError('Tenant context is required')  # ← Strict
```

**Security Features**:
- ✅ Authentication required
- ✅ Token validation enforced
- ✅ Tenant isolation active
- ✅ No auto-tenant creation
- ✅ Proper error handling

**Environment Variables** (staging):
```bash
# .env or environment config
DEBUG=False  # Critical!
DJANGO_SETTINGS_MODULE=projectmeats.settings.staging
```

---

### 3️⃣ Production Environment (`DEBUG=False`)

**Settings File**: `backend/projectmeats/settings/production.py`

```python
DEBUG = False  # Hardcoded (NEVER True)
```

**Authentication Flow**: **Identical to Staging**
```
User Request → Token Validation → Permission Check → Tenant Isolation → Success/Fail
```

**Additional Security**:
```python
# production.py has additional security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

**Environment Variables** (production):
```bash
DEBUG=False  # Must ALWAYS be False
DJANGO_SETTINGS_MODULE=projectmeats.settings.production
SECRET_KEY=<strong-random-key>
```

---

## 🎯 The Magic: How `DEBUG` Controls Everything

### The Control Flow

```python
# Every request goes through this logic:

if settings.DEBUG:  # ← THE KEY DECISION POINT
    # Development Mode
    authentication = None      # Bypass
    permissions = AllowAny     # Allow all
    tenant = auto_create()     # Auto-create
    isolation = disabled       # Show all data
else:
    # Production/Staging Mode
    authentication = required  # Strict
    permissions = IsAuthenticated  # Must login
    tenant = from_middleware_or_user  # Must exist
    isolation = enabled        # Filter by tenant
```

### Settings Hierarchy

```
base.py (shared settings)
    ↓
development.py (DEBUG=True) ← Your local machine
    OR
production.py (DEBUG=False) ← Live servers
    ↓
staging.py (extends production.py, DEBUG=False) ← UAT/staging servers
```

---

## 🔧 Configuration in Each Environment

### Development (Local Machine)

**File**: `backend/projectmeats/settings/development.py`
```python
DEBUG = True  # ← Authentication bypass ACTIVE
ALLOWED_HOSTS = ['localhost', '127.0.0.1']
```

**How to Run**:
```bash
# Automatically uses development.py when DJANGO_SETTINGS_MODULE not set
python manage.py runserver
```

---

### Staging/UAT (UAT Server)

**File**: `backend/projectmeats/settings/staging.py`
```python
DEBUG = config("DEBUG", default=False, cast=bool)  # ← From env var
```

**Environment Setup**:
```bash
# Set in server environment or .env file
export DEBUG=False  # CRITICAL
export DJANGO_SETTINGS_MODULE=projectmeats.settings.staging
export DATABASE_URL=postgresql://...
export SECRET_KEY=<staging-secret-key>
```

**How to Run**:
```bash
# On UAT server
gunicorn projectmeats.wsgi:application
```

---

### Production (Live Server)

**File**: `backend/projectmeats/settings/production.py`
```python
DEBUG = False  # ← Hardcoded, cannot be overridden
```

**Environment Setup**:
```bash
# Set in production environment
export DEBUG=False  # CRITICAL (though hardcoded as backup)
export DJANGO_SETTINGS_MODULE=projectmeats.settings.production
export DATABASE_URL=postgresql://...
export SECRET_KEY=<production-secret-key>
export ALLOWED_HOSTS=meatscentral.com,www.meatscentral.com
```

---

## 🚨 Security Safeguards

### 1. Hardcoded Production Safety

```python
# production.py
DEBUG = False  # Can't be changed via environment variable
```

This prevents accidental DEBUG=True in production.

### 2. Environment Variable Validation

```python
# staging.py
DEBUG = config("DEBUG", default=False, cast=bool)  # Defaults to False
```

Even if DEBUG env var is missing, defaults to False (secure).

### 3. Deployment Checks

```bash
# Before deploying to staging/production, verify:
python manage.py shell -c "from django.conf import settings; print(f'DEBUG={settings.DEBUG}')"
# Must output: DEBUG=False
```

---

## 📊 Request Flow Comparison

### Development Request (DEBUG=True)

```
1. Request arrives: POST /api/v1/suppliers/
   Headers: Authorization: Bearer invalid-token-xyz

2. get_authenticators()
   → settings.DEBUG = True
   → return []  # Skip authentication
   → ⚠️ Token is IGNORED

3. get_permissions()
   → settings.DEBUG = True
   → return [AllowAny()]  # No restrictions

4. perform_create()
   → No tenant context
   → settings.DEBUG = True
   → Auto-create "Development Tenant"
   → ✅ Success

Result: 201 Created (no authentication needed)
```

### Production Request (DEBUG=False)

```
1. Request arrives: POST /api/v1/suppliers/
   Headers: Authorization: Bearer invalid-token-xyz

2. get_authenticators()
   → settings.DEBUG = False
   → return [SessionAuthentication, TokenAuthentication]
   → 🔍 Token validation runs

3. Token Validation
   → Token 'invalid-token-xyz' not found in database
   → ❌ raises AuthenticationFailed
   → Returns 401 Unauthorized

Request STOPS here - never reaches permissions or creation
```

### Production Request (Valid Token, DEBUG=False)

```
1. Request arrives: POST /api/v1/suppliers/
   Headers: Authorization: Bearer valid-token-abc123

2. get_authenticators()
   → settings.DEBUG = False
   → return [SessionAuthentication, TokenAuthentication]
   → 🔍 Token validation runs
   → Token found in database
   → ✅ User authenticated

3. get_permissions()
   → settings.DEBUG = False
   → return [IsAuthenticated()]
   → User is authenticated
   → ✅ Permission granted

4. perform_create()
   → Get tenant from middleware or user association
   → Tenant found
   → ✅ Create supplier with tenant
   → Returns 201 Created

Result: 201 Created (with proper tenant association)
```

---

## 🎓 Key Takeaways

### ✅ Development (DEBUG=True)
- **Purpose**: Fast local development
- **Security**: Intentionally low
- **Authentication**: Bypassed
- **Tenant**: Auto-created
- **Data Access**: All data visible

### ✅ Staging/Production (DEBUG=False)
- **Purpose**: Pre-production testing / Live system
- **Security**: High (production-grade)
- **Authentication**: Required and validated
- **Tenant**: Must exist from middleware/user
- **Data Access**: Strict tenant isolation

### 🔑 The Control Mechanism
- **Single Setting**: `DEBUG` (True/False)
- **Single Check**: `if settings.DEBUG:`
- **Multiple Effects**: Auth, Permissions, Tenants, Isolation
- **Environment-Specific**: Different settings files per environment

---

## 🛡️ Security Guarantees

### What Makes It Safe?

1. **DEBUG is False by default** in staging/production settings
2. **Production.py hardcodes DEBUG=False** (can't be overridden)
3. **All bypasses check `settings.DEBUG`** before executing
4. **No production environment variables set DEBUG=True**
5. **Deployment checks verify DEBUG=False** before going live

### What Could Go Wrong?

❌ **Setting DEBUG=True in production** would:
- Disable all authentication
- Allow anyone to create/read/modify data
- Break tenant isolation
- Expose all tenant data

✅ **This is prevented by**:
- Hardcoded `DEBUG = False` in production.py
- Deployment verification scripts
- CI/CD pipeline checks
- Code review requirements

---

## 📝 Verification Commands

### Check Current DEBUG Setting

```bash
# Development
python manage.py shell -c "from django.conf import settings; print(f'DEBUG={settings.DEBUG}')"
# Expected: DEBUG=True

# Staging/Production
python manage.py shell -c "from django.conf import settings; print(f'DEBUG={settings.DEBUG}')"
# Expected: DEBUG=False
```

### Test Authentication Requirement

```bash
# Should work in development, fail in staging/production
curl -X POST http://localhost:8000/api/v1/suppliers/ \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Test"}'

# Development: 201 Created
# Staging/Production: 401 Unauthorized
```

---

**Summary**: The entire security model pivots on the `DEBUG` setting, which is controlled by environment-specific settings files. Development uses `DEBUG=True` for convenience, while staging and production use `DEBUG=False` for security.

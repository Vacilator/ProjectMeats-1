# Production Launch Checklist — Meats Central

> **Use this checklist before promoting from UAT → Production.**

---

## 1. Pre-Launch Verification

### Infrastructure
- [ ] All GitHub Secrets verified: `python config/manage_env.py audit`
- [ ] Production Docker images built with SHA tags
- [ ] Production database backup taken
- [ ] Bastion tunnel connectivity confirmed
- [ ] DNS records pointing to production droplets
- [ ] SSL certificates valid and auto-renewing (Let's Encrypt)
- [ ] Nginx reverse proxy configured with correct `CSRF_TRUSTED_ORIGINS`

### Database
- [ ] All migrations applied: `python manage.py showmigrations` (no `[ ]` unchecked)
- [ ] RLS policies active on all tenant-aware tables
- [ ] Initial tenant + superuser created
- [ ] Database connection pooling configured (PgBouncer if needed)
- [ ] `--fake-initial` strategy tested on fresh + existing databases

### Backend
- [ ] `DJANGO_SETTINGS_MODULE=projectmeats.settings.production`
- [ ] `DEBUG=False` confirmed
- [ ] `SECRET_KEY` is unique production value (not shared with dev/UAT)
- [ ] `ALLOWED_HOSTS` includes production domain
- [ ] `CORS_ALLOWED_ORIGINS` includes production frontend URL
- [ ] Static files collected: `python manage.py collectstatic --noinput`
- [ ] Health endpoint responds: `curl https://prod.meatscentral.com/api/v1/health/`
- [ ] Celery workers running and connected to Redis
- [ ] WebSocket (Channels) ASGI server running

### Frontend
- [ ] Production build: `npm run build` (zero warnings, zero errors)
- [ ] Environment variables set (API base URL, WebSocket URL)
- [ ] Bundle size acceptable (< 2MB gzipped)
- [ ] No console.log statements in production (lint rule)
- [ ] Service worker configured for offline resilience (if applicable)

---

## 2. Security Verification

- [ ] No secrets in source code: `grep -r "password123\|secret_key" backend/ frontend/`
- [ ] JWT token expiry configured (access: 15min, refresh: 7 days)
- [ ] Rate limiting enabled on auth endpoints
- [ ] CSRF protection active (secure cookies, SameSite=Strict)
- [ ] Session cookies: `Secure=True`, `HttpOnly=True`
- [ ] Admin panel access restricted to superusers
- [ ] RLS policies verified: `SELECT * FROM pg_policies WHERE policyname LIKE '%tenant%'`
- [ ] No debug endpoints exposed in production

---

## 3. Monitoring & Observability

- [ ] Structured logging active (JSON format)
- [ ] Error tracking configured (Sentry or similar)
- [ ] Health endpoint: `/api/v1/health/` (backend)
- [ ] Readiness endpoint: `/api/v1/ready/` (backend)
- [ ] Metrics endpoint: `/api/v1/internal/metrics/` (internal only)
- [ ] Celery task monitoring (Flower or built-in)
- [ ] WebSocket connection health tracked
- [ ] Disk space alerts on droplets
- [ ] Database connection count monitoring

---

## 4. Deployment Execution

### Step 1: Final UAT Verification
```bash
# Run full test suite
cd backend && python manage.py test tenant_apps/ apps/ --verbosity=1
cd frontend && npx tsc --noEmit && npm test
```

### Step 2: Promote to Production
```bash
# Trigger production deployment via GitHub Actions
# Merge UAT branch → main (triggers main-pipeline.yml)
gh pr create --base main --head development --title "Release: Production v1.0"
```

### Step 3: Verify Deployment
```bash
# Check health
curl -s https://prod.meatscentral.com/api/v1/health/ | jq .

# Check frontend
curl -s -o /dev/null -w "%{http_code}" https://prod.meatscentral.com/

# Check migrations
# (via bastion tunnel — see GOLDEN_PIPELINE.md)
python manage.py showmigrations | grep "\[ \]"  # Should be empty
```

### Step 4: Smoke Test
1. Login with production credentials
2. Navigate to Trader Command Center
3. Create a test trade via Smart Trade Creator
4. Verify WebSocket real-time updates
5. Check AI Inbox sync (wait up to 15 minutes)
6. Verify Process Cockpit shows new trade

---

## 5. Rollback Plan

### Immediate Rollback (< 5 minutes)
```bash
# Redeploy previous SHA tag
# In GitHub Actions, re-run the previous successful deployment
# or manually:
docker pull registry.digitalocean.com/projectmeats/backend:prod-{PREVIOUS_SHA}
docker pull registry.digitalocean.com/projectmeats/frontend:prod-{PREVIOUS_SHA}
# Restart containers with previous images
```

### Database Rollback
```bash
# Only if migration caused data issues
python manage.py migrate <app_name> <previous_migration_number>
```

### DNS Failover
- Point DNS to UAT environment temporarily if production is completely down

---

## 6. Post-Launch Monitoring (First 24 Hours)

- [ ] Monitor error rates (should be < 0.1%)
- [ ] Monitor response times (P95 < 500ms for API calls)
- [ ] Monitor WebSocket connection stability
- [ ] Monitor Celery task success rates
- [ ] Monitor database connection count
- [ ] Check email sync is running on schedule (every 15 minutes)
- [ ] Verify AI proposals are generating (check Celery logs)
- [ ] Confirm multi-tenant isolation (login as different tenants, verify data separation)

---

## 7. Go/No-Go Decision Criteria

| Criteria | Threshold | Status |
|----------|-----------|--------|
| Backend tests pass | 149/149 | ☐ |
| TypeScript clean | 0 errors | ☐ |
| Health endpoint | 200 OK | ☐ |
| Frontend loads | < 3s FCP | ☐ |
| WebSocket connects | Within 2s | ☐ |
| RLS verified | All policies active | ☐ |
| Secrets audit | 0 missing | ☐ |
| Zero critical bugs | In last 48h | ☐ |

**If any criteria fails: NO-GO. Fix and re-verify.**

---

**Last Updated:** May 8, 2026  
**Authority:** docs/GOLDEN_PIPELINE.md

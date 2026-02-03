# Forms & Flows Enhancement - Implementation Guardrails

**Status**: 🛡️ ACTIVE  
**Category**: Safety & Deployment  
**Last Updated**: 2026-02-03  
**Related**: FORMS_FLOWS_ENHANCEMENT_PLAN.md

---

## Executive Summary

This document defines the guardrails and safety measures for implementing the Forms & Flows Enhancement Plan to prevent any breaks in the golden pipeline or production systems.

---

## 🎯 Core Principles

1. **Backward Compatibility**: All changes must maintain existing functionality
2. **Incremental Rollout**: Deploy to dev → UAT → production with validation at each stage
3. **Testing First**: No code changes without corresponding tests
4. **Reversible Changes**: All features must have rollback procedures
5. **Monitoring**: Add observability for all new features

---

## 🛡️ Deployment Safety Checklist

### Pre-Deployment

- [ ] All tests pass (backend + frontend)
- [ ] Code review completed
- [ ] Feature flags configured (if applicable)
- [ ] Rollback procedure documented
- [ ] Database migrations tested on dev
- [ ] Performance impact assessed
- [ ] Security scan completed

### Development Environment

- [ ] Deploy to dev environment
- [ ] Run smoke tests
- [ ] Verify new features work
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Test edge cases
- [ ] Validate backward compatibility

### UAT Environment

- [ ] Deploy to UAT after dev validation
- [ ] Run full regression test suite
- [ ] User acceptance testing
- [ ] Load testing (if applicable)
- [ ] Monitor for 24 hours
- [ ] Review error rates
- [ ] Verify integrations

### Production Environment

- [ ] Deploy during low-traffic window
- [ ] Run smoke tests immediately
- [ ] Monitor error rates for 1 hour
- [ ] Check performance metrics
- [ ] Verify critical flows work
- [ ] Have rollback ready
- [ ] Gradual rollout (if possible)

---

## 🚨 Golden Pipeline Protection

### Critical Pipeline Components

1. **Backend Build** (`build-backend` job)
   - Docker build must succeed
   - No breaking dependency changes
   - Dockerfile syntax valid

2. **Frontend Build** (`build-frontend` job)
   - TypeScript compilation succeeds
   - No ESLint errors
   - Bundle size acceptable

3. **Backend Tests** (`test-backend` job)
   - All Django tests pass
   - Database migrations apply cleanly
   - No test database issues

4. **Frontend Tests** (`test-frontend` job)
   - All Vitest tests pass
   - No snapshot failures
   - Coverage thresholds met

5. **Migrations** (`migrate` job)
   - Idempotent migrations
   - No data loss
   - Reversible if needed

6. **Deployments** (`deploy-backend`, `deploy-frontend` jobs)
   - Docker containers start successfully
   - Health checks pass
   - No 500 errors

### Pipeline Failure Response

If the pipeline fails:

1. **Immediate Actions**
   - Revert the breaking commit
   - Notify the team
   - Create incident ticket

2. **Investigation**
   - Review pipeline logs
   - Identify root cause
   - Document findings

3. **Resolution**
   - Fix the issue locally
   - Add regression test
   - Re-test thoroughly
   - Re-deploy with fix

---

## 🧪 Testing Strategy

### Backend Testing

#### Unit Tests
```bash
# Run all backend tests
cd backend
python manage.py test apps/ --verbosity=2

# Run specific app tests
python manage.py test apps.tenants --verbosity=2
python manage.py test tenant_apps.workflows --verbosity=2
```

#### Integration Tests
```bash
# Test API endpoints
python manage.py test tenant_apps.workflows.tests_admin_api --verbosity=2
```

#### Database Tests
```bash
# Test migrations
python manage.py migrate --fake-initial --noinput

# Check for unapplied migrations
python manage.py makemigrations --check
```

### Frontend Testing

#### Unit Tests
```bash
# Run all frontend tests
cd frontend
npm run test:ci

# Run specific tests
npm run test -- MyTasks
npm run test -- NotificationBell
```

#### Integration Tests
```bash
# Run E2E tests (when available)
npm run test:e2e
```

#### Type Checking
```bash
# TypeScript compilation
npm run type-check
```

### Smoke Tests

After deployment, verify:

1. **Critical Endpoints**
   ```bash
   # Health check
   curl https://dev.meatscentral.com/api/health/
   
   # Action items counts
   curl -H "Authorization: Bearer $TOKEN" \
        https://dev.meatscentral.com/api/v1/workflows/action-items/counts/
   
   # Notifications
   curl -H "Authorization: Bearer $TOKEN" \
        https://dev.meatscentral.com/api/v1/workflows/notifications/
   ```

2. **Frontend Pages**
   - Dashboard loads
   - MyTasks page loads
   - Navigation works
   - No console errors

3. **New Features**
   - NotificationBell shows count
   - Badges display in sidebar
   - Action items load correctly

---

## 🔄 Rollback Procedures

### Immediate Rollback (< 1 hour)

If critical issues detected within 1 hour of deployment:

1. **Backend Rollback**
   ```bash
   # SSH to server
   ssh user@server
   
   # Pull previous image
   docker pull registry.digitalocean.com/meatscentral/projectmeats-backend:uat-<previous-sha>
   
   # Stop current container
   docker rm -f pm-backend
   
   # Start previous container
   docker run -d --name pm-backend \
     --restart unless-stopped \
     -p 8000:8000 \
     --env-file /root/projectmeats/backend/.env \
     registry.digitalocean.com/meatscentral/projectmeats-backend:uat-<previous-sha>
   ```

2. **Frontend Rollback**
   ```bash
   # Pull previous image
   docker pull registry.digitalocean.com/meatscentral/projectmeats-frontend:uat-<previous-sha>
   
   # Stop current container
   docker rm -f pm-frontend
   
   # Start previous container
   docker run -d --name pm-frontend \
     --restart unless-stopped \
     -p 127.0.0.1:8080:80 \
     -e REACT_APP_API_BASE_URL="https://uat.meatscentral.com" \
     registry.digitalocean.com/meatscentral/projectmeats-frontend:uat-<previous-sha>
   ```

3. **Database Rollback**
   ```bash
   # If migrations were applied, reverse them
   cd /home/runner/work/ProjectMeats/ProjectMeats/backend
   python manage.py migrate workflows <previous-migration-number>
   ```

### Git Rollback (> 1 hour)

If issues discovered after longer period:

1. **Create Revert PR**
   ```bash
   git revert <commit-hash>
   git push origin copilot/revert-forms-flows
   ```

2. **Follow Normal Deployment Process**
   - Create PR
   - Code review
   - Merge to development
   - Deploy through pipeline

---

## 🔍 Monitoring & Observability

### Metrics to Monitor

1. **Error Rates**
   - 500 errors on `/api/v1/workflows/` endpoints
   - Frontend console errors
   - Database connection errors

2. **Performance**
   - Action items API response time (target: < 200ms)
   - Notification polling impact
   - Database query performance

3. **Usage**
   - Number of action items per user
   - Notification delivery success rate
   - Badge count accuracy

### Alerting

Set up alerts for:

- API error rate > 1%
- Response time > 1 second
- Database connection failures
- Container restarts

### Logging

Add structured logging for:

- Action item queries
- Notification creation
- Badge count calculations
- User actions (for debugging)

---

## 🚩 Feature Flags

### Implementation

Use environment variables to control feature rollout:

```python
# backend/projectmeats/settings/base.py
FEATURE_FLAGS = {
    'FORMS_FLOWS_ENHANCED': env.bool('FEATURE_FORMS_FLOWS_ENHANCED', default=False),
    'NOTIFICATION_BELL': env.bool('FEATURE_NOTIFICATION_BELL', default=False),
    'SIDEBAR_BADGES': env.bool('FEATURE_SIDEBAR_BADGES', default=False),
}
```

```typescript
// frontend/src/config/features.ts
export const FEATURES = {
  FORMS_FLOWS_ENHANCED: import.meta.env.VITE_FEATURE_FORMS_FLOWS_ENHANCED === 'true',
  NOTIFICATION_BELL: import.meta.env.VITE_FEATURE_NOTIFICATION_BELL === 'true',
  SIDEBAR_BADGES: import.meta.env.VITE_FEATURE_SIDEBAR_BADGES === 'true',
};
```

### Gradual Rollout

1. **Phase 1**: Dev only
2. **Phase 2**: Dev + UAT
3. **Phase 3**: Dev + UAT + Production (50% users)
4. **Phase 4**: All users

---

## 📊 Performance Budgets

### Backend

- Action Items API: < 200ms p95
- Notification API: < 100ms p95
- Badge Counts API: < 50ms p95
- Database queries: < 50ms per query

### Frontend

- Page load time: < 2 seconds
- Time to interactive: < 3 seconds
- Badge update latency: < 1 second
- Bundle size increase: < 50KB

---

## 🔒 Security Considerations

### Authentication & Authorization

- All endpoints require authentication
- User can only see their own action items
- Tenant isolation enforced
- No sensitive data in logs

### Data Protection

- No PII in notification text
- Proper data sanitization
- SQL injection prevention
- XSS prevention

### API Security

- Rate limiting on action items endpoint
- Input validation
- CORS configured correctly
- CSRF protection enabled

---

## 📝 Incident Response

### Severity Levels

1. **P0 - Critical**: Production down, data loss
2. **P1 - High**: Feature broken, affecting all users
3. **P2 - Medium**: Feature degraded, affecting some users
4. **P3 - Low**: Minor issue, cosmetic

### Response Procedures

#### P0/P1 Incidents

1. **Immediate Actions** (< 5 minutes)
   - Rollback to previous version
   - Notify team
   - Create incident channel

2. **Investigation** (< 30 minutes)
   - Review logs
   - Identify root cause
   - Document timeline

3. **Resolution** (< 2 hours)
   - Fix issue
   - Deploy fix
   - Monitor for stability

4. **Post-Mortem** (< 24 hours)
   - Document incident
   - Identify prevention measures
   - Update runbooks

#### P2/P3 Incidents

1. Create ticket
2. Prioritize in backlog
3. Fix in next sprint

---

## ✅ Pre-Deployment Verification Checklist

### Code Quality

- [ ] TypeScript compilation succeeds
- [ ] No ESLint errors
- [ ] No console.log statements
- [ ] Code reviewed by 2+ people
- [ ] All comments addressed

### Testing

- [ ] Unit tests pass (100%)
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Edge cases covered
- [ ] Error handling tested

### Database

- [ ] Migrations created
- [ ] Migrations tested on dev
- [ ] No data loss risk
- [ ] Rollback migration exists
- [ ] Indexes added if needed

### Performance

- [ ] No N+1 queries
- [ ] Database queries optimized
- [ ] Caching implemented if needed
- [ ] Bundle size acceptable
- [ ] Load tested (if applicable)

### Security

- [ ] No hardcoded secrets
- [ ] Input validation added
- [ ] Authorization checks added
- [ ] XSS prevention verified
- [ ] SQL injection prevented

### Documentation

- [ ] README updated
- [ ] API docs updated
- [ ] Deployment guide updated
- [ ] Rollback procedure documented
- [ ] Known issues documented

---

## 🎓 Lessons Learned

### What Worked Well

- Parallel swimlane architecture (backend + frontend)
- Docker run pattern (100% reliability)
- Immutable image tagging with SHA
- Environment-scoped secrets

### What to Avoid

- docker-compose on remote hosts (version conflicts)
- Mutable :latest tags
- Hardcoded secrets
- Breaking changes without feature flags

---

## 📚 References

- [FORMS_FLOWS_ENHANCEMENT_PLAN.md](./FORMS_FLOWS_ENHANCEMENT_PLAN.md)
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)
- [GOLDEN_STANDARD_ACHIEVEMENT.md](../GOLDEN_STANDARD_ACHIEVEMENT.md)
- [Workflow Instructions](../../.github/instructions/workflows.instructions.md)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Copilot Agent | Initial guardrails document |


# Phase 6.6: Load Testing - Complete

**Date**: February 26, 2026  
**Status**: ✅ Delivered  
**Effort**: 2 hours

---

## Deliverables

### 1. Locust Load Testing Framework
**File**: `backend/locustfile.py` (13 KB, 450+ lines)

**Features**:
- ✅ Multi-user simulation (3 user profiles)
- ✅ Sequential task sets for realistic workflows
- ✅ Weighted task distribution
- ✅ Session management (authentication tokens)
- ✅ Custom event hooks for reporting
- ✅ Think time simulation (1-5 seconds)

---

### 2. User Profiles (3 Types)

#### ProjectMeatsUser (Standard User)
- **Tasks**: Authentication (10%), Workflows (30%), Forms (20%), Catalog (40%)
- **Think time**: 1-3 seconds
- **Use case**: Typical business user

#### AdminUser (Power User)
- **Tasks**: Workflows (50%), Forms (20%), Catalog (30%)
- **Think time**: 0.5-2 seconds
- **Use case**: Admin performing intensive operations

#### ReadOnlyUser (Browse-Only)
- **Tasks**: Catalog browsing (100%)
- **Think time**: 2-5 seconds
- **Use case**: Customer/supplier browsing catalogs

---

### 3. Task Sets (4 Scenarios)

#### AuthenticationFlow
**Tests**: 3 sequential tasks
1. Login (obtain token)
2. Verify token (validate authentication)
3. Logout (clean up session)

**Coverage**: Authentication, session management, logout

---

#### WorkflowOperations
**Tests**: 3 weighted tasks
1. List workflows (weight: 3)
2. Get workflow detail (weight: 2)
3. Create workflow (weight: 1)

**Coverage**: CRUD operations, list pagination, detail retrieval

---

#### FormSubmissionFlow
**Tests**: 2 sequential tasks
1. Get form definition (weight: 2)
2. Submit form data (weight: 1)

**Coverage**: Form retrieval, validation, submission

---

#### CatalogBrowsing
**Tests**: 3 weighted tasks
1. List suppliers (weight: 3)
2. List customers (weight: 3)
3. Search suppliers (weight: 2)

**Coverage**: List views, search functionality, pagination

---

## Test Scenarios

### Scenario 1: Normal Traffic (Baseline)
```bash
locust -f locustfile.py \
  --users 50 \
  --spawn-rate 5 \
  --run-time 5m \
  --host=http://localhost:8000
```

**Expected Metrics**:
- Response time: < 200ms (p95)
- RPS: 100-200
- Error rate: < 1%

---

### Scenario 2: Peak Traffic (3x Normal)
```bash
locust -f locustfile.py \
  --users 150 \
  --spawn-rate 10 \
  --run-time 10m \
  --host=http://localhost:8000
```

**Expected Metrics**:
- Response time: < 500ms (p95)
- RPS: 300-500
- Error rate: < 2%

---

### Scenario 3: Stress Test (Breaking Point)
```bash
locust -f locustfile.py \
  --users 1000 \
  --spawn-rate 20 \
  --run-time 15m \
  --host=http://localhost:8000 \
  --html=stress_test.html
```

**Goal**: Identify bottlenecks and failure points

---

### Scenario 4: Endurance Test (1 Hour)
```bash
locust -f locustfile.py \
  --users 100 \
  --spawn-rate 5 \
  --run-time 60m \
  --host=http://localhost:8000 \
  --html=endurance_test.html
```

**Goal**: Detect memory leaks and resource exhaustion

---

## Performance Targets

### Response Time (p95)
| Endpoint Type | Target | Acceptable | Critical |
|---------------|--------|------------|----------|
| **Authentication** | <100ms | <200ms | <500ms |
| **List Views** | <200ms | <500ms | <1000ms |
| **Detail Views** | <100ms | <200ms | <500ms |
| **Form Submissions** | <300ms | <500ms | <1000ms |
| **Search** | <300ms | <600ms | <1200ms |

### Throughput
| Load Level | Users | RPS | Target Response Time |
|------------|-------|-----|----------------------|
| **Light** | 1-50 | 50-100 | <200ms |
| **Normal** | 50-200 | 100-300 | <300ms |
| **Peak** | 200-500 | 300-800 | <500ms |
| **Stress** | 500-1000+ | 800-1500+ | <1000ms |

### Error Rates
- **Acceptable**: < 1%
- **Warning**: 1-5%
- **Critical**: > 5%

---

## Technical Implementation

### Sequential Task Sets
```python
class WorkflowOperations(SequentialTaskSet):
    """
    Tasks run in defined order:
    1. Login
    2. List workflows
    3. Create workflow
    4. Logout
    """
    
    def on_start(self):
        self.login()  # Authenticate before tasks
    
    @task(3)
    def list_workflows(self):
        # Task logic
        pass
```

### Session Management
```python
def login(self):
    response = self.client.post("/api/auth/login/", json=payload)
    if response.status_code == 200:
        data = response.json()
        self.user.auth_token = data.get("access")  # Store token
        self.user.tenant_id = data.get("tenant_id")

def get_headers(self):
    return {
        "Authorization": f"Bearer {self.user.auth_token}",
        "X-Tenant-ID": str(self.user.tenant_id),
    }
```

### Event Hooks
```python
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print(f"Load test starting on {environment.host}...")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print(f"Total requests: {environment.stats.total.num_requests}")
    print(f"Average response time: {environment.stats.total.avg_response_time:.2f}ms")
```

---

## Documentation

**File**: `docs/LOAD_TESTING.md` (11 KB)

**Contents**:
- Installation instructions
- Running load tests (local, headless, production)
- User profiles explained
- Test scenarios with commands
- Performance targets table
- Interpreting results (response time distribution, RPS, error rates)
- Optimization strategies (database queries, N+1 problems, caching)
- CI/CD integration example (GitHub Actions)
- Best practices (start small, realistic data, monitor infrastructure)
- Troubleshooting guide

---

## Usage Examples

### Local Development
```bash
# With web UI (http://localhost:8089)
locust -f locustfile.py --host=http://localhost:8000

# Headless (100 users, 5 min)
locust -f locustfile.py \
  --headless \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --host=http://localhost:8000 \
  --html=load_test_report.html
```

### Production (Caution!)
```bash
# Conservative start
locust -f locustfile.py \
  --headless \
  --users 50 \
  --spawn-rate 2 \
  --run-time 1m \
  --host=https://api.meatscentral.com

# Full stress test (coordinate with ops team)
locust -f locustfile.py \
  --users 1000 \
  --spawn-rate 20 \
  --run-time 10m \
  --host=https://api.meatscentral.com \
  --html=stress_test_report.html
```

---

## CI/CD Integration (Proposed)

### GitHub Actions Workflow
```yaml
name: Weekly Load Test

on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install Locust
        run: pip install locust
      
      - name: Run Load Test
        run: |
          locust -f backend/locustfile.py \
            --headless \
            --users 100 \
            --spawn-rate 10 \
            --run-time 5m \
            --host=https://dev.meatscentral.com \
            --html=load_test_report.html
      
      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: load-test-report
          path: load_test_report.html
```

---

## Metrics

| Metric | Value |
|--------|-------|
| **Files Created** | 2 |
| **Lines of Code** | 450+ |
| **User Profiles** | 3 |
| **Task Sets** | 4 |
| **Test Scenarios** | 13 tasks |
| **Time Invested** | 2 hours |
| **Documentation** | 11 KB |

---

## Success Criteria

### Completed ✅
- [x] Locust installed and configured
- [x] Multi-user profiles (standard, admin, read-only)
- [x] Sequential task sets for realistic flows
- [x] Session management (authentication tokens)
- [x] Event hooks for custom reporting
- [x] Performance targets documented
- [x] Comprehensive usage guide
- [x] CI/CD integration example
- [x] Troubleshooting guide

### Future Work
- [ ] Create test users/tenants for load testing
- [ ] Integrate with CI/CD pipeline
- [ ] Set up performance monitoring dashboard
- [ ] Establish performance regression alerts
- [ ] Create load testing environment (dedicated staging)

---

## Known Limitations

1. **Test Data Required**: Load test assumes test users/tenants exist (needs seeding)
2. **No Distributed Mode**: Single-node Locust (can be extended to distributed mode)
3. **Static Scenarios**: Tasks use hardcoded IDs (needs dynamic data generation)
4. **No WebSocket Testing**: Doesn't test real-time features (future enhancement)

---

## Optimization Strategies (Documented)

### Database Optimization
- **N+1 Query Detection**: Use `select_related()`, `prefetch_related()`
- **Indexing**: Add indexes on frequently queried fields
- **Connection Pooling**: Enable `CONN_MAX_AGE` for persistent connections
- **Query Timeout**: Set statement timeout to prevent runaway queries

### Application Optimization
- **Caching**: Implement Redis for expensive queries
- **Pagination**: Limit result sets to reduce memory usage
- **Serializer Optimization**: Use `only()` to fetch required fields
- **Background Tasks**: Offload heavy processing to Celery

### Infrastructure Optimization
- **Horizontal Scaling**: Use load balancers with multiple backend instances
- **Resource Allocation**: Increase container CPU/memory limits
- **Database Scaling**: Use read replicas for read-heavy workloads
- **CDN**: Offload static assets to reduce backend load

---

## Next Steps

1. **Establish Baseline**: Run load tests to establish current performance baseline
2. **Create Test Data**: Seed database with test users/workflows/forms
3. **Schedule Regular Tests**: Set up weekly load tests in CI/CD
4. **Monitor Production**: Compare load test results with real-world APM data
5. **Iterate**: Optimize based on bottlenecks, re-test, document improvements

---

**Status**: ✅ Complete - Ready for execution  
**Next**: Establish performance baseline with 100-user load test  
**Impact**: Proactive performance monitoring + capacity planning

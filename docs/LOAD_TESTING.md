# Load Testing Documentation

## Overview

ProjectMeats uses **Locust** for load testing and performance benchmarking. Locust is a Python-based load testing tool that simulates thousands of concurrent users accessing your API.

---

## Installation

```bash
# Install Locust
pip install locust

# Verify installation
locust --version
```

---

## Running Load Tests

### 1. Local Development Testing

```bash
# Navigate to backend directory
cd backend/

# Run with web UI (recommended for monitoring)
locust -f locustfile.py --host=http://localhost:8000

# Open browser to http://localhost:8089
# Configure: Number of users, spawn rate, host
# Click "Start Swarming"
```

### 2. Headless Mode (CI/CD)

```bash
# Run 100 users, 5 spawn rate, 2 minutes
locust -f locustfile.py \
  --headless \
  --users 100 \
  --spawn-rate 5 \
  --run-time 2m \
  --host=http://localhost:8000

# With HTML report
locust -f locustfile.py \
  --headless \
  --users 100 \
  --spawn-rate 5 \
  --run-time 2m \
  --host=http://localhost:8000 \
  --html=load_test_report.html
```

### 3. Production Load Testing

**⚠️ WARNING**: Only run production load tests during agreed-upon maintenance windows with scaled infrastructure.

```bash
# Start conservatively
locust -f locustfile.py \
  --headless \
  --users 50 \
  --spawn-rate 2 \
  --run-time 1m \
  --host=https://meatscentral.com

# Gradually increase
locust -f locustfile.py \
  --users 500 \
  --spawn-rate 10 \
  --run-time 5m \
  --host=https://meatscentral.com

# Stress test (1000+ users)
locust -f locustfile.py \
  --users 1000 \
  --spawn-rate 20 \
  --run-time 10m \
  --host=https://meatscentral.com \
  --html=stress_test_report.html
```

---

## User Profiles

### ProjectMeatsUser (Standard User)
- **Weight**: Balanced
- **Tasks**:
  - Authentication (10%)
  - Workflow operations (30%)
  - Form submissions (20%)
  - Catalog browsing (40%)
- **Think time**: 1-3 seconds

### AdminUser (Power User)
- **Weight**: High workflow activity
- **Tasks**:
  - Workflow operations (50%)
  - Form submissions (20%)
  - Catalog browsing (30%)
- **Think time**: 0.5-2 seconds

### ReadOnlyUser (Browse-Only)
- **Weight**: High browsing activity
- **Tasks**:
  - Catalog browsing only (100%)
- **Think time**: 2-5 seconds

---

## Test Scenarios

### Scenario 1: Normal Traffic (Baseline)
```bash
# Simulate typical weekday traffic
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

### Scenario 2: Peak Traffic (Black Friday)
```bash
# Simulate 3x normal traffic
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

### Scenario 3: Stress Test (Breaking Point)
```bash
# Find system limits
locust -f locustfile.py \
  --users 1000 \
  --spawn-rate 20 \
  --run-time 15m \
  --host=http://localhost:8000 \
  --html=stress_test.html
```

**Goal**: Identify bottlenecks and failure points

### Scenario 4: Sustained Load (Endurance Test)
```bash
# Test for 1 hour
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

## Interpreting Results

### Key Metrics

#### 1. Response Time Distribution
```
Name                    # reqs   50%    95%    99%   avg    min    max
/api/auth/login/        1000     45ms   120ms  180ms  55ms   30ms   250ms
/api/workflows/         5000     80ms   200ms  350ms  95ms   40ms   500ms
/api/forms/123/submit/  2000     120ms  300ms  450ms  140ms  60ms   600ms
```

**Analysis**:
- **50th percentile**: Half of requests faster than this
- **95th percentile**: 95% of users experience this or better
- **99th percentile**: Outliers (network issues, cold starts)

#### 2. Requests Per Second (RPS)
```
Total requests: 50,000
Duration: 300s
RPS: 166.67
```

**Analysis**:
- Measures throughput capacity
- Compare against target load
- Identify peak capacity before degradation

#### 3. Error Rate
```
Total failures: 50 (1% of 5000 requests)
- 401 Unauthorized: 30 (60%)
- 500 Internal Server Error: 15 (30%)
- 504 Gateway Timeout: 5 (10%)
```

**Analysis**:
- **401**: Authentication issues (test data problem)
- **500**: Application errors (code bugs)
- **504**: Timeout (slow queries, DB bottleneck)

---

## Optimizing Based on Results

### If Response Times are High (>500ms)

#### Check Database Queries
```python
# Django Debug Toolbar or query logging
from django.db import connection
print(len(connection.queries))  # Number of queries
print(connection.queries)  # Query details
```

**Solutions**:
- Add `select_related()` for foreign keys
- Add `prefetch_related()` for many-to-many
- Add database indexes on frequently queried fields
- Cache expensive queries (Redis)

#### Check for N+1 Queries
```python
# Bad (N+1 query problem)
suppliers = Supplier.objects.filter(tenant=tenant)
for supplier in suppliers:
    print(supplier.products.count())  # Query per supplier!

# Good (prefetch)
suppliers = Supplier.objects.filter(tenant=tenant).prefetch_related('products')
for supplier in suppliers:
    print(supplier.products.count())  # No extra queries
```

---

### If Error Rates are High (>5%)

#### Check Logs
```bash
# Backend logs
docker logs pm-backend --tail 100

# Filter for errors
docker logs pm-backend | grep "ERROR"
docker logs pm-backend | grep "500"
```

#### Common Issues
1. **Rate limiting**: Increase rate limits or whitelist load test IPs
2. **Connection pooling**: Increase database connection pool size
3. **Memory issues**: Scale up backend container resources
4. **Tenant isolation**: Ensure test users have proper tenant assignments

---

### If RPS is Low (<100)

#### Horizontal Scaling
```bash
# Increase backend instances
docker-compose up --scale backend=3

# Verify backend is reachable
curl http://localhost:8000/api/v1/health/
```

#### Connection Pooling
```python
# settings/production.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 600,  # Persistent connections
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000',  # 30s query timeout
        },
    }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Load Testing

on:
  schedule:
    # Run every Sunday at 2 AM
    - cron: '0 2 * * 0'
  workflow_dispatch:
    inputs:
      users:
        description: 'Number of users'
        required: true
        default: '100'
      duration:
        description: 'Test duration (e.g., 5m, 10m)'
        required: true
        default: '5m'

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
            --users ${{ inputs.users || '100' }} \
            --spawn-rate 10 \
            --run-time ${{ inputs.duration || '5m' }} \
            --host=https://dev.meatscentral.com \
            --html=load_test_report.html \
            --csv=load_test_results

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: load-test-report
          path: |
            load_test_report.html
            load_test_results*.csv

      - name: Check Performance Threshold
        run: |
          # Parse CSV and fail if p95 > 500ms
          python scripts/check_performance_threshold.py load_test_results_stats.csv
```

---

## Best Practices

### 1. Start Small
- Begin with 10-20 users
- Increase gradually (double each run)
- Monitor system resources (CPU, memory, DB connections)

### 2. Use Realistic Data
- Create test users/tenants in advance
- Seed database with realistic data volumes
- Use varied test data (different suppliers, forms, etc.)

### 3. Monitor Infrastructure
- Watch CPU, memory, disk I/O during tests
- Monitor database connection pool
- Check network bandwidth

### 4. Isolate Environment
- Run load tests on dedicated staging environment
- Don't run against production without approval
- Use separate database for load testing

### 5. Analyze Bottlenecks
- Profile slow endpoints (Django Debug Toolbar)
- Use APM tools (Sentry Performance, New Relic)
- Check database slow query log

---

## Troubleshooting

### Issue: Connection Refused
```
ConnectionError: HTTPConnectionPool(host='localhost', port=8000):
Max retries exceeded with url: /api/auth/login/
```

**Solutions**:
- Verify backend is running: `curl http://localhost:8000/api/v1/health/`
- Check firewall rules
- Ensure correct host/port in `--host` parameter

---

### Issue: Authentication Failures (401)
```
POST /api/auth/login/ - 401 Unauthorized (100 failures)
```

**Solutions**:
- Create test users before running load test
- Verify credentials in `locustfile.py`
- Check backend logs for authentication errors

---

### Issue: High Memory Usage
```
Backend container using 4GB+ RAM during load test
```

**Solutions**:
- Add connection pooling (`CONN_MAX_AGE`)
- Implement caching (Redis)
- Optimize queryset evaluation (avoid loading all data into memory)
- Use pagination for list views

---

## Next Steps

1. **Establish Baseline**: Run load tests on current code to establish performance baseline
2. **Set Targets**: Define acceptable response times and throughput for your SLA
3. **Regular Testing**: Schedule weekly load tests to detect performance regressions
4. **Monitor Production**: Use APM tools to correlate load test results with real-world performance
5. **Iterate**: Optimize based on results, re-test, repeat

---

**Documentation Status**: ✅ Complete
**Last Updated**: February 26, 2026
**Part of**: Gap Analysis Phase 6.6 - Load Testing

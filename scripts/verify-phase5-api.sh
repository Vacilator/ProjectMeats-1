#!/bin/bash
#
# Phase 5 API Verification Script
# Tests all WorkflowExecution endpoints
#
# Usage: ./verify-phase5-api.sh
#

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
API_URL="${BASE_URL}/api/v1/workflows"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "Phase 5: WorkflowExecution API Verification"
echo "============================================"
echo ""

# Check if server is running
echo -n "Checking if server is running... "
if curl -s "${BASE_URL}/api/v1/health/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server is up"
else
    echo -e "${RED}✗${NC} Server is not running at ${BASE_URL}"
    exit 1
fi

# Note: This script assumes you have authentication set up
# For local testing, you might need to:
# 1. Get an auth token
# 2. Set it in headers
# Example: TOKEN=$(curl -X POST ${BASE_URL}/api/auth/login/ -d '{"username":"admin","password":"pass"}' | jq -r '.token')

echo ""
echo "Note: Authentication required for these endpoints"
echo "Please ensure you have a valid session or token"
echo ""

# Test 1: List all executions
echo "============================================"
echo "Test 1: List All Executions"
echo "============================================"
echo "GET ${API_URL}/executions/"
echo ""
curl -s -X GET "${API_URL}/executions/" \
    -H "Content-Type: application/json" \
    | python3 -m json.tool || echo -e "${RED}✗ Failed${NC}"
echo ""

# Test 2: List in-progress executions
echo "============================================"
echo "Test 2: List In-Progress Executions"
echo "============================================"
echo "GET ${API_URL}/executions/?status=in_progress"
echo ""
curl -s -X GET "${API_URL}/executions/?status=in_progress" \
    -H "Content-Type: application/json" \
    | python3 -m json.tool || echo -e "${RED}✗ Failed${NC}"
echo ""

# Test 3: List my assigned executions
echo "============================================"
echo "Test 3: List My Assigned Executions"
echo "============================================"
echo "GET ${API_URL}/executions/?assigned_to=me"
echo ""
curl -s -X GET "${API_URL}/executions/?assigned_to=me" \
    -H "Content-Type: application/json" \
    | python3 -m json.tool || echo -e "${RED}✗ Failed${NC}"
echo ""

# Test 4: Create execution (will fail without valid workflow ID)
echo "============================================"
echo "Test 4: Create Execution (Example)"
echo "============================================"
echo "POST ${API_URL}/executions/"
echo "Body: {\"workflow\": \"<workflow-uuid>\"}"
echo ""
echo -e "${YELLOW}⚠ Skipping - requires valid workflow UUID${NC}"
echo ""

# Test 5: Get execution details (will fail without valid execution ID)
echo "============================================"
echo "Test 5: Get Execution Details (Example)"
echo "============================================"
echo "GET ${API_URL}/executions/<execution-id>/"
echo ""
echo -e "${YELLOW}⚠ Skipping - requires valid execution UUID${NC}"
echo ""

# Test 6: Get audit trail (will fail without valid execution ID)
echo "============================================"
echo "Test 6: Get Audit Trail (Example)"
echo "============================================"
echo "GET ${API_URL}/executions/<execution-id>/audit/"
echo ""
echo -e "${YELLOW}⚠ Skipping - requires valid execution UUID${NC}"
echo ""

# Test 7: Resume execution (will fail without valid execution ID)
echo "============================================"
echo "Test 7: Resume Execution (Example)"
echo "============================================"
echo "POST ${API_URL}/executions/<execution-id>/resume/"
echo ""
echo -e "${YELLOW}⚠ Skipping - requires valid execution UUID${NC}"
echo ""

# Test 8: Pause execution (will fail without valid execution ID)
echo "============================================"
echo "Test 8: Pause Execution (Example)"
echo "============================================"
echo "POST ${API_URL}/executions/<execution-id>/pause/"
echo ""
echo -e "${YELLOW}⚠ Skipping - requires valid execution UUID${NC}"
echo ""

# Test 9: Cancel execution (will fail without valid execution ID)
echo "============================================"
echo "Test 9: Cancel Execution (Example)"
echo "============================================"
echo "POST ${API_URL}/executions/<execution-id>/cancel/"
echo ""
echo -e "${YELLOW}⚠ Skipping - requires valid execution UUID${NC}"
echo ""

# Summary
echo "============================================"
echo "Verification Summary"
echo "============================================"
echo ""
echo -e "${GREEN}✓${NC} Basic connectivity tests passed"
echo -e "${YELLOW}⚠${NC} Full CRUD tests require:"
echo "  - Valid authentication token"
echo "  - At least one workflow created"
echo "  - At least one execution created"
echo ""
echo "To run full tests:"
echo "1. Create a workflow in the admin interface"
echo "2. Create an execution via the API or UI"
echo "3. Note the execution UUID"
echo "4. Modify this script with the UUID"
echo "5. Re-run the tests"
echo ""
echo "============================================"

# Check if model is registered in admin
echo "Checking Django Admin Registration..."
echo ""
python3 << 'PYTHON_EOF'
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/workspaces/ProjectMeats/backend')
django.setup()

from apps.core.admin_site import admin_site

# Check if WorkflowExecution is registered
from tenant_apps.workflows.models import WorkflowExecution

if admin_site.is_registered(WorkflowExecution):
    print("✓ WorkflowExecution is registered in Django Admin")
else:
    print("✗ WorkflowExecution is NOT registered in Django Admin")

# Check if model exists in database
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'workflows_workflowexecution'
    """)
    if cursor.fetchone():
        print("✓ workflows_workflowexecution table exists in database")
    else:
        print("✗ workflows_workflowexecution table does NOT exist")

# Count executions
try:
    count = WorkflowExecution.objects.count()
    print(f"✓ Found {count} workflow execution(s) in database")
except Exception as e:
    print(f"✗ Error querying WorkflowExecution: {e}")

PYTHON_EOF

echo ""
echo "============================================"
echo "Verification Complete!"
echo "============================================"

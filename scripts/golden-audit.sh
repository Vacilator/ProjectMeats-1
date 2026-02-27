#!/bin/bash
#
# Golden Audit Script - SSH & Database Connectivity Verification
# 
# Tests connectivity across all 6 environment lanes:
# - dev-backend, uat-backend, prod-backend (database via SQL)
# - dev-frontend, uat-frontend, prod-frontend (shell via uptime)
#
# Usage: ./scripts/golden-audit.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Audit results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print status
print_status() {
  local status=$1
  local env=$2
  local message=$3
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if [ "$status" == "PASS" ]; then
    echo -e "${GREEN}✓${NC} $env: $message"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  elif [ "$status" == "FAIL" ]; then
    echo -e "${RED}✗${NC} $env: $message"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  else
    echo -e "${YELLOW}⚠${NC} $env: $message"
  fi
}

# Function to trigger workflow and check status
trigger_audit() {
  local environment=$1
  local type=$2
  local script=$3
  local description=$4
  
  echo -e "\n${BLUE}🔍 Auditing: $environment ($type)${NC}"
  echo "Command: $script"
  
  # Trigger the workflow
  RUN_ID=$(gh workflow run 98-ops-db-surgery.yml \
    -f environment="$environment" \
    -f type="$type" \
    -f script="$script" \
    --json url,databaseId 2>&1 | tee /tmp/gh-output.txt | grep -oP 'https://github.com/[^/]+/[^/]+/actions/runs/\K[0-9]+' || echo "")
  
  if [ -z "$RUN_ID" ]; then
    # Try to extract from JSON output
    RUN_ID=$(cat /tmp/gh-output.txt | jq -r '.databaseId' 2>/dev/null || echo "")
  fi
  
  if [ -z "$RUN_ID" ]; then
    print_status "FAIL" "$environment" "Failed to trigger workflow (check secrets/permissions)"
    return 1
  fi
  
  echo "Workflow triggered: Run ID $RUN_ID"
  echo "Waiting for completion (max 2 minutes)..."
  
  # Wait for workflow to complete (max 2 minutes)
  MAX_WAIT=24 # 24 * 5 seconds = 2 minutes
  WAIT_COUNT=0
  
  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Check workflow status
    STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '.status + ":" + (.conclusion // "running")' 2>/dev/null || echo "unknown")
    
    if [[ "$STATUS" == "completed:success" ]]; then
      print_status "PASS" "$environment" "$description - Connectivity verified"
      return 0
    elif [[ "$STATUS" == "completed:failure" ]]; then
      print_status "FAIL" "$environment" "$description - Workflow failed (check logs: https://github.com/Meats-Central/ProjectMeats/actions/runs/$RUN_ID)"
      return 1
    elif [[ "$STATUS" == "completed:"* ]]; then
      print_status "FAIL" "$environment" "$description - Workflow $STATUS"
      return 1
    fi
    
    # Still running
    echo -n "."
    sleep 5
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
  
  # Timeout
  print_status "WARN" "$environment" "$description - Timeout waiting for workflow (check: https://github.com/Meats-Central/ProjectMeats/actions/runs/$RUN_ID)"
  return 1
}

# Main audit
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Golden Audit - Connectivity Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Testing SSH and database connectivity across 6 environment lanes"
echo ""

# Backend environments (SQL test)
echo -e "\n${YELLOW}=== Backend Environments (Database) ===${NC}"

trigger_audit "dev" "sql" "SELECT version();" "Database version check" || true
trigger_audit "uat" "sql" "SELECT version();" "Database version check" || true
trigger_audit "prod" "sql" "SELECT version();" "Database version check" || true

# Frontend environments (Shell test)
echo -e "\n${YELLOW}=== Frontend Environments (SSH) ===${NC}"

trigger_audit "dev" "shell" "uptime" "Server uptime check" || true
trigger_audit "uat" "shell" "uptime" "Server uptime check" || true
trigger_audit "prod" "shell" "uptime" "Server uptime check" || true

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}   Audit Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ GOLDEN AUDIT PASSED - All environments reachable${NC}"
  exit 0
else
  PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
  echo -e "${YELLOW}⚠️ GOLDEN AUDIT PARTIAL - $PASS_RATE% pass rate${NC}"
  echo ""
  echo "Action Items:"
  echo "1. Check GitHub Secrets configuration for failed environments"
  echo "2. Verify SSH credentials and host accessibility"
  echo "3. Review workflow logs: https://github.com/Meats-Central/ProjectMeats/actions/workflows/98-ops-db-surgery.yml"
  exit 1
fi

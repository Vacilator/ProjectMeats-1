#!/bin/bash
# Pre-deployment Safety Checks
# Validates environment and deployment readiness before proceeding

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT="${1:-}"
REQUIRED_SECRETS="${2:-}"

if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: Environment not specified${NC}"
    echo "Usage: $0 <dev|uat|prod> [required_secrets_list]"
    exit 1
fi

echo "=== Pre-Deployment Check for $ENVIRONMENT ==="

# Check 1: Verify required environment variables
check_env_vars() {
    echo -e "\n${YELLOW}Checking environment variables...${NC}"
    local missing=0
    
    # Common required variables
    local common_vars="REGISTRY FRONTEND_IMAGE BACKEND_IMAGE"
    
    for var in $common_vars; do
        if [ -z "${!var:-}" ]; then
            echo -e "${RED}✗ Missing: $var${NC}"
            missing=$((missing + 1))
        else
            echo -e "${GREEN}✓ Found: $var${NC}"
        fi
    done
    
    if [ $missing -gt 0 ]; then
        echo -e "${RED}Error: $missing required environment variables missing${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ All required environment variables present${NC}"
    return 0
}

# Check 2: Verify Docker daemon is running
check_docker() {
    echo -e "\n${YELLOW}Checking Docker daemon...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not found${NC}"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}✗ Docker daemon not running${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Docker daemon running${NC}"
    return 0
}

# Check 3: Verify registry connectivity
check_registry() {
    echo -e "\n${YELLOW}Checking registry connectivity...${NC}"
    if [ -z "${REGISTRY:-}" ]; then
        echo -e "${RED}✗ REGISTRY not set${NC}"
        return 1
    fi
    
    # Try to ping registry (basic connectivity check)
    if ! timeout 5 bash -c "echo > /dev/tcp/$(echo $REGISTRY | cut -d'/' -f1)/443" 2>/dev/null; then
        echo -e "${RED}✗ Cannot reach registry: $REGISTRY${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Registry reachable: $REGISTRY${NC}"
    return 0
}

# Check 4: Verify disk space
check_disk_space() {
    echo -e "\n${YELLOW}Checking disk space...${NC}"
    local available=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    local required=5
    
    if [ "$available" -lt "$required" ]; then
        echo -e "${RED}✗ Insufficient disk space: ${available}GB available, ${required}GB required${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Sufficient disk space: ${available}GB available${NC}"
    return 0
}

# Check 5: Verify no in-progress deployments
check_active_deployments() {
    echo -e "\n${YELLOW}Checking for active deployments...${NC}"
    
    # Check for deployment lock file
    local lock_file="/tmp/pm-deploy-${ENVIRONMENT}.lock"
    if [ -f "$lock_file" ]; then
        local lock_age=$(($(date +%s) - $(stat -c %Y "$lock_file" 2>/dev/null || echo 0)))
        if [ $lock_age -lt 600 ]; then  # 10 minutes
            echo -e "${RED}✗ Active deployment in progress (lock age: ${lock_age}s)${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠ Stale lock file found, removing...${NC}"
            rm -f "$lock_file"
        fi
    fi
    
    echo -e "${GREEN}✓ No active deployments${NC}"
    return 0
}

# Check 6: Validate deployment artifacts exist
check_artifacts() {
    echo -e "\n${YELLOW}Checking deployment artifacts...${NC}"
    
    # Check if Dockerfiles exist
    if [ ! -f "frontend/Dockerfile" ]; then
        echo -e "${RED}✗ Frontend Dockerfile not found${NC}"
        return 1
    fi
    
    if [ ! -f "backend/Dockerfile" ]; then
        echo -e "${RED}✗ Backend Dockerfile not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Deployment artifacts present${NC}"
    return 0
}

# NEW: Check 7: Verify previous deployment succeeded (prevent cascading failures)
check_previous_deployment() {
    echo -e "\n${YELLOW}Checking previous deployment status...${NC}"
    
    # Skip for dev (first in chain)
    if [ "$ENVIRONMENT" = "dev" ]; then
        echo -e "${GREEN}✓ Development environment (no upstream)${NC}"
        return 0
    fi
    
    # For UAT, check if dev deployment succeeded
    if [ "$ENVIRONMENT" = "uat" ]; then
        local prev_env="development"
    elif [ "$ENVIRONMENT" = "prod" ]; then
        local prev_env="uat"
    fi
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠ gh CLI not available, skipping upstream check${NC}"
        return 0
    fi
    
    # Get last deployment run for previous environment
    local last_run=$(gh run list --workflow="Master Pipeline" --branch "$prev_env" --limit 1 --json conclusion,status --jq '.[0]')
    local conclusion=$(echo "$last_run" | jq -r '.conclusion')
    local status=$(echo "$last_run" | jq -r '.status')
    
    if [ "$status" = "in_progress" ]; then
        echo -e "${YELLOW}⚠ Upstream deployment ($prev_env) still in progress${NC}"
        return 0  # Don't block, but warn
    fi
    
    if [ "$conclusion" != "success" ]; then
        echo -e "${RED}✗ Upstream deployment ($prev_env) failed or was cancelled${NC}"
        echo -e "${RED}  Blocking promotion to prevent cascading failures${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Upstream deployment ($prev_env) succeeded${NC}"
    return 0
}

# NEW: Check 8: Verify build artifacts are available
check_build_success() {
    echo -e "\n${YELLOW}Checking build artifacts...${NC}"
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠ gh CLI not available, skipping build check${NC}"
        return 0
    fi
    
    # Get current workflow run jobs
    local run_id="${GITHUB_RUN_ID:-}"
    if [ -z "$run_id" ]; then
        echo -e "${YELLOW}⚠ Not running in GitHub Actions, skipping build check${NC}"
        return 0
    fi
    
    # Check if build jobs succeeded
    local failed_builds=$(gh run view "$run_id" --json jobs --jq '.jobs[] | select(.name | contains("Build")) | select(.conclusion != "success") | .name')
    
    if [ -n "$failed_builds" ]; then
        echo -e "${RED}✗ Build jobs failed:${NC}"
        echo "$failed_builds"
        return 1
    fi
    
    echo -e "${GREEN}✓ All build jobs succeeded${NC}"
    return 0
}

# Run all checks
main() {
    local failed=0
    
    check_env_vars || failed=$((failed + 1))
    check_docker || failed=$((failed + 1))
    check_registry || failed=$((failed + 1))
    check_disk_space || failed=$((failed + 1))
    check_active_deployments || failed=$((failed + 1))
    check_artifacts || failed=$((failed + 1))
    check_previous_deployment || failed=$((failed + 1))
    check_build_success || failed=$((failed + 1))
    
    echo ""
    echo "================================"
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All pre-deployment checks passed${NC}"
        echo "================================"
        return 0
    else
        echo -e "${RED}✗ $failed check(s) failed${NC}"
        echo "================================"
        return 1
    fi
}

main

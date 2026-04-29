#!/bin/bash
# Deployment Rollback Script
# Rolls back to previous deployment version

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT="${1:-}"
COMPONENT="${2:-all}"  # frontend, backend, or all
REGISTRY="${REGISTRY:-registry.digitalocean.com/meatscentral}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-projectmeats-frontend}"
BACKEND_IMAGE="${BACKEND_IMAGE:-projectmeats-backend}"

normalize_environment() {
    case "$1" in
        dev|development)
            echo "development"
            ;;
        uat)
            echo "uat"
            ;;
        prod|production)
            echo "production"
            ;;
        *)
            return 1
            ;;
    esac
}

is_non_dev() {
    [[ "$ENVIRONMENT" != "development" ]]
}

resolve_existing_path() {
    local label=$1
    shift

    for candidate in "$@"; do
        if [ -e "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done

    echo -e "${RED}✗ ${label} not found. Checked: $*${NC}" >&2
    return 1
}

if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: Environment not specified${NC}"
    echo "Usage: $0 <development|uat|production> [frontend|backend|all]"
    exit 1
fi

if ! ENVIRONMENT="$(normalize_environment "$ENVIRONMENT")"; then
    echo -e "${RED}Error: Invalid environment '${1:-}'${NC}"
    echo "Usage: $0 <development|uat|production> [frontend|backend|all]"
    echo "Aliases supported: dev -> development, prod -> production"
    exit 1
fi

echo "=== Deployment Rollback: $ENVIRONMENT ($COMPONENT) ==="

# Function to get previous image tag
get_previous_tag() {
    local image=$1
    # List images and get the second most recent (first is current)
    docker images --format "{{.Tag}}" "$image" | grep -E "^${ENVIRONMENT}-" | head -n 2 | tail -n 1
}

resolve_image_ref() {
    local image=$1
    local explicit_ref=${2:-}

    if is_non_dev; then
        if [ -z "$explicit_ref" ]; then
            echo -e "${RED}✗ ${ENVIRONMENT} rollback requires an explicit immutable image ref.${NC}" >&2
            echo "  Export the matching BACKEND_IMAGE_REF or FRONTEND_IMAGE_REF variable before retrying." >&2
            echo "  Expected format: ${image}@sha256:<digest>" >&2
            return 1
        fi

        if [[ "$explicit_ref" != "$image@sha256:"* ]]; then
            echo -e "${RED}✗ Invalid image ref for ${image}.${NC}" >&2
            echo "  Expected immutable digest ref: ${image}@sha256:<digest>" >&2
            echo "  Received: ${explicit_ref}" >&2
            return 1
        fi

        echo "$explicit_ref"
        return 0
    fi

    local prev_tag
    prev_tag="$(get_previous_tag "$image")"
    if [ -z "$prev_tag" ]; then
        echo -e "${RED}✗ No previous version found for rollback${NC}" >&2
        return 1
    fi

    echo "${image}:${prev_tag}"
}

# Function to rollback container
rollback_container() {
    local container_name=$1
    local image_ref=$2
    local port_mapping=$3
    local volumes=$4
    local env_file=${5:-}
    
    echo -e "\n${YELLOW}Rolling back $container_name...${NC}"
    echo "Rollback image ref: $image_ref"
    
    # Stop current container
    echo "Stopping current container..."
    docker stop "$container_name" >/dev/null 2>&1 || true
    docker rm "$container_name" >/dev/null 2>&1 || true
    
    # Start container with previous version
    echo "Starting container with previous version..."
    local docker_cmd="docker run -d --name $container_name --restart unless-stopped $port_mapping"
    
    if [ -n "$env_file" ]; then
        docker_cmd="$docker_cmd --env-file $env_file"
    fi
    
    if [ -n "$volumes" ]; then
        docker_cmd="$docker_cmd $volumes"
    fi
    
    docker_cmd="$docker_cmd $image_ref"
    
    if eval "$docker_cmd"; then
        echo -e "${GREEN}✓ Rollback successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Rollback failed${NC}"
        return 1
    fi
}

# Rollback frontend
rollback_frontend() {
    echo -e "\n${YELLOW}=== Rolling back frontend ===${NC}"
    local image="$REGISTRY/$FRONTEND_IMAGE"
    local image_ref
    local env_config

    image_ref="$(resolve_image_ref "$image" "${FRONTEND_IMAGE_REF:-}")" || return 1
    env_config="$(resolve_existing_path "frontend env-config.js" "/opt/pm/frontend/env/env-config.js")" || return 1
    local volumes="-v ${env_config}:/usr/share/nginx/html/env-config.js:ro"
    
    rollback_container "pm-frontend" "$image_ref" "-p 127.0.0.1:8080:80" "$volumes"
}

# Rollback backend
rollback_backend() {
    echo -e "\n${YELLOW}=== Rolling back backend ===${NC}"
    local image="$REGISTRY/$BACKEND_IMAGE"
    local image_ref
    local env_file
    local media_dir
    local static_dir

    image_ref="$(resolve_image_ref "$image" "${BACKEND_IMAGE_REF:-}")" || return 1
    env_file="$(resolve_existing_path "backend .env" \
        "/root/projectmeats/backend/.env" \
        "/home/django/ProjectMeats/backend/.env")" || return 1
    media_dir="$(resolve_existing_path "backend media directory" \
        "/root/projectmeats/media" \
        "/home/django/ProjectMeats/media")" || return 1
    static_dir="$(resolve_existing_path "backend staticfiles directory" \
        "/root/projectmeats/staticfiles" \
        "/home/django/ProjectMeats/staticfiles")" || return 1

    local volumes="-v ${media_dir}:/app/media -v ${static_dir}:/app/staticfiles"
    
    rollback_container "pm-backend" "$image_ref" "-p 8000:8000" "$volumes" "$env_file"
}

# Create rollback snapshot
create_snapshot() {
    echo -e "\n${YELLOW}Creating rollback snapshot...${NC}"
    local snapshot_file="/tmp/pm-rollback-snapshot-$(date +%Y%m%d-%H%M%S).jsonl"

    docker ps --format json > "$snapshot_file"
    if command -v jq >/dev/null 2>&1; then
        jq -s '.' "$snapshot_file" > "${snapshot_file}.tmp"
        mv "${snapshot_file}.tmp" "$snapshot_file"
    fi
    echo -e "${GREEN}✓ Snapshot saved: $snapshot_file${NC}"
}

# Verify rollback
health_check_container() {
    local label=$1
    local url=$2
    local max_attempts=10

    echo "Waiting for $label health check: $url"
    for attempt in $(seq 1 "$max_attempts"); do
        HTTP_CODE=$(curl -L -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✓ ${label} health check passed${NC}"
            return 0
        fi
        echo "Health check ${attempt}/${max_attempts} returned HTTP ${HTTP_CODE}"
        sleep 3
    done

    echo -e "${RED}✗ ${label} health check failed${NC}"
    return 1
}

verify_rollback() {
    echo -e "\n${YELLOW}Verifying rollback...${NC}"
    local failed=0
    local backend_health_url="http://127.0.0.1:8000/api/v1/health/"

    if is_non_dev; then
        backend_health_url="http://127.0.0.1:8000/api/v1/ready/"
    fi
    
    if [ "$COMPONENT" = "frontend" ] || [ "$COMPONENT" = "all" ]; then
        if ! docker ps | grep -q pm-frontend; then
            echo -e "${RED}✗ Frontend container not running${NC}"
            failed=1
        elif ! health_check_container "frontend" "http://127.0.0.1:8080/"; then
            failed=1
        else
            echo -e "${GREEN}✓ Frontend container running${NC}"
        fi
    fi
    
    if [ "$COMPONENT" = "backend" ] || [ "$COMPONENT" = "all" ]; then
        if ! docker ps | grep -q pm-backend; then
            echo -e "${RED}✗ Backend container not running${NC}"
            failed=1
        elif ! health_check_container "backend" "$backend_health_url"; then
            failed=1
        else
            echo -e "${GREEN}✓ Backend container running${NC}"
        fi
    fi
    
    return $failed
}

print_observability_follow_up() {
    if ! is_non_dev; then
        return 0
    fi

    cat <<EOF

${YELLOW}Non-dev observability follow-up${NC}
- Review backend readiness directly: curl http://127.0.0.1:8000/api/v1/ready/
- Review backend integration signals: curl http://127.0.0.1:8000/api/v1/health/
- Re-run lane diagnostics from GitHub Actions:
  gh workflow run 99-ops-management-command.yml --repo Meats-Central/ProjectMeats \\
    -f environment=${ENVIRONMENT} \\
    -f command='check_infrastructure --require-redis-readiness'
- Confirm the rollback evidence (backend/frontend digest refs + health results) in the incident log.
EOF
}

# Main rollback process
main() {
    # Create snapshot before rollback
    create_snapshot
    
    case "$COMPONENT" in
        frontend)
            rollback_frontend
            ;;
        backend)
            rollback_backend
            ;;
        all)
            rollback_backend
            rollback_frontend
            ;;
        *)
            echo -e "${RED}Invalid component: $COMPONENT${NC}"
            exit 1
            ;;
    esac
    
    # Verify rollback
    if verify_rollback; then
        echo -e "\n${GREEN}=== Rollback completed successfully ===${NC}"
        print_observability_follow_up
        return 0
    else
        echo -e "\n${RED}=== Rollback verification failed ===${NC}"
        return 1
    fi
}

main

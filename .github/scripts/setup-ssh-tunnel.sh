#!/usr/bin/env bash
set -euo pipefail

echo "================================"
echo "Creating SSH Tunnel"
echo "================================"
echo "Target: $DB_HOST:$DB_PORT"
echo "Via Bastion: $BASTION_USER@$BASTION_HOST"
echo "Local Port: 5433"
echo ""

# First, verify SSH connectivity to bastion
echo "Step 1: Verifying bastion host connectivity..."
if ! sshpass -p "$SSHPASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  $BASTION_USER@$BASTION_HOST "echo '✓ Bastion host reachable'"; then
  echo "✗ Cannot connect to bastion host: $BASTION_HOST"
  echo "Possible causes:"
  echo "  1. Bastion host is down"
  echo "  2. SSH credentials are invalid"
  echo "  3. Firewall blocking GitHub Actions IP"
  echo "  4. fail2ban has blocked this IP"
  exit 1
fi

# Verify database is reachable from bastion
echo ""
echo "Step 2: Verifying database accessibility from bastion..."
if ! sshpass -p "$SSHPASS" ssh -o StrictHostKeyChecking=no \
  $BASTION_USER@$BASTION_HOST "nc -z -w 5 $DB_HOST $DB_PORT"; then
  echo "✗ Database $DB_HOST:$DB_PORT is not accessible from bastion"
  echo "Checking if database service is listening on bastion..."
  sshpass -p "$SSHPASS" ssh -o StrictHostKeyChecking=no \
    $BASTION_USER@$BASTION_HOST "netstat -tuln | grep :$DB_PORT || echo 'Port $DB_PORT not listening on bastion'"
  echo ""
  echo "Possible causes:"
  echo "  1. Database service is down"
  echo "  2. Database is not accessible from bastion host"
  echo "  3. DB_HOST ($DB_HOST) or DB_PORT ($DB_PORT) secrets are incorrect"
  echo "  4. Firewall rules blocking bastion -> database connection"
  exit 1
fi

echo "✓ Database is reachable from bastion"

# Function to forcefully cleanup port 5433
cleanup_port() {
  EXISTING_PIDS=$(lsof -ti:5433 2>/dev/null || true)
  if [ -n "$EXISTING_PIDS" ]; then
    echo "Force-killing processes on port 5433: $EXISTING_PIDS"
    for pid in $EXISTING_PIDS; do
      kill -9 "$pid" 2>/dev/null || true
    done
    sleep 2
  fi
}

# Initial cleanup
echo ""
echo "Step 3: Cleaning up any existing tunnels..."
cleanup_port

echo ""
echo "Step 4: Creating SSH tunnel..."
MAX_RETRIES=3
RETRY_COUNT=0
TUNNEL_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Tunnel creation attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."

  # Create SSH tunnel in background with keepalive options.
  # NOTE: Using ssh "-f" (fork) can be flaky in CI: the process may exit immediately even when
  # the command returns 0. Start the tunnel ourselves, capture PID, and verify it stays alive.
  sshpass -p "$SSHPASS" ssh \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o LogLevel=ERROR \
    -N \
    -L 5433:$DB_HOST:$DB_PORT \
    $BASTION_USER@$BASTION_HOST > /tmp/ssh_tunnel.log 2>&1 &

  TUNNEL_PID=$!
  sleep 1

  if kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "✓ Tunnel process started (pid=$TUNNEL_PID)"
    TUNNEL_SUCCESS=true
    break
  fi

  EXIT_CODE=$?
  echo "✗ Tunnel process exited immediately with exit code $EXIT_CODE (attempt $((RETRY_COUNT + 1)))"
  echo "SSH output:"
  cat /tmp/ssh_tunnel.log 2>/dev/null || echo "No log available"
  RETRY_COUNT=$((RETRY_COUNT + 1))

  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "Retrying in 5 seconds..."
    sleep 5
    cleanup_port
  fi
done

if [ "$TUNNEL_SUCCESS" = false ]; then
  echo "✗ SSH tunnel creation failed after $MAX_RETRIES attempts"
  echo "SSH log output:"
  cat /tmp/ssh_tunnel.log 2>/dev/null || echo "No log available"
  exit 1
fi

echo ""
echo "Step 5: Verifying tunnel is established and listening..."
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if nc -z 127.0.0.1 5433 2>/dev/null; then
    echo "✓ Port 5433 is listening"

    if ps aux | grep "ssh.*5433:$DB_HOST:$DB_PORT" | grep -v grep > /dev/null; then
      echo "✓ SSH tunnel process confirmed running"
      echo "✓ SSH tunnel established successfully!"
      exit 0
    fi

    echo "⚠ Port is listening but tunnel process not found in expected form"
    echo "Current SSH processes:"
    ps aux | grep ssh | grep -v grep || echo "No SSH processes found"
  fi

  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - tunnel not ready yet, waiting 2 seconds..."
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "✗ Failed to establish SSH tunnel after $MAX_ATTEMPTS attempts"
echo "Current SSH processes:"
ps aux | grep ssh | grep -v grep || echo "No SSH processes found"
echo "Port 5433 status:"
netstat -an | grep 5433 || echo "Port 5433 not listening"
echo "lsof check:"
lsof -i:5433 || echo "Port 5433 not in lsof"
echo "SSH log output:"
cat /tmp/ssh_tunnel.log 2>/dev/null || echo "No log available"
exit 1

#!/usr/bin/env bash
set -euo pipefail

# Stop all MoronList services (local processes and docker containers)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping all MoronList services..."

# Stop docker-compose services (devenv and production)
echo "Stopping Docker Compose services..."
if [ -f "$ROOT_DIR/devenv/docker-compose.yml" ]; then
  docker compose -f "$ROOT_DIR/devenv/docker-compose.yml" down 2>/dev/null || true
fi
if [ -f "$ROOT_DIR/production/docker-compose.yml" ]; then
  docker compose -f "$ROOT_DIR/production/docker-compose.yml" down 2>/dev/null || true
fi

# Kill any local node processes related to moronlist
echo "Stopping local Node.js processes..."
pkill -f "node.*moronlist" 2>/dev/null || true

# Free up common ports (MoronList: 6000, Persona: 6005, UI: 3000)
echo "Freeing ports 3000, 6000, 6005..."
for port in 3000 6000 6005; do
  lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done

# Wait for processes to terminate
sleep 2

echo "All MoronList services stopped"

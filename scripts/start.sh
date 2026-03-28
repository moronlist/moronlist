#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Load .env file
if [[ -f ".env" ]]; then
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found. Copy .env.example to .env and configure it."
  exit 1
fi

# Check if Persona is running (start via Docker Compose if not)
PERSONA_PORT="${PERSONA_SERVER_PORT:-4005}"
NEED_DOCKER_UP=false

if ! curl -s "http://localhost:$PERSONA_PORT/health" > /dev/null 2>&1; then
  echo -e "\033[1;33mPersona server is not running. Will start via Docker Compose...\033[0m"
  NEED_DOCKER_UP=true
fi

if [[ "$NEED_DOCKER_UP" == true ]]; then
  docker compose -f "$ROOT_DIR/devenv/docker-compose.yml" up -d

  # Wait for Persona to be healthy
  echo -n "Waiting for Persona to be ready"
  MAX_ATTEMPTS=30
  ATTEMPT=0
  while ! curl -s "http://localhost:$PERSONA_PORT/health" > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [[ $ATTEMPT -ge $MAX_ATTEMPTS ]]; then
      echo -e "\n\033[0;31mError: Persona failed to start after ${MAX_ATTEMPTS} attempts\033[0m"
      echo "Check Docker logs with: docker compose -f devenv/docker-compose.yml logs"
      exit 1
    fi
    echo -n "."
    sleep 1
  done
  echo -e " \033[0;32mready\033[0m"
fi

# Convert relative paths to absolute (since we cd into subdirectories)
if [[ -n "${MORONLIST_DATA_DIR:-}" ]] && [[ ! "$MORONLIST_DATA_DIR" = /* ]]; then
  export MORONLIST_DATA_DIR="$ROOT_DIR/$MORONLIST_DATA_DIR"
fi
if [[ -n "${MORONLIST_LOG_FILE_DIR:-}" ]] && [[ ! "$MORONLIST_LOG_FILE_DIR" = /* ]]; then
  export MORONLIST_LOG_FILE_DIR="$ROOT_DIR/$MORONLIST_LOG_FILE_DIR"
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "Starting services..."

# Function to kill processes on exit
cleanup() {
  trap - SIGINT SIGTERM  # Remove trap to prevent recursion
  echo -e "\n${YELLOW}Stopping services...${NC}"
  kill 0 2>/dev/null
  # Stop Docker containers (Persona)
  docker compose -f "$ROOT_DIR/devenv/docker-compose.yml" down 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Function to wait for server to be ready
wait_for_server() {
  local port="$1"
  local name="$2"

  # First try at 2 seconds (silent)
  sleep 2
  if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
    return 0
  fi

  # Second try at 5 seconds
  sleep 3
  if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
    return 0
  fi

  echo -e "${RED}$name failed to start on port $port${NC}"
  return 1
}

# Ensure data directories exist
if [[ -n "${MORONLIST_DATA_DIR:-}" ]]; then
  mkdir -p "$MORONLIST_DATA_DIR"
fi
if [[ -n "${MORONLIST_LOG_FILE_DIR:-}" ]]; then
  mkdir -p "$MORONLIST_LOG_FILE_DIR"
fi

# Run migrations
KNEX="$ROOT_DIR/node_modules/.bin/knex"

echo -e "${GREEN}Running MoronList migrations...${NC}"
NODE_ENV=${NODE_ENV:-development} $KNEX migrate:latest --knexfile "$ROOT_DIR/knexfile.moronlist.js" --env ${NODE_ENV:-development}

# Track PIDs
PIDS=()

# Start MoronList service
echo -e "${GREEN}Starting MoronList service...${NC}"
(cd node/packages/service/moronlist && npm run dev) &
MORONLIST_SERVER_PID=$!
PIDS+=($MORONLIST_SERVER_PID)
echo "MoronList server starting with PID $MORONLIST_SERVER_PID"

if ! wait_for_server "${MORONLIST_SERVER_PORT:-4000}" "MoronList server"; then
  kill "${PIDS[@]}" 2>/dev/null || true
  exit 1
fi
echo -e "${GREEN}MoronList server started successfully${NC}"

# Start MoronList UI
(cd node/packages/ui/moronlist-app && npm run dev) &
MORONLIST_UI_PID=$!
PIDS+=($MORONLIST_UI_PID)
echo "MoronList UI started with PID $MORONLIST_UI_PID"

echo -e "${GREEN}All services started${NC}"

# Wait for all processes
wait "${PIDS[@]}"

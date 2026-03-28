#!/bin/bash
# Deploy MoronList and Persona services to production server
# All services run from a SINGLE docker-compose file in one directory
# Usage: ./scripts/deploy.sh [--skip-build] [--force-build] [--frontend-only]

set -e

# Configuration
SERVER="moronlistuser@moronlist.com"

# Single deployment directory for all services
REMOTE_APP_DIR="/home/moronlistuser/moronlist"

# Remote data directories (explicit paths for each)
PERSONA_DATA_REMOTE_DIR="/home/moronlistuser/data/persona/db"
PERSONA_LOG_REMOTE_DIR="/home/moronlistuser/data/persona/logs"
MORONLIST_DATA_REMOTE_DIR="/home/moronlistuser/data/moronlist/db"
MORONLIST_LOG_REMOTE_DIR="/home/moronlistuser/data/moronlist/logs"

# Frontend directory (served by nginx)
MORONLIST_REMOTE_FRONTEND_DIR="/home/moronlistuser/frontend/moronlist"

# Docker image names (Persona is pulled from ghcr.io, not built locally)
PERSONA_IMAGE_NAME="ghcr.io/agilehead/persona:latest"
MORONLIST_IMAGE_NAME="moronlist-server"
MORONLIST_MIGRATIONS_IMAGE_NAME="moronlist-migrations"

# Build configuration - Frontend environment variables
VITE_PERSONA_URL="https://persona.moronlist.com"
VITE_API_URL="https://api.moronlist.com"
VITE_SITE_URL="https://moronlist.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Parse arguments
SKIP_BUILD=false
FORCE_BUILD=false
FRONTEND_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --force-build)
      FORCE_BUILD=true
      ;;
    --frontend-only)
      FRONTEND_ONLY=true
      ;;
  esac
done

echo -e "${GREEN}Deploying to production${NC}"
echo "   Server: $SERVER"
echo "   App directory: $REMOTE_APP_DIR"
if [ "$FRONTEND_ONLY" = true ]; then
  echo "   Mode: Frontend only (skipping Docker)"
fi
echo ""

# ============================================================================
# Change detection: determine which services need building
# ============================================================================

# Check if any of the given paths have changes since the base commit
has_changes() {
  local base_commit=$1
  shift
  for path in "$@"; do
    if git diff --name-only "$base_commit" HEAD -- "$path" | grep -q .; then
      return 0
    fi
  done
  return 1
}

# Initialize build flags (default: build everything)
BUILD_MORONLIST_DOCKER=true
BUILD_MORONLIST_FRONTEND=true

if [ "$SKIP_BUILD" = false ] && [ "$FORCE_BUILD" = false ]; then
  echo -e "${YELLOW}Checking for changes since last deploy...${NC}"
  LAST_DEPLOY_COMMIT=$(ssh $SERVER "cat $REMOTE_APP_DIR/.last-deploy-commit 2>/dev/null || echo ''")

  if [ -n "$LAST_DEPLOY_COMMIT" ] && git rev-parse --verify "$LAST_DEPLOY_COMMIT" >/dev/null 2>&1; then
    echo "  Last deployed commit: $LAST_DEPLOY_COMMIT"
    echo "  Current commit: $(git rev-parse HEAD)"

    # Check shared paths that trigger a full rebuild
    SHARED_CHANGED=false
    if has_changes "$LAST_DEPLOY_COMMIT" \
      "package.json" "package-lock.json" \
      "tsconfig.base.json" \
      "scripts/build.sh" "scripts/setup-hooks.sh" \
      "production/"; then
      SHARED_CHANGED=true
      echo "  Shared files changed - rebuilding all"
    fi

    if [ "$SHARED_CHANGED" = false ]; then
      # MoronList Docker
      if ! has_changes "$LAST_DEPLOY_COMMIT" \
        "node/packages/service/moronlist/" \
        "node/packages/lib/moronlist-db/" \
        "node/packages/lib/logger/" \
        "database/" \
        "knexfile.moronlist.js"; then
        BUILD_MORONLIST_DOCKER=false
      fi

      # MoronList frontend
      if ! has_changes "$LAST_DEPLOY_COMMIT" \
        "node/packages/ui/moronlist-app/"; then
        BUILD_MORONLIST_FRONTEND=false
      fi
    fi

    # Print build summary
    echo ""
    echo "  Build plan:"
    echo "    MoronList Docker:   $([ "$BUILD_MORONLIST_DOCKER" = true ] && echo "BUILD" || echo "skip (no changes)")"
    echo "    MoronList frontend: $([ "$BUILD_MORONLIST_FRONTEND" = true ] && echo "BUILD" || echo "skip (no changes)")"
    echo ""
  else
    echo "  No previous deploy found or commit not in history - building everything"
  fi
elif [ "$FORCE_BUILD" = true ]; then
  echo -e "${YELLOW}Force build enabled - building all${NC}"
fi

# ============================================================================
# Frontend-only deployment
# ============================================================================
if [ "$FRONTEND_ONLY" = true ]; then
  if [ "$BUILD_MORONLIST_FRONTEND" = true ]; then
    echo -e "${YELLOW}Building MoronList frontend...${NC}"
    cd node/packages/ui/moronlist-app
    VITE_PERSONA_URL=$VITE_PERSONA_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    npm run build
    cd "$ROOT_DIR"
    echo -e "${GREEN}MoronList frontend built${NC}"

    echo -e "${YELLOW}Deploying MoronList frontend...${NC}"
    ssh $SERVER "mkdir -p $MORONLIST_REMOTE_FRONTEND_DIR"
    rsync -avz --delete node/packages/ui/moronlist-app/dist/ $SERVER:$MORONLIST_REMOTE_FRONTEND_DIR/
    echo -e "${GREEN}MoronList frontend deployed${NC}"
  else
    echo -e "${YELLOW}Skipping MoronList frontend (no changes since last deploy)${NC}"
  fi

  # Save deployed commit for future change detection
  DEPLOY_COMMIT=$(git rev-parse HEAD)
  ssh $SERVER "echo '$DEPLOY_COMMIT' > $REMOTE_APP_DIR/.last-deploy-commit"
  echo -e "${GREEN}Saved deploy commit: $DEPLOY_COMMIT${NC}"

  echo ""
  echo -e "${GREEN}Frontend deployment complete!${NC}"
  exit 0
fi

# ============================================================================
# Full deployment (Docker + Frontend)
# ============================================================================

# Step 1: Build Docker images and frontend locally
if [ "$SKIP_BUILD" = false ]; then
  if [ "$BUILD_MORONLIST_DOCKER" = true ]; then
    echo -e "${YELLOW}Step 1a: Building MoronList Docker images locally...${NC}"
    DOCKER_BUILDKIT=1 docker build -f node/packages/service/moronlist/Dockerfile \
      --target migrations \
      -t ${MORONLIST_MIGRATIONS_IMAGE_NAME}:latest .
    DOCKER_BUILDKIT=1 docker build -f node/packages/service/moronlist/Dockerfile \
      --target production \
      -t ${MORONLIST_IMAGE_NAME}:latest .
    echo -e "${GREEN}MoronList Docker images built${NC}"
  else
    echo -e "${YELLOW}Skipping MoronList Docker build (no changes since last deploy)${NC}"
  fi

  if [ "$BUILD_MORONLIST_FRONTEND" = true ]; then
    echo -e "${YELLOW}Building MoronList frontend...${NC}"
    cd node/packages/ui/moronlist-app
    VITE_PERSONA_URL=$VITE_PERSONA_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    npm run build
    cd "$ROOT_DIR"
    echo -e "${GREEN}MoronList frontend built${NC}"
  else
    echo -e "${YELLOW}Skipping MoronList frontend build (no changes since last deploy)${NC}"
  fi
else
  echo -e "${YELLOW}Step 1: Skipping build (--skip-build)${NC}"
fi

# Step 2: Save images to tar files (pull Persona locally first)
echo -e "${YELLOW}Step 2: Saving images to tar files...${NC}"
TEMP_DIR=$(mktemp -d)

echo "Pulling Persona image from ghcr.io locally..."
docker pull $PERSONA_IMAGE_NAME
docker save $PERSONA_IMAGE_NAME | gzip > "$TEMP_DIR/persona.tar.gz"

if [[ "$BUILD_MORONLIST_DOCKER" == true ]]; then
  docker save ${MORONLIST_IMAGE_NAME}:latest | gzip > "$TEMP_DIR/moronlist-server.tar.gz"
  docker save ${MORONLIST_MIGRATIONS_IMAGE_NAME}:latest | gzip > "$TEMP_DIR/moronlist-migrations.tar.gz"
fi

echo -e "${GREEN}Images saved to $TEMP_DIR${NC}"

# Step 3: Create remote directories (NEVER touch data dirs if they exist)
echo -e "${YELLOW}Step 3: Setting up remote directories...${NC}"

ssh $SERVER "mkdir -p $REMOTE_APP_DIR"
ssh $SERVER "mkdir -p $PERSONA_DATA_REMOTE_DIR $PERSONA_LOG_REMOTE_DIR"
ssh $SERVER "mkdir -p $MORONLIST_DATA_REMOTE_DIR $MORONLIST_LOG_REMOTE_DIR"

echo -e "${GREEN}Remote directories ready${NC}"

# Step 4: Copy files to server (single docker-compose.yml for all services)
echo -e "${YELLOW}Step 4: Copying files to server...${NC}"

# Copy docker-compose.yml to the single app directory
scp production/docker-compose.yml $SERVER:$REMOTE_APP_DIR/

# Copy maintenance mode files to user's home directory
echo "Copying maintenance mode files..."
rsync -avz production/maintenance/ $SERVER:/home/moronlistuser/maintenance/
ssh $SERVER "chmod +x /home/moronlistuser/maintenance/maintenance-on.sh /home/moronlistuser/maintenance/maintenance-off.sh"

# Copy .env.production ONLY if .env doesn't exist on server (first deploy)
ENV_EXISTS=$(ssh $SERVER "[ -f $REMOTE_APP_DIR/.env ] && echo 'yes' || echo 'no'")
if [ "$ENV_EXISTS" = "no" ]; then
  if [ -f .env.production ]; then
    echo "First deploy: copying .env.production to server..."
    scp .env.production $SERVER:$REMOTE_APP_DIR/.env
  else
    echo -e "${RED}ERROR: No .env.production file found and no .env exists on server.${NC}"
    echo "Create .env.production with production secrets before first deploy."
    rm -rf "$TEMP_DIR"
    exit 1
  fi
else
  echo ".env already exists on server, skipping (secrets preserved)"
fi

echo -e "${GREEN}Files copied${NC}"

# Step 5: Deploy frontend
echo -e "${YELLOW}Step 5: Deploying frontend...${NC}"

if [[ "$BUILD_MORONLIST_FRONTEND" == true ]]; then
  ssh $SERVER "mkdir -p $MORONLIST_REMOTE_FRONTEND_DIR"
  rsync -avz --delete node/packages/ui/moronlist-app/dist/ $SERVER:$MORONLIST_REMOTE_FRONTEND_DIR/
  echo -e "${GREEN}MoronList frontend deployed${NC}"
else
  echo -e "${YELLOW}Skipping MoronList frontend deploy (no changes since last deploy)${NC}"
fi

# Step 6: Transfer Docker images to server (only if changed)
echo -e "${YELLOW}Step 6: Transferring Docker images to server (comparing hashes)...${NC}"

# Function to check if image needs transfer by comparing local and remote image IDs
needs_transfer() {
  local image_name=$1
  local local_id=$(docker images --no-trunc -q "$image_name" 2>/dev/null | head -1)
  local remote_id=$(ssh $SERVER "docker images --no-trunc -q '$image_name' 2>/dev/null | head -1")

  if [[ -z "$local_id" ]]; then
    echo "skip"  # No local image
  elif [[ "$local_id" == "$remote_id" ]]; then
    echo "skip"  # Same image
  else
    echo "transfer"
  fi
}

# Function to transfer and load an image
transfer_image() {
  local image_name=$1
  local tar_file=$2
  local result=$(needs_transfer "$image_name")

  if [[ "$result" == "transfer" ]]; then
    echo "  Transferring $image_name (changed)..."
    scp "$TEMP_DIR/$tar_file" $SERVER:/tmp/
    echo "  Loading $image_name on server..."
    ssh $SERVER "gunzip -c /tmp/$tar_file | docker load && rm /tmp/$tar_file"
  else
    echo "  Skipping $image_name (unchanged)"
  fi
}

transfer_image "$PERSONA_IMAGE_NAME" "persona.tar.gz"

if [[ "$BUILD_MORONLIST_DOCKER" == true ]]; then
  transfer_image "${MORONLIST_IMAGE_NAME}:latest" "moronlist-server.tar.gz"
  transfer_image "${MORONLIST_MIGRATIONS_IMAGE_NAME}:latest" "moronlist-migrations.tar.gz"
else
  echo "  Skipping MoronList image transfer (no changes since last deploy)"
fi

echo -e "${GREEN}Images transferred and loaded${NC}"

# Step 7: Run migrations
echo -e "${YELLOW}Step 7: Running database migrations...${NC}"

ssh $SERVER "cd $REMOTE_APP_DIR && \
  MORONLIST_DATA_HOST_DIR=$MORONLIST_DATA_REMOTE_DIR \
  docker compose run --rm moronlist-migrations"
echo -e "${GREEN}MoronList migrations complete${NC}"

# Step 8: Stop existing containers
echo -e "${YELLOW}Step 8: Stopping existing containers...${NC}"

ssh $SERVER "cd $REMOTE_APP_DIR && docker compose stop persona-server 2>/dev/null || true"
ssh $SERVER "cd $REMOTE_APP_DIR && docker compose rm -f persona-server 2>/dev/null || true"

ssh $SERVER "cd $REMOTE_APP_DIR && docker compose stop moronlist-server 2>/dev/null || true"
ssh $SERVER "cd $REMOTE_APP_DIR && docker compose rm -f moronlist-server 2>/dev/null || true"

echo -e "${GREEN}Old containers stopped${NC}"

# Step 9: Start new containers
echo -e "${YELLOW}Step 9: Starting new servers...${NC}"

# Start Persona first since moronlist depends on it for auth
ssh $SERVER "cd $REMOTE_APP_DIR && \
  PERSONA_DATA_HOST_DIR=$PERSONA_DATA_REMOTE_DIR \
  PERSONA_LOG_HOST_DIR=$PERSONA_LOG_REMOTE_DIR \
  docker compose up -d persona-server"
echo -e "${GREEN}Persona server started${NC}"
# Wait for Persona to be healthy before starting moronlist
echo "Waiting for Persona to be ready..."
sleep 5

ssh $SERVER "cd $REMOTE_APP_DIR && \
  MORONLIST_DATA_HOST_DIR=$MORONLIST_DATA_REMOTE_DIR \
  MORONLIST_LOG_HOST_DIR=$MORONLIST_LOG_REMOTE_DIR \
  docker compose up -d moronlist-server"
echo -e "${GREEN}MoronList server started${NC}"

# Step 10: Verify deployment
echo -e "${YELLOW}Step 10: Verifying deployment...${NC}"
sleep 5  # Wait for servers to start

PERSONA_HEALTH=$(ssh $SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:6005/health" || echo "000")
if [ "$PERSONA_HEALTH" = "200" ]; then
  echo -e "${GREEN}Persona health check passed!${NC}"
else
  echo -e "${RED}Persona health check failed (HTTP $PERSONA_HEALTH)${NC}"
  echo "Check logs with: ssh $SERVER 'cd $REMOTE_APP_DIR && docker compose logs persona-server'"
fi

MORONLIST_HEALTH=$(ssh $SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:6000/health" || echo "000")
if [ "$MORONLIST_HEALTH" = "200" ]; then
  echo -e "${GREEN}MoronList health check passed!${NC}"
else
  echo -e "${RED}MoronList health check failed (HTTP $MORONLIST_HEALTH)${NC}"
  echo "Check logs with: ssh $SERVER 'cd $REMOTE_APP_DIR && docker compose logs moronlist-server'"
fi

# Save deployed commit for future change detection
DEPLOY_COMMIT=$(git rev-parse HEAD)
ssh $SERVER "echo '$DEPLOY_COMMIT' > $REMOTE_APP_DIR/.last-deploy-commit"
echo -e "${GREEN}Saved deploy commit: $DEPLOY_COMMIT${NC}"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "App directory: $REMOTE_APP_DIR"
echo "Logs: ssh $SERVER 'cd $REMOTE_APP_DIR && docker compose logs -f'"
echo ""
echo "Persona:"
echo "  API: http://localhost:6005 on remote (proxied via nginx)"
echo "MoronList:"
echo "  API: http://localhost:6000 on remote (proxied via nginx)"
echo "  Frontend: $MORONLIST_REMOTE_FRONTEND_DIR"

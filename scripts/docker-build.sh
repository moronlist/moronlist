#!/usr/bin/env bash
set -euo pipefail

# Build Docker containers for MoronList

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "Building MoronList Docker containers..."

# Default target is production
TARGET="${1:-production}"

build_moronlist() {
  local target="$1"
  case "$target" in
    production)
      echo "Building MoronList migrations image..."
      DOCKER_BUILDKIT=1 docker build \
        -f node/packages/service/moronlist/Dockerfile \
        --target migrations \
        -t moronlist-migrations:latest \
        .
      echo "Building MoronList production image..."
      DOCKER_BUILDKIT=1 docker build \
        -f node/packages/service/moronlist/Dockerfile \
        --target production \
        -t moronlist-server:production \
        -t moronlist-server:latest \
        .
      ;;
    migrations)
      echo "Building MoronList migrations image only..."
      DOCKER_BUILDKIT=1 docker build \
        -f node/packages/service/moronlist/Dockerfile \
        --target migrations \
        -t moronlist-migrations:latest \
        .
      ;;
    development)
      echo "Building MoronList development image..."
      DOCKER_BUILDKIT=1 docker build \
        -f node/packages/service/moronlist/Dockerfile \
        --target development \
        -t moronlist-server:development \
        .
      ;;
  esac
}

case "$TARGET" in
  production|prod|p)
    build_moronlist production
    ;;
  migrations|m)
    build_moronlist migrations
    ;;
  development|dev|d)
    build_moronlist development
    ;;
  all|a)
    echo "Building all images..."
    build_moronlist migrations
    build_moronlist development
    build_moronlist production
    ;;
  *)
    echo "Usage: $0 [production|migrations|development|all]"
    echo "  production (default) - Build migrations + production images"
    echo "  migrations          - Build migrations image only"
    echo "  development         - Build development image"
    echo "  all                 - Build all images"
    echo ""
    echo "Note: Persona is pulled from ghcr.io, not built locally"
    exit 1
    ;;
esac

echo "Docker build completed!"
echo ""
echo "Available images:"
docker images --filter "reference=moronlist-*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

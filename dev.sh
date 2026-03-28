#!/bin/bash
# MoronList development CLI
# Usage: ./dev.sh <command> [options]
# Run ./dev.sh help for available commands

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

# Load .env file if it exists
if [[ -f ".env" ]]; then
  set -a
  source .env
  set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
  echo -e "${BLUE}MoronList Development CLI${NC}"
  echo ""
  echo "Usage: ./dev.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  start                         Start dev servers (server + UI)"
  echo "  stop                          Stop all services"
  echo "  build [--clean] [--install] [--no-format]  Build the project"
  echo "  clean                         Clean build artifacts"
  echo ""
  echo "  lint [--fix]                  Lint code"
  echo "  format [--check]              Format code"
  echo ""
  echo "  migrate                       Run database migrations"
  echo "  migrate --rollback            Rollback last migration"
  echo "  migrate --make <name>         Create new migration"
  echo "  migrate --status              Show migration status"
  echo ""
  echo "  test                          Run tests"
  echo "  test compose                  Run tests against Docker Compose"
  echo ""
  echo "  docker build                  Build Docker images"
  echo "  docker up                     Start devenv Docker Compose"
  echo "  docker down                   Stop devenv Docker Compose"
  echo "  docker logs [service]         Show Docker logs"
  echo ""
}

# Default command is start
COMMAND="${1:-start}"

case "$COMMAND" in
  start)
    shift || true
    exec "$ROOT_DIR/scripts/start.sh" "$@"
    ;;

  build)
    shift
    exec "$ROOT_DIR/scripts/build.sh" "$@"
    ;;

  clean)
    exec "$ROOT_DIR/scripts/clean.sh"
    ;;

  stop)
    exec "$ROOT_DIR/scripts/stop-all.sh"
    ;;

  lint)
    shift
    exec "$ROOT_DIR/scripts/lint-all.sh" "$@"
    ;;

  format)
    shift
    exec "$ROOT_DIR/scripts/format-all.sh" "$@"
    ;;

  migrate)
    shift
    KNEX="./node_modules/.bin/knex"

    # Parse action
    ACTION="latest"
    MIGRATION_NAME=""

    while [[ $# -gt 0 ]]; do
      case $1 in
        --rollback)
          ACTION="rollback"
          shift
          ;;
        --make)
          ACTION="make"
          MIGRATION_NAME="${2:-}"
          shift 2 || { echo -e "${RED}Error: Migration name required${NC}"; exit 1; }
          ;;
        --status)
          ACTION="status"
          shift
          ;;
        *)
          echo -e "${RED}Unknown option: $1${NC}"
          exit 1
          ;;
      esac
    done

    # Ensure data directory exists
    if [[ -n "${MORONLIST_DATA_DIR:-}" ]] && [[ ! -d "$MORONLIST_DATA_DIR" ]]; then
      echo -e "${YELLOW}Creating data directory: $MORONLIST_DATA_DIR${NC}"
      mkdir -p "$MORONLIST_DATA_DIR"
    fi

    echo -e "${GREEN}Running migration for moronlist...${NC}"

    case "$ACTION" in
      rollback)
        NODE_ENV=${NODE_ENV:-development} $KNEX migrate:rollback --knexfile "./knexfile.moronlist.js" --env ${NODE_ENV:-development}
        ;;
      make)
        $KNEX migrate:make "$MIGRATION_NAME" --knexfile "./knexfile.moronlist.js" --env development --migrations-directory "./database/moronlist/sqlite/migrations"
        ;;
      status)
        NODE_ENV=${NODE_ENV:-development} $KNEX migrate:status --knexfile "./knexfile.moronlist.js" --env ${NODE_ENV:-development}
        ;;
      latest)
        NODE_ENV=${NODE_ENV:-development} $KNEX migrate:latest --knexfile "./knexfile.moronlist.js" --env ${NODE_ENV:-development}
        ;;
    esac
    ;;

  docker)
    shift
    DOCKER_CMD="${1:-}"
    case "$DOCKER_CMD" in
      build)
        shift || true
        exec "$ROOT_DIR/scripts/docker-build.sh" "$@"
        ;;
      up)
        docker compose -f devenv/docker-compose.yml up -d
        ;;
      down)
        docker compose -f devenv/docker-compose.yml down
        ;;
      logs)
        shift
        docker compose -f devenv/docker-compose.yml logs "$@"
        ;;
      *)
        echo -e "${RED}Unknown docker command: $DOCKER_CMD${NC}"
        echo "Usage: ./dev.sh docker build|up|down|logs"
        exit 1
        ;;
    esac
    ;;

  test)
    shift || true
    if [[ "${1:-}" == "compose" ]]; then
      shift || true
      exec "$ROOT_DIR/scripts/test-integration.sh" compose "$@"
    else
      exec "$ROOT_DIR/scripts/test.sh" "$@"
    fi
    ;;

  help|--help|-h)
    show_help
    ;;

  *)
    echo -e "${RED}Unknown command: $COMMAND${NC}"
    echo ""
    show_help
    exit 1
    ;;
esac

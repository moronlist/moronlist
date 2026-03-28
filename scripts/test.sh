#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
DB_TYPE="sqlite"
TEST_TYPE="all"
GREP_PATTERN=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --db)
      DB_TYPE="$2"
      shift 2
      ;;
    --unit)
      TEST_TYPE="unit"
      shift
      ;;
    --integration)
      TEST_TYPE="integration"
      shift
      ;;
    --grep)
      GREP_PATTERN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--db sqlite|postgres] [--unit|--integration] [--grep pattern]"
      exit 1
      ;;
  esac
done

# Set environment variables based on database type
case $DB_TYPE in
  sqlite)
    export MORONLIST_DB_TYPE=sqlite

    if [ -z "${MORONLIST_DATA_DIR:-}" ]; then
      echo -e "${RED}ERROR: MORONLIST_DATA_DIR environment variable is required for SQLite${NC}"
      exit 1
    fi

    echo "Running tests with SQLite database..."
    ;;
  postgres)
    export MORONLIST_DB_TYPE=postgres
    export MORONLIST_DB_HOST="${MORONLIST_DB_HOST:-localhost}"
    export MORONLIST_DB_PORT="${MORONLIST_DB_PORT:-5432}"
    export MORONLIST_DB_NAME="${MORONLIST_DB_NAME:-moronlist_test}"
    export MORONLIST_DB_USER="${MORONLIST_DB_USER:-moronlist}"
    export MORONLIST_DB_PASSWORD="${MORONLIST_DB_PASSWORD:-moronlist}"
    echo "Running tests with PostgreSQL database..."
    ;;
  *)
    echo "Unknown database type: $DB_TYPE"
    echo "Supported databases: sqlite, postgres"
    exit 1
    ;;
esac

# Setup test database
if [ "$TEST_TYPE" != "unit" ]; then
  if [ "$DB_TYPE" = "sqlite" ]; then
    # TestDatabase class handles SQLite setup (creates db file, runs migrations)
    export NODE_ENV=test
    echo "Test database will be set up by test framework..."
  elif [ "$DB_TYPE" = "postgres" ]; then
    # Future: setup PostgreSQL test database
    echo "PostgreSQL test setup not yet implemented"
    exit 1
  fi
fi

# Build test command arguments
TEST_ARGS=""
if [ "$TEST_TYPE" = "unit" ]; then
  TEST_ARGS="$TEST_ARGS -- --unit"
elif [ "$TEST_TYPE" = "integration" ]; then
  TEST_ARGS="$TEST_ARGS -- --integration"
fi

if [ -n "$GREP_PATTERN" ]; then
  if [ -z "$TEST_ARGS" ]; then
    TEST_ARGS="-- --grep \"$GREP_PATTERN\""
  else
    TEST_ARGS="$TEST_ARGS --grep \"$GREP_PATTERN\""
  fi
fi

echo "Running tests..."

echo -e "${GREEN}Running tests for service-moronlist...${NC}"

if [ -f "node/packages/service/moronlist/package.json" ]; then
  if node -e "process.exit(require('./node/packages/service/moronlist/package.json').scripts?.test ? 0 : 1)" 2>/dev/null; then
    (cd "node/packages/service/moronlist" && eval "npm test $TEST_ARGS")
  else
    echo -e "${YELLOW}No test script found for service-moronlist, skipping...${NC}"
  fi
else
  echo -e "${YELLOW}Package not found: node/packages/service/moronlist, skipping...${NC}"
fi

echo -e "${GREEN}Tests completed successfully!${NC}"

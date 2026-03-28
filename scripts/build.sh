#!/usr/bin/env bash
set -euo pipefail

echo "Building MoronList..."

# Root directory (where this script is run from)
ROOT_DIR="$(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse command line arguments
CLEAN=false
INSTALL=false
NO_FORMAT=false

for arg in "$@"; do
  case $arg in
    --clean)
      CLEAN=true
      shift
      ;;
    --install)
      INSTALL=true
      shift
      ;;
    --no-format)
      NO_FORMAT=true
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

# Clean if requested
if [ "$CLEAN" = true ]; then
  echo -e "${YELLOW}Cleaning build artifacts...${NC}"
  ./scripts/clean.sh
fi

# Install dependencies if requested or if node_modules doesn't exist
if [ "$INSTALL" = true ] || [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Packages to build in order (libs first, then service, then UI)
PACKAGES=(
  "lib/logger:logger"
  "lib/moronlist-db:moronlist-db"
  "lib/test-utils:moronlist-test-utils"
  "service/moronlist:service-moronlist"
  "ui/moronlist-app:moronlist-app"
)

# Build each package
for pkg_entry in "${PACKAGES[@]}"; do
  pkg_path="${pkg_entry%%:*}"
  pkg_name="${pkg_entry##*:}"
  pkg="node/packages/$pkg_path"

  if [ ! -f "$pkg/package.json" ]; then
    echo -e "${RED}Package $pkg_name not found${NC}"
    continue
  fi

  echo -e "${GREEN}Building $pkg_name...${NC}"

  # Check if package has a build script
  if node -e "process.exit(require('./$pkg/package.json').scripts?.build ? 0 : 1)" 2>/dev/null; then
    # Run codegen if it exists (for packages that don't include codegen in build)
    if node -e "process.exit(require('./$pkg/package.json').scripts?.codegen ? 0 : 1)" 2>/dev/null; then
      echo "  Running code generation..."
      (cd "$pkg" && npm run codegen)
    fi

    # Run the build
    echo "  Compiling TypeScript..."
    (cd "$pkg" && npm run build)

    # Format generated files after build completes
    # Note: Use --ignore-path /dev/null to override default .gitignore behavior
    # since generated files are gitignored but still need formatting
    if [ -d "$pkg/src/generated" ]; then
      echo "  Formatting generated files..."
      "$ROOT_DIR/node_modules/.bin/prettier" --write --ignore-path /dev/null "$pkg/src/generated/**/*.ts" 2>/dev/null || true
    fi
    if [ -d "$pkg/tests/generated" ]; then
      "$ROOT_DIR/node_modules/.bin/prettier" --write --ignore-path /dev/null "$pkg/tests/generated/**/*.ts" 2>/dev/null || true
    fi
  else
    echo "  No build script found, skipping..."
  fi
done

# Format code unless disabled
if [ "$NO_FORMAT" = false ]; then
  echo -e "${YELLOW}Formatting code...${NC}"
  ./scripts/format-all.sh
fi

echo -e "${GREEN}Build completed successfully!${NC}"

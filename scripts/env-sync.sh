#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

WRITE_MODE=false
FORCE_MODE=false

for arg in "$@"; do
  case $arg in
    --write)
      WRITE_MODE=true
      ;;
    --force)
      FORCE_MODE=true
      WRITE_MODE=true
      ;;
  esac
done

SOURCE_FILE=".env.example"
TARGET_FILES=(
  ".env.docker.example"
  ".env.production.example"
  ".env"
  ".env.docker"
  ".env.production"
)

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo -e "${RED}Error: $SOURCE_FILE not found${NC}"
  exit 1
fi

echo -e "${BLUE}Env Sync - Source: $SOURCE_FILE${NC}"
if [[ "$FORCE_MODE" == true ]]; then
  echo -e "${YELLOW}Force mode: will overwrite files to match source structure${NC}"
fi
echo ""

# Get all variable names from source
declare -A SOURCE_VARS
while IFS= read -r line; do
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
    SOURCE_VARS["${BASH_REMATCH[1]}"]=1
  fi
done < "$SOURCE_FILE"

# Track if any changes are needed
CHANGES_NEEDED=false
EXTRA_VARS_FOUND=false

for target in "${TARGET_FILES[@]}"; do
  # Create file if it doesn't exist
  if [[ ! -f "$target" ]]; then
    if [[ "$WRITE_MODE" == true ]]; then
      cp "$SOURCE_FILE" "$target"
      echo -e "${GREEN}Created: $target${NC}"
    else
      echo -e "${YELLOW}Missing: $target (will be created from $SOURCE_FILE)${NC}"
      CHANGES_NEEDED=true
    fi
    continue
  fi

  # Check for missing and extra variables
  MISSING_VARS=()
  EXTRA_VARS=()

  # Find missing vars (in source but not in target)
  while IFS= read -r line; do
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
      VAR_NAME="${BASH_REMATCH[1]}"
      if ! grep -q "^${VAR_NAME}=" "$target" 2>/dev/null; then
        MISSING_VARS+=("$VAR_NAME")
      fi
    fi
  done < "$SOURCE_FILE"

  # Find extra vars (in target but not in source)
  while IFS= read -r line; do
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
      VAR_NAME="${BASH_REMATCH[1]}"
      if [[ -z "${SOURCE_VARS[$VAR_NAME]:-}" ]]; then
        EXTRA_VARS+=("$VAR_NAME")
      fi
    fi
  done < "$target"

  # Report findings
  if [[ ${#MISSING_VARS[@]} -gt 0 ]] || [[ ${#EXTRA_VARS[@]} -gt 0 ]]; then
    CHANGES_NEEDED=true
    echo -e "${YELLOW}$target:${NC}"

    for var in "${MISSING_VARS[@]}"; do
      echo -e "  ${RED}Missing:${NC} $var"
    done

    for var in "${EXTRA_VARS[@]}"; do
      echo -e "  ${YELLOW}Extra:${NC} $var"
    done

    if [[ ${#EXTRA_VARS[@]} -gt 0 ]]; then
      EXTRA_VARS_FOUND=true
    fi

    if [[ "$WRITE_MODE" == true ]]; then
      if [[ ${#EXTRA_VARS[@]} -gt 0 ]] && [[ "$FORCE_MODE" == false ]]; then
        echo -e "  ${RED}Skipped (extra vars found - use --force to overwrite)${NC}"
      else
        # Rebuild the file with all lines from source, preserving existing values
        TEMP_FILE=$(mktemp)

        while IFS= read -r line; do
          if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            # Comment or blank line - copy as-is
            echo "$line" >> "$TEMP_FILE"
          elif [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; then
            VAR_NAME="${BASH_REMATCH[1]}"

            # Check if variable exists in target
            EXISTING_LINE=$(grep "^${VAR_NAME}=" "$target" 2>/dev/null || true)

            if [[ -n "$EXISTING_LINE" ]]; then
              # Use existing value from target
              echo "$EXISTING_LINE" >> "$TEMP_FILE"
            else
              # Use default from source
              echo "$line" >> "$TEMP_FILE"
            fi
          else
            # Other lines - copy as-is
            echo "$line" >> "$TEMP_FILE"
          fi
        done < "$SOURCE_FILE"

        mv "$TEMP_FILE" "$target"
        echo -e "  ${GREEN}Updated${NC}"
      fi
    fi
    echo ""
  else
    echo -e "${GREEN}$target: OK${NC}"
  fi
done

echo ""
if [[ "$CHANGES_NEEDED" == true ]]; then
  if [[ "$WRITE_MODE" == true ]]; then
    if [[ "$EXTRA_VARS_FOUND" == true ]] && [[ "$FORCE_MODE" == false ]]; then
      echo -e "${RED}Some files were skipped due to extra variables.${NC}"
      echo -e "${YELLOW}Use --force to overwrite and remove extra variables.${NC}"
      exit 1
    else
      echo -e "${GREEN}All files synced.${NC}"
    fi
  else
    if [[ "$EXTRA_VARS_FOUND" == true ]]; then
      echo -e "${YELLOW}Run with --write to sync (will skip files with extra vars).${NC}"
      echo -e "${YELLOW}Run with --force to overwrite all files (removes extra vars).${NC}"
    else
      echo -e "${YELLOW}Run with --write to sync missing variables.${NC}"
    fi
    exit 1
  fi
else
  echo -e "${GREEN}All files are in sync.${NC}"
fi

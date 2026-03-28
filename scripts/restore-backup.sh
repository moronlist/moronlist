#!/bin/bash
# Restore a production backup into the local data directory
# Usage:
#   ./scripts/restore-backup.sh                  # Download fresh backup from production and restore
#   ./scripts/restore-backup.sh <backup-path>    # Restore from an existing local backup
#
# Example:
#   ./scripts/restore-backup.sh /home/jeswin/servers/backup/moronlist/full/2026-03-28_120000
#
# This copies database files from a backup into ./data/ so that
# local dev servers can run against production data.
#
# IMPORTANT: Stops any running services first to avoid database corruption.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_PATH="$1"
TEMP_BACKUP_DIR=""

if [[ -z "$BACKUP_PATH" ]]; then
  # No path given — download a fresh backup from production
  TEMP_BACKUP_DIR="/tmp/moronlist-backup-$(date +%s)"
  echo -e "${GREEN}No backup path specified. Downloading fresh backup from production...${NC}"
  "$SCRIPT_DIR/backup.sh" --full "$TEMP_BACKUP_DIR"

  # Find the backup directory (backup.sh creates full/<timestamp>/)
  BACKUP_PATH=$(find "$TEMP_BACKUP_DIR/full" -maxdepth 1 -mindepth 1 -type d | head -1)

  if [[ -z "$BACKUP_PATH" ]] || [[ ! -f "$BACKUP_PATH/manifest.json" ]]; then
    echo -e "${RED}Backup download failed - no valid backup found in $TEMP_BACKUP_DIR${NC}"
    rm -rf "$TEMP_BACKUP_DIR"
    exit 1
  fi
else
  if [[ ! -d "$BACKUP_PATH" ]]; then
    echo -e "${RED}Backup directory not found: $BACKUP_PATH${NC}"
    exit 1
  fi

  if [[ ! -f "$BACKUP_PATH/manifest.json" ]]; then
    echo -e "${RED}No manifest.json found in $BACKUP_PATH - not a valid backup${NC}"
    exit 1
  fi
fi

# Stop running services to avoid database corruption
echo -e "${YELLOW}Stopping any running services...${NC}"
./scripts/stop-all.sh 2>/dev/null || true

# Show backup info
echo -e "${GREEN}Restoring from backup:${NC} $BACKUP_PATH"
echo ""

DATA_DIR="$ROOT_DIR/data"

# Restore MoronList DB
if [[ -f "$BACKUP_PATH/moronlist/db/moronlist.db" ]]; then
  echo -e "${YELLOW}Restoring MoronList database...${NC}"
  mkdir -p "$DATA_DIR/moronlist/db"
  cp "$BACKUP_PATH/moronlist/db/moronlist.db" "$DATA_DIR/moronlist/db/moronlist.db"
  # Remove WAL/SHM files to avoid stale state
  rm -f "$DATA_DIR/moronlist/db/moronlist.db-wal" "$DATA_DIR/moronlist/db/moronlist.db-shm"
  echo -e "${GREEN}  moronlist.db restored${NC}"
fi

# Restore Persona DB
if [[ -f "$BACKUP_PATH/persona/db/persona.db" ]]; then
  echo -e "${YELLOW}Restoring Persona database...${NC}"
  mkdir -p "$DATA_DIR/persona/db"
  cp "$BACKUP_PATH/persona/db/persona.db" "$DATA_DIR/persona/db/persona.db"
  rm -f "$DATA_DIR/persona/db/persona.db-wal" "$DATA_DIR/persona/db/persona.db-shm"
  echo -e "${GREEN}  persona.db restored${NC}"
fi

# Clean up temp backup directory if we created one
if [[ -n "$TEMP_BACKUP_DIR" ]]; then
  echo -e "${YELLOW}Cleaning up temp backup...${NC}"
  rm -rf "$TEMP_BACKUP_DIR"
fi

echo ""
echo -e "${GREEN}Restore complete!${NC}"
echo -e "${YELLOW}Note: You may need to run migrations if the backup is from an older schema version.${NC}"

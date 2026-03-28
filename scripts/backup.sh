#!/bin/bash
set -euo pipefail

# Default configuration
DEFAULT_BACKUP_DIR="$HOME/servers/backup/moronlist"
DEFAULT_HOST="moronlistuser@moronlist.com"
DEFAULT_DATA_DIR="~/data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [OPTIONS] [backup-dir]"
    echo ""
    echo "Backup MoronList server data via SSH."
    echo ""
    echo "Options:"
    echo "  --full              Create a full backup (default: incremental)"
    echo "  --host <host>       Remote host (default: $DEFAULT_HOST)"
    echo "  --data-dir <path>   Remote data directory (default: $DEFAULT_DATA_DIR)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Arguments:"
    echo "  backup-dir          Local backup directory (default: $DEFAULT_BACKUP_DIR)"
    echo ""
    echo "Examples:"
    echo "  $0 --full                    # Full backup to default location"
    echo "  $0                           # Incremental backup to default location"
    echo "  $0 --full /mnt/backups       # Full backup to custom location"
    exit 0
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
FULL_BACKUP=false
HOST="$DEFAULT_HOST"
DATA_DIR="$DEFAULT_DATA_DIR"
BACKUP_DIR="$DEFAULT_BACKUP_DIR"

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FULL_BACKUP=true
            shift
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --data-dir)
            DATA_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        -*)
            log_error "Unknown option: $1"
            exit 1
            ;;
        *)
            BACKUP_DIR="$1"
            shift
            ;;
    esac
done

# Timestamp for this backup
TIMESTAMP=$(date -u +%Y-%m-%d_%H%M%S)

# Directory structure
FULL_DIR="$BACKUP_DIR/full"
INCREMENTAL_DIR="$BACKUP_DIR/incremental"

# Find the latest full backup
find_latest_full() {
    if [[ -d "$FULL_DIR" ]]; then
        ls -1 "$FULL_DIR" 2>/dev/null | sort -r | head -1
    fi
}

# Verify SSH connection
verify_ssh() {
    log_info "Verifying SSH connection to $HOST..."
    if ! ssh -o ConnectTimeout=10 "$HOST" "echo 'SSH OK'" > /dev/null 2>&1; then
        log_error "Cannot connect to $HOST via SSH"
        exit 1
    fi
    log_info "SSH connection verified"
}

# Verify sqlite3 is available on server
verify_sqlite3() {
    log_info "Verifying sqlite3 is available on server..."
    if ! ssh "$HOST" "which sqlite3" > /dev/null 2>&1; then
        log_error "sqlite3 is not installed on $HOST"
        log_error "Please run: sudo apt-get install sqlite3"
        exit 1
    fi
    log_info "sqlite3 verified"
}

# Backup databases
backup_databases() {
    local dest_dir="$1"
    local temp_suffix="backup-$TIMESTAMP"

    log_info "Backing up databases..."

    # Create backup directories (match server structure)
    mkdir -p "$dest_dir/moronlist/db"
    mkdir -p "$dest_dir/persona/db"

    # Backup moronlist database
    log_info "  Backing up moronlist.db..."
    ssh "$HOST" "sqlite3 $DATA_DIR/moronlist/db/moronlist.db \".backup /tmp/moronlist-$temp_suffix.db\""
    scp -q "$HOST:/tmp/moronlist-$temp_suffix.db" "$dest_dir/moronlist/db/moronlist.db"
    ssh "$HOST" "rm /tmp/moronlist-$temp_suffix.db"

    # Backup persona database (if exists)
    if ssh "$HOST" "[ -f $DATA_DIR/persona/db/persona.db ]" 2>/dev/null; then
        log_info "  Backing up persona.db..."
        ssh "$HOST" "sqlite3 $DATA_DIR/persona/db/persona.db \".backup /tmp/persona-$temp_suffix.db\""
        scp -q "$HOST:/tmp/persona-$temp_suffix.db" "$dest_dir/persona/db/persona.db"
        ssh "$HOST" "rm /tmp/persona-$temp_suffix.db"
    else
        log_warn "  persona.db not found, skipping..."
    fi

    log_info "Databases backed up"
}

# Create manifest
create_manifest() {
    local dest_dir="$1"
    local backup_type="$2"
    local parent_full="${3:-}"

    log_info "Creating manifest..."

    # Get sizes
    local moronlist_db_size=$(stat -f%z "$dest_dir/moronlist/db/moronlist.db" 2>/dev/null || stat -c%s "$dest_dir/moronlist/db/moronlist.db" 2>/dev/null || echo "0")
    local persona_db_size=$(stat -f%z "$dest_dir/persona/db/persona.db" 2>/dev/null || stat -c%s "$dest_dir/persona/db/persona.db" 2>/dev/null || echo "0")

    local parent_line=""
    if [[ -n "$parent_full" ]]; then
        parent_line="\"parent_full\": \"$parent_full\","
    fi

    cat > "$dest_dir/manifest.json" << EOF
{
  "type": "$backup_type",
  "timestamp": "$(date -Iseconds)",
  "host": "$HOST",
  $parent_line
  "services": {
    "moronlist": {
      "db_size": $moronlist_db_size
    },
    "persona": {
      "db_size": $persona_db_size
    }
  }
}
EOF

    log_info "Manifest created"
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "  MoronList Backup Script"
    echo "========================================"
    echo ""

    # Verify prerequisites
    verify_ssh
    verify_sqlite3

    # Determine backup type
    LATEST_FULL=$(find_latest_full)

    if [[ "$FULL_BACKUP" == "true" ]] || [[ -z "$LATEST_FULL" ]]; then
        if [[ -z "$LATEST_FULL" ]] && [[ "$FULL_BACKUP" != "true" ]]; then
            log_warn "No previous full backup found. Creating full backup."
        fi

        DEST_DIR="$FULL_DIR/$TIMESTAMP"
        log_info "Starting FULL backup to $DEST_DIR"
        mkdir -p "$DEST_DIR"

        backup_databases "$DEST_DIR"
        create_manifest "$DEST_DIR" "full"
    else
        # Incremental backup (just databases, no images to diff)
        DEST_DIR="$INCREMENTAL_DIR/$TIMESTAMP"

        log_info "Starting INCREMENTAL backup to $DEST_DIR"
        log_info "Based on full backup: $LATEST_FULL"
        mkdir -p "$DEST_DIR"

        backup_databases "$DEST_DIR"
        create_manifest "$DEST_DIR" "incremental" "$LATEST_FULL"
    fi

    echo ""
    echo "========================================"
    log_info "Backup completed successfully!"
    log_info "Location: $DEST_DIR"
    echo "========================================"
    echo ""

    # Show summary
    cat "$DEST_DIR/manifest.json"
}

main

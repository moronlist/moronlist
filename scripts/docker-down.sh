#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping devenv Docker Compose..."
docker compose -f "$ROOT_DIR/devenv/docker-compose.yml" down

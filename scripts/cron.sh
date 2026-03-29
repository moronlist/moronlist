#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Load env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DATA_DIR="${DATA_OUTPUT_DIR:-./output/data}"
SITE_DIR="${SITE_OUTPUT_DIR:-./output/site}"

# Flush changelog to static files
node --import tsx node/packages/service/moronlist/src/cron/index.ts

# Git push (only the directories that have changes)
push_if_changed() {
  local dir="$1"
  local msg="$2"

  if [ ! -d "$dir/.git" ]; then
    echo "Skipping git push for $dir (not a git repo)"
    return
  fi

  cd "$dir"
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "$msg"
    git push
    echo "Pushed $dir"
  else
    echo "No changes in $dir"
  fi
  cd "$ROOT_DIR"
}

push_if_changed "$DATA_DIR" "flush $(date -u +%Y-%m-%dT%H:%M:%SZ)"
push_if_changed "$SITE_DIR" "update $(date -u +%Y-%m-%dT%H:%M:%SZ)"

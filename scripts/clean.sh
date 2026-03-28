#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning build artifacts..."

# Remove dist directories
find . -type d -name "dist" -not -path "./node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Remove generated files
find . -type d -name "generated" -not -path "./node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Remove .turbo cache if it exists
rm -rf .turbo 2>/dev/null || true

# Remove parcel cache if it exists
rm -rf .parcel-cache 2>/dev/null || true

# Remove vite cache if it exists
rm -rf node_modules/.vite 2>/dev/null || true

echo "Clean completed!"

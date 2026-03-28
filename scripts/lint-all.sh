#!/usr/bin/env bash
set -euo pipefail

echo "Linting code with ESLint..."

# Check if we should fix or just check
FIX=false

for arg in "$@"; do
  case $arg in
    --fix)
      FIX=true
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

if [ "$FIX" = true ]; then
  echo "Running ESLint with auto-fix..."
  npx eslint . --ext .js,.jsx,.ts,.tsx --fix
else
  echo "Running ESLint check..."
  npx eslint . --ext .js,.jsx,.ts,.tsx
fi

echo "Linting complete!"

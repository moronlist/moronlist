#!/usr/bin/env bash
set -euo pipefail

echo "Formatting code with Prettier..."

# Check if we're just checking or actually formatting
CHECK_ONLY=false

for arg in "$@"; do
  case $arg in
    --check)
      CHECK_ONLY=true
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

if [ "$CHECK_ONLY" = true ]; then
  echo "Checking formatting..."
  npx prettier --check \
    "**/*.{js,jsx,ts,tsx,json,md,yml,yaml}" \
    --ignore-path .gitignore \
    --ignore-path .prettierignore
else
  echo "Formatting files..."
  npx prettier --write \
    "**/*.{js,jsx,ts,tsx,json,md,yml,yaml}" \
    --ignore-path .gitignore \
    --ignore-path .prettierignore
fi

echo "Formatting complete!"

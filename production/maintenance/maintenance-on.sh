#!/bin/bash

# Enable maintenance mode for MoronList
# Run this script from /home/moronlistuser/maintenance/ after SSH login
#
# This script uses symlink swapping - it NEVER modifies sites-available.
# Original configs remain untouched in /etc/nginx/sites-available/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
MAINTENANCE_NGINX="$SCRIPT_DIR/nginx"

echo "Enabling maintenance mode..."

# Check if maintenance config exists
if [ ! -f "$MAINTENANCE_NGINX/moronlist.com.maintenance" ]; then
    echo "ERROR: Maintenance config not found: $MAINTENANCE_NGINX/moronlist.com.maintenance"
    exit 1
fi

# Check if already in maintenance mode - if so, just exit
if [ -L "$NGINX_ENABLED/moronlist.com" ]; then
    current_target=$(readlink -f "$NGINX_ENABLED/moronlist.com")
    if [[ "$current_target" == *"maintenance"* ]]; then
        echo "Already in maintenance mode"
        exit 0
    fi
fi

# Swap symlinks to point to maintenance configs
echo "Switching to maintenance nginx configs..."
sudo rm -f "$NGINX_ENABLED/moronlist.com"
sudo ln -s "$MAINTENANCE_NGINX/moronlist.com.maintenance" "$NGINX_ENABLED/moronlist.com"

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo ""
echo "Maintenance mode ENABLED for:"
echo "  - moronlist.com"
echo ""
echo "To disable maintenance mode, run: ./maintenance-off.sh"

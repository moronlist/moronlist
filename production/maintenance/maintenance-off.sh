#!/bin/bash

# Disable maintenance mode for MoronList
# Run this script from /home/moronlistuser/maintenance/ after SSH login
#
# This script uses symlink swapping - it NEVER modifies sites-available.
# Original configs remain untouched in /etc/nginx/sites-available/

set -e

NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "Disabling maintenance mode..."

# Check if original config exists in sites-available
if [ ! -f "$NGINX_AVAILABLE/moronlist.com" ]; then
    echo "ERROR: Original config not found: $NGINX_AVAILABLE/moronlist.com"
    echo "Please ensure the original nginx config exists in sites-available."
    exit 1
fi

# Restore symlinks to point to original configs
echo "Restoring original nginx configs..."
sudo rm -f "$NGINX_ENABLED/moronlist.com"
sudo ln -s "$NGINX_AVAILABLE/moronlist.com" "$NGINX_ENABLED/moronlist.com"

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo ""
echo "Maintenance mode DISABLED for:"
echo "  - moronlist.com"
echo ""
echo "Services are now running normally."

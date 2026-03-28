#!/bin/bash
set -e

echo "Starting MoronList Server..."

# Change to service directory
cd /app/node/packages/service/moronlist

# Note: Database migrations should be run on the host before starting the container
# The database is mounted from the host, so migrations are managed externally
# To run migrations, use: npm run migrate:latest (on the host with proper env vars)

# Start the server
echo "Starting server on port ${MORONLIST_SERVER_PORT:-6000}..."
exec node dist/bin/server.js

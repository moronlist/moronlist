# Build stage
FROM node:24-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
# py3-setuptools provides distutils needed by node-gyp
RUN apk add --no-cache bash python3 py3-setuptools make g++

WORKDIR /app

# Copy package files for npm workspace install FIRST (for better caching)
# Include ALL workspace packages so build.sh can build the complete monorepo
COPY package*.json ./
COPY node/packages/lib/moronlist-db/package*.json ./node/packages/lib/moronlist-db/
COPY node/packages/lib/logger/package*.json ./node/packages/lib/logger/
COPY node/packages/lib/test-utils/package*.json ./node/packages/lib/test-utils/
COPY node/packages/service/moronlist/package*.json ./node/packages/service/moronlist/
COPY node/packages/ui/moronlist-app/package*.json ./node/packages/ui/moronlist-app/
COPY node/packages/plugin/chrome/package*.json ./node/packages/plugin/chrome/

# Copy scripts needed for npm postinstall hook (setup-hooks.sh)
COPY scripts/ ./scripts/

# Install dependencies BEFORE copying source (so npm install is cached unless package.json changes)
RUN npm install

# Copy remaining source files AFTER npm install
COPY tsconfig.base.json ./
COPY node/ ./node/
COPY database/ ./database/
COPY knexfile.moronlist.js ./

# Build the application
RUN chmod +x scripts/build.sh && \
    ./scripts/build.sh --no-format

# Make dist files readable by any user (for rootless Docker)
# Note: node_modules already has correct permissions from npm install
RUN chmod -R a+rX /app/node/packages/*/dist /app/database 2>/dev/null || true

# Migrations stage - runs migrations and exits
# User is set via docker-compose user: directive for rootless operation
FROM node:24-alpine AS migrations

RUN apk add --no-cache bash

WORKDIR /app

# Copy from builder - need knex, migrations, and database access
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database/ ./database/
COPY --from=builder /app/knexfile.moronlist.js ./
COPY --from=builder /app/node/packages/lib/moronlist-db/dist ./node/packages/lib/moronlist-db/dist
COPY --from=builder /app/node/packages/lib/moronlist-db/package*.json ./node/packages/lib/moronlist-db/
COPY --from=builder /app/node/packages/lib/logger/dist ./node/packages/lib/logger/dist
COPY --from=builder /app/node/packages/lib/logger/package*.json ./node/packages/lib/logger/

# Create data directory
RUN mkdir -p /app/data

CMD ["./node_modules/.bin/knex", "migrate:latest", "--knexfile", "./knexfile.moronlist.js", "--env", "production"]

# Development stage
FROM node:24-alpine AS development

RUN apk add --no-cache bash

WORKDIR /app

# Copy from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node/ ./node/
COPY --from=builder /app/database/ ./database/
COPY --from=builder /app/scripts/ ./scripts/
COPY --from=builder /app/knexfile.moronlist.js ./
COPY --from=builder /app/tsconfig.base.json ./

# Create data directory
RUN mkdir -p /app/data

EXPOSE 6000

CMD ["npm", "run", "dev"]

# Production stage
# User is set via docker-compose user: directive for rootless operation
FROM node:24-alpine AS production

RUN apk add --no-cache bash

WORKDIR /app

# Copy built application and dependencies from builder
# Service package
COPY --from=builder /app/node/packages/service/moronlist/dist ./node/packages/service/moronlist/dist
COPY --from=builder /app/node/packages/service/moronlist/package*.json ./node/packages/service/moronlist/
# Lib packages (dependencies)
COPY --from=builder /app/node/packages/lib/moronlist-db/dist ./node/packages/lib/moronlist-db/dist
COPY --from=builder /app/node/packages/lib/moronlist-db/package*.json ./node/packages/lib/moronlist-db/
COPY --from=builder /app/node/packages/lib/logger/dist ./node/packages/lib/logger/dist
COPY --from=builder /app/node/packages/lib/logger/package*.json ./node/packages/lib/logger/
# Root package.json for workspaces
COPY --from=builder /app/package*.json ./
# Node modules (hoisted to root by npm workspaces)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database ./database
COPY --from=builder /app/knexfile.moronlist.js ./

# Copy startup scripts
COPY node/packages/service/moronlist/docker-entrypoint-moronlist.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Create data directories
RUN mkdir -p /app/data /app/logs

EXPOSE 6000

ENV NODE_ENV=production \
    MORONLIST_SERVER_PORT=6000 \
    LOG_LEVEL=info

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.MORONLIST_SERVER_PORT || 6000) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["./docker-entrypoint.sh"]

# CLAUDE.md

**NEVER DEPLOY WITHOUT EXPLICIT USER INSTRUCTION**: Deployments to production are STRICTLY FORBIDDEN unless the user explicitly says to deploy. No exceptions.

**sed USAGE**

NEVER USE sed TO BULK REPLACE
NEVER USE sed TO BULK REPLACE
NEVER USE sed TO BULK REPLACE
NEVER USE sed TO BULK REPLACE

**NO QUICK FIXES**: Quick fixes and workarounds are banned in this project. Always fix the root cause properly.

**NEVER SSH INTO PRODUCTION**: Do not SSH into production servers unless the user explicitly asks you to. Never use `root@` - always use the application-specific user.

**NEVER USE FORCE PUSH OR DESTRUCTIVE GIT OPERATIONS**: `git push --force`, `git push --force-with-lease`, `git reset --hard`, `git clean -fd` are ABSOLUTELY FORBIDDEN. Use `git revert` to undo changes instead.

This file provides guidance to Claude Code when working with the MoronList codebase.

## Critical Guidelines

### NEVER ACT WITHOUT EXPLICIT USER APPROVAL

**YOU MUST ALWAYS ASK FOR PERMISSION BEFORE:**

- Making architectural decisions or changes
- Implementing new features or functionality
- Modifying APIs, interfaces, or data structures
- Changing expected behavior or test expectations
- Adding new dependencies or patterns

**ONLY make changes AFTER the user explicitly approves.** When you identify issues or potential improvements, explain them clearly and wait for the user's decision. Do NOT assume what the user wants or make "helpful" changes without permission.

### NEVER COMMIT DIRECTLY TO MAIN

**CRITICAL**: ALL changes must be made on a feature branch, never directly on main.

- Always create a new branch before making changes (e.g., `feature/add-delta-sync`, `fix/list-inheritance`)
- Push the feature branch and create a pull request
- Only merge to main after user approval

### NEVER COMMIT WITHOUT ALL TESTS PASSING

**CRITICAL**: ALL tests must pass before committing.

- Run tests and verify all pass
- No exceptions - if tests fail, fix them before committing

### NEVER BLAME "PRE-EXISTING FAILURES"

**CRITICAL**: The excuse "these are pre-existing failures" is NEVER acceptable.

- If tests fail, they must be fixed - period
- If you introduced code that breaks tests, fix your code
- If tests were already broken before your changes, fix those tests too
- The codebase must always be in a clean, passing state

### FINISH DISCUSSIONS BEFORE WRITING CODE

**IMPORTANT**: When the user asks a question or you're in the middle of a discussion, DO NOT jump to writing code. Always:

1. **Complete the discussion first** - Understand the problem fully
2. **Analyze and explain** - Work through the issue verbally
3. **Get confirmation** - Ensure the user agrees with the approach
4. **Only then write code** - After the user explicitly asks you to implement

## Project Overview & Principles

MoronList is a collaborative block list platform for Twitter and other social platforms. Users create, share, inherit, and fork block lists. A separate browser plugin reads block list data via API and performs the actual blocking.

### Key Concepts

- **Block Lists**: Curated lists of accounts to block, created by users
- **Inheritance**: A block list can inherit from multiple parent lists (DAG). Resolved list = union of all inherited entries + own entries
- **Forking**: Copy a block list as a starting point, then diverge independently
- **Delta Sync**: Git-like model where clients download only changes since their last sync, not full lists
- **Browser Plugin**: Separate project that reads data via API and applies blocks

### Documentation & Code Principles

**Code Principles:**

- **NO CLASSES** - Use functional style with strict types
- **NO DYNAMIC IMPORTS** - Always use static imports
- **PREFER FUNCTIONS** - Export functions from modules
- **USE RESULT TYPES** - For error handling
- **PREFER `type` over `interface`**
- **NO EMOJIS** - Do not use emojis in code, logs, or comments

### Environment Variables

**CRITICAL**: NEVER use fallback defaults with `||` for required environment variables.

```typescript
// BAD - silent failure with default value
const host = process.env.MORONLIST_SERVER_HOST || "127.0.0.1";
const secret = process.env.JWT_SECRET || "dev-secret";

// GOOD - fail fast if required var is missing
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}
const host = required("MORONLIST_SERVER_HOST");
```

All environment variables must be validated at startup in `src/config.ts`. The application should fail immediately if required variables are missing.

### Linting and Code Quality Standards

**CRITICAL**: NEVER weaken linting, testing, or type-checking rules:

- **NO eslint-disable comments** - Fix the actual issues instead of suppressing warnings
- **NO test.skip or test.only in committed code** - All tests must run and pass
- **NO @ts-expect-error or @ts-ignore** - Fix type errors properly
- **NO relaxing TypeScript strict mode** - Maintain full type safety
- **NO lowering code coverage thresholds** - Improve coverage instead
- **NO weakening any quality gates** - Standards exist for a reason

### Security: Never Use npx

**CRITICAL SECURITY REQUIREMENT**: NEVER use `npx` for any commands.

- **ALWAYS use exact dependency versions** in package.json
- **ALWAYS use local node_modules binaries**
- **NEVER use `npx`** - use local dependencies

### Database Conventions

- **SQLite** for development/initial deployment (via Tinqer)
- **All SQL via Tinqer** - Never write raw SQL
- **Raw SQL exception**: When Tinqer cannot support a feature, raw SQL is permitted but MUST use named parameters (`:paramName`), never positional placeholders (`?`)
- **Repository Pattern** - Interfaces with SQLite implementation
- **Singular table names**: lowercase (e.g., `user`, `block_list`, `block_entry`)
- **Column names**: snake_case for all columns
- **UUIDs** for primary keys
- **Hard deletes** with audit logging
- **MIGRATION POLICY**: Use migration system for all schema changes

### ESM Modules

- **All imports MUST include `.js` extension**: `import { foo } from "./bar.js"`
- **TypeScript configured for `"module": "NodeNext"`**
- **Type: `"module"` in all package.json files**
- **NO DYNAMIC IMPORTS**: Always use static imports

### GraphQL Architecture

- **Single schema file** in each service
- **Type generation** with graphql-codegen
- **DataLoaders** for N+1 query prevention
- **Result types** for all domain functions
- **Context pattern** for database and auth

## Deployment

### Server Access

SSH access to the production server as the application user:

```bash
ssh moronlistuser@moronlist.com
```

**NEVER attempt to SSH as root** — you do not have root access. All deployment, maintenance, and backup operations run as `moronlistuser`. If something requires root (e.g., nginx changes, SSL cert issues), escalate to the infrastructure team.

### Prerequisites

- SSH access to `moronlistuser@moronlist.com`
- Docker images build locally, get transferred to the server via scp
- The server runs rootless Docker under `moronlistuser`
- Nginx runs on the host with SSL via certbot

### Deploy Commands

```bash
# Full deploy (builds only what changed since last deploy)
./scripts/deploy.sh

# Force rebuild everything regardless of changes
./scripts/deploy.sh --force-build

# Deploy only the frontend (no Docker rebuild)
./scripts/deploy.sh --frontend-only

# Skip building, deploy existing local artifacts
./scripts/deploy.sh --skip-build
```

### How Change Detection Works

The deploy script stores the last deployed git commit on the server. On each deploy, it diffs against that commit to determine what needs rebuilding:

- **Shared files changed** (package.json, package-lock.json, tsconfig.base.json, production/) — rebuilds everything
- **Service files changed** (node/packages/service/moronlist/, node/packages/lib/, database/, knexfile.moronlist.js) — rebuilds Docker images only
- **Frontend files changed** (node/packages/ui/moronlist-app/) — rebuilds frontend only
- **First deploy or commit not in history** — rebuilds everything

Migrations always run regardless of what changed.

### Server Layout

```
/home/moronlistuser/
  moronlist/              # Deploy dir (docker-compose.yml, .env)
  data/
    persona/db/           # Persona SQLite DB
    persona/logs/
    moronlist/db/         # MoronList SQLite DB
    moronlist/logs/
  frontend/
    moronlist/            # Static frontend (served by nginx)
  maintenance/            # Maintenance mode pages + scripts
```

### Ports

- `6000` — moronlist-server (proxied via `api.moronlist.com`)
- `6005` — persona-server (proxied via `persona.moronlist.com`)

These are intentionally different from Lesser (4000/4005) to avoid conflicts on the shared server.

### Maintenance Mode

SSH into the server and run from `/home/moronlistuser/maintenance/`:

```bash
./maintenance-on.sh     # Swaps nginx to maintenance page
./maintenance-off.sh    # Restores normal nginx config
```

### Backups

```bash
# Full backup from production to local machine
./scripts/backup.sh --full

# Incremental backup (databases only, diffed against last full)
./scripts/backup.sh

# Restore backup into local dev environment
./scripts/restore-backup.sh                          # Downloads fresh from production
./scripts/restore-backup.sh /path/to/backup/dir      # Restores from local backup
```

Backups are saved to `~/servers/backup/moronlist/` by default.

### Environment Variables

The server's `.env` is at `/home/moronlistuser/moronlist/.env`. It is only copied on first deploy (from local `.env.production`). After that, edit it directly on the server via SSH. The deploy script never overwrites it.

## Essential Commands & Workflow

### Git Workflow

**CRITICAL GIT SAFETY RULES**:

1. **NEVER use `git push --force`**
2. **ALL git push commands require EXPLICIT user authorization**
3. **Use revert commits instead of force push**

**NEW BRANCH REQUIREMENT**: ALL changes must be made on a new feature branch, never directly on main.

## Code Patterns

### Import Patterns

```typescript
// Always include .js extension
import { createBlockListRepository } from "./repositories/block-list.js";
import type { Result } from "../types.js";
```

### Result Type Pattern

```typescript
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export async function doSomething(): Promise<Result<Data>> {
  if (error) {
    return {
      success: false,
      error: new Error("Description"),
    };
  }
  return { success: true, data: result };
}
```

### Repository Pattern

```typescript
// Repository interface
export type BlockListRepository = {
  findById: (id: string) => Promise<Result<BlockList>>;
  create: (data: CreateBlockListData) => Promise<Result<BlockList>>;
  update: (id: string, data: UpdateBlockListData) => Promise<Result<BlockList>>;
  delete: (id: string) => Promise<Result<void>>;
};

// Repository implementation
export function createBlockListRepository(db: Database): BlockListRepository {
  const schema = createSchema<DatabaseSchema>();

  return {
    findById: async (id) => {
      // Tinqer query implementation
    },
    // ... other methods
  };
}
```

### DataLoader Pattern

```typescript
import DataLoader from "dataloader";

export function createLoaders(repos: Repositories) {
  return {
    blockListById: new DataLoader(async (ids: readonly string[]) => {
      const result = await repos.blockLists.findByIds([...ids]);
      if (!result.success) throw result.error;

      const map = new Map(result.data.map((list) => [list.id, list]));
      return ids.map((id) => map.get(id) ?? new Error(`Block list ${id} not found`));
    }),
  };
}
```

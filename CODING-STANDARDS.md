# Coding Standards

This document outlines the coding standards and patterns used throughout the MoronList codebase. All contributors must follow these guidelines to maintain consistency and quality.

## Core Principles

### 1. Functional Programming First

**NO CLASSES** - Use functions and modules exclusively.

```typescript
// Good - Pure function with explicit dependencies
export async function createBlockList(
  db: Database,
  data: CreateBlockListData,
  userId: string,
): Promise<Result<BlockList>> {
  // Implementation
}

// Bad - Service class for stateless operations
export class BlockListService {
  constructor(private db: Database) {}

  async createBlockList(data: CreateBlockListData): Promise<BlockList> {
    // This should be a function, not a class method
  }
}
```

### 2. Explicit Error Handling with Result Types

Use `Result<T>` for all operations that can fail. Never throw exceptions for expected errors.

```typescript
// Result type definition (in types.ts)
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Good - Using Result type
export async function findBlockList(db: Database, listId: string): Promise<Result<BlockList>> {
  try {
    const lists = await executeSelect(
      db,
      schema,
      (q, p) =>
        q
          .from("block_list")
          .where((bl) => bl.id === p.listId)
          .select((bl) => ({ ...bl }))
          .take(1),
      { listId }
    );

    if (lists.length === 0) {
      return {
        success: false,
        error: new Error("Block list not found"),
      };
    }

    return { success: true, data: lists[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Bad - Throwing exceptions
export async function findBlockList(db: Database, listId: string): Promise<BlockList> {
  const lists = await executeSelect(/* ... */);
  if (lists.length === 0) throw new Error("Block list not found");
  return lists[0];
}
```

### 3. Database Patterns with Tinqer

#### All SQL MUST use Tinqer

**CRITICAL**: Never write raw SQL. Always use Tinqer for type-safe queries.

```typescript
// Good - Tinqer query
import { createSchema, executeSelect, executeInsert } from "@tinqerjs/tinqer";
import { executeSqlite } from "@tinqerjs/tinqer-sqlite";

const schema = createSchema<DatabaseSchema>();

export async function createBlockEntry(
  db: Database,
  data: CreateBlockEntryData
): Promise<Result<BlockEntry>> {
  const result = await executeInsert(
    db,
    schema,
    (q, p) =>
      q
        .insertInto("block_entry")
        .values({
          id: p.id,
          block_list_id: p.blockListId,
          platform_user_id: p.platformUserId,
          platform: p.platform,
          created_at: p.createdAt,
        })
        .returning((e) => ({ ...e })),
    {
      id: generateUUID(),
      blockListId: data.blockListId,
      platformUserId: data.platformUserId,
      platform: data.platform,
      createdAt: new Date().toISOString(),
    }
  );

  return { success: true, data: result };
}

// Bad - Raw SQL
export async function createBlockEntry(db: Database, data: CreateBlockEntryData): Promise<void> {
  return db.run(`INSERT INTO block_entry (id, block_list_id, platform_user_id) VALUES (?, ?, ?)`, [
    data.id,
    data.blockListId,
    data.platformUserId,
  ]);
}
```

#### Raw SQL Exception: FTS and Special Cases

In rare cases where Tinqer cannot support a feature, raw SQL is permitted with these rules:

1. **Must use named parameters** - Never use `?` positional placeholders
2. **Keep in dedicated repository** - Isolate raw SQL in its own module
3. **Document the exception** - Explain why Tinqer cannot be used

```typescript
// Good - Named parameters with raw SQL
db.prepare(
  `SELECT item_id FROM item_fts WHERE item_fts MATCH :query LIMIT :limit`
).all({ query: sanitized, limit });

// Bad - Positional placeholders
db.prepare(`SELECT item_id FROM item_fts WHERE item_fts MATCH ? LIMIT ?`).run(query, limit);
```

#### DbRow Types

All database types must exactly mirror the database schema with snake_case:

```typescript
// Database schema types (snake_case)
type BlockListDbRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private" | "unlisted";
  forked_from_id: string | null;
  created_at: string;
  updated_at: string;
};

type BlockEntryDbRow = {
  id: string;
  block_list_id: string;
  platform_user_id: string;
  platform: string;
  reason: string | null;
  added_by_id: string;
  created_at: string;
};
```

#### Repository Pattern

Implement repositories as functional interfaces:

```typescript
// Repository interface
export type BlockListRepository = {
  findById: (id: string) => Promise<Result<BlockList>>;
  findByOwnerId: (ownerId: string) => Promise<Result<BlockList[]>>;
  create: (data: CreateBlockListData) => Promise<Result<BlockList>>;
  update: (id: string, data: UpdateBlockListData) => Promise<Result<BlockList>>;
  delete: (id: string) => Promise<Result<void>>;
};

// Repository implementation
export function createBlockListRepository(db: Database): BlockListRepository {
  const schema = createSchema<DatabaseSchema>();

  return {
    findById: async (id) => {
      const lists = await executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("block_list")
            .where((bl) => bl.id === p.id)
            .select((bl) => ({ ...bl }))
            .take(1),
        { id }
      );

      return lists.length > 0
        ? { success: true, data: mapBlockListFromDb(lists[0]) }
        : { success: false, error: new Error("Block list not found") };
    },
    // ... other methods
  };
}
```

### 4. Module Structure

#### Imports

All imports MUST include the `.js` extension:

```typescript
// Good
import { createBlockListRepository } from "./repositories/block-list.js";
import { authenticate } from "./middleware/auth.js";
import type { Result } from "./types.js";

// Bad
import { createBlockListRepository } from "./repositories/block-list";
import { authenticate } from "./middleware/auth";
```

#### Exports

Use named exports exclusively:

```typescript
// Good
export function createBlockList() { ... }
export function updateBlockList() { ... }
export type BlockList = { ... };

// Bad
export default class BlockListService { ... }
```

### 5. Naming Conventions

#### General Rules

- **Functions**: camelCase (`createBlockList`, `resolveInheritance`, `syncDelta`)
- **Types/Interfaces**: PascalCase (`User`, `BlockList`, `BlockEntry`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_LIST_SIZE`, `DEFAULT_PLATFORM`)
- **Files**: kebab-case (`block-list.ts`, `delta-sync.ts`, `user-repository.ts`)
- **Database**: snake_case tables and columns (`block_list`, `created_at`, `owner_id`)

#### Database Naming

- **Tables**: singular, lowercase (`user`, `block_list`, `block_entry`, `list_inheritance`)
- **Columns**: snake_case (`user_id`, `created_at`, `block_list_id`)
- **Foreign Keys**: `{table}_id` (`owner_id`, `block_list_id`, `parent_list_id`)

### 6. TypeScript Guidelines

#### Strict Mode

Always use TypeScript strict mode. See `tsconfig.base.json` for full configuration.

#### Type vs Interface

Prefer `type` over `interface`:

```typescript
// Good - Using type
type BlockList = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  forkedFromId: string | null;
  createdAt: string;
  updatedAt: string;
};

type Visibility = "public" | "private" | "unlisted";

// Use interface only for extensible contracts
```

#### Strict Equality Only

**CRITICAL**: Always use strict equality operators (`===` and `!==`). Never use loose equality (`==` or `!=`).

```typescript
// Good - Strict equality
if (value === null) { ... }
if (value !== undefined) { ... }

// Bad - Loose equality (BANNED)
if (value == null) { ... }
if (value != undefined) { ... }
```

#### Avoid `any`

Never use `any`. Use `unknown` if type is truly unknown:

```typescript
// Good
function parseJSON(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Bad
function parseJSON(content: any): any {
  return JSON.parse(content);
}
```

### 7. Async/Await Pattern

Always use async/await instead of promise chains:

```typescript
// Good
export async function addEntryToList(
  repos: Repositories,
  listId: string,
  data: AddEntryData
): Promise<Result<BlockEntry>> {
  const listResult = await repos.blockLists.findById(listId);
  if (!listResult.success) {
    return listResult;
  }

  const entryResult = await repos.blockEntries.create({
    blockListId: listId,
    ...data,
  });

  return entryResult;
}

// Bad - Promise chains
export function addEntryToList(
  repos: Repositories,
  listId: string,
  data: AddEntryData
): Promise<Result<BlockEntry>> {
  return repos.blockLists.findById(listId).then((listResult) => {
    if (!listResult.success) return listResult;
    return repos.blockEntries.create({ blockListId: listId, ...data });
  });
}
```

### 8. GraphQL Resolver Patterns

```typescript
// Good - Proper error handling with Result types
export const blockListResolver = {
  Query: {
    blockList: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      const validation = uuidSchema.safeParse(args.id);
      if (!validation.success) {
        throw new GraphQLError("Invalid block list ID", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const result = await context.repos.blockLists.findById(args.id);

      if (!result.success) {
        throw new GraphQLError(result.error.message, {
          extensions: {
            code: "BLOCK_LIST_NOT_FOUND",
            http: { status: 404 },
          },
        });
      }

      return result.data;
    },
  },

  BlockList: {
    owner: async (parent: BlockList, _: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.ownerId);
    },

    entries: async (parent: BlockList, _: unknown, context: GraphQLContext) => {
      return context.loaders.entriesByBlockListId.load(parent.id);
    },
  },
};
```

### 9. Input Validation

Always validate input with Zod:

```typescript
import { z } from "zod";

export const createBlockListSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private", "unlisted"]),
});

export const addBlockEntrySchema = z.object({
  platformUserId: z.string().min(1).max(200),
  platform: z.enum(["twitter", "bluesky", "mastodon"]),
  reason: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  offset: z.number().min(0).default(0),
  limit: z.number().min(1).max(100).default(20),
});

// Use in resolvers
const validatedData = createBlockListSchema.parse(args.input);
```

### 10. Testing

```typescript
describe("Block List Operations", () => {
  let db: Database;
  let repos: Repositories;
  let userId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    repos = createRepositories(db);
    const userResult = await repos.users.create({
      email: "test@example.com",
      name: "Test User",
    });
    if (!userResult.success) throw userResult.error;
    userId = userResult.data.id;
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it("should create a block list", async () => {
    // Arrange
    const listData = {
      name: "Spam Accounts",
      description: "Known spam accounts on Twitter",
      visibility: "public" as const,
    };

    // Act
    const result = await createBlockList(repos, userId, listData);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Spam Accounts");
      expect(result.data.ownerId).toBe(userId);
    }
  });
});
```

### 11. Authentication & Authorization

```typescript
// Good - Check authentication and authorization
export async function updateBlockList(
  repos: Repositories,
  userId: string,
  listId: string,
  data: UpdateBlockListData
): Promise<Result<BlockList>> {
  const listResult = await repos.blockLists.findById(listId);
  if (!listResult.success) {
    return listResult;
  }

  if (listResult.data.ownerId !== userId) {
    return {
      success: false,
      error: new Error("Not authorized to update this block list"),
    };
  }

  return repos.blockLists.update(listId, data);
}
```

### 12. Performance Patterns

#### DataLoader for N+1 Prevention

```typescript
import DataLoader from "dataloader";

export function createLoaders(repos: Repositories) {
  return {
    userById: new DataLoader(async (userIds: readonly string[]) => {
      const result = await repos.users.findByIds([...userIds]);
      if (!result.success) throw result.error;

      const userMap = new Map(result.data.map((user) => [user.id, user]));
      return userIds.map((id) => userMap.get(id) ?? new Error(`User ${id} not found`));
    }),

    entriesByBlockListId: new DataLoader(async (listIds: readonly string[]) => {
      const result = await repos.blockEntries.findByListIds([...listIds]);
      if (!result.success) throw result.error;

      const entriesByList = new Map<string, BlockEntry[]>();
      for (const entry of result.data) {
        const entries = entriesByList.get(entry.blockListId) ?? [];
        entries.push(entry);
        entriesByList.set(entry.blockListId, entries);
      }

      return listIds.map((id) => entriesByList.get(id) ?? []);
    }),
  };
}
```

## Code Review Checklist

Before submitting a PR, ensure:

- [ ] All functions use Result types for error handling
- [ ] No classes used
- [ ] All imports include `.js` extension
- [ ] All database queries use Tinqer (no raw SQL)
- [ ] Repository pattern implemented for data access
- [ ] Input validation with Zod
- [ ] No `any` types used
- [ ] Strict equality only (`===`/`!==`, never `==`/`!=`)
- [ ] DataLoaders used for nested GraphQL queries
- [ ] Tests included for new functionality
- [ ] No console.log statements (use logger)

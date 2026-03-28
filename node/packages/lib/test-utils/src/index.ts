import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import Knex from "knex";
import { randomBytes } from "crypto";
import { executeInsert } from "@tinqerjs/better-sqlite3-adapter";
import { schema } from "moronlist-db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get project root (5 levels up from src/index.ts: src -> test-utils -> lib -> packages -> node -> root)
const PROJECT_ROOT = join(__dirname, "../../../../..");

// Base62 alphabet: 0-9, A-Z, a-z
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// ============================================
// Logger
// ============================================

export type TestLogger = {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
};

const showDebug = process.env.TEST_DEBUG === "1";

export const testLogger: TestLogger = {
  info: showDebug
    ? (message: string, ...args: unknown[]) => console.info(`[TEST INFO] ${message}`, ...args)
    : () => {
        // noop
      },
  error: (message: string, ...args: unknown[]) => console.error(`[TEST ERROR] ${message}`, ...args),
  warn: showDebug
    ? (message: string, ...args: unknown[]) => console.warn(`[TEST WARN] ${message}`, ...args)
    : () => {
        // noop
      },
  debug: showDebug
    ? (message: string, ...args: unknown[]) => console.info(`[TEST DEBUG] ${message}`, ...args)
    : () => {
        // noop
      },
};

export const consoleLogger: TestLogger = {
  info: (message: string, ...args: unknown[]) => console.info(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) => console.info(`[DEBUG] ${message}`, ...args),
};

// ============================================
// ID Generation
// ============================================

/**
 * Generate a short, URL-friendly ID using base62 encoding.
 * Default length is 16 characters, providing 62^16 (~4.8 x 10^28) unique values.
 */
export function generateId(length = 16): string {
  const bytes = randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      const char = BASE62_ALPHABET[byte % 62];
      if (char !== undefined) {
        result += char;
      }
    }
  }

  return result;
}

// ============================================
// Test Database
// ============================================

export type TestDatabaseHandle = {
  db: Database.Database;
  dbPath: string;
  testDir: string | null;
};

/**
 * Create a test database with migrations applied.
 * Returns a handle containing the better-sqlite3 connection.
 */
export async function createTestDatabase(logger: TestLogger): Promise<TestDatabaseHandle> {
  const timestamp = Date.now();
  const testDir = join(PROJECT_ROOT, ".tests", `test-${String(timestamp)}`, "data");
  mkdirSync(testDir, { recursive: true });
  const dbPath = join(testDir, "moronlist-test.db");

  logger.info("Setting up test database...");

  // Create Knex instance for migrations
  const knex = Knex({
    client: "sqlite3",
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
    migrations: {
      directory: join(__dirname, "../../../../../database/moronlist/sqlite/migrations"),
    },
  });

  // Run migrations
  try {
    await knex.migrate.latest();
    logger.info("Migrations applied successfully");
  } catch (error) {
    logger.error("Error running migrations:", error);
    throw error;
  }

  await knex.destroy();

  // Create better-sqlite3 instance for queries
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  logger.info("Test database setup complete");

  return { db, dbPath, testDir };
}

/**
 * Clean up a test database: close connection and remove test directory.
 */
export async function cleanupTestDatabase(
  handle: TestDatabaseHandle,
  logger: TestLogger
): Promise<void> {
  handle.db.close();

  if (handle.testDir !== null) {
    try {
      const fs = await import("fs/promises");
      // testDir is .tests/test-$timestamp/data, so go up one level to delete test-$timestamp
      const testRunDir = join(handle.testDir, "..");
      await fs.rm(testRunDir, { recursive: true, force: true });
      logger.info(`Test directory deleted: ${testRunDir}`);
    } catch {
      // Ignore if directory doesn't exist
    }
  }
}

/**
 * Truncate all tables in the test database (preserving schema).
 */
export function truncateAllTables(db: Database.Database, logger: TestLogger): void {
  // Disable foreign key checks temporarily
  db.pragma("foreign_keys = OFF");

  // Get all table names
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'knex_migrations' AND name != 'knex_migrations_lock'"
    )
    .all() as { name: string }[];

  // Truncate each table
  for (const { name } of tables) {
    db.prepare(`DELETE FROM ${name}`).run();
  }

  // Re-enable foreign key checks
  db.pragma("foreign_keys = ON");

  logger.debug(`Truncated ${String(tables.length)} tables`);
}

// ============================================
// Test Fixture Helpers
// ============================================

export function insertTestUser(
  db: Database.Database,
  data: {
    id: string;
    email: string;
    name: string;
    role?: string;
    banned?: boolean;
    ban_reason?: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("user").values({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role,
        banned: p.banned,
        ban_reason: p.banReason,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }),
    {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role ?? "USER",
      banned: data.banned === true ? 1 : 0,
      banReason: data.ban_reason ?? null,
      createdAt: now,
      updatedAt: now,
    }
  );
}

export function insertTestMoronList(
  db: Database.Database,
  data: {
    platform: string;
    slug: string;
    owner_id: string;
    name: string;
    description?: string;
    visibility?: string;
    version?: number;
    forked_from_platform?: string;
    forked_from_slug?: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("moron_list").values({
        platform: p.platform,
        slug: p.slug,
        owner_id: p.ownerId,
        name: p.name,
        description: p.description,
        visibility: p.visibility,
        version: p.version,
        forked_from_platform: p.forkedFromPlatform,
        forked_from_slug: p.forkedFromSlug,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }),
    {
      platform: data.platform,
      slug: data.slug,
      ownerId: data.owner_id,
      name: data.name,
      description: data.description ?? null,
      visibility: data.visibility ?? "public",
      version: data.version ?? 0,
      forkedFromPlatform: data.forked_from_platform ?? null,
      forkedFromSlug: data.forked_from_slug ?? null,
      createdAt: now,
      updatedAt: now,
    }
  );
}

export function insertTestMoronEntry(
  db: Database.Database,
  data: {
    id: string;
    list_platform: string;
    list_slug: string;
    platform_user_id: string;
    display_name?: string;
    reason?: string;
    added_by_id: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("moron_entry").values({
        id: p.id,
        list_platform: p.listPlatform,
        list_slug: p.listSlug,
        platform_user_id: p.platformUserId,
        display_name: p.displayName,
        reason: p.reason,
        added_by_id: p.addedById,
        created_at: p.createdAt,
      }),
    {
      id: data.id,
      listPlatform: data.list_platform,
      listSlug: data.list_slug,
      platformUserId: data.platform_user_id,
      displayName: data.display_name ?? null,
      reason: data.reason ?? null,
      addedById: data.added_by_id,
      createdAt: now,
    }
  );
}

export function insertTestSaintEntry(
  db: Database.Database,
  data: {
    id: string;
    list_platform: string;
    list_slug: string;
    platform_user_id: string;
    reason?: string;
    added_by_id: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("saint_entry").values({
        id: p.id,
        list_platform: p.listPlatform,
        list_slug: p.listSlug,
        platform_user_id: p.platformUserId,
        reason: p.reason,
        added_by_id: p.addedById,
        created_at: p.createdAt,
      }),
    {
      id: data.id,
      listPlatform: data.list_platform,
      listSlug: data.list_slug,
      platformUserId: data.platform_user_id,
      reason: data.reason ?? null,
      addedById: data.added_by_id,
      createdAt: now,
    }
  );
}

export function insertTestSubscription(
  db: Database.Database,
  data: {
    user_id: string;
    list_platform: string;
    list_slug: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("subscription").values({
        user_id: p.userId,
        list_platform: p.listPlatform,
        list_slug: p.listSlug,
        subscribed_at: p.subscribedAt,
      }),
    {
      userId: data.user_id,
      listPlatform: data.list_platform,
      listSlug: data.list_slug,
      subscribedAt: now,
    }
  );
}

export function insertTestInheritance(
  db: Database.Database,
  data: {
    child_platform: string;
    child_slug: string;
    parent_platform: string;
    parent_slug: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("moron_list_inheritance").values({
        child_platform: p.childPlatform,
        child_slug: p.childSlug,
        parent_platform: p.parentPlatform,
        parent_slug: p.parentSlug,
        created_at: p.createdAt,
      }),
    {
      childPlatform: data.child_platform,
      childSlug: data.child_slug,
      parentPlatform: data.parent_platform,
      parentSlug: data.parent_slug,
      createdAt: now,
    }
  );
}

export function insertTestChangelog(
  db: Database.Database,
  data: {
    id: string;
    list_platform: string;
    list_slug: string;
    version: number;
    action: string;
    platform_user_id: string;
    user_id: string;
  }
): void {
  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("changelog").values({
        id: p.id,
        list_platform: p.listPlatform,
        list_slug: p.listSlug,
        version: p.version,
        action: p.action,
        platform_user_id: p.platformUserId,
        user_id: p.userId,
        created_at: p.createdAt,
      }),
    {
      id: data.id,
      listPlatform: data.list_platform,
      listSlug: data.list_slug,
      version: data.version,
      action: data.action,
      platformUserId: data.platform_user_id,
      userId: data.user_id,
      createdAt: now,
    }
  );
}

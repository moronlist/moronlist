/**
 * moronlist-db - Database connection and schema for MoronList
 */

// Database schema types
export type { DatabaseSchema } from "./schema.js";

// Database initialization
export { initTinqerDatabase, type DatabaseConfig, type TinqerDatabaseHandle } from "./tinqer.js";

// SQLite implementation
export { initSQLiteDatabase, closeSQLiteDatabase, type SQLiteDatabase } from "./tinqer-sqlite.js";

// PostgreSQL implementation (placeholder)
export {
  initPostgreSQLDatabase,
  closePostgreSQLDatabase,
  type PostgreSQLDatabase,
} from "./tinqer-pg.js";

// Tinqer schema instance
export { schema } from "./tinqer-types.js";

// Database row types
export type {
  UserDbRow,
  MoronListDbRow,
  MoronEntryDbRow,
  SaintEntryDbRow,
  MoronListInheritanceDbRow,
  ChangelogDbRow,
  FlushStateDbRow,
  SubscriptionDbRow,
} from "./types.js";

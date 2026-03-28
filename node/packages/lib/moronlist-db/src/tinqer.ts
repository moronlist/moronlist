/**
 * Tinqer Database Initialization
 * Factory for creating database connections based on configuration
 */

import { initSQLiteDatabase, type SQLiteDatabase } from "./tinqer-sqlite.js";
import { initPostgreSQLDatabase, type PostgreSQLDatabase } from "./tinqer-pg.js";

export type DatabaseConfig =
  | { type: "sqlite"; sqlite: { dbPath: string } }
  | {
      type: "postgres";
      postgres: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
      };
    };

export type TinqerDatabaseHandle = SQLiteDatabase | PostgreSQLDatabase;

/**
 * Initialize Tinqer database connection based on configuration
 * Returns the raw database handle (better-sqlite3 or pg-promise)
 */
export function initTinqerDatabase(config: DatabaseConfig): TinqerDatabaseHandle {
  if (config.type === "sqlite") {
    return initSQLiteDatabase(config.sqlite.dbPath);
  }
  return initPostgreSQLDatabase(config.postgres);
}

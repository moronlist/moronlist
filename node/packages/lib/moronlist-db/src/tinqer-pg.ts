/**
 * PostgreSQL implementation - NOT YET IMPLEMENTED
 * This is a placeholder for future PostgreSQL support
 */

// Placeholder type for PostgreSQL database handle
// Will be replaced with actual pg-promise database type when implemented
export type PostgreSQLDatabase = { _type: "postgresql"; _notImplemented: true };

export function initPostgreSQLDatabase(_config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}): PostgreSQLDatabase {
  throw new Error("PostgreSQL support is not yet implemented. Please use SQLite for now.");
}

export function closePostgreSQLDatabase(_db: PostgreSQLDatabase): void {
  throw new Error("PostgreSQL support is not yet implemented");
}

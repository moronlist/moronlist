/**
 * Flush State SQLite Repository
 */

import { executeSelect } from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase } from "moronlist-db";
import type { IFlushStateRepository } from "../interfaces/index.js";
import type { FlushState } from "../../types.js";
import { mapFlushStateFromDb } from "../../types.js";

function getState(db: SQLiteDatabase, platform: string, slug: string): FlushState | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("flush_state")
        .where((f) => f.list_platform === p.platform && f.list_slug === p.slug)
        .select((f) => ({
          list_platform: f.list_platform,
          list_slug: f.list_slug,
          last_flushed_version: f.last_flushed_version,
          last_flushed_at: f.last_flushed_at,
        })),
    { platform, slug }
  );

  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return mapFlushStateFromDb(row);
}

function updateState(db: SQLiteDatabase, platform: string, slug: string, version: number): void {
  const now = new Date().toISOString();

  // Raw SQL exception: Tinqer does not support INSERT OR REPLACE (upsert)
  db.prepare(
    `INSERT OR REPLACE INTO flush_state (list_platform, list_slug, last_flushed_version, last_flushed_at)
     VALUES (:platform, :slug, :version, :now)`
  ).run({ platform, slug, version, now });
}

export function createFlushStateRepository(db: SQLiteDatabase): IFlushStateRepository {
  return {
    getState: (platform, slug) => getState(db, platform, slug),
    updateState: (platform, slug, version) => updateState(db, platform, slug, version),
  };
}

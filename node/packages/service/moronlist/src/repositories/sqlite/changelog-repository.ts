/**
 * Changelog SQLite Repository
 */

import { executeSelect, executeInsert, executeDelete } from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase } from "moronlist-db";
import type { IChangelogRepository, CreateChangelogData } from "../interfaces/index.js";
import type { ChangelogEntry } from "../../types.js";
import { mapChangelogFromDb } from "../../types.js";
import { v4 as uuidv4 } from "uuid";

function findByList(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  sinceVersion: number | undefined,
  limit: number
): ChangelogEntry[] {
  if (sinceVersion !== undefined) {
    const rows = executeSelect(
      db,
      schema,
      (q, p) =>
        q
          .from("changelog")
          .where(
            (c) =>
              c.list_platform === p.platform && c.list_slug === p.slug && c.version > p.sinceVersion
          )
          .select((c) => ({
            id: c.id,
            list_platform: c.list_platform,
            list_slug: c.list_slug,
            version: c.version,
            action: c.action,
            platform_user_id: c.platform_user_id,
            user_id: c.user_id,
            reason: c.reason,
            flush_version: c.flush_version,
            created_at: c.created_at,
          }))
          .orderBy((c) => c.version)
          .take(p.limit),
      { platform, slug, sinceVersion, limit }
    );

    return rows.map(mapChangelogFromDb);
  }

  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("changelog")
        .where((c) => c.list_platform === p.platform && c.list_slug === p.slug)
        .select((c) => ({
          id: c.id,
          list_platform: c.list_platform,
          list_slug: c.list_slug,
          version: c.version,
          action: c.action,
          platform_user_id: c.platform_user_id,
          user_id: c.user_id,
          reason: c.reason,
          flush_version: c.flush_version,
          created_at: c.created_at,
        }))
        .orderBy((c) => c.version)
        .take(p.limit),
    { platform, slug, limit }
  );

  return rows.map(mapChangelogFromDb);
}

function createEntry(db: SQLiteDatabase, data: CreateChangelogData): ChangelogEntry {
  const id = uuidv4();
  const now = new Date().toISOString();
  const reason = data.reason ?? null;

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
        reason: p.reason,
        flush_version: p.flushVersion,
        created_at: p.createdAt,
      }),
    {
      id,
      listPlatform: data.listPlatform,
      listSlug: data.listSlug,
      version: data.version,
      action: data.action,
      platformUserId: data.platformUserId,
      userId: data.userId,
      reason,
      flushVersion: null,
      createdAt: now,
    }
  );

  // Return the entry directly since we have all the data
  return {
    id,
    listPlatform: data.listPlatform,
    listSlug: data.listSlug,
    version: data.version,
    action: data.action,
    platformUserId: data.platformUserId,
    userId: data.userId,
    reason,
    flushVersion: null,
    createdAt: new Date(now),
  };
}

function createBatch(db: SQLiteDatabase, entries: CreateChangelogData[]): ChangelogEntry[] {
  const results: ChangelogEntry[] = [];
  for (const data of entries) {
    results.push(createEntry(db, data));
  }
  return results;
}

function findUnflushed(db: SQLiteDatabase, platform: string, slug: string): ChangelogEntry[] {
  // Raw SQL exception: Tinqer does not support IS NULL comparisons
  const rows = db
    .prepare(
      `SELECT id, list_platform, list_slug, version, action, platform_user_id,
              user_id, reason, flush_version, created_at
       FROM changelog
       WHERE list_platform = :platform
         AND list_slug = :slug
         AND flush_version IS NULL
       ORDER BY version ASC`
    )
    .all({ platform, slug }) as {
    id: string;
    list_platform: string;
    list_slug: string;
    version: number;
    action: string;
    platform_user_id: string;
    user_id: string;
    reason: string | null;
    flush_version: number | null;
    created_at: string;
  }[];

  return rows.map(mapChangelogFromDb);
}

function findListsWithUnflushed(db: SQLiteDatabase): { platform: string; slug: string }[] {
  // Raw SQL exception: Tinqer does not support IS NULL in WHERE with DISTINCT
  const rows = db
    .prepare(
      `SELECT DISTINCT list_platform, list_slug
       FROM changelog
       WHERE flush_version IS NULL
       ORDER BY list_platform, list_slug`
    )
    .all() as { list_platform: string; list_slug: string }[];

  return rows.map((row) => ({ platform: row.list_platform, slug: row.list_slug }));
}

function markFlushed(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  upToVersion: number
): void {
  // Raw SQL exception: Tinqer does not support IS NULL in WHERE with compound conditions for UPDATE
  db.prepare(
    `UPDATE changelog
     SET flush_version = :upToVersion
     WHERE list_platform = :platform
       AND list_slug = :slug
       AND version <= :upToVersion
       AND flush_version IS NULL`
  ).run({ platform, slug, upToVersion });
}

function findLatestActionForUser(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  platformUserId: string
): ChangelogEntry | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("changelog")
        .where(
          (c) =>
            c.list_platform === p.platform &&
            c.list_slug === p.slug &&
            c.platform_user_id === p.platformUserId
        )
        .select((c) => ({
          id: c.id,
          list_platform: c.list_platform,
          list_slug: c.list_slug,
          version: c.version,
          action: c.action,
          platform_user_id: c.platform_user_id,
          user_id: c.user_id,
          reason: c.reason,
          flush_version: c.flush_version,
          created_at: c.created_at,
        }))
        .orderByDescending((c) => c.version)
        .take(1),
    { platform, slug, platformUserId }
  );

  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return mapChangelogFromDb(row);
}

function deleteAllByList(db: SQLiteDatabase, platform: string, slug: string): number {
  return executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("changelog")
        .where((c) => c.list_platform === p.platform && c.list_slug === p.slug),
    { platform, slug }
  );
}

export function createChangelogRepository(db: SQLiteDatabase): IChangelogRepository {
  return {
    findByList: (platform, slug, sinceVersion, limit) =>
      findByList(db, platform, slug, sinceVersion, limit),
    findUnflushed: (platform, slug) => findUnflushed(db, platform, slug),
    findListsWithUnflushed: () => findListsWithUnflushed(db),
    findLatestActionForUser: (platform, slug, platformUserId) =>
      findLatestActionForUser(db, platform, slug, platformUserId),
    create: (data) => createEntry(db, data),
    createBatch: (entries) => createBatch(db, entries),
    markFlushed: (platform, slug, upToVersion) => markFlushed(db, platform, slug, upToVersion),
    deleteAllByList: (platform, slug) => deleteAllByList(db, platform, slug),
  };
}

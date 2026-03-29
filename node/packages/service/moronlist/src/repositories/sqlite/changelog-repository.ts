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
    findLatestActionForUser: (platform, slug, platformUserId) =>
      findLatestActionForUser(db, platform, slug, platformUserId),
    create: (data) => createEntry(db, data),
    createBatch: (entries) => createBatch(db, entries),
    deleteAllByList: (platform, slug) => deleteAllByList(db, platform, slug),
  };
}

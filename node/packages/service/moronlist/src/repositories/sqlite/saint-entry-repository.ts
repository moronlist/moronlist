/**
 * Saint Entry SQLite Repository
 */

import { executeSelect, executeInsert, executeDelete } from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase } from "moronlist-db";
import type { ISaintEntryRepository, CreateSaintEntryData } from "../interfaces/index.js";
import type { SaintEntry } from "../../types.js";
import { mapSaintEntryFromDb } from "../../types.js";
import { v4 as uuidv4 } from "uuid";

function findById(db: SQLiteDatabase, id: string): SaintEntry | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("saint_entry")
        .where((e) => e.id === p.id)
        .select((e) => ({
          id: e.id,
          list_platform: e.list_platform,
          list_slug: e.list_slug,
          platform_user_id: e.platform_user_id,
          reason: e.reason,
          added_by_id: e.added_by_id,
          created_at: e.created_at,
        }))
        .take(1),
    { id }
  );

  const row = rows[0];
  return row !== undefined ? mapSaintEntryFromDb(row) : null;
}

function findByListAndPlatformUser(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  platformUserId: string
): SaintEntry | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("saint_entry")
        .where(
          (e) =>
            e.list_platform === p.platform &&
            e.list_slug === p.slug &&
            e.platform_user_id === p.platformUserId
        )
        .select((e) => ({
          id: e.id,
          list_platform: e.list_platform,
          list_slug: e.list_slug,
          platform_user_id: e.platform_user_id,
          reason: e.reason,
          added_by_id: e.added_by_id,
          created_at: e.created_at,
        }))
        .take(1),
    { platform, slug, platformUserId }
  );

  const row = rows[0];
  return row !== undefined ? mapSaintEntryFromDb(row) : null;
}

function findByList(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  offset: number,
  limit: number
): SaintEntry[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("saint_entry")
        .where((e) => e.list_platform === p.platform && e.list_slug === p.slug)
        .select((e) => ({
          id: e.id,
          list_platform: e.list_platform,
          list_slug: e.list_slug,
          platform_user_id: e.platform_user_id,
          reason: e.reason,
          added_by_id: e.added_by_id,
          created_at: e.created_at,
        }))
        .skip(p.offset)
        .take(p.limit),
    { platform, slug, offset, limit }
  );

  return rows.map(mapSaintEntryFromDb);
}

function countByList(db: SQLiteDatabase, platform: string, slug: string): number {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("saint_entry")
        .where((e) => e.list_platform === p.platform && e.list_slug === p.slug)
        .groupBy(() => true)
        .select((g) => ({
          count: g.count(),
        })),
    { platform, slug }
  );

  return rows[0]?.count ?? 0;
}

function findAllByList(db: SQLiteDatabase, platform: string, slug: string): SaintEntry[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("saint_entry")
        .where((e) => e.list_platform === p.platform && e.list_slug === p.slug)
        .select((e) => ({
          id: e.id,
          list_platform: e.list_platform,
          list_slug: e.list_slug,
          platform_user_id: e.platform_user_id,
          reason: e.reason,
          added_by_id: e.added_by_id,
          created_at: e.created_at,
        })),
    { platform, slug }
  );

  return rows.map(mapSaintEntryFromDb);
}

function createEntry(db: SQLiteDatabase, data: CreateSaintEntryData): SaintEntry {
  const id = uuidv4();
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
      id,
      listPlatform: data.listPlatform,
      listSlug: data.listSlug,
      platformUserId: data.platformUserId,
      reason: data.reason ?? (null as string | null),
      addedById: data.addedById,
      createdAt: now,
    }
  );

  const entry = findById(db, id);
  if (entry === null) {
    throw new Error("Failed to create saint entry");
  }
  return entry;
}

function createBatch(db: SQLiteDatabase, entries: CreateSaintEntryData[]): SaintEntry[] {
  const results: SaintEntry[] = [];
  for (const data of entries) {
    results.push(createEntry(db, data));
  }
  return results;
}

function deleteById(db: SQLiteDatabase, id: string): boolean {
  const deleted = executeDelete(
    db,
    schema,
    (q, p) => q.deleteFrom("saint_entry").where((e) => e.id === p.id),
    { id }
  );

  return deleted > 0;
}

function deleteByPlatformUser(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  platformUserId: string
): boolean {
  const deleted = executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("saint_entry")
        .where(
          (e) =>
            e.list_platform === p.platform &&
            e.list_slug === p.slug &&
            e.platform_user_id === p.platformUserId
        ),
    { platform, slug, platformUserId }
  );

  return deleted > 0;
}

function deleteAllByList(db: SQLiteDatabase, platform: string, slug: string): number {
  return executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("saint_entry")
        .where((e) => e.list_platform === p.platform && e.list_slug === p.slug),
    { platform, slug }
  );
}

export function createSaintEntryRepository(db: SQLiteDatabase): ISaintEntryRepository {
  return {
    findById: (id) => findById(db, id),
    findByListAndPlatformUser: (platform, slug, platformUserId) =>
      findByListAndPlatformUser(db, platform, slug, platformUserId),
    findByList: (platform, slug, offset, limit) => findByList(db, platform, slug, offset, limit),
    countByList: (platform, slug) => countByList(db, platform, slug),
    findAllByList: (platform, slug) => findAllByList(db, platform, slug),
    create: (data) => createEntry(db, data),
    createBatch: (entries) => createBatch(db, entries),
    deleteById: (id) => deleteById(db, id),
    deleteByPlatformUser: (platform, slug, platformUserId) =>
      deleteByPlatformUser(db, platform, slug, platformUserId),
    deleteAllByList: (platform, slug) => deleteAllByList(db, platform, slug),
  };
}

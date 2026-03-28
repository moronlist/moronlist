/**
 * Moron List SQLite Repository
 */

import {
  executeSelect,
  executeInsert,
  executeUpdate,
  executeDelete,
} from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase, type MoronListDbRow } from "moronlist-db";
import type {
  IMoronListRepository,
  CreateMoronListData,
  UpdateMoronListData,
} from "../interfaces/index.js";
import type { MoronList } from "../../types.js";
import { mapMoronListFromDb } from "../../types.js";

function selectAll(db: SQLiteDatabase, platform: string, slug: string): MoronList | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list")
        .where((l) => l.platform === p.platform && l.slug === p.slug)
        .select((l) => ({
          platform: l.platform,
          slug: l.slug,
          owner_id: l.owner_id,
          name: l.name,
          description: l.description,
          visibility: l.visibility,
          version: l.version,
          forked_from_platform: l.forked_from_platform,
          forked_from_slug: l.forked_from_slug,
          created_at: l.created_at,
          updated_at: l.updated_at,
        }))
        .take(1),
    { platform, slug }
  );

  const row = rows[0];
  return row !== undefined ? mapMoronListFromDb(row) : null;
}

function findByPlatformAndSlug(
  db: SQLiteDatabase,
  platform: string,
  slug: string
): MoronList | null {
  return selectAll(db, platform, slug);
}

function findByOwnerId(db: SQLiteDatabase, ownerId: string): MoronList[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list")
        .where((l) => l.owner_id === p.ownerId)
        .select((l) => ({
          platform: l.platform,
          slug: l.slug,
          owner_id: l.owner_id,
          name: l.name,
          description: l.description,
          visibility: l.visibility,
          version: l.version,
          forked_from_platform: l.forked_from_platform,
          forked_from_slug: l.forked_from_slug,
          created_at: l.created_at,
          updated_at: l.updated_at,
        })),
    { ownerId }
  );

  return rows.map(mapMoronListFromDb);
}

function findByPlatform(
  db: SQLiteDatabase,
  platform: string,
  offset: number,
  limit: number
): MoronList[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list")
        .where((l) => l.platform === p.platform && l.visibility === p.visibility)
        .select((l) => ({
          platform: l.platform,
          slug: l.slug,
          owner_id: l.owner_id,
          name: l.name,
          description: l.description,
          visibility: l.visibility,
          version: l.version,
          forked_from_platform: l.forked_from_platform,
          forked_from_slug: l.forked_from_slug,
          created_at: l.created_at,
          updated_at: l.updated_at,
        }))
        .skip(p.offset)
        .take(p.limit),
    { platform, visibility: "public", offset, limit }
  );

  return rows.map(mapMoronListFromDb);
}

function countByPlatform(db: SQLiteDatabase, platform: string): number {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list")
        .where((l) => l.platform === p.platform && l.visibility === p.visibility)
        .groupBy(() => true)
        .select((g) => ({
          count: g.count(),
        })),
    { platform, visibility: "public" }
  );

  return rows[0]?.count ?? 0;
}

function searchByPlatform(
  db: SQLiteDatabase,
  platform: string,
  query: string,
  offset: number,
  limit: number
): MoronList[] {
  // Raw SQL exception: Tinqer does not support LIKE operator
  const pattern = `%${query}%`;
  const rows = db
    .prepare(
      `SELECT platform, slug, owner_id, name, description, visibility, version,
              forked_from_platform, forked_from_slug, created_at, updated_at
       FROM moron_list
       WHERE platform = :platform
         AND visibility = :visibility
         AND (name LIKE :pattern OR slug LIKE :pattern)
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`
    )
    .all({ platform, visibility: "public", pattern, offset, limit }) as MoronListDbRow[];

  return rows.map(mapMoronListFromDb);
}

function findPopularByPlatform(
  db: SQLiteDatabase,
  platform: string,
  offset: number,
  limit: number
): MoronList[] {
  // Popular = public lists sorted by version (higher version = more activity)
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list")
        .where((l) => l.platform === p.platform && l.visibility === p.visibility)
        .select((l) => ({
          platform: l.platform,
          slug: l.slug,
          owner_id: l.owner_id,
          name: l.name,
          description: l.description,
          visibility: l.visibility,
          version: l.version,
          forked_from_platform: l.forked_from_platform,
          forked_from_slug: l.forked_from_slug,
          created_at: l.created_at,
          updated_at: l.updated_at,
        }))
        .orderBy((l) => l.version, "desc")
        .skip(p.offset)
        .take(p.limit),
    { platform, visibility: "public", offset, limit }
  );

  return rows.map(mapMoronListFromDb);
}

function create(db: SQLiteDatabase, data: CreateMoronListData): MoronList {
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
      ownerId: data.ownerId,
      name: data.name,
      description: data.description ?? (null as string | null),
      visibility: data.visibility,
      version: 0,
      forkedFromPlatform: data.forkedFromPlatform ?? (null as string | null),
      forkedFromSlug: data.forkedFromSlug ?? (null as string | null),
      createdAt: now,
      updatedAt: now,
    }
  );

  const list = selectAll(db, data.platform, data.slug);
  if (list === null) {
    throw new Error("Failed to create moron list");
  }
  return list;
}

function update(
  db: SQLiteDatabase,
  platform: string,
  slug: string,
  data: UpdateMoronListData
): MoronList {
  const now = new Date().toISOString();

  // Read current record and merge with partial update data
  const existing = selectAll(db, platform, slug);
  if (existing === null) {
    throw new Error(`List ${platform}/${slug} not found`);
  }

  const name = data.name ?? existing.name;
  const description = data.description ?? existing.description ?? null;
  const visibility = data.visibility ?? existing.visibility;

  executeUpdate(
    db,
    schema,
    (q, p) =>
      q
        .update("moron_list")
        .set({
          name: p.name,
          description: p.description,
          visibility: p.visibility,
          updated_at: p.updatedAt,
        })
        .where((l) => l.platform === p.platform && l.slug === p.slug),
    { platform, slug, name, description: description, visibility, updatedAt: now }
  );

  const list = selectAll(db, platform, slug);
  if (list === null) {
    throw new Error(`List ${platform}/${slug} not found after update`);
  }
  return list;
}

function incrementVersion(db: SQLiteDatabase, platform: string, slug: string): number {
  const now = new Date().toISOString();
  const existing = selectAll(db, platform, slug);
  if (existing === null) {
    throw new Error(`List ${platform}/${slug} not found`);
  }

  const newVersion = existing.version + 1;

  executeUpdate(
    db,
    schema,
    (q, p) =>
      q
        .update("moron_list")
        .set({ version: p.newVersion, updated_at: p.now })
        .where((l) => l.platform === p.platform && l.slug === p.slug),
    { platform, slug, newVersion, now }
  );

  return newVersion;
}

function deleteList(db: SQLiteDatabase, platform: string, slug: string): boolean {
  const deleted = executeDelete(
    db,
    schema,
    (q, p) =>
      q.deleteFrom("moron_list").where((l) => l.platform === p.platform && l.slug === p.slug),
    { platform, slug }
  );

  return deleted > 0;
}

export function createMoronListRepository(db: SQLiteDatabase): IMoronListRepository {
  return {
    findByPlatformAndSlug: (platform, slug) => findByPlatformAndSlug(db, platform, slug),
    findByOwnerId: (ownerId) => findByOwnerId(db, ownerId),
    findByPlatform: (platform, offset, limit) => findByPlatform(db, platform, offset, limit),
    countByPlatform: (platform) => countByPlatform(db, platform),
    searchByPlatform: (platform, query, offset, limit) =>
      searchByPlatform(db, platform, query, offset, limit),
    findPopularByPlatform: (platform, offset, limit) =>
      findPopularByPlatform(db, platform, offset, limit),
    create: (data) => create(db, data),
    update: (platform, slug, data) => update(db, platform, slug, data),
    incrementVersion: (platform, slug) => incrementVersion(db, platform, slug),
    delete: (platform, slug) => deleteList(db, platform, slug),
  };
}

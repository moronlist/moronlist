/**
 * Inheritance SQLite Repository
 */

import { executeSelect, executeInsert, executeDelete } from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase } from "moronlist-db";
import type { IInheritanceRepository } from "../interfaces/index.js";
import type { InheritanceLink } from "../../types.js";

function mapToDomain(row: {
  child_platform: string;
  child_slug: string;
  parent_platform: string;
  parent_slug: string;
  created_at: string;
}): InheritanceLink {
  return {
    childPlatform: row.child_platform,
    childSlug: row.child_slug,
    parentPlatform: row.parent_platform,
    parentSlug: row.parent_slug,
    createdAt: new Date(row.created_at),
  };
}

function findParents(
  db: SQLiteDatabase,
  childPlatform: string,
  childSlug: string
): InheritanceLink[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list_inheritance")
        .where((i) => i.child_platform === p.childPlatform && i.child_slug === p.childSlug)
        .select((i) => ({
          child_platform: i.child_platform,
          child_slug: i.child_slug,
          parent_platform: i.parent_platform,
          parent_slug: i.parent_slug,
          created_at: i.created_at,
        })),
    { childPlatform, childSlug }
  );

  return rows.map(mapToDomain);
}

function findChildren(
  db: SQLiteDatabase,
  parentPlatform: string,
  parentSlug: string
): InheritanceLink[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("moron_list_inheritance")
        .where((i) => i.parent_platform === p.parentPlatform && i.parent_slug === p.parentSlug)
        .select((i) => ({
          child_platform: i.child_platform,
          child_slug: i.child_slug,
          parent_platform: i.parent_platform,
          parent_slug: i.parent_slug,
          created_at: i.created_at,
        })),
    { parentPlatform, parentSlug }
  );

  return rows.map(mapToDomain);
}

function setParents(
  db: SQLiteDatabase,
  childPlatform: string,
  childSlug: string,
  parents: { platform: string; slug: string }[]
): void {
  // Delete all existing parents
  executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("moron_list_inheritance")
        .where((i) => i.child_platform === p.childPlatform && i.child_slug === p.childSlug),
    { childPlatform, childSlug }
  );

  // Insert new parents
  const now = new Date().toISOString();
  for (const parent of parents) {
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
        childPlatform,
        childSlug,
        parentPlatform: parent.platform,
        parentSlug: parent.slug,
        createdAt: now,
      }
    );
  }
}

function deleteAllForList(db: SQLiteDatabase, platform: string, slug: string): number {
  // Delete as child
  const asChild = executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("moron_list_inheritance")
        .where((i) => i.child_platform === p.platform && i.child_slug === p.slug),
    { platform, slug }
  );

  // Delete as parent
  const asParent = executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("moron_list_inheritance")
        .where((i) => i.parent_platform === p.platform && i.parent_slug === p.slug),
    { platform, slug }
  );

  return asChild + asParent;
}

export function createInheritanceRepository(db: SQLiteDatabase): IInheritanceRepository {
  return {
    findParents: (childPlatform, childSlug) => findParents(db, childPlatform, childSlug),
    findChildren: (parentPlatform, parentSlug) => findChildren(db, parentPlatform, parentSlug),
    setParents: (childPlatform, childSlug, parents) =>
      setParents(db, childPlatform, childSlug, parents),
    deleteAllForList: (platform, slug) => deleteAllForList(db, platform, slug),
  };
}

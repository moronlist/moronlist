/**
 * Subscription SQLite Repository
 */

import { executeSelect, executeInsert, executeDelete } from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase } from "moronlist-db";
import type { ISubscriptionRepository } from "../interfaces/index.js";
import type { Subscription } from "../../types.js";
import { mapSubscriptionFromDb } from "../../types.js";

function findByUser(db: SQLiteDatabase, userId: string): Subscription[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("subscription")
        .where((s) => s.user_id === p.userId)
        .select((s) => ({
          user_id: s.user_id,
          list_platform: s.list_platform,
          list_slug: s.list_slug,
          subscribed_at: s.subscribed_at,
        })),
    { userId }
  );

  return rows.map(mapSubscriptionFromDb);
}

function findByList(db: SQLiteDatabase, platform: string, slug: string): Subscription[] {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("subscription")
        .where((s) => s.list_platform === p.platform && s.list_slug === p.slug)
        .select((s) => ({
          user_id: s.user_id,
          list_platform: s.list_platform,
          list_slug: s.list_slug,
          subscribed_at: s.subscribed_at,
        })),
    { platform, slug }
  );

  return rows.map(mapSubscriptionFromDb);
}

function isSubscribed(db: SQLiteDatabase, userId: string, platform: string, slug: string): boolean {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("subscription")
        .where(
          (s) => s.user_id === p.userId && s.list_platform === p.platform && s.list_slug === p.slug
        )
        .select((s) => ({
          user_id: s.user_id,
        }))
        .take(1),
    { userId, platform, slug }
  );

  return rows.length > 0;
}

function subscribe(
  db: SQLiteDatabase,
  userId: string,
  platform: string,
  slug: string
): Subscription {
  // Check if already subscribed
  if (isSubscribed(db, userId, platform, slug)) {
    const existing = findByUser(db, userId).find(
      (s) => s.listPlatform === platform && s.listSlug === slug
    );
    if (existing !== undefined) {
      return existing;
    }
  }

  const now = new Date().toISOString();

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("subscription").values({
        user_id: p.userId,
        list_platform: p.platform,
        list_slug: p.slug,
        subscribed_at: p.subscribedAt,
      }),
    {
      userId,
      platform,
      slug,
      subscribedAt: now,
    }
  );

  return {
    userId,
    listPlatform: platform,
    listSlug: slug,
    subscribedAt: new Date(now),
  };
}

function unsubscribe(db: SQLiteDatabase, userId: string, platform: string, slug: string): boolean {
  const deleted = executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("subscription")
        .where(
          (s) => s.user_id === p.userId && s.list_platform === p.platform && s.list_slug === p.slug
        ),
    { userId, platform, slug }
  );

  return deleted > 0;
}

function deleteAllByList(db: SQLiteDatabase, platform: string, slug: string): number {
  return executeDelete(
    db,
    schema,
    (q, p) =>
      q
        .deleteFrom("subscription")
        .where((s) => s.list_platform === p.platform && s.list_slug === p.slug),
    { platform, slug }
  );
}

function countByList(db: SQLiteDatabase, platform: string, slug: string): number {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("subscription")
        .where((s) => s.list_platform === p.platform && s.list_slug === p.slug)
        .groupBy(() => true)
        .select((g) => ({
          count: g.count(),
        })),
    { platform, slug }
  );

  return rows[0]?.count ?? 0;
}

export function createSubscriptionRepository(db: SQLiteDatabase): ISubscriptionRepository {
  return {
    findByUser: (userId) => findByUser(db, userId),
    findByList: (platform, slug) => findByList(db, platform, slug),
    isSubscribed: (userId, platform, slug) => isSubscribed(db, userId, platform, slug),
    subscribe: (userId, platform, slug) => subscribe(db, userId, platform, slug),
    unsubscribe: (userId, platform, slug) => unsubscribe(db, userId, platform, slug),
    deleteAllByList: (platform, slug) => deleteAllByList(db, platform, slug),
    countByList: (platform, slug) => countByList(db, platform, slug),
  };
}

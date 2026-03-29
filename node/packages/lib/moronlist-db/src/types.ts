/**
 * SQLite-specific database row types
 * These map directly to database tables with SQLite-specific types:
 * - INTEGER (0/1) for booleans
 * - TEXT for dates (ISO 8601 strings)
 */

// User table row
export type UserDbRow = {
  id: string; // User-chosen ID (3-24 chars, alphanumeric + underscore)
  email: string;
  name: string;
  role: string; // ROOT, ADMIN, MODERATOR, USER
  banned: number; // INTEGER (0/1) in SQLite
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
};

// Moron list table row
export type MoronListDbRow = {
  platform: string; // e.g. 'x', 'bluesky'
  slug: string; // URL-friendly, unique per platform
  owner_id: string; // FK to user.id
  name: string;
  description: string | null;
  visibility: string; // public, private, unlisted
  version: number;
  entry_count: number;
  saint_count: number;
  forked_from_platform: string | null; // FK to moron_list
  forked_from_slug: string | null; // FK to moron_list
  created_at: string;
  updated_at: string;
};

// Moron list inheritance table row
export type MoronListInheritanceDbRow = {
  child_platform: string;
  child_slug: string;
  parent_platform: string;
  parent_slug: string;
  created_at: string;
};

// Changelog table row
export type ChangelogDbRow = {
  id: string; // UUID
  list_platform: string;
  list_slug: string;
  version: number;
  action: string; // ADD, REMOVE, ADD_SAINT, REMOVE_SAINT
  platform_user_id: string;
  user_id: string; // FK to user.id
  reason: string | null;
  flush_version: number | null;
  created_at: string;
};

// Flush state table row
export type FlushStateDbRow = {
  list_platform: string;
  list_slug: string;
  last_flushed_version: number;
  last_flushed_at: string | null;
};

// Subscription table row
export type SubscriptionDbRow = {
  user_id: string; // FK to user.id
  list_platform: string;
  list_slug: string;
  subscribed_at: string;
};

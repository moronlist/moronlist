// Database schema definition for Tinqer
// This provides type-safe queries with the Tinqer query builder

export type DatabaseSchema = {
  // User table
  // Note: id is user-chosen (3-24 chars, alphanumeric + underscore)
  user: {
    id: string;
    email: string;
    name: string;
    role: string; // ROOT, ADMIN, MODERATOR, USER
    banned: number; // 0 or 1 in SQLite
    ban_reason: string | null;
    created_at: string;
    updated_at: string;
  };

  // Moron list table
  moron_list: {
    platform: string; // e.g. 'x', 'bluesky'
    slug: string; // URL-friendly, unique per platform
    owner_id: string; // FK to user.id
    name: string;
    description: string | null;
    visibility: string; // public, private, unlisted
    version: number;
    entry_count: number;
    saint_count: number;
    forked_from_platform: string | null;
    forked_from_slug: string | null;
    created_at: string;
    updated_at: string;
  };

  // Moron list inheritance table - list parent/child relationships
  moron_list_inheritance: {
    child_platform: string;
    child_slug: string;
    parent_platform: string;
    parent_slug: string;
    created_at: string;
  };

  // Changelog table - tracks changes to lists
  changelog: {
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

  // Flush state table - tracks flush progress per list
  flush_state: {
    list_platform: string;
    list_slug: string;
    last_flushed_version: number;
    last_flushed_at: string | null;
  };

  // Subscription table - users subscribing to lists
  subscription: {
    user_id: string; // FK to user.id
    list_platform: string;
    list_slug: string;
    subscribed_at: string;
  };
};

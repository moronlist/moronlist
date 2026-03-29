/**
 * Core domain types for MoronList
 */

import type { UserDbRow, MoronListDbRow, ChangelogDbRow, SubscriptionDbRow } from "moronlist-db";

// Result type for error handling
export type DomainError = {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
};

export type Result<T, E = DomainError> = { success: true; data: T } | { success: false; error: E };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure(error: DomainError): Result<never> {
  return { success: false, error };
}

// Error codes
export const ErrorCode = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Business logic
  CYCLE_DETECTED: "CYCLE_DETECTED",
  MAX_PARENTS_EXCEEDED: "MAX_PARENTS_EXCEEDED",
  CANNOT_INHERIT_OWN_LIST: "CANNOT_INHERIT_OWN_LIST",
  LIST_NOT_PUBLIC: "LIST_NOT_PUBLIC",

  // System errors
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

// Domain types (camelCase)

export type UserRole = "ROOT" | "ADMIN" | "MODERATOR" | "USER";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  banned: boolean;
  banReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Visibility = "public" | "private" | "unlisted";

export type MoronList = {
  platform: string;
  slug: string;
  ownerId: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  version: number;
  entryCount: number;
  saintCount: number;
  forkedFromPlatform: string | null;
  forkedFromSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChangelogAction = "ADD" | "REMOVE" | "ADD_SAINT" | "REMOVE_SAINT";

export type ChangelogEntry = {
  id: string;
  listPlatform: string;
  listSlug: string;
  version: number;
  action: ChangelogAction;
  platformUserId: string;
  userId: string;
  reason: string | null;
  createdAt: Date;
};

export type Subscription = {
  userId: string;
  listPlatform: string;
  listSlug: string;
  subscribedAt: Date;
};

export type InheritanceLink = {
  childPlatform: string;
  childSlug: string;
  parentPlatform: string;
  parentSlug: string;
  createdAt: Date;
};

// Mapping functions from DbRow types to domain types

export function mapUserFromDb(row: UserDbRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    banned: row.banned === 1,
    banReason: row.ban_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapMoronListFromDb(row: MoronListDbRow): MoronList {
  return {
    platform: row.platform,
    slug: row.slug,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    visibility: row.visibility as Visibility,
    version: row.version,
    entryCount: row.entry_count,
    saintCount: row.saint_count,
    forkedFromPlatform: row.forked_from_platform,
    forkedFromSlug: row.forked_from_slug,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapChangelogFromDb(row: ChangelogDbRow): ChangelogEntry {
  return {
    id: row.id,
    listPlatform: row.list_platform,
    listSlug: row.list_slug,
    version: row.version,
    action: row.action as ChangelogAction,
    platformUserId: row.platform_user_id,
    userId: row.user_id,
    reason: row.reason,
    createdAt: new Date(row.created_at),
  };
}

export function mapSubscriptionFromDb(row: SubscriptionDbRow): Subscription {
  return {
    userId: row.user_id,
    listPlatform: row.list_platform,
    listSlug: row.list_slug,
    subscribedAt: new Date(row.subscribed_at),
  };
}

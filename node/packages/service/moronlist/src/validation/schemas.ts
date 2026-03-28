/**
 * Zod validation schemas for all API inputs
 */

import { z } from "zod";

// Reusable patterns
const PLATFORM_REGEX = /^[a-z][a-z0-9_-]{0,29}$/;
const SLUG_REGEX = /^[a-z][a-z0-9_-]{0,59}$/;
const USER_ID_REGEX = /^[a-z][a-z0-9_]{2,23}$/;

// Common param schemas
export const platformParam = z.string().regex(PLATFORM_REGEX, "Invalid platform identifier");
export const slugParam = z.string().regex(SLUG_REGEX, "Invalid slug");
export const userIdParam = z.string().regex(USER_ID_REGEX, "Invalid user ID format");

// Pagination
export const paginationQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// Auth
export const completeOnboardingBody = z.object({
  id: z
    .string()
    .min(3)
    .max(24)
    .regex(
      USER_ID_REGEX,
      "User ID must be 3-24 lowercase alphanumeric characters or underscores, starting with a letter"
    ),
  name: z.string().min(1).max(100).trim(),
});

// Moron list CRUD
export const createMoronListBody = z.object({
  platform: z
    .string()
    .regex(PLATFORM_REGEX, "Platform must be lowercase alphanumeric, hyphens, or underscores"),
  slug: z
    .string()
    .regex(SLUG_REGEX, "Slug must be lowercase alphanumeric, hyphens, or underscores"),
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  visibility: z.enum(["public", "private", "unlisted"]).default("public"),
});

export const updateMoronListBody = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
});

export const forkMoronListBody = z.object({
  slug: z
    .string()
    .regex(SLUG_REGEX, "Slug must be lowercase alphanumeric, hyphens, or underscores"),
  name: z.string().min(1).max(200).trim().optional(),
});

// Browse / Search
export const searchQuery = z.object({
  q: z.string().min(1).max(200).trim(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const browseQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const popularQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Entries
export const createEntryBody = z.object({
  platformUserId: z.string().min(1).max(200).trim(),
  displayName: z.string().max(200).trim().optional(),
  reason: z.string().max(1000).trim().optional(),
});

export const batchCreateEntriesBody = z.object({
  entries: z
    .array(
      z.object({
        platformUserId: z.string().min(1).max(200).trim(),
        displayName: z.string().max(200).trim().optional(),
        reason: z.string().max(1000).trim().optional(),
      })
    )
    .min(1)
    .max(1000),
});

export const deleteEntryByPlatformUserQuery = z.object({
  platformUserId: z.string().min(1).max(200).trim(),
});

// Saints
export const createSaintBody = z.object({
  platformUserId: z.string().min(1).max(200).trim(),
  reason: z.string().max(1000).trim().optional(),
});

export const batchCreateSaintsBody = z.object({
  saints: z
    .array(
      z.object({
        platformUserId: z.string().min(1).max(200).trim(),
        reason: z.string().max(1000).trim().optional(),
      })
    )
    .min(1)
    .max(1000),
});

export const deleteSaintByPlatformUserQuery = z.object({
  platformUserId: z.string().min(1).max(200).trim(),
});

// Inheritance
export const updateParentsBody = z.object({
  parents: z
    .array(
      z
        .string()
        .regex(
          /^[a-z][a-z0-9_-]{0,29}\/[a-z][a-z0-9_-]{0,59}$/,
          "Each parent must be in platform/slug format"
        )
    )
    .max(50),
});

// Changelog
export const changelogQuery = z.object({
  sinceVersion: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// Subscriptions
export const createSubscriptionBody = z.object({
  moronListId: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,29}\/[a-z][a-z0-9_-]{0,59}$/, "Must be in platform/slug format"),
});

// Sync (plugin)
export const syncBody = z.object({
  lists: z.record(
    z.string().regex(/^[a-z][a-z0-9_-]{0,29}\/[a-z][a-z0-9_-]{0,59}$/),
    z.number().int().min(0)
  ),
});

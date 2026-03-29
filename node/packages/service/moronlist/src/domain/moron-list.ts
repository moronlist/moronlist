/**
 * Moron List domain logic
 * Business logic for list operations (create, update, delete, fork)
 */

import type { Repositories } from "../repositories/interfaces/index.js";
import type { MoronList, Result, Visibility } from "../types.js";
import { success, failure, ErrorCode } from "../types.js";

export type CreateListInput = {
  platform: string;
  slug: string;
  ownerId: string;
  name: string;
  description?: string;
  visibility: Visibility;
};

export type UpdateListInput = {
  name?: string;
  description?: string;
  visibility?: Visibility;
};

export type ForkListInput = {
  slug: string;
  name?: string;
  userId: string;
};

export function createList(repos: Repositories, input: CreateListInput): Result<MoronList> {
  // Check user exists
  const user = repos.user.findById(input.ownerId);
  if (user === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "User not found" });
  }

  if (user.banned) {
    return failure({ code: ErrorCode.FORBIDDEN, message: "Account is banned" });
  }

  // Check if list already exists
  const existing = repos.moronList.findByPlatformAndSlug(input.platform, input.slug);
  if (existing !== null) {
    return failure({
      code: ErrorCode.ALREADY_EXISTS,
      message: `List ${input.platform}/${input.slug} already exists`,
    });
  }

  const list = repos.moronList.create({
    platform: input.platform,
    slug: input.slug,
    ownerId: input.ownerId,
    name: input.name,
    description: input.description,
    visibility: input.visibility,
  });

  return success(list);
}

export function updateList(
  repos: Repositories,
  platform: string,
  slug: string,
  userId: string,
  input: UpdateListInput
): Result<MoronList> {
  const list = repos.moronList.findByPlatformAndSlug(platform, slug);
  if (list === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "List not found" });
  }

  // Only owner can update
  if (list.ownerId !== userId) {
    return failure({
      code: ErrorCode.FORBIDDEN,
      message: "Only the list owner can update this list",
    });
  }

  const updated = repos.moronList.update(platform, slug, input);
  return success(updated);
}

export function deleteList(
  repos: Repositories,
  platform: string,
  slug: string,
  userId: string,
  userRole?: string
): Result<{ deleted: boolean }> {
  const list = repos.moronList.findByPlatformAndSlug(platform, slug);
  if (list === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "List not found" });
  }

  // Owner can always delete; ROOT and ADMIN can delete any list
  const isPrivileged = userRole === "ROOT" || userRole === "ADMIN";
  if (list.ownerId !== userId && !isPrivileged) {
    return failure({
      code: ErrorCode.FORBIDDEN,
      message: "Only the list owner can delete this list",
    });
  }

  // Clean up all related data
  repos.moronEntry.deleteAllByList(platform, slug);
  repos.saintEntry.deleteAllByList(platform, slug);
  repos.changelog.deleteAllByList(platform, slug);
  repos.subscription.deleteAllByList(platform, slug);
  repos.inheritance.deleteAllForList(platform, slug);
  repos.moronList.delete(platform, slug);

  return success({ deleted: true });
}

export function forkList(
  repos: Repositories,
  sourcePlatform: string,
  sourceSlug: string,
  input: ForkListInput
): Result<MoronList> {
  const source = repos.moronList.findByPlatformAndSlug(sourcePlatform, sourceSlug);
  if (source === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "Source list not found" });
  }

  // Can only fork public lists
  if (source.visibility !== "public") {
    return failure({ code: ErrorCode.FORBIDDEN, message: "Can only fork public lists" });
  }

  const user = repos.user.findById(input.userId);
  if (user === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "User not found" });
  }

  if (user.banned) {
    return failure({ code: ErrorCode.FORBIDDEN, message: "Account is banned" });
  }

  // Check if target already exists
  const existing = repos.moronList.findByPlatformAndSlug(sourcePlatform, input.slug);
  if (existing !== null) {
    return failure({
      code: ErrorCode.ALREADY_EXISTS,
      message: `List ${sourcePlatform}/${input.slug} already exists`,
    });
  }

  // Create the forked list
  const forked = repos.moronList.create({
    platform: sourcePlatform,
    slug: input.slug,
    ownerId: input.userId,
    name: input.name ?? source.name,
    description: source.description ?? undefined,
    visibility: "public",
    forkedFromPlatform: sourcePlatform,
    forkedFromSlug: sourceSlug,
  });

  // Replay changelog from the source list to compute effective entries and saints.
  // We read all changelog entries and replay ADD/REMOVE/ADD_SAINT/REMOVE_SAINT
  // to compute the current effective set of entries and saints.
  const allChangelog = repos.changelog.findByList(sourcePlatform, sourceSlug, undefined, 100000);

  const effectiveEntries = new Map<string, string | undefined>();
  const effectiveSaints = new Map<string, string | undefined>();

  for (const entry of allChangelog) {
    switch (entry.action) {
      case "ADD":
        effectiveEntries.set(entry.platformUserId, entry.reason ?? undefined);
        break;
      case "REMOVE":
        effectiveEntries.delete(entry.platformUserId);
        break;
      case "ADD_SAINT":
        effectiveSaints.set(entry.platformUserId, entry.reason ?? undefined);
        break;
      case "REMOVE_SAINT":
        effectiveSaints.delete(entry.platformUserId);
        break;
    }
  }

  // Write ADD changelog entries for the forked list
  const entryItems = Array.from(effectiveEntries.entries());
  if (entryItems.length > 0) {
    const entryVersion = repos.moronList.incrementVersion(sourcePlatform, input.slug);
    repos.changelog.createBatch(
      entryItems.map(([platformUserId, reason]) => ({
        listPlatform: sourcePlatform,
        listSlug: input.slug,
        version: entryVersion,
        action: "ADD" as const,
        platformUserId,
        userId: input.userId,
        reason,
      }))
    );
  }

  // Write ADD_SAINT changelog entries for the forked list
  const saintItems = Array.from(effectiveSaints.entries());
  if (saintItems.length > 0) {
    const saintVersion = repos.moronList.incrementVersion(sourcePlatform, input.slug);
    repos.changelog.createBatch(
      saintItems.map(([platformUserId, reason]) => ({
        listPlatform: sourcePlatform,
        listSlug: input.slug,
        version: saintVersion,
        action: "ADD_SAINT" as const,
        platformUserId,
        userId: input.userId,
        reason,
      }))
    );
  }

  // Update entry_count and saint_count on the forked list
  repos.moronList.updateEntryCounts(
    sourcePlatform,
    input.slug,
    entryItems.length,
    saintItems.length
  );

  // Copy inheritance
  const parents = repos.inheritance.findParents(sourcePlatform, sourceSlug);
  if (parents.length > 0) {
    repos.inheritance.setParents(
      sourcePlatform,
      input.slug,
      parents.map((p) => ({ platform: p.parentPlatform, slug: p.parentSlug }))
    );
  }

  return success(forked);
}

/**
 * Check if a user can read a list (based on visibility and ownership)
 */
export function canReadList(list: MoronList, userId: string | undefined): boolean {
  if (list.visibility === "public" || list.visibility === "unlisted") {
    return true;
  }
  // Private lists: only owner can read
  return userId !== undefined && list.ownerId === userId;
}

/**
 * Check if a user can write to a list (add/remove entries)
 */
export function canWriteList(list: MoronList, userId: string): boolean {
  return list.ownerId === userId;
}

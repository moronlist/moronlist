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

  // Copy all entries from source
  const entries = repos.moronEntry.findAllByList(sourcePlatform, sourceSlug);
  if (entries.length > 0) {
    repos.moronEntry.createBatch(
      entries.map((e) => ({
        listPlatform: sourcePlatform,
        listSlug: input.slug,
        platformUserId: e.platformUserId,
        displayName: e.displayName ?? undefined,
        reason: e.reason ?? undefined,
        addedById: input.userId,
      }))
    );
  }

  // Copy all saints from source
  const saints = repos.saintEntry.findAllByList(sourcePlatform, sourceSlug);
  if (saints.length > 0) {
    repos.saintEntry.createBatch(
      saints.map((s) => ({
        listPlatform: sourcePlatform,
        listSlug: input.slug,
        platformUserId: s.platformUserId,
        reason: s.reason ?? undefined,
        addedById: input.userId,
      }))
    );
  }

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

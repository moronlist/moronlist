/**
 * Inheritance domain logic
 * DAG resolution, cycle detection, parent validation
 */

import type { Repositories } from "../repositories/interfaces/index.js";
import type { Result } from "../types.js";
import { success, failure, ErrorCode } from "../types.js";

const MAX_PARENTS = 50;
const MAX_DEPTH = 20;

export type ParentRef = {
  platform: string;
  slug: string;
};

export type AncestorNode = {
  platform: string;
  slug: string;
  name: string;
  depth: number;
  parents: { platform: string; slug: string }[];
};

/**
 * Parse a "platform/slug" string into parts
 */
export function parseListId(id: string): ParentRef | null {
  const slashIndex = id.indexOf("/");
  if (slashIndex === -1) {
    return null;
  }
  const platform = id.substring(0, slashIndex);
  const slug = id.substring(slashIndex + 1);
  if (platform === "" || slug === "") {
    return null;
  }
  return { platform, slug };
}

/**
 * Validate and set parents for a list.
 * Checks:
 * - All parents exist and are public
 * - No self-reference
 * - No cycles
 * - Not exceeding max parents
 */
export function setParents(
  repos: Repositories,
  platform: string,
  slug: string,
  userId: string,
  parentIds: string[]
): Result<{ platform: string; slug: string }[]> {
  const list = repos.moronList.findByPlatformAndSlug(platform, slug);
  if (list === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "List not found" });
  }

  if (list.ownerId !== userId) {
    return failure({ code: ErrorCode.FORBIDDEN, message: "Only the list owner can set parents" });
  }

  if (parentIds.length > MAX_PARENTS) {
    return failure({
      code: ErrorCode.MAX_PARENTS_EXCEEDED,
      message: `Maximum ${String(MAX_PARENTS)} parents allowed`,
    });
  }

  // Parse parent references
  const parents: ParentRef[] = [];
  for (const id of parentIds) {
    const ref = parseListId(id);
    if (ref === null) {
      return failure({
        code: ErrorCode.INVALID_INPUT,
        message: `Invalid parent reference: ${id}`,
      });
    }

    // No self-reference
    if (ref.platform === platform && ref.slug === slug) {
      return failure({
        code: ErrorCode.CANNOT_INHERIT_OWN_LIST,
        message: "A list cannot inherit from itself",
      });
    }

    parents.push(ref);
  }

  // Validate all parents exist, are public, and are on the same platform
  for (const ref of parents) {
    // Cross-platform inheritance is not allowed
    if (ref.platform !== platform) {
      return failure({
        code: ErrorCode.INVALID_INPUT,
        message: `Cannot inherit across platforms: ${ref.platform}/${ref.slug} is not on platform ${platform}`,
      });
    }

    const parentList = repos.moronList.findByPlatformAndSlug(ref.platform, ref.slug);
    if (parentList === null) {
      return failure({
        code: ErrorCode.NOT_FOUND,
        message: `Parent list ${ref.platform}/${ref.slug} not found`,
      });
    }
    if (parentList.visibility !== "public") {
      return failure({
        code: ErrorCode.LIST_NOT_PUBLIC,
        message: `Parent list ${ref.platform}/${ref.slug} is not public`,
      });
    }
  }

  // Check for cycles: would any parent eventually lead back to this list?
  for (const ref of parents) {
    if (wouldCreateCycle(repos, ref.platform, ref.slug, platform, slug, 0)) {
      return failure({
        code: ErrorCode.CYCLE_DETECTED,
        message: `Adding ${ref.platform}/${ref.slug} as parent would create a cycle`,
      });
    }
  }

  // All checks passed -- set parents
  repos.inheritance.setParents(platform, slug, parents);

  return success(parents);
}

/**
 * Check if making parentPlatform/parentSlug a parent of childPlatform/childSlug
 * would create a cycle. We do this by checking if childPlatform/childSlug is an
 * ancestor of parentPlatform/parentSlug.
 */
function wouldCreateCycle(
  repos: Repositories,
  parentPlatform: string,
  parentSlug: string,
  targetPlatform: string,
  targetSlug: string,
  depth: number
): boolean {
  if (depth > MAX_DEPTH) {
    return false; // Bail out to prevent stack overflow
  }

  // Get the parents of the proposed parent
  const grandparents = repos.inheritance.findParents(parentPlatform, parentSlug);

  for (const gp of grandparents) {
    // If any grandparent is the target, we have a cycle
    if (gp.parentPlatform === targetPlatform && gp.parentSlug === targetSlug) {
      return true;
    }
    // Recurse into grandparent
    if (
      wouldCreateCycle(
        repos,
        gp.parentPlatform,
        gp.parentSlug,
        targetPlatform,
        targetSlug,
        depth + 1
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve full ancestor tree (BFS) for a list.
 * Returns all ancestors with their depth and parent references.
 */
export function resolveAncestorTree(
  repos: Repositories,
  platform: string,
  slug: string
): Result<AncestorNode[]> {
  const list = repos.moronList.findByPlatformAndSlug(platform, slug);
  if (list === null) {
    return failure({ code: ErrorCode.NOT_FOUND, message: "List not found" });
  }

  const visited = new Set<string>();
  const result: AncestorNode[] = [];
  const queue: { platform: string; slug: string; depth: number }[] = [];

  // Start with direct parents
  const directParents = repos.inheritance.findParents(platform, slug);
  for (const p of directParents) {
    const key = `${p.parentPlatform}/${p.parentSlug}`;
    if (!visited.has(key)) {
      visited.add(key);
      queue.push({ platform: p.parentPlatform, slug: p.parentSlug, depth: 1 });
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    if (current.depth > MAX_DEPTH) continue;

    const parentList = repos.moronList.findByPlatformAndSlug(current.platform, current.slug);
    if (parentList === null) continue;

    const parentLinks = repos.inheritance.findParents(current.platform, current.slug);
    const parentRefs = parentLinks.map((l) => ({
      platform: l.parentPlatform,
      slug: l.parentSlug,
    }));

    result.push({
      platform: current.platform,
      slug: current.slug,
      name: parentList.name,
      depth: current.depth,
      parents: parentRefs,
    });

    // Enqueue grandparents
    for (const pr of parentRefs) {
      const key = `${pr.platform}/${pr.slug}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ platform: pr.platform, slug: pr.slug, depth: current.depth + 1 });
      }
    }
  }

  return success(result);
}

/**
 * Get all ancestor list references (platform/slug pairs) for a list,
 * used for sync resolution. Returns flat set of all unique ancestors.
 */
export function getAllAncestorRefs(
  repos: Repositories,
  platform: string,
  slug: string
): { platform: string; slug: string }[] {
  const visited = new Set<string>();
  const ancestors: { platform: string; slug: string }[] = [];
  const queue: { platform: string; slug: string }[] = [{ platform, slug }];
  const startKey = `${platform}/${slug}`;
  visited.add(startKey);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const parentLinks = repos.inheritance.findParents(current.platform, current.slug);
    for (const link of parentLinks) {
      const key = `${link.parentPlatform}/${link.parentSlug}`;
      if (!visited.has(key)) {
        visited.add(key);
        ancestors.push({ platform: link.parentPlatform, slug: link.parentSlug });
        queue.push({ platform: link.parentPlatform, slug: link.parentSlug });
      }
    }
  }

  return ancestors;
}

/**
 * Sync domain logic
 * Delta computation, snapshot generation for browser plugin sync
 */

import type { Repositories } from "../repositories/interfaces/index.js";
import { getAllAncestorRefs } from "./inheritance.js";

// Short-key change format for plugin sync
export type DeltaChange = {
  a: "add" | "rm" | "saint" | "unsaint";
  u: string; // platform username
};

export type ListDelta = {
  version: number;
  changes: DeltaChange[];
};

export type ListSnapshot = {
  version: number;
  morons: string[];
  saints: string[];
};

export type SyncResponse = {
  deltas: Record<string, ListDelta | ListSnapshot>;
  inherited: Record<string, { morons: string[]; saints: string[] }>;
  removed: string[];
};

// Maximum number of changelog entries before switching to snapshot
const MAX_DELTA_SIZE = 500;

/**
 * Compute sync response for a set of subscribed lists with their current versions.
 * When version=0 or the delta is too large, sends a full snapshot instead.
 */
export function computeSync(
  repos: Repositories,
  userId: string,
  lists: Record<string, number>
): SyncResponse {
  const deltas: Record<string, ListDelta | ListSnapshot> = {};
  const inherited: Record<string, { morons: string[]; saints: string[] }> = {};
  const removed: string[] = [];

  // Track all inherited lists we need to include
  const inheritedListKeys = new Set<string>();

  for (const [listId, clientVersion] of Object.entries(lists)) {
    const slashIndex = listId.indexOf("/");
    if (slashIndex === -1) continue;

    const platform = listId.substring(0, slashIndex);
    const slug = listId.substring(slashIndex + 1);

    const list = repos.moronList.findByPlatformAndSlug(platform, slug);
    if (list === null) {
      // List was deleted or no longer accessible
      removed.push(listId);
      continue;
    }

    // Check if the list is accessible
    if (list.visibility === "private" && list.ownerId !== userId) {
      removed.push(listId);
      continue;
    }

    const serverVersion = list.version;

    // Client is already up to date (but version 0 means first sync, always send snapshot)
    if (clientVersion === serverVersion && clientVersion !== 0) {
      continue;
    }

    // Full snapshot if client has version 0 (first sync)
    if (clientVersion === 0) {
      deltas[listId] = buildSnapshot(repos, platform, slug, serverVersion);
    } else {
      // Try delta
      const changelog = repos.changelog.findByList(
        platform,
        slug,
        clientVersion,
        MAX_DELTA_SIZE + 1
      );

      if (changelog.length > MAX_DELTA_SIZE) {
        // Too many changes, send snapshot
        deltas[listId] = buildSnapshot(repos, platform, slug, serverVersion);
      } else {
        // Build delta
        const changes: DeltaChange[] = changelog.map((entry) => ({
          a: mapChangelogAction(entry.action),
          u: entry.platformUserId,
        }));

        deltas[listId] = {
          version: serverVersion,
          changes,
        };
      }
    }

    // Gather inherited lists
    const ancestors = getAllAncestorRefs(repos, platform, slug);
    for (const ancestor of ancestors) {
      const key = `${ancestor.platform}/${ancestor.slug}`;
      inheritedListKeys.add(key);
    }
  }

  // Build inherited list data
  for (const key of inheritedListKeys) {
    const slashIndex = key.indexOf("/");
    if (slashIndex === -1) continue;
    const platform = key.substring(0, slashIndex);
    const slug = key.substring(slashIndex + 1);

    const parentList = repos.moronList.findByPlatformAndSlug(platform, slug);
    if (parentList?.visibility !== "public") continue;

    const moronEntries = repos.moronEntry.findAllByList(platform, slug);
    const saintEntries = repos.saintEntry.findAllByList(platform, slug);

    inherited[key] = {
      morons: moronEntries.map((e) => e.platformUserId),
      saints: saintEntries.map((e) => e.platformUserId),
    };
  }

  return { deltas, inherited, removed };
}

function buildSnapshot(
  repos: Repositories,
  platform: string,
  slug: string,
  version: number
): ListSnapshot {
  const moronEntries = repos.moronEntry.findAllByList(platform, slug);
  const saintEntries = repos.saintEntry.findAllByList(platform, slug);

  return {
    version,
    morons: moronEntries.map((e) => e.platformUserId),
    saints: saintEntries.map((e) => e.platformUserId),
  };
}

function mapChangelogAction(action: string): "add" | "rm" | "saint" | "unsaint" {
  switch (action) {
    case "ADD":
      return "add";
    case "REMOVE":
      return "rm";
    case "ADD_SAINT":
      return "saint";
    case "REMOVE_SAINT":
      return "unsaint";
    default:
      return "add";
  }
}

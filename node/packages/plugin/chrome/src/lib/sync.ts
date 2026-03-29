/**
 * Sync engine — downloads txt files from CDN incrementally.
 *
 * Immutable files (1 to N-1) are cached locally. Only the tail file
 * is re-downloaded on each sync since it may have grown.
 *
 * Follows parent chains from meta.json — if list A inherits from B
 * which inherits from C, all three lists' data is downloaded and replayed.
 */

import { fetchMySubscriptions, fetchMyLists, fetchMeta, fetchTxtFile } from "./api-client.js";
import type { ParentNode } from "./api-client.js";
import {
  getSyncState,
  setSyncState,
  setLastSyncTime,
  setMyLists,
  type OwnedList,
} from "./storage.js";
import { replaceBlocked, replaceSainted } from "./blocked-db.js";

const SYNC_ALARM_NAME = "moronlist-sync";
const SYNC_INTERVAL_MINUTES = 20;

type SyncResult = {
  success: boolean;
  error?: string;
  listsUpdated?: number;
};

// In-memory cache: listKey → { fileIndex → parsedLines }
const fileCache: Record<string, Record<number, string[]>> = {};

function replayLines(lines: string[]): { blocked: Set<string>; sainted: Set<string> } {
  const blocked = new Set<string>();
  const sainted = new Set<string>();

  for (const line of lines) {
    if (line.length < 2) continue;
    const op = line[0];
    const rest = line.slice(1);
    const spaceIdx = rest.indexOf(" ");
    const username = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
    if (username.length === 0) continue;

    switch (op) {
      case "+":
        blocked.add(username);
        break;
      case "-":
        blocked.delete(username);
        break;
      case "*":
        sainted.add(username);
        break;
      case "~":
        sainted.delete(username);
        break;
    }
  }

  return { blocked, sainted };
}

/**
 * Extract all ancestor list keys from a meta.json parent tree.
 */
function collectAncestors(parents: ParentNode[] | undefined): string[] {
  if (parents === undefined) return [];
  const result: string[] = [];
  for (const p of parents) {
    result.push(`${p.platform}/${p.slug}`);
    if (p.parents !== undefined) {
      result.push(...collectAncestors(p.parents));
    }
  }
  return result;
}

/**
 * Download txt files for a single list, using cache for immutable files.
 * Returns the lines collected, and updates fileCache + syncState.
 */
async function syncList(
  platform: string,
  slug: string,
  syncState: Record<string, { version: number; fileCount: number }>,
  newSyncState: Record<string, { version: number; fileCount: number }>
): Promise<{ lines: string[]; updated: boolean }> {
  const listKey = `${platform}/${slug}`;

  const metaResult = await fetchMeta(platform, slug);
  if (!metaResult.success) {
    // Keep old state, use cached lines
    const existing = syncState[listKey];
    if (existing !== undefined) {
      newSyncState[listKey] = existing;
    }
    return { lines: getCachedLines(listKey), updated: false };
  }

  const meta = metaResult.data;
  const localState = syncState[listKey];
  const cached = fileCache[listKey] ?? {};

  const needsUpdate =
    localState === undefined ||
    localState.version !== meta.version ||
    localState.fileCount !== meta.files;

  if (needsUpdate) {
    const newCache: Record<number, string[]> = {};

    for (let i = 1; i <= meta.files; i++) {
      const isImmutable = i < meta.files;
      const hasCached = cached[i] !== undefined;

      if (isImmutable && hasCached) {
        newCache[i] = cached[i];
      } else {
        const txtResult = await fetchTxtFile(platform, slug, i);
        if (txtResult.success) {
          newCache[i] = txtResult.data.split("\n").filter((l) => l.length > 0);
        } else if (hasCached) {
          newCache[i] = cached[i];
        }
      }
    }

    fileCache[listKey] = newCache;
  }

  newSyncState[listKey] = {
    version: meta.version,
    fileCount: meta.files,
  };

  return { lines: getCachedLines(listKey), updated: needsUpdate };
}

function getCachedLines(listKey: string): string[] {
  const cached = fileCache[listKey];
  if (cached === undefined) return [];
  const lines: string[] = [];
  // Sort by file index to maintain order
  const indices = Object.keys(cached)
    .map(Number)
    .sort((a, b) => a - b);
  for (const i of indices) {
    const fileLines = cached[i];
    if (fileLines !== undefined) {
      lines.push(...fileLines);
    }
  }
  return lines;
}

export async function performSync(): Promise<SyncResult> {
  const subsResult = await fetchMySubscriptions();
  if (!subsResult.success) {
    return { success: false, error: subsResult.error };
  }

  const syncState = await getSyncState();
  const newSyncState: Record<string, { version: number; fileCount: number }> = {};
  let listsUpdated = 0;
  const allLines: string[] = [];

  // Track which lists we need to sync (subscribed + their parents)
  const listsToSync = new Set<string>();

  // First pass: get meta for subscribed lists, collect parent keys
  for (const sub of subsResult.data) {
    const listKey = `${sub.listPlatform}/${sub.listSlug}`;
    listsToSync.add(listKey);

    const metaResult = await fetchMeta(sub.listPlatform, sub.listSlug);
    if (metaResult.success) {
      // Add all ancestors from the parent tree
      const ancestors = collectAncestors(metaResult.data.parents);
      for (const a of ancestors) {
        listsToSync.add(a);
      }
    }
  }

  // Second pass: sync all lists (subscribed + parents)
  for (const listKey of listsToSync) {
    const [platform, slug] = listKey.split("/");
    if (platform === undefined || slug === undefined) continue;

    const result = await syncList(platform, slug, syncState, newSyncState);
    allLines.push(...result.lines);
    if (result.updated) {
      listsUpdated++;
    }
  }

  const { blocked, sainted } = replayLines(allLines);

  await replaceBlocked(Array.from(blocked));
  await replaceSainted(Array.from(sainted));
  await setSyncState(newSyncState);
  await setLastSyncTime(Date.now());

  return { success: true, listsUpdated };
}

export async function refreshMyLists(): Promise<void> {
  const listsResult = await fetchMyLists();
  if (!listsResult.success) return;

  const ownedLists: OwnedList[] = listsResult.data.map((list) => ({
    id: list.id,
    platform: list.platform,
    slug: list.slug,
    name: list.name,
  }));

  await setMyLists(ownedLists);
}

export async function performFullSync(): Promise<SyncResult> {
  await refreshMyLists();
  return performSync();
}

export function isSyncAlarm(name: string): boolean {
  return name === SYNC_ALARM_NAME;
}

export async function scheduleSync(): Promise<void> {
  await chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
}

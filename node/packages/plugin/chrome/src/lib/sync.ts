import { fetchMySubscriptions, fetchMyLists, fetchMeta, fetchTxtFile } from "./api-client.js";
import {
  getSyncState,
  setSyncState,
  setBlockedUsers,
  setSaintedUsers,
  setLastSyncTime,
  setMyLists,
} from "./storage.js";
import type { OwnedList } from "./storage.js";

const SYNC_ALARM_NAME = "moronlist-sync";
const SYNC_INTERVAL_MINUTES = 5;

export type SyncResult =
  | { success: true; listsUpdated: number }
  | { success: false; error: string };

// Parse txt file lines into blocked and sainted sets.
// Line format: first char is op (+/-/*/~), rest is username (optionally followed by space + reason).
// + = add to blocked
// - = remove from blocked
// * = add to sainted
// ~ = remove from sainted
export function replayTxtFiles(lines: string[]): { blocked: Set<string>; sainted: Set<string> } {
  const blocked = new Set<string>();
  const sainted = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) {
      continue;
    }

    const op = trimmed[0];
    const rest = trimmed.slice(1).trim();
    // Username is the first token (before any space/reason)
    const spaceIdx = rest.indexOf(" ");
    const username = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);

    if (username.length === 0) {
      continue;
    }

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
      default:
        // Unknown op, skip
        break;
    }
  }

  return { blocked, sainted };
}

export async function performSync(): Promise<SyncResult> {
  const subsResult = await fetchMySubscriptions();
  if (!subsResult.success) {
    return { success: false, error: subsResult.error };
  }

  const syncState = await getSyncState();
  const newSyncState: Record<string, { version: number; fileCount: number }> = {};
  let listsUpdated = 0;

  // Collect all txt file lines across all subscribed lists
  const allLines: string[] = [];

  for (const sub of subsResult.data) {
    const listKey = `${sub.platform}/${sub.slug}`;

    // Fetch meta.json from CDN
    const metaResult = await fetchMeta(sub.platform, sub.slug);
    if (!metaResult.success) {
      // Keep old sync state for this list if meta fetch fails
      const existing = syncState[listKey];
      if (existing !== undefined) {
        newSyncState[listKey] = existing;
      }
      continue;
    }

    const meta = metaResult.data;
    const localState = syncState[listKey];

    // Check if we need to download files
    const needsUpdate =
      localState === undefined ||
      localState.version !== meta.version ||
      localState.fileCount !== meta.fileCount;

    if (needsUpdate) {
      listsUpdated++;
    }

    // Download all txt files (we always need them all to replay)
    for (let i = 0; i < meta.fileCount; i++) {
      const txtResult = await fetchTxtFile(sub.platform, sub.slug, i);
      if (txtResult.success) {
        allLines.push(...txtResult.data.split("\n"));
      }
    }

    newSyncState[listKey] = {
      version: meta.version,
      fileCount: meta.fileCount,
    };
  }

  // Replay all lines to build the effective blocked/sainted sets
  const { blocked, sainted } = replayTxtFiles(allLines);

  await setBlockedUsers(Array.from(blocked));
  await setSaintedUsers(Array.from(sainted));
  await setSyncState(newSyncState);
  await setLastSyncTime(Date.now());

  return { success: true, listsUpdated };
}

export async function refreshMyLists(): Promise<void> {
  const listsResult = await fetchMyLists();
  if (!listsResult.success) {
    return;
  }

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

export async function scheduleSync(): Promise<void> {
  await chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
    delayInMinutes: 0.1,
  });
}

export async function cancelSync(): Promise<void> {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
}

export function isSyncAlarm(alarmName: string): boolean {
  return alarmName === SYNC_ALARM_NAME;
}

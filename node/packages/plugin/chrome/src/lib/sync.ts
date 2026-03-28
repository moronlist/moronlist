import { sync, fetchMySubscriptions, fetchMe } from "./api-client.js";
import type { SyncDelta } from "./api-client.js";
import {
  getSyncState,
  setSyncState,
  getBlockedUsers,
  setBlockedUsers,
  getSaintedUsers,
  setSaintedUsers,
  setLastSyncTime,
  setMyLists,
} from "./storage.js";
import type { BlockedUsers, SaintedUsers, OwnedList } from "./storage.js";

const SYNC_ALARM_NAME = "moronlist-sync";
const SYNC_INTERVAL_MINUTES = 5;

export type SyncResult =
  | { success: true; deltasApplied: number }
  | { success: false; error: string };

function applyDelta(
  blocked: BlockedUsers,
  sainted: SaintedUsers,
  delta: SyncDelta
): { blocked: BlockedUsers; sainted: SaintedUsers } {
  const listKey = `${delta.platform}/${delta.slug}`;

  const currentBlocked = new Set(blocked[listKey] ?? []);
  const currentSainted = new Set(sainted[listKey] ?? []);

  if (delta.snapshot) {
    currentBlocked.clear();
    currentSainted.clear();
  }

  for (const entry of delta.entries.added) {
    currentBlocked.add(entry.platformUserId);
  }
  for (const userId of delta.entries.removed) {
    currentBlocked.delete(userId);
  }

  for (const saint of delta.saints.added) {
    currentSainted.add(saint.platformUserId);
  }
  for (const userId of delta.saints.removed) {
    currentSainted.delete(userId);
  }

  return {
    blocked: { ...blocked, [listKey]: Array.from(currentBlocked) },
    sainted: { ...sainted, [listKey]: Array.from(currentSainted) },
  };
}

export async function performSync(): Promise<SyncResult> {
  const syncState = await getSyncState();

  const syncResult = await sync(syncState.lists);
  if (!syncResult.success) {
    return { success: false, error: syncResult.error };
  }

  let blocked = await getBlockedUsers();
  let sainted = await getSaintedUsers();
  const newListVersions = { ...syncState.lists };
  const newListsToTrack: Record<string, number> = {};

  for (const delta of syncResult.data.deltas) {
    const applied = applyDelta(blocked, sainted, delta);
    blocked = applied.blocked;
    sainted = applied.sainted;
    newListVersions[delta.listId] = delta.version;

    for (const inherited of delta.inherits) {
      const inheritKey = `${inherited.platform}/${inherited.slug}`;
      const alreadyTracked = Object.entries(newListVersions).some(([, _version]) => {
        return (
          Object.keys(blocked).includes(inheritKey) || Object.keys(sainted).includes(inheritKey)
        );
      });
      if (!alreadyTracked) {
        newListsToTrack[inheritKey] = 0;
      }
    }
  }

  await setBlockedUsers(blocked);
  await setSaintedUsers(sainted);
  await setSyncState({ lists: { ...newListVersions, ...newListsToTrack } });
  await setLastSyncTime(Date.now());

  return { success: true, deltasApplied: syncResult.data.deltas.length };
}

export async function refreshSubscriptions(): Promise<void> {
  const subsResult = await fetchMySubscriptions();
  if (!subsResult.success) {
    return;
  }

  const syncState = await getSyncState();
  const updatedLists = { ...syncState.lists };

  for (const sub of subsResult.data) {
    if (updatedLists[sub.moronListId] === undefined) {
      updatedLists[sub.moronListId] = 0;
    }
  }

  const subscribedIds = new Set(subsResult.data.map((s) => s.moronListId));
  for (const listId of Object.keys(updatedLists)) {
    if (!subscribedIds.has(listId)) {
      delete updatedLists[listId];
    }
  }

  await setSyncState({ lists: updatedLists });
}

export async function refreshMyLists(): Promise<void> {
  const meResult = await fetchMe();
  if (!meResult.success) {
    return;
  }

  const subsResult = await fetchMySubscriptions();
  if (!subsResult.success) {
    return;
  }

  const ownedLists: OwnedList[] = subsResult.data.map((sub) => ({
    id: sub.moronListId,
    platform: sub.platform,
    slug: sub.slug,
    name: sub.name,
  }));

  await setMyLists(ownedLists);
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

export async function performFullSync(): Promise<SyncResult> {
  await refreshSubscriptions();
  await refreshMyLists();
  return performSync();
}

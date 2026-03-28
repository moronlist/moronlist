const DEFAULT_API_URL = "http://localhost:6000";

export type SyncState = {
  lists: Record<string, number>;
};

export type BlockedUsers = Record<string, string[]>;

export type SaintedUsers = Record<string, string[]>;

export type OwnedList = {
  id: string;
  platform: string;
  slug: string;
  name: string;
};

type StorageSchema = {
  apiUrl: string;
  authToken: string | null;
  syncState: SyncState;
  blockedUsers: BlockedUsers;
  saintedUsers: SaintedUsers;
  lastSyncTime: number | null;
  myLists: OwnedList[];
  lastSelectedListIds: string[];
  pendingUsername: string | null;
};

async function getItem<K extends keyof StorageSchema>(
  key: K,
  defaultValue: StorageSchema[K]
): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  const value = result[key] as StorageSchema[K] | undefined;
  if (value === undefined) {
    return defaultValue;
  }
  return value;
}

async function setItem<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getApiUrl(): Promise<string> {
  return getItem("apiUrl", DEFAULT_API_URL);
}

export async function setApiUrl(url: string): Promise<void> {
  return setItem("apiUrl", url);
}

export async function getAuthToken(): Promise<string | null> {
  return getItem("authToken", null);
}

export async function setAuthToken(token: string | null): Promise<void> {
  return setItem("authToken", token);
}

export async function getSyncState(): Promise<SyncState> {
  return getItem("syncState", { lists: {} });
}

export async function setSyncState(state: SyncState): Promise<void> {
  return setItem("syncState", state);
}

export async function getBlockedUsers(): Promise<BlockedUsers> {
  return getItem("blockedUsers", {});
}

export async function setBlockedUsers(users: BlockedUsers): Promise<void> {
  return setItem("blockedUsers", users);
}

export async function getSaintedUsers(): Promise<SaintedUsers> {
  return getItem("saintedUsers", {});
}

export async function setSaintedUsers(users: SaintedUsers): Promise<void> {
  return setItem("saintedUsers", users);
}

export async function getLastSyncTime(): Promise<number | null> {
  return getItem("lastSyncTime", null);
}

export async function setLastSyncTime(time: number | null): Promise<void> {
  return setItem("lastSyncTime", time);
}

export async function getMyLists(): Promise<OwnedList[]> {
  return getItem("myLists", []);
}

export async function setMyLists(lists: OwnedList[]): Promise<void> {
  return setItem("myLists", lists);
}

export async function getLastSelectedListIds(): Promise<string[]> {
  return getItem("lastSelectedListIds", []);
}

export async function setLastSelectedListIds(ids: string[]): Promise<void> {
  return setItem("lastSelectedListIds", ids);
}

export async function getPendingUsername(): Promise<string | null> {
  return getItem("pendingUsername", null);
}

export async function setPendingUsername(username: string | null): Promise<void> {
  return setItem("pendingUsername", username);
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear();
}

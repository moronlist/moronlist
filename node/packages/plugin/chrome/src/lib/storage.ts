const DEFAULT_API_URL = import.meta.env.VITE_API_URL as string;
const DEFAULT_DATA_URL = import.meta.env.VITE_DATA_URL as string;

export type OwnedList = {
  id: string;
  platform: string;
  slug: string;
  name: string;
};

type StorageSchema = {
  apiUrl: string;
  dataUrl: string;
  authToken: string | null;
  user: { id: string; name: string; email: string } | null;
  // Per-list sync state: version and file count
  syncState: Record<string, { version: number; fileCount: number }>;
  // Computed blocked/sainted sets (serialized as string[])
  blockedUsers: string[];
  saintedUsers: string[];
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

export async function getDataUrl(): Promise<string> {
  return getItem("dataUrl", DEFAULT_DATA_URL);
}

export async function setDataUrl(url: string): Promise<void> {
  return setItem("dataUrl", url);
}

export async function getAuthToken(): Promise<string | null> {
  return getItem("authToken", null);
}

export async function setAuthToken(token: string | null): Promise<void> {
  return setItem("authToken", token);
}

export async function getUser(): Promise<StorageSchema["user"]> {
  return getItem("user", null);
}

export async function setUser(user: StorageSchema["user"]): Promise<void> {
  return setItem("user", user);
}

export async function getSyncState(): Promise<StorageSchema["syncState"]> {
  return getItem("syncState", {});
}

export async function setSyncState(state: StorageSchema["syncState"]): Promise<void> {
  return setItem("syncState", state);
}

export async function getBlockedUsers(): Promise<string[]> {
  return getItem("blockedUsers", []);
}

export async function setBlockedUsers(users: string[]): Promise<void> {
  return setItem("blockedUsers", users);
}

export async function getSaintedUsers(): Promise<string[]> {
  return getItem("saintedUsers", []);
}

export async function setSaintedUsers(users: string[]): Promise<void> {
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

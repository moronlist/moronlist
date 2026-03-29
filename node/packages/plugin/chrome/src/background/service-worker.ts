import { scheduleSync, isSyncAlarm, performFullSync, performSync } from "../lib/sync.js";
import {
  getLastSyncTime,
  getMyLists,
  getAuthToken,
  setAuthToken,
  setUser,
  getUser,
  getApiUrl,
  setPendingUsername,
} from "../lib/storage.js";
import {
  checkUser as dbCheckUser,
  addBlocked,
  removeBlocked,
  addSainted,
  removeSainted,
  getBlockedCount,
  getSaintedCount,
} from "../lib/blocked-db.js";
import {
  addEntries,
  addSaints,
  removeEntries,
  removeSaints,
  fetchMe,
  fetchMyLists,
  fetchMySubscriptions,
  createList,
} from "../lib/api-client.js";

export type MessageType =
  | { type: "LOGIN" }
  | { type: "LOGOUT" }
  | { type: "SYNC_NOW" }
  | { type: "ADD_ENTRY"; platform: string; slug: string; platformUserId: string; reason?: string }
  | { type: "ADD_SAINT"; platform: string; slug: string; platformUserId: string; reason?: string }
  | { type: "REMOVE_ENTRY"; platform: string; slug: string; platformUserId: string }
  | { type: "REMOVE_SAINT"; platform: string; slug: string; platformUserId: string }
  | { type: "CHECK_USER"; platformUserId: string }
  | { type: "GET_STATUS" }
  | { type: "GET_BLOCKED_SET" }
  | { type: "GET_MY_LISTS" }
  | { type: "GET_MY_SUBSCRIPTIONS" }
  | { type: "CREATE_LIST"; platform: string; slug: string; name: string; description?: string }
  | { type: "GET_LIST_ENTRIES"; platform: string; slug: string }
  | { type: "OPEN_QUICK_ADD"; platformUserId: string }
  | { type: "BLOCK_LIST_UPDATED" };

export type StatusResponse = {
  lastSyncTime: number | null;
  blockedCount: number;
  saintedCount: number;
  listCount: number;
  signedIn: boolean;
};

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleSync();

  chrome.contextMenus.create({
    id: "moronlist-add",
    title: "Add to MoronList",
    contexts: ["page", "link"],
    documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
  });

  const token = await getAuthToken();
  if (token !== null) {
    const meResult = await fetchMe();
    if (meResult.success) {
      await setUser({ id: meResult.data.id, name: meResult.data.name, email: meResult.data.email });
      await performFullSync();
    }
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (isSyncAlarm(alarm.name)) {
    const token = await getAuthToken();
    if (token !== null) {
      await performSync();
      notifyContentScriptsOfUpdate();
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "moronlist-add") {
    return;
  }

  const url = info.linkUrl ?? info.pageUrl;
  if (url === undefined) {
    return;
  }

  const username = extractUsernameFromUrl(url);
  if (username === null) {
    return;
  }

  // Set pending username and open popup
  await setPendingUsername(username);
  if (tab?.id !== undefined) {
    await chrome.action.openPopup();
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: MessageType,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    handleMessage(message).then(sendResponse);
    return true;
  }
);

async function handleLogin(): Promise<{ success: boolean; error?: string }> {
  const apiUrl = await getApiUrl();
  const loginUrl = `${apiUrl}/auth/login`;

  // Open a tab for login
  const tab = await chrome.tabs.create({ url: loginUrl });
  const tabId = tab.id;
  if (tabId === undefined) {
    return { success: false, error: "Failed to open login tab" };
  }

  // Return a promise that resolves when we detect the token in the URL
  return new Promise((resolve) => {
    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      updatedTab: chrome.tabs.Tab
    ): void => {
      if (updatedTabId !== tabId) {
        return;
      }
      if (changeInfo.url === undefined && updatedTab.url === undefined) {
        return;
      }

      const currentUrl = changeInfo.url ?? updatedTab.url ?? "";

      // Look for token in URL fragment (#token=...)
      const hashIndex = currentUrl.indexOf("#token=");
      if (hashIndex === -1) {
        return;
      }

      const token = currentUrl.slice(hashIndex + 7).split("&")[0];
      if (token === undefined || token.length === 0) {
        return;
      }

      // Found token - clean up listener and close tab
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.remove(tabId).catch(() => {
        // Tab may already be closed
      });

      // Store token and fetch user info
      setAuthToken(token)
        .then(() => fetchMe())
        .then(async (meResult) => {
          if (meResult.success && meResult.data.user !== null) {
            await setUser({
              id: meResult.data.user.id,
              name: meResult.data.user.name,
              email: meResult.data.user.email,
            });
            await performFullSync();
            notifyContentScriptsOfUpdate();
            notifyContentScripts("AUTH_CHANGED");
            resolve({ success: true });
          } else {
            // User exists but needs onboarding, or auth failed
            notifyContentScripts("AUTH_CHANGED");
            resolve({ success: true });
          }
        })
        .catch((err) => {
          resolve({
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        });
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Also handle tab being closed manually
    const removedListener = (removedTabId: number): void => {
      if (removedTabId === tabId) {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.onRemoved.removeListener(removedListener);
        resolve({ success: false, error: "Login tab was closed" });
      }
    };
    chrome.tabs.onRemoved.addListener(removedListener);
  });
}

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case "LOGIN": {
      return handleLogin();
    }

    case "LOGOUT": {
      await setAuthToken(null);
      await setUser(null);
      notifyContentScripts("AUTH_CHANGED");
      return { success: true };
    }

    case "SYNC_NOW": {
      const result = await performFullSync();
      notifyContentScriptsOfUpdate();
      return result;
    }

    case "ADD_ENTRY": {
      // Optimistic: add to IndexedDB immediately
      await addBlocked([message.platformUserId]);
      notifyContentScriptsOfUpdate();
      // Then send to server
      const result = await addEntries(message.platform, message.slug, [
        { platformUserId: message.platformUserId, reason: message.reason },
      ]);
      return result;
    }

    case "ADD_SAINT": {
      await addSainted([message.platformUserId]);
      notifyContentScriptsOfUpdate();
      const saintResult = await addSaints(message.platform, message.slug, [
        { platformUserId: message.platformUserId, reason: message.reason },
      ]);
      return saintResult;
    }

    case "REMOVE_ENTRY": {
      await removeBlocked([message.platformUserId]);
      notifyContentScriptsOfUpdate();
      const rmResult = await removeEntries(message.platform, message.slug, [
        { platformUserId: message.platformUserId },
      ]);
      return rmResult;
    }

    case "REMOVE_SAINT": {
      await removeSainted([message.platformUserId]);
      notifyContentScriptsOfUpdate();
      const srmResult = await removeSaints(message.platform, message.slug, [
        { platformUserId: message.platformUserId },
      ]);
      return srmResult;
    }

    case "GET_STATUS": {
      const blockedCount = await getBlockedCount();
      const saintedCount = await getSaintedCount();
      const lastSyncTime = await getLastSyncTime();
      const myLists = await getMyLists();
      const user = await getUser();
      return {
        lastSyncTime,
        blockedCount,
        saintedCount,
        listCount: myLists.length,
        signedIn: user !== null,
      } satisfies StatusResponse;
    }

    case "CHECK_USER": {
      return dbCheckUser(message.platformUserId);
    }

    case "GET_BLOCKED_SET": {
      // Legacy — content script now uses CHECK_USER per-username
      const blockedN = await getBlockedCount();
      const saintedN = await getSaintedCount();
      return { blockedCount: blockedN, saintedCount: saintedN };
    }

    case "GET_MY_LISTS": {
      const listsResult = await fetchMyLists();
      return listsResult;
    }

    case "GET_MY_SUBSCRIPTIONS": {
      const subsResult = await fetchMySubscriptions();
      return subsResult;
    }

    case "CREATE_LIST": {
      const createResult = await createList({
        platform: message.platform,
        slug: message.slug,
        name: message.name,
        description: message.description,
      });
      return createResult;
    }

    case "GET_LIST_ENTRIES": {
      // List entries are in static txt files on the CDN
      // For now, return empty — entries will be available after first data sync
      return { success: true, data: [] };
    }

    case "OPEN_QUICK_ADD": {
      await setPendingUsername(message.platformUserId);
      await chrome.action.openPopup();
      return { success: true };
    }

    case "BLOCK_LIST_UPDATED": {
      return { ok: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}

function extractUsernameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname !== "x.com" &&
      parsed.hostname !== "twitter.com" &&
      parsed.hostname !== "www.x.com" &&
      parsed.hostname !== "www.twitter.com"
    ) {
      return null;
    }
    const pathParts = parsed.pathname.split("/").filter((p) => p.length > 0);
    if (pathParts.length === 0) {
      return null;
    }
    const username = pathParts[0];
    if (username === undefined) {
      return null;
    }
    const reservedPaths = [
      "home",
      "explore",
      "notifications",
      "messages",
      "settings",
      "search",
      "compose",
      "i",
      "hashtag",
    ];
    if (reservedPaths.includes(username)) {
      return null;
    }
    return username;
  } catch {
    return null;
  }
}

function notifyContentScripts(messageType: string): void {
  chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { type: messageType }).catch(() => {
          // Tab may not have content script loaded yet
        });
      }
    }
  });
}

function notifyContentScriptsOfUpdate(): void {
  notifyContentScripts("BLOCK_LIST_UPDATED");
}

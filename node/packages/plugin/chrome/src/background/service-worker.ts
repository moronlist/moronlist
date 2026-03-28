import { scheduleSync, isSyncAlarm, performFullSync, performSync } from "../lib/sync.js";
import {
  getBlockedUsers,
  getSaintedUsers,
  getLastSyncTime,
  getMyLists,
  setPendingUsername,
} from "../lib/storage.js";
import { addEntry, addSaint, fetchMe } from "../lib/api-client.js";

export type MessageType =
  | { type: "SYNC_NOW" }
  | { type: "ADD_ENTRY"; platform: string; slug: string; platformUserId: string; reason?: string }
  | { type: "ADD_SAINT"; platform: string; slug: string; platformUserId: string; reason?: string }
  | { type: "CHECK_USER"; platformUserId: string }
  | { type: "GET_STATUS" }
  | { type: "GET_BLOCKED_SET" }
  | { type: "BLOCK_LIST_UPDATED" }
  | { type: "OPEN_QUICK_ADD"; platformUserId: string };

export type CheckUserResponse = {
  blocked: boolean;
  sainted: boolean;
};

export type StatusResponse = {
  lastSyncTime: number | null;
  blockedCount: number;
  saintedCount: number;
  listCount: number;
};

function countUniqueUsers(users: Record<string, string[]>): number {
  const unique = new Set<string>();
  for (const list of Object.values(users)) {
    for (const userId of list) {
      unique.add(userId);
    }
  }
  return unique.size;
}

function isUserInSet(users: Record<string, string[]>, platformUserId: string): boolean {
  for (const list of Object.values(users)) {
    if (list.includes(platformUserId)) {
      return true;
    }
  }
  return false;
}

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleSync();

  chrome.contextMenus.create({
    id: "moronlist-add",
    title: "Add to MoronList",
    contexts: ["page", "link"],
    documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
  });

  const meResult = await fetchMe();
  if (meResult.success) {
    await performFullSync();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (isSyncAlarm(alarm.name)) {
    await performSync();
    notifyContentScriptsOfUpdate();
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

  if (tab?.id !== undefined) {
    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_ADD_DIALOG",
      username,
    });
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

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case "SYNC_NOW": {
      const result = await performFullSync();
      notifyContentScriptsOfUpdate();
      return result;
    }

    case "ADD_ENTRY": {
      const result = await addEntry(message.platform, message.slug, {
        platformUserId: message.platformUserId,
        reason: message.reason,
      });
      if (result.success) {
        await performSync();
        notifyContentScriptsOfUpdate();
      }
      return result;
    }

    case "ADD_SAINT": {
      const result = await addSaint(message.platform, message.slug, {
        platformUserId: message.platformUserId,
        reason: message.reason,
      });
      if (result.success) {
        await performSync();
        notifyContentScriptsOfUpdate();
      }
      return result;
    }

    case "CHECK_USER": {
      const blocked = await getBlockedUsers();
      const sainted = await getSaintedUsers();
      return {
        blocked: isUserInSet(blocked, message.platformUserId),
        sainted: isUserInSet(sainted, message.platformUserId),
      } satisfies CheckUserResponse;
    }

    case "GET_STATUS": {
      const blocked = await getBlockedUsers();
      const sainted = await getSaintedUsers();
      const lastSyncTime = await getLastSyncTime();
      const myLists = await getMyLists();
      return {
        lastSyncTime,
        blockedCount: countUniqueUsers(blocked),
        saintedCount: countUniqueUsers(sainted),
        listCount: myLists.length,
      } satisfies StatusResponse;
    }

    case "GET_BLOCKED_SET": {
      const blocked = await getBlockedUsers();
      const sainted = await getSaintedUsers();
      return { blocked, sainted };
    }

    case "BLOCK_LIST_UPDATED": {
      return { ok: true };
    }

    case "OPEN_QUICK_ADD": {
      await setPendingUsername(message.platformUserId);
      await chrome.action.openPopup();
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

function notifyContentScriptsOfUpdate(): void {
  chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { type: "BLOCK_LIST_UPDATED" }).catch(() => {
          // Tab may not have content script loaded yet
        });
      }
    }
  });
}

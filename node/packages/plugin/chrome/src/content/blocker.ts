type BlockState = {
  blockedUsers: Set<string>;
  saintedUsers: Set<string>;
  processedElements: WeakSet<Element>;
};

const state: BlockState = {
  blockedUsers: new Set(),
  saintedUsers: new Set(),
  processedElements: new WeakSet(),
};

const MORONLIST_ATTR = "data-moronlist-processed";
const MORONLIST_BLOCKED_ATTR = "data-moronlist-blocked";
const MORONLIST_BTN_ATTR = "data-moronlist-btn";

const DEBOUNCE_MS = 150;

function flattenUserSet(users: Record<string, string[]>): Set<string> {
  const flat = new Set<string>();
  for (const list of Object.values(users)) {
    for (const userId of list) {
      flat.add(userId.toLowerCase());
    }
  }
  return flat;
}

async function loadBlockedSets(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "GET_BLOCKED_SET",
    })) as {
      blocked: Record<string, string[]>;
      sainted: Record<string, string[]>;
    };
    state.blockedUsers = flattenUserSet(response.blocked);
    state.saintedUsers = flattenUserSet(response.sainted);
  } catch {
    // Extension context may be invalidated
  }
}

function isBlocked(username: string): boolean {
  const lower = username.toLowerCase();
  if (state.saintedUsers.has(lower)) {
    return false;
  }
  return state.blockedUsers.has(lower);
}

function extractUsernameFromTweet(tweetElement: Element): string | null {
  const userLink = tweetElement.querySelector('a[href^="/"][role="link"] > div > span');
  if (userLink !== null) {
    const text = userLink.textContent;
    if (text !== null && text.startsWith("@")) {
      return text.slice(1);
    }
  }

  const allLinks = tweetElement.querySelectorAll('a[href^="/"]');
  for (const link of allLinks) {
    const href = link.getAttribute("href");
    if (href === null) {
      continue;
    }
    const match = href.match(/^\/([a-zA-Z0-9_]+)(\/|$)/);
    if (match === null || match[1] === undefined) {
      continue;
    }
    const candidate = match[1];
    const reserved = [
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
    if (reserved.includes(candidate.toLowerCase())) {
      continue;
    }
    const parentDiv = link.closest('[data-testid="User-Name"]');
    if (parentDiv !== null) {
      return candidate;
    }
  }

  const userNameDiv = tweetElement.querySelector('[data-testid="User-Name"]');
  if (userNameDiv !== null) {
    const spans = userNameDiv.querySelectorAll("span");
    for (const span of spans) {
      const text = span.textContent;
      if (text !== null && text.startsWith("@")) {
        return text.slice(1);
      }
    }
  }

  return null;
}

function extractUsernameFromProfilePage(): string | null {
  const userNameHeader = document.querySelector('[data-testid="UserName"] span');
  if (userNameHeader !== null) {
    const text = userNameHeader.textContent;
    if (text !== null && text.startsWith("@")) {
      return text.slice(1);
    }
  }

  const pathParts = window.location.pathname.split("/").filter((p) => p.length > 0);
  if (pathParts.length >= 1 && pathParts[0] !== undefined) {
    const reserved = [
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
    if (!reserved.includes(pathParts[0].toLowerCase())) {
      return pathParts[0];
    }
  }

  return null;
}

function hideTweet(tweetElement: Element): void {
  const el = tweetElement as HTMLElement;
  el.style.display = "none";
  el.setAttribute(MORONLIST_BLOCKED_ATTR, "true");
}

function showTweet(tweetElement: Element): void {
  const el = tweetElement as HTMLElement;
  el.style.display = "";
  el.removeAttribute(MORONLIST_BLOCKED_ATTR);
}

function createAddButton(username: string): HTMLElement {
  const btn = document.createElement("button");
  btn.setAttribute(MORONLIST_BTN_ATTR, "true");
  btn.textContent = "ML";
  btn.title = `Add @${username} to MoronList`;
  btn.style.cssText = [
    "display: inline-flex",
    "align-items: center",
    "justify-content: center",
    "width: 20px",
    "height: 20px",
    "border-radius: 50%",
    "background: #ef4444",
    "color: white",
    "font-size: 8px",
    "font-weight: bold",
    "border: none",
    "cursor: pointer",
    "margin-left: 4px",
    "opacity: 0",
    "transition: opacity 0.15s ease",
    "vertical-align: middle",
    "line-height: 1",
    "padding: 0",
  ].join("; ");

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "ADD_ENTRY",
      platform: "twitter",
      slug: "",
      platformUserId: username,
    });
  });

  return btn;
}

function processTweet(tweetElement: Element): void {
  if (tweetElement.hasAttribute(MORONLIST_ATTR)) {
    const prevUsername = tweetElement.getAttribute(MORONLIST_ATTR);
    if (prevUsername !== null && prevUsername.length > 0) {
      if (isBlocked(prevUsername)) {
        hideTweet(tweetElement);
      } else {
        showTweet(tweetElement);
      }
      return;
    }
  }

  const username = extractUsernameFromTweet(tweetElement);
  if (username === null) {
    return;
  }

  tweetElement.setAttribute(MORONLIST_ATTR, username);

  if (isBlocked(username)) {
    hideTweet(tweetElement);
    return;
  }

  const userNameContainer = tweetElement.querySelector('[data-testid="User-Name"]');
  if (userNameContainer !== null) {
    const existingBtn = userNameContainer.querySelector(`[${MORONLIST_BTN_ATTR}]`);
    if (existingBtn === null) {
      const btn = createAddButton(username);
      userNameContainer.appendChild(btn);

      tweetElement.addEventListener("mouseenter", () => {
        btn.style.opacity = "1";
      });
      tweetElement.addEventListener("mouseleave", () => {
        btn.style.opacity = "0";
      });
    }
  }
}

function processTweets(): void {
  const tweets = document.querySelectorAll(
    'article[data-testid="tweet"], [data-testid="cellInnerDiv"]'
  );
  for (const tweet of tweets) {
    processTweet(tweet);
  }
}

function reprocessAllTweets(): void {
  const processed = document.querySelectorAll(`[${MORONLIST_ATTR}]`);
  for (const el of processed) {
    const username = el.getAttribute(MORONLIST_ATTR);
    if (username !== null && username.length > 0) {
      if (isBlocked(username)) {
        hideTweet(el);
      } else {
        showTweet(el);
      }
    }
  }
  processTweets();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedProcessTweets(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    processTweets();
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    let hasRelevantChanges = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasRelevantChanges = true;
        break;
      }
    }
    if (hasRelevantChanges) {
      debouncedProcessTweets();
    }
  });

  const targetNode = document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
  });
}

function handleProfilePage(): void {
  const username = extractUsernameFromProfilePage();
  if (username === null) {
    return;
  }

  if (isBlocked(username)) {
    const existingBanner = document.querySelector("#moronlist-profile-banner");
    if (existingBanner === null) {
      const banner = document.createElement("div");
      banner.id = "moronlist-profile-banner";
      banner.style.cssText = [
        "position: fixed",
        "top: 0",
        "left: 0",
        "right: 0",
        "z-index: 10000",
        "background: #ef4444",
        "color: white",
        "text-align: center",
        "padding: 8px 16px",
        "font-size: 14px",
        "font-weight: 600",
        "font-family: system-ui, sans-serif",
      ].join("; ");
      banner.textContent = `@${username} is on your MoronList`;
      document.body.prepend(banner);
    }
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; username?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === "BLOCK_LIST_UPDATED") {
      loadBlockedSets().then(() => {
        reprocessAllTweets();
        handleProfilePage();
        sendResponse({ ok: true });
      });
      return true;
    }
    if (message.type === "SHOW_ADD_DIALOG") {
      sendResponse({ ok: true });
      return false;
    }
    return false;
  }
);

async function initialize(): Promise<void> {
  await loadBlockedSets();
  processTweets();
  handleProfilePage();
  setupMutationObserver();
}

initialize();

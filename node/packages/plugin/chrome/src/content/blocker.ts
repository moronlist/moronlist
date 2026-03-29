type BlockState = {
  blockedUsers: Set<string>;
  saintedUsers: Set<string>;
};

const state: BlockState = {
  blockedUsers: new Set(),
  saintedUsers: new Set(),
};

const MORONLIST_ATTR = "data-moronlist-processed";
const MORONLIST_BTN_ATTR = "data-moronlist-btn";

const DEBOUNCE_MS = 250;

async function loadBlockedSets(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "GET_BLOCKED_SET",
    })) as {
      blocked: string[];
      sainted: string[];
    };
    state.blockedUsers = new Set(response.blocked.map((u) => u.toLowerCase()));
    state.saintedUsers = new Set(response.sainted.map((u) => u.toLowerCase()));
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
  // Primary: UserAvatar-Container-{username} data-testid attribute
  // This is the most reliable selector -- X puts the username directly in the attribute
  const avatarContainers = tweetElement.querySelectorAll('[data-testid^="UserAvatar-Container-"]');
  if (avatarContainers.length > 0) {
    // First avatar is the tweet author (subsequent ones may be quoted tweets)
    const firstAvatar = avatarContainers[0];
    if (firstAvatar !== undefined) {
      const testId = firstAvatar.getAttribute("data-testid");
      if (testId !== null) {
        const username = testId.replace("UserAvatar-Container-", "");
        if (username.length > 0) {
          return username;
        }
      }
    }
  }

  // Fallback: find @handle in User-Name container
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

  // Last resort: profile link href in User-Name area
  const userNameArea = tweetElement.querySelector('[data-testid="User-Name"]');
  if (userNameArea !== null) {
    const profileLink = userNameArea.querySelector('a[href^="/"][role="link"]');
    if (profileLink !== null) {
      const href = profileLink.getAttribute("href");
      if (href !== null) {
        const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
        if (match !== null && match[1] !== undefined) {
          return match[1];
        }
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

function markBlocked(tweetElement: Element): void {
  tweetElement.setAttribute(MORONLIST_ATTR, "blocked");
}

function markProcessed(tweetElement: Element): void {
  tweetElement.setAttribute(MORONLIST_ATTR, "ok");
}

// MoronList ban icon (circle with line through it)
const ML_ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-1xvli5t r-1hdv0qi"><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"></path></g></svg>`;

function createActionBarButton(username: string): HTMLElement {
  // Create wrapper div matching X's action bar button structure
  const wrapper = document.createElement("div");
  wrapper.setAttribute(MORONLIST_BTN_ATTR, "true");
  wrapper.className = "css-175oi2r r-18u37iz r-1h0z5md r-1wron08";

  const btn = document.createElement("button");
  btn.setAttribute("aria-label", `Add @${username} to MoronList`);
  btn.setAttribute("role", "button");
  btn.setAttribute("type", "button");
  btn.className = "css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l";

  const inner = document.createElement("div");
  inner.setAttribute("dir", "ltr");
  inner.className =
    "css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q";
  inner.style.color = "rgb(113, 118, 123)";

  const iconContainer = document.createElement("div");
  iconContainer.className = "css-175oi2r r-xoduu5";

  // Hover background circle
  const hoverBg = document.createElement("div");
  hoverBg.className =
    "css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l";
  iconContainer.appendChild(hoverBg);

  // SVG icon
  const iconSpan = document.createElement("span");
  iconSpan.innerHTML = ML_ICON_SVG;
  const svg = iconSpan.firstElementChild;
  if (svg !== null) {
    iconContainer.appendChild(svg);
  }

  inner.appendChild(iconContainer);
  btn.appendChild(inner);
  wrapper.appendChild(btn);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "OPEN_QUICK_ADD",
      platformUserId: username,
    });
  });

  return wrapper;
}

function processTweet(tweetElement: Element): void {
  // Already processed -- re-evaluate block status on reprocess
  const currentAttr = tweetElement.getAttribute(MORONLIST_ATTR);
  if (currentAttr === "ok" || currentAttr === "blocked") {
    const username = tweetElement.getAttribute("data-moronlist-username");
    if (username !== null && username.length > 0) {
      if (isBlocked(username)) {
        markBlocked(tweetElement);
      } else {
        markProcessed(tweetElement);
      }
    }
    return;
  }

  const username = extractUsernameFromTweet(tweetElement);
  if (username === null) {
    // Can't determine user -- show the tweet anyway
    markProcessed(tweetElement);
    return;
  }

  tweetElement.setAttribute("data-moronlist-username", username);

  if (isBlocked(username)) {
    markBlocked(tweetElement);
    return;
  }

  markProcessed(tweetElement);

  // Add MoronList button to the action bar (reply, repost, like, etc.)
  const actionBar = tweetElement.querySelector('[role="group"]');
  if (actionBar !== null) {
    const existingBtn = actionBar.querySelector(`[${MORONLIST_BTN_ATTR}]`);
    if (existingBtn === null) {
      const btn = createActionBarButton(username);
      actionBar.appendChild(btn);
    }
  }
}

function processTweets(): void {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  for (const tweet of tweets) {
    processTweet(tweet);
  }
}

function reprocessAllTweets(): void {
  const processed = document.querySelectorAll("[data-moronlist-username]");
  for (const el of processed) {
    const username = el.getAttribute("data-moronlist-username");
    if (username !== null && username.length > 0) {
      if (isBlocked(username)) {
        markBlocked(el);
      } else {
        markProcessed(el);
      }
    }
  }
  processTweets();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let rafPending = false;

function debouncedProcessTweets(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        processTweets();
        rafPending = false;
      });
    }
  }, DEBOUNCE_MS);
}

function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    let hasRelevantChanges = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLElement &&
          (node.tagName === "ARTICLE" || node.querySelector("article") !== null)
        ) {
          hasRelevantChanges = true;
          break;
        }
      }
      if (hasRelevantChanges) break;
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
    return false;
  }
);

async function initialize(): Promise<void> {
  // Load blocked sets with a timeout — don't let a hung service worker
  // prevent tweets from showing. If it fails, all tweets show (nothing blocked).
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
  await Promise.race([loadBlockedSets(), timeout]);

  processTweets();
  handleProfilePage();
  setupMutationObserver();
}

initialize();

const MORONLIST_ATTR = "data-moronlist-processed";
const MORONLIST_BTN_ATTR = "data-moronlist-btn";

const DEBOUNCE_MS = 250;

// Per-page-session cache: username -> isBlocked
// Avoids re-querying IndexedDB for the same username on scroll
const userCache = new Map<string, boolean>();

function clearUserCache(): void {
  userCache.clear();
}

async function isBlocked(username: string): Promise<boolean> {
  const lower = username.toLowerCase();
  const cached = userCache.get(lower);
  if (cached !== undefined) return cached;

  try {
    const result = (await chrome.runtime.sendMessage({
      type: "CHECK_USER",
      platformUserId: lower,
    })) as { blocked: boolean; sainted: boolean };
    const blocked = result.blocked && !result.sainted;
    userCache.set(lower, blocked);
    return blocked;
  } catch {
    // Extension context may be invalidated
    return false;
  }
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

async function processTweet(tweetElement: Element): Promise<void> {
  // Already processed -- re-evaluate block status on reprocess
  const currentAttr = tweetElement.getAttribute(MORONLIST_ATTR);
  if (currentAttr === "ok" || currentAttr === "blocked") {
    const username = tweetElement.getAttribute("data-moronlist-username");
    if (username !== null && username.length > 0) {
      if (await isBlocked(username)) {
        markBlocked(tweetElement);
      } else {
        markProcessed(tweetElement);
      }
    }
    return;
  }

  const username = extractUsernameFromTweet(tweetElement);
  if (username === null) {
    markProcessed(tweetElement);
    return;
  }

  tweetElement.setAttribute("data-moronlist-username", username);

  if (await isBlocked(username)) {
    markBlocked(tweetElement);
    blockedOnPage.add(username.toLowerCase());
    updateSidebarBadge();
    return;
  }

  markProcessed(tweetElement);

  // Add MoronList button next to the username (in the top-right area with grok/more buttons)
  const topRightArea = tweetElement
    .querySelector('[data-testid="caret"]')
    ?.closest(".css-175oi2r.r-1awozwy.r-18u37iz.r-1cmwbt1.r-1wtj0ep");
  if (topRightArea !== null && topRightArea !== undefined) {
    const existingBtn = topRightArea.querySelector(`[${MORONLIST_BTN_ATTR}]`);
    if (existingBtn === null) {
      const btn = createActionBarButton(username);
      // Insert before the grok button (first child)
      topRightArea.insertBefore(btn, topRightArea.firstChild);
    }
  }
}

function processTweets(): void {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  for (const tweet of tweets) {
    void processTweet(tweet);
  }
}

function reprocessAllTweets(): void {
  clearUserCache();
  blockedOnPage.clear();
  const processed = document.querySelectorAll("[data-moronlist-username]");
  for (const el of processed) {
    const username = el.getAttribute("data-moronlist-username");
    if (username !== null && username.length > 0) {
      void isBlocked(username).then((blocked) => {
        if (blocked) {
          markBlocked(el);
          blockedOnPage.add(username.toLowerCase());
        } else {
          markProcessed(el);
        }
        updateSidebarBadge();
      });
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

  void isBlocked(username).then((blocked) => {
    if (blocked) {
      const existingBanner = document.querySelector("#moronlist-profile-banner");
      if (existingBanner === null) {
        const banner = document.createElement("div");
        banner.id = "moronlist-profile-banner";
        banner.textContent = `@${username} is on your MoronList`;
        document.body.prepend(banner);
      }
    }
  });
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; username?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === "BLOCK_LIST_UPDATED") {
      reprocessAllTweets();
      handleProfilePage();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "AUTH_CHANGED") {
      // Refresh the modal's current section if it's open
      const modal = document.getElementById("moronlist-modal");
      if (modal !== null && modal.classList.contains("open")) {
        const activeLink = modal.querySelector(".moronlist-sidebar-link.active");
        const section = activeLink?.getAttribute("data-section") ?? "blocked";
        switchModalSection(modal, section);
      }
      sendResponse({ ok: true });
      return false;
    }
    return false;
  }
);

// Track blocked usernames on the current page for the sidebar badge and modal
const blockedOnPage = new Set<string>();

// ============================================================
// Sidebar nav item
// ============================================================

const SIDEBAR_ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-1nao33i r-lwhw9o r-cnnz9e"><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"></path></g></svg>`;

function injectSidebarItem(): void {
  const nav = document.querySelector('nav[role="navigation"]');
  if (nav === null) return;

  // Check if labels are currently shown on X's nav items
  const hasLabels =
    nav.querySelector('[data-testid="AppTabBar_Home_Link"] div[dir="ltr"]') !== null;
  const existing = document.getElementById("moronlist-sidebar-item");

  if (existing !== null) {
    // Check if our label state matches — if not, remove and re-inject
    const ourLabel = existing.querySelector('div[dir="ltr"]');
    const ourHasLabel = ourLabel !== null;
    if (ourHasLabel === hasLabels) {
      return; // Already correct
    }
    existing.remove();
  }

  const moreButton = nav.querySelector('[data-testid="AppTabBar_More_Menu"]');
  if (moreButton === null) {
    return;
  }

  const item = document.createElement("a");
  item.id = "moronlist-sidebar-item";
  item.setAttribute("role", "link");
  item.className =
    "css-175oi2r r-6koalj r-eqz5dr r-16y2uox r-1habvwh r-cnw61z r-13qz1uu r-1ny4l3l r-1loqt21";
  // No inline style — let the CSS classes handle alignment

  const outerDiv = document.createElement("div");
  outerDiv.className =
    "css-175oi2r r-sdzlij r-dnmrzs r-1awozwy r-18u37iz r-1777fci r-xyw6el r-o7ynqc r-6416eg";

  const innerDiv = document.createElement("div");
  innerDiv.className = "css-175oi2r";
  innerDiv.innerHTML = SIDEBAR_ICON_SVG;

  outerDiv.appendChild(innerDiv);

  // Only add label if other nav items have labels (expanded sidebar)
  const existingLabel = nav.querySelector('[data-testid="AppTabBar_Home_Link"] div[dir="ltr"]');
  if (existingLabel !== null) {
    const label = document.createElement("div");
    label.className =
      "css-146c3p1 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-adyw6z r-135wba7 r-16dba41 r-dlybji r-nazi8o";
    label.dir = "ltr";
    label.style.color = "rgb(231, 233, 234)";
    const labelSpan = document.createElement("span");
    labelSpan.className = "css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3";
    labelSpan.textContent = "Morons";
    label.appendChild(labelSpan);
    outerDiv.appendChild(label);
  }

  item.appendChild(outerDiv);

  // Badge for count
  const badge = document.createElement("span");
  badge.id = "moronlist-sidebar-badge";
  item.appendChild(badge);

  item.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal();
  });

  // Insert before the More button
  moreButton.parentElement?.insertBefore(item, moreButton);

  // Update badge immediately
  updateSidebarBadge();
}

let sidebarInjectionInterval: ReturnType<typeof setInterval> | null = null;

function startSidebarInjection(): void {
  // Try immediately
  injectSidebarItem();

  // Keep checking every 2s — X may re-render the sidebar on resize/navigation
  // and remove our injected element. This is lightweight (just an getElementById check).
  sidebarInjectionInterval = setInterval(() => {
    if (document.getElementById("moronlist-sidebar-item") === null) {
      injectSidebarItem();
    }
  }, 2000);
}

function updateSidebarBadge(): void {
  const badge = document.getElementById("moronlist-sidebar-badge");
  if (badge === null) return;

  const count = blockedOnPage.size;
  if (count === 0) {
    badge.classList.remove("visible");
    badge.textContent = "";
  } else {
    badge.classList.add("visible");
    badge.textContent = String(count);
  }
}

// ============================================================
// Theme detection
// ============================================================

function detectTheme(): "dark" | "light" {
  const bg = window.getComputedStyle(document.body).backgroundColor;
  // X dark: rgb(0, 0, 0), X dim: rgb(21, 32, 43)
  if (bg === "rgb(0, 0, 0)" || bg === "rgb(21, 32, 43)") {
    return "dark";
  }
  return "light";
}

// ============================================================
// Modal
// ============================================================

let modalSidebarOpen = false;

function createModalElement(): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.id = "moronlist-backdrop";
  backdrop.addEventListener("click", closeModal);
  document.body.appendChild(backdrop);

  const modal = document.createElement("div");
  modal.id = "moronlist-modal";

  modal.innerHTML = `
    <div class="moronlist-modal-header">
      <div class="moronlist-modal-header-left">
        <button class="moronlist-hamburger" id="moronlist-hamburger" type="button" aria-label="Toggle sidebar menu">&#9776;</button>
        <h2 class="moronlist-modal-title">MoronList</h2>
      </div>
      <button class="moronlist-modal-close" id="moronlist-modal-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="moronlist-modal-body">
      <div class="moronlist-modal-sidebar" id="moronlist-modal-sidebar">
        <button class="moronlist-sidebar-link active" data-section="blocked">Blocked</button>
        <button class="moronlist-sidebar-link" data-section="my-lists">My Lists</button>
        <button class="moronlist-sidebar-link" data-section="subscriptions">Subscriptions</button>
        <button class="moronlist-sidebar-link" data-section="settings">Settings</button>
      </div>
      <div class="moronlist-modal-content">
        <input class="moronlist-search-input" id="moronlist-modal-search" type="text" placeholder="Search blocked users..." />
        <div class="moronlist-blocked-list" id="moronlist-modal-list"></div>
      </div>
    </div>
  `;

  // Close button
  modal.querySelector("#moronlist-modal-close")?.addEventListener("click", closeModal);

  // Hamburger toggle
  modal.querySelector("#moronlist-hamburger")?.addEventListener("click", () => {
    modalSidebarOpen = !modalSidebarOpen;
    const sidebar = document.getElementById("moronlist-modal-sidebar");
    if (sidebar !== null) {
      if (modalSidebarOpen) {
        sidebar.classList.add("sidebar-open");
      } else {
        sidebar.classList.remove("sidebar-open");
      }
    }
  });

  // Sidebar section switching
  const sidebarLinks = modal.querySelectorAll(".moronlist-sidebar-link");
  for (const link of sidebarLinks) {
    link.addEventListener("click", () => {
      // Update active state
      for (const l of sidebarLinks) {
        l.classList.remove("active");
      }
      link.classList.add("active");

      const section = link.getAttribute("data-section") ?? "blocked";
      switchModalSection(modal, section);

      // Close mobile sidebar
      const sidebar = document.getElementById("moronlist-modal-sidebar");
      if (sidebar !== null) {
        sidebar.classList.remove("sidebar-open");
        modalSidebarOpen = false;
      }
    });
  }

  // Search filter
  modal.querySelector("#moronlist-modal-search")?.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    const items = modal.querySelectorAll(".moronlist-blocked-item");
    for (const item of items) {
      const username = item.getAttribute("data-username") ?? "";
      (item as HTMLElement).style.display = username.includes(query) ? "" : "none";
    }
  });

  // Escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  document.body.appendChild(modal);
  return modal;
}

function switchModalSection(modal: HTMLElement, section: string): void {
  const content = modal.querySelector(".moronlist-modal-content");
  if (content === null) return;

  switch (section) {
    case "blocked":
      content.innerHTML = `
        <input class="moronlist-search-input" id="moronlist-modal-search" type="text" placeholder="Search blocked users..." />
        <div class="moronlist-blocked-list" id="moronlist-modal-list"></div>
      `;
      populateModalBlockedList(modal);
      // Re-attach search handler
      modal.querySelector("#moronlist-modal-search")?.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const items = modal.querySelectorAll(".moronlist-blocked-item");
        for (const item of items) {
          const username = item.getAttribute("data-username") ?? "";
          (item as HTMLElement).style.display = username.includes(query) ? "" : "none";
        }
      });
      break;

    case "my-lists":
      content.innerHTML = `
        <div class="moronlist-empty-state" style="padding: 24px;">
          <p style="margin-bottom: 8px; font-weight: 600;">My Lists</p>
          <p style="font-size: 13px;">Loading...</p>
        </div>
      `;
      void loadMyListsSection(content);
      break;

    case "subscriptions":
      content.innerHTML = `
        <div class="moronlist-empty-state" style="padding: 24px;">
          <p style="margin-bottom: 8px; font-weight: 600;">Subscriptions</p>
          <p style="font-size: 13px;">Loading...</p>
        </div>
      `;
      void loadSubscriptionsSection(content);
      break;

    case "settings":
      content.innerHTML = `<div style="padding: 24px;"><p style="font-size: 13px; opacity: 0.6;">Loading...</p></div>`;
      void loadSettingsSection(content);
      break;
  }
}

async function loadMyListsSection(content: Element): Promise<void> {
  const theme = detectTheme();
  const textColor = theme === "dark" ? "#e7e9ea" : "#0f1419";
  const mutedColor = theme === "dark" ? "#71767b" : "#536471";
  const inputBg = theme === "dark" ? "#22303c" : "#eff3f4";
  const inputBorder = theme === "dark" ? "#2f3336" : "#cfd9de";

  try {
    const listsResult = (await chrome.runtime.sendMessage({ type: "GET_MY_LISTS" })) as {
      success: boolean;
      data?: Array<{ name: string; platform: string; slug: string }>;
      error?: string;
    };

    let html = `<div style="padding: 16px;">`;

    // Create new list form
    html += `<div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid ${inputBorder};">`;
    html += `<p style="font-size: 14px; font-weight: 600; margin: 0 0 10px 0; color: ${textColor};">Create New List</p>`;
    html += `<form id="moronlist-create-form" style="display: flex; flex-direction: column; gap: 6px;">`;
    html += `<div style="display: flex; gap: 6px;">`;
    html += `<input id="moronlist-create-name" type="text" placeholder="List name" required style="flex: 1; background: ${inputBg}; border: 1px solid ${inputBorder}; color: ${textColor}; padding: 5px 8px; border-radius: 4px; font-size: 12px; outline: none;" />`;
    html += `<input id="moronlist-create-slug" type="text" placeholder="slug-auto-filled" style="flex: 1; background: ${inputBg}; border: 1px solid ${inputBorder}; color: ${mutedColor}; padding: 5px 8px; border-radius: 4px; font-size: 12px; outline: none;" />`;
    html += `</div>`;
    html += `<div style="display: flex; gap: 6px;">`;
    html += `<input id="moronlist-create-desc" type="text" placeholder="Description (optional)" style="flex: 1; background: ${inputBg}; border: 1px solid ${inputBorder}; color: ${textColor}; padding: 5px 8px; border-radius: 4px; font-size: 12px; outline: none;" />`;
    html += `<button type="submit" style="background: #ef4444; color: white; border: none; padding: 5px 14px; border-radius: 4px; font-size: 12px; cursor: pointer; white-space: nowrap;">Create</button>`;
    html += `</div>`;
    html += `</form>`;
    html += `<span id="moronlist-create-feedback" style="font-size: 12px; color: ${mutedColor}; display: block; margin-top: 4px;"></span>`;
    html += `</div>`;

    // List of existing lists
    if (listsResult.success && listsResult.data !== undefined && listsResult.data.length > 0) {
      const lists = listsResult.data;
      html += lists
        .map(
          (l) =>
            `<div class="moronlist-blocked-item" data-list-key="${l.platform}/${l.slug}" style="padding: 10px 12px; cursor: pointer;">
              <span style="font-weight: 600; color: ${textColor};">${l.name}</span>
              <span style="opacity: 0.5; font-size: 12px; margin-left: 8px; color: ${mutedColor};">${l.platform}/${l.slug}</span>
              <span style="float: right; font-size: 12px; color: ${mutedColor};">&rarr;</span>
            </div>`
        )
        .join("");
    } else if (listsResult.success) {
      html += `<div class="moronlist-empty-state">No lists yet</div>`;
    } else {
      html += `<div class="moronlist-empty-state">Failed to load: ${listsResult.error ?? "unknown"}</div>`;
    }

    html += `</div>`;
    content.innerHTML = html;

    // Auto-fill slug from name (kebab-case, live)
    let slugManuallyEdited = false;
    const nameInput = content.querySelector("#moronlist-create-name") as HTMLInputElement | null;
    const slugInput = content.querySelector("#moronlist-create-slug") as HTMLInputElement | null;

    if (nameInput !== null && slugInput !== null) {
      nameInput.addEventListener("input", () => {
        if (!slugManuallyEdited) {
          slugInput.value = nameInput.value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        }
      });
      slugInput.addEventListener("input", () => {
        slugManuallyEdited = true;
      });
      slugInput.addEventListener("focus", () => {
        if (slugInput.value.length > 0) {
          slugInput.style.color = detectTheme() === "dark" ? "#e7e9ea" : "#0f1419";
        }
      });
    }

    // Create form handler
    content.querySelector("#moronlist-create-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const slug = (
        content.querySelector("#moronlist-create-slug") as HTMLInputElement
      ).value.trim();
      const name = (
        content.querySelector("#moronlist-create-name") as HTMLInputElement
      ).value.trim();
      const desc = (
        content.querySelector("#moronlist-create-desc") as HTMLInputElement
      ).value.trim();
      const feedback = content.querySelector("#moronlist-create-feedback");

      if (slug.length === 0 || name.length === 0) {
        if (feedback !== null) feedback.textContent = "Name is required";
        return;
      }
      if (feedback !== null) feedback.textContent = "Creating...";

      void chrome.runtime
        .sendMessage({
          type: "CREATE_LIST",
          platform: "x",
          slug,
          name,
          description: desc.length > 0 ? desc : undefined,
        })
        .then((result: unknown) => {
          const r = result as { success: boolean; error?: string };
          if (r.success) {
            // Refresh the list
            void loadMyListsSection(content);
          } else {
            if (feedback !== null) feedback.textContent = r.error ?? "Failed";
          }
        });
    });

    // Click on list item to view entries
    const listItems = content.querySelectorAll("[data-list-key]");
    for (const item of listItems) {
      item.addEventListener("click", () => {
        const key = item.getAttribute("data-list-key") ?? "";
        const parts = key.split("/");
        if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
          void loadListDetailSection(content, parts[0], parts[1]);
        }
      });
    }
  } catch {
    content.innerHTML = `<div class="moronlist-empty-state" style="padding: 24px;">Failed to load lists</div>`;
  }
}

async function loadListDetailSection(
  content: Element,
  platform: string,
  slug: string
): Promise<void> {
  const theme = detectTheme();
  const textColor = theme === "dark" ? "#e7e9ea" : "#0f1419";
  const mutedColor = theme === "dark" ? "#71767b" : "#536471";
  const inputBg = theme === "dark" ? "#22303c" : "#eff3f4";
  const inputBorder = theme === "dark" ? "#2f3336" : "#cfd9de";

  content.innerHTML = `<div style="padding: 16px; color: ${textColor};"><p style="font-size: 13px; color: ${mutedColor};">Loading ${platform}/${slug}...</p></div>`;

  try {
    // Get the changelog entries for this list from the API
    const result = (await chrome.runtime.sendMessage({
      type: "GET_LIST_ENTRIES",
      platform,
      slug,
    })) as {
      success: boolean;
      data?: Array<{ action: string; platformUserId: string; reason: string | null }>;
      error?: string;
    };

    let html = `<div style="padding: 16px;">`;

    // Back button
    html += `<div style="margin-bottom: 12px;">`;
    html += `<button id="moronlist-list-back" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; padding: 0;">&larr; Back to My Lists</button>`;
    html += `<span style="font-weight: 700; font-size: 16px; margin-left: 12px; color: ${textColor};">${platform}/${slug}</span>`;
    html += `</div>`;

    // Search
    html += `<input id="moronlist-list-search" type="text" placeholder="Search entries..." style="width: 100%; box-sizing: border-box; background: ${inputBg}; border: 1px solid ${inputBorder}; color: ${textColor}; padding: 8px 12px; border-radius: 20px; font-size: 13px; outline: none; margin-bottom: 12px;" />`;

    if (result.success && result.data !== undefined) {
      // Compute effective set from changelog
      const entries = new Map<string, { action: string; reason: string | null }>();
      for (const e of result.data) {
        entries.set(e.platformUserId, { action: e.action, reason: e.reason });
      }

      // Show current morons and saints
      const morons: Array<{ user: string; reason: string | null }> = [];
      const saints: Array<{ user: string; reason: string | null }> = [];
      for (const [user, info] of entries) {
        if (info.action === "ADD") morons.push({ user, reason: info.reason });
        if (info.action === "ADD_SAINT") saints.push({ user, reason: info.reason });
      }

      html += `<p style="font-size: 13px; color: ${mutedColor}; margin-bottom: 8px;">${String(morons.length)} morons, ${String(saints.length)} saints</p>`;

      if (morons.length > 0) {
        html += `<p style="font-size: 12px; font-weight: 600; color: #ef4444; margin: 8px 0 4px;">Morons</p>`;
        for (const m of morons) {
          html += `<div class="moronlist-blocked-item" data-search="${m.user}" style="padding: 6px 12px;"><span class="moronlist-blocked-username">@${m.user}</span>`;
          if (m.reason !== null)
            html += ` <span style="font-size: 11px; color: ${mutedColor};">${m.reason}</span>`;
          html += `</div>`;
        }
      }

      if (saints.length > 0) {
        html += `<p style="font-size: 12px; font-weight: 600; color: #22c55e; margin: 12px 0 4px;">Saints</p>`;
        for (const s of saints) {
          html += `<div class="moronlist-blocked-item" data-search="${s.user}" style="padding: 6px 12px;"><span style="color: #22c55e;">@${s.user}</span>`;
          if (s.reason !== null)
            html += ` <span style="font-size: 11px; color: ${mutedColor};">${s.reason}</span>`;
          html += `</div>`;
        }
      }

      if (morons.length === 0 && saints.length === 0) {
        html += `<div class="moronlist-empty-state">No entries yet</div>`;
      }
    } else {
      html += `<div class="moronlist-empty-state">Failed to load: ${result.error ?? "unknown"}</div>`;
    }

    html += `</div>`;
    content.innerHTML = html;

    // Back button handler
    content.querySelector("#moronlist-list-back")?.addEventListener("click", () => {
      void loadMyListsSection(content);
    });

    // Search filter
    content.querySelector("#moronlist-list-search")?.addEventListener("input", (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      const items = content.querySelectorAll("[data-search]");
      for (const item of items) {
        const user = item.getAttribute("data-search") ?? "";
        (item as HTMLElement).style.display = user.includes(query) ? "" : "none";
      }
    });
  } catch {
    content.innerHTML = `<div class="moronlist-empty-state" style="padding: 24px;">Failed to load list detail</div>`;
  }
}

async function loadSubscriptionsSection(content: Element): Promise<void> {
  try {
    const subsResult = (await chrome.runtime.sendMessage({ type: "GET_MY_SUBSCRIPTIONS" })) as {
      success: boolean;
      data?: Array<{ listName: string; listPlatform: string; listSlug: string }>;
      error?: string;
    };

    if (!subsResult.success || subsResult.data === undefined) {
      content.innerHTML = `<div class="moronlist-empty-state" style="padding: 24px;">Failed to load subscriptions: ${subsResult.error ?? "unknown error"}</div>`;
      return;
    }

    const subs = subsResult.data;
    if (subs.length === 0) {
      content.innerHTML = `<div class="moronlist-empty-state" style="padding: 24px;">No subscriptions yet.</div>`;
      return;
    }

    content.innerHTML = `
      <div style="padding: 12px;">
        ${subs
          .map(
            (s) => `
          <div class="moronlist-blocked-item" style="padding: 10px 12px;">
            <span style="font-weight: 600;">${s.listName}</span>
            <span style="opacity: 0.5; font-size: 12px; margin-left: 8px;">${s.listPlatform}/${s.listSlug}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  } catch {
    content.innerHTML = `<div class="moronlist-empty-state" style="padding: 24px;">Failed to load subscriptions</div>`;
  }
}

async function loadSettingsSection(content: Element): Promise<void> {
  try {
    const status = (await chrome.runtime.sendMessage({ type: "GET_STATUS" })) as {
      signedIn: boolean;
      blockedCount: number;
      saintedCount: number;
      listCount: number;
      lastSyncTime: number | null;
    };

    const theme = detectTheme();
    const textColor = theme === "dark" ? "#e7e9ea" : "#0f1419";
    const mutedColor = theme === "dark" ? "#71767b" : "#536471";
    const inputBg = theme === "dark" ? "#22303c" : "#eff3f4";
    const inputBorder = theme === "dark" ? "#2f3336" : "#cfd9de";

    let html = `<div style="padding: 24px; color: ${textColor};">`;
    html += `<h3 style="font-size: 18px; font-weight: 700; margin: 0 0 20px 0;">Settings</h3>`;

    // Account section
    html += `<div style="margin-bottom: 24px;">`;
    html += `<p style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Account</p>`;
    if (status.signedIn) {
      html += `<p style="font-size: 13px; color: ${mutedColor}; margin: 0 0 8px 0;">Signed in</p>`;
      html += `<button id="moronlist-settings-signout" style="background: #ef4444; color: white; border: none; padding: 6px 16px; border-radius: 4px; font-size: 13px; cursor: pointer;">Sign Out</button>`;
    } else {
      html += `<p style="font-size: 13px; color: ${mutedColor}; margin: 0 0 8px 0;">Not signed in</p>`;
      html += `<button id="moronlist-settings-signin" style="background: #1d9bf0; color: white; border: none; padding: 6px 16px; border-radius: 4px; font-size: 13px; cursor: pointer;">Sign In with Google</button>`;
    }
    html += `</div>`;

    // Stats
    html += `<div style="margin-bottom: 24px;">`;
    html += `<p style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Stats</p>`;
    html += `<p style="font-size: 13px; color: ${mutedColor}; margin: 0;">`;
    html += `${String(status.blockedCount)} blocked, ${String(status.saintedCount)} sainted, ${String(status.listCount)} lists`;
    if (status.lastSyncTime !== null) {
      const ago = Math.round((Date.now() - status.lastSyncTime) / 60000);
      html += ` &middot; last synced ${String(ago)}m ago`;
    }
    html += `</p></div>`;

    // Create list is under My Lists tab

    html += `</div>`;
    content.innerHTML = html;

    // Attach handlers
    content.querySelector("#moronlist-settings-signout")?.addEventListener("click", () => {
      void chrome.runtime.sendMessage({ type: "LOGOUT" }).then(() => {
        void loadSettingsSection(content);
      });
    });

    content.querySelector("#moronlist-settings-signin")?.addEventListener("click", () => {
      void chrome.runtime.sendMessage({ type: "LOGIN" });
    });

    // Create list form is under My Lists tab
  } catch {
    content.innerHTML = `<div class="moronlist-empty-state" style="padding: 24px;">Failed to load settings</div>`;
  }
}

function populateModalBlockedList(modal: HTMLElement): void {
  const list = modal.querySelector("#moronlist-modal-list");
  if (list === null) return;

  const search = modal.querySelector("#moronlist-modal-search") as HTMLInputElement | null;
  if (search !== null) {
    search.value = "";
  }

  if (blockedOnPage.size === 0) {
    list.innerHTML = `<div class="moronlist-empty-state">No blocked users found on this page</div>`;
    return;
  }

  const sorted = Array.from(blockedOnPage).sort();
  list.innerHTML = sorted
    .map(
      (u) =>
        `<div class="moronlist-blocked-item" data-username="${u}"><span class="moronlist-blocked-username">@${u}</span></div>`
    )
    .join("");
}

function openModal(): void {
  let modal = document.getElementById("moronlist-modal");
  if (modal === null) {
    modal = createModalElement();
  }

  // Apply theme
  const theme = detectTheme();
  modal.classList.remove("moronlist-dark", "moronlist-light");
  modal.classList.add(theme === "dark" ? "moronlist-dark" : "moronlist-light");

  // Reset sidebar on small screens
  modalSidebarOpen = false;
  const sidebar = document.getElementById("moronlist-modal-sidebar");
  if (sidebar !== null) {
    sidebar.classList.remove("sidebar-open");
  }

  populateModalBlockedList(modal);

  const backdrop = document.getElementById("moronlist-backdrop");
  if (backdrop !== null) {
    backdrop.classList.add("open");
  }
  modal.classList.add("open");

  // Focus the modal for keyboard events
  modal.focus();
}

function closeModal(): void {
  const modal = document.getElementById("moronlist-modal");
  const backdrop = document.getElementById("moronlist-backdrop");

  if (modal !== null) {
    modal.classList.remove("open");
  }
  if (backdrop !== null) {
    backdrop.classList.remove("open");
  }
}

// ============================================================
// Initialization
// ============================================================

async function initialize(): Promise<void> {
  // No bulk loading -- each tweet queries the service worker individually
  // via CHECK_USER, which does an IndexedDB lookup (O(1) per user)
  startSidebarInjection();
  processTweets();
  handleProfilePage();
  setupMutationObserver();
}

initialize();

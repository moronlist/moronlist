/**
 * Launch a browser to inspect X/Twitter DOM.
 *
 * Uses a persistent Chrome profile at .data/chrome-profile/
 * so you only need to log in once.
 *
 * Usage: node scripts/inspect-x.js
 *
 * Press Enter when on the timeline to take a screenshot and dump DOM info.
 * Press Enter again to close.
 */

const puppeteer = require("puppeteer");
const { join } = require("path");

const ROOT = join(__dirname, "..");

(async () => {
  const userDataDir = join(ROOT, ".data", "chrome-profile");

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
  await page.goto("https://x.com", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  console.log("");
  console.log("Browser open. Log in if needed (session is saved).");
  console.log("Navigate to the timeline, then press Enter to inspect...");

  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  console.log("Inspecting...");

  // Screenshot
  await page.screenshot({
    path: join(ROOT, ".temp", "x-timeline.png"),
    fullPage: false,
  });

  // DOM inspection
  const info = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    const results = [];

    for (let i = 0; i < Math.min(5, tweets.length); i++) {
      const tweet = tweets[i];
      const group = tweet.querySelector('[role="group"]');
      if (!group) continue;

      const username =
        tweet
          .querySelector('[data-testid^="UserAvatar-Container-"]')
          ?.getAttribute("data-testid")
          ?.replace("UserAvatar-Container-", "") || "unknown";

      const children = Array.from(group.children);
      results.push({
        username,
        actionBarChildCount: children.length,
        buttons: Array.from(group.querySelectorAll("button, a")).map((b) => ({
          testId: b.getAttribute("data-testid"),
          ariaLabel: (b.getAttribute("aria-label") || "").substring(0, 60),
        })),
        groupClasses: group.className,
        wrapperClasses: children.map((c) => c.className),
        // Get the full HTML of the last child (share button wrapper)
        lastChildHTML: children[children.length - 1]?.outerHTML?.substring(0, 500),
      });
    }

    return { viewport, tweetCount: tweets.length, tweets: results };
  });

  console.log("");
  console.log(JSON.stringify(info, null, 2));
  console.log("");
  console.log("Screenshot saved to .temp/x-timeline.png");
  console.log("Press Enter to close browser...");

  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

/**
 * Launch a persistent debug browser for live DOM inspection.
 *
 * Keeps Chrome running with remote debugging on port 9222.
 * Other scripts/tools can connect via puppeteer.connect().
 * Session is saved in .data/chrome-profile/ so login persists.
 *
 * Usage: node scripts/browser-debug.js
 * Then connect from another script: puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })
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
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0",
    ],
    defaultViewport: null,
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
  console.log("Debug browser running on port 9222");
  console.log("Connect with: puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })");
  console.log("Session saved in .data/chrome-profile/");
  console.log("Ctrl+C to stop.");
  console.log("");

  // Keep alive until killed
  await new Promise(() => {});
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

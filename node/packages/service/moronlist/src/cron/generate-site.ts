/**
 * Static site generator.
 *
 * Produces minimal HTML pages from the data directory's meta.json files:
 *   - index.html: landing page with platform links
 *   - {platform}/index.html: list of public lists on that platform
 *   - {platform}/{slug}/index.html: individual list detail page
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";

type MetaJson = {
  platform: string;
  slug: string;
  name: string;
  description: string | null;
  version: number;
  entries: number;
  files: number;
  parents: ParentNode[];
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
};

type ParentNode = {
  platform: string;
  slug: string;
  name: string;
  parents?: ParentNode[];
};

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0d0d0d;
    color: #e0e0e0;
    line-height: 1.6;
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }
  a { color: #5b9bd5; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { color: #fff; margin-bottom: 0.5rem; font-size: 1.8rem; }
  h2 { color: #fff; margin-bottom: 0.5rem; font-size: 1.4rem; }
  p { margin-bottom: 1rem; color: #b0b0b0; }
  .list-card {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin-bottom: 0.75rem;
  }
  .list-card h3 { color: #fff; font-size: 1.1rem; margin-bottom: 0.25rem; }
  .list-card .meta { color: #808080; font-size: 0.85rem; }
  .list-card .desc { color: #b0b0b0; font-size: 0.9rem; margin-top: 0.25rem; }
  .badge {
    display: inline-block;
    background: #2a2a2a;
    color: #a0a0a0;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-right: 0.5rem;
  }
  .parent-tree { margin-left: 1.5rem; border-left: 2px solid #2a2a2a; padding-left: 1rem; }
  .parent-tree .parent-item { margin-bottom: 0.5rem; }
  .back { margin-bottom: 1.5rem; display: inline-block; }
  .nav { margin-bottom: 2rem; }
  .nav a { margin-right: 1rem; }
  .platforms { margin-top: 1.5rem; }
  .install-cta {
    background: #1a2a1a;
    border: 1px solid #2a4a2a;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 1.5rem 0;
  }
  .install-cta a { color: #6bc96b; font-weight: bold; }
`;

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readMetaFiles(dataDir: string, platform: string): MetaJson[] {
  const platformDir = join(dataDir, platform);
  if (!existsSync(platformDir)) {
    return [];
  }

  const metas: MetaJson[] = [];
  const slugDirs = readdirSync(platformDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of slugDirs) {
    const metaPath = join(platformDir, slug, "meta.json");
    if (!existsSync(metaPath)) {
      continue;
    }
    try {
      const raw = readFileSync(metaPath, "utf-8");
      metas.push(JSON.parse(raw) as MetaJson);
    } catch {
      logger.warn("Failed to read meta.json", { platform, slug });
    }
  }

  return metas;
}

function renderParentTree(parents: ParentNode[]): string {
  if (parents.length === 0) {
    return "";
  }

  let html = '<div class="parent-tree">';
  for (const parent of parents) {
    html += `<div class="parent-item">`;
    html += `<a href="/${parent.platform}/${parent.slug}/">${escapeHtml(parent.name)}</a>`;
    html += ` <span class="badge">${escapeHtml(parent.platform)}/${escapeHtml(parent.slug)}</span>`;
    if (parent.parents !== undefined && parent.parents.length > 0) {
      html += renderParentTree(parent.parents);
    }
    html += `</div>`;
  }
  html += "</div>";
  return html;
}

function generateIndexPage(siteDir: string, platforms: string[]): void {
  let body = `<h1>MoronList</h1>`;
  body += `<p>Collaborative block lists for social platforms.</p>`;
  body += `<div class="install-cta">`;
  body += `<p>Install the <a href="https://chromewebstore.google.com/detail/moronlist" target="_blank" rel="noopener">Chrome extension</a> to subscribe to lists and automatically block accounts.</p>`;
  body += `</div>`;
  body += `<h2>Platforms</h2>`;
  body += `<div class="platforms">`;
  for (const platform of platforms) {
    body += `<div class="list-card"><h3><a href="/${platform}/">${escapeHtml(platform.toUpperCase())}</a></h3></div>`;
  }
  if (platforms.length === 0) {
    body += `<p>No platforms available yet.</p>`;
  }
  body += `</div>`;

  writeFileSync(join(siteDir, "index.html"), htmlPage("MoronList", body), "utf-8");
}

function generatePlatformPage(siteDir: string, dataDir: string, platform: string): void {
  const metas = readMetaFiles(dataDir, platform);
  const platformDir = join(siteDir, platform);
  mkdirSync(platformDir, { recursive: true });

  // Sort by subscriber count descending
  metas.sort((a, b) => b.subscriberCount - a.subscriberCount);

  let body = `<a class="back" href="/">Back to MoronList</a>`;
  body += `<h1>${escapeHtml(platform.toUpperCase())} Lists</h1>`;
  body += `<p>${String(metas.length)} public list${metas.length !== 1 ? "s" : ""}</p>`;

  for (const meta of metas) {
    body += `<div class="list-card">`;
    body += `<h3><a href="/${meta.platform}/${meta.slug}/">${escapeHtml(meta.name)}</a></h3>`;
    body += `<div class="meta">`;
    body += `<span class="badge">${meta.entries.toLocaleString()} entries</span>`;
    body += `<span class="badge">${meta.subscriberCount.toLocaleString()} subscribers</span>`;
    body += `</div>`;
    if (meta.description !== null && meta.description !== "") {
      body += `<div class="desc">${escapeHtml(meta.description)}</div>`;
    }
    body += `</div>`;
  }

  if (metas.length === 0) {
    body += `<p>No lists yet.</p>`;
  }

  writeFileSync(
    join(platformDir, "index.html"),
    htmlPage(`${platform.toUpperCase()} Lists - MoronList`, body),
    "utf-8"
  );
}

function generateListPage(siteDir: string, meta: MetaJson): void {
  const listDir = join(siteDir, meta.platform, meta.slug);
  mkdirSync(listDir, { recursive: true });

  let body = `<a class="back" href="/${meta.platform}/">Back to ${escapeHtml(meta.platform.toUpperCase())} Lists</a>`;
  body += `<h1>${escapeHtml(meta.name)}</h1>`;

  if (meta.description !== null && meta.description !== "") {
    body += `<p>${escapeHtml(meta.description)}</p>`;
  }

  body += `<div class="meta" style="margin-bottom: 1rem;">`;
  body += `<span class="badge">${String(meta.entries)} entries</span>`;
  body += `<span class="badge">${String(meta.subscriberCount)} subscribers</span>`;
  body += `<span class="badge">v${String(meta.version)}</span>`;
  body += `</div>`;

  body += `<div class="install-cta">`;
  body += `<p>Install the <a href="https://chromewebstore.google.com/detail/moronlist" target="_blank" rel="noopener">Chrome extension</a> to subscribe to this list.</p>`;
  body += `</div>`;

  if (meta.parents.length > 0) {
    body += `<h2>Inherits from</h2>`;
    body += renderParentTree(meta.parents);
  }

  writeFileSync(join(listDir, "index.html"), htmlPage(`${meta.name} - MoronList`, body), "utf-8");
}

export function generateSite(_repos: Repositories, dataDir: string, siteDir: string): void {
  mkdirSync(siteDir, { recursive: true });

  // Discover platforms from the data directory
  const platforms: string[] = [];
  if (existsSync(dataDir)) {
    const entries = readdirSync(dataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        platforms.push(entry.name);
      }
    }
  }
  platforms.sort();

  // Generate index page
  generateIndexPage(siteDir, platforms);

  // Generate platform pages and list pages
  for (const platform of platforms) {
    generatePlatformPage(siteDir, dataDir, platform);

    const metas = readMetaFiles(dataDir, platform);
    for (const meta of metas) {
      generateListPage(siteDir, meta);
    }
  }

  logger.info("Site generated", { platforms: platforms.length, siteDir });
}

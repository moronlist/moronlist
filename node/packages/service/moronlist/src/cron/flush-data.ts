/**
 * Flush changelog entries to static txt files and meta.json.
 *
 * For each list with unflushed changelog entries:
 *   1. Read unflushed entries from the database
 *   2. Convert each entry to a txt line (+, -, *, ~)
 *   3. Append lines to the active tail file (10k lines max per file)
 *   4. Write meta.json with list metadata and parent tree
 *   5. Mark entries as flushed and update flush state
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import type { ChangelogEntry } from "../types.js";

const MAX_LINES_PER_FILE = 10_000;

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

type FlushResult = {
  flushed: number;
  errors: number;
};

function actionToPrefix(action: string): string {
  switch (action) {
    case "ADD":
      return "+";
    case "REMOVE":
      return "-";
    case "ADD_SAINT":
      return "*";
    case "REMOVE_SAINT":
      return "~";
    default:
      return "+";
  }
}

function entryToLine(entry: ChangelogEntry): string {
  const prefix = actionToPrefix(entry.action);
  if (entry.reason !== null && entry.reason !== "") {
    return `${prefix}${entry.platformUserId} ${entry.reason}`;
  }
  return `${prefix}${entry.platformUserId}`;
}

function countLinesInFile(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }
  const content = readFileSync(filePath, "utf-8");
  if (content === "") {
    return 0;
  }
  // Count newlines; each line ends with \n
  return content.split("\n").filter((line) => line !== "").length;
}

function readExistingMeta(listDir: string): MetaJson | null {
  const metaPath = join(listDir, "meta.json");
  if (!existsSync(metaPath)) {
    return null;
  }
  try {
    const raw = readFileSync(metaPath, "utf-8");
    return JSON.parse(raw) as MetaJson;
  } catch {
    return null;
  }
}

function buildParentTree(
  repos: Repositories,
  platform: string,
  slug: string,
  visited: Set<string>
): ParentNode[] {
  const key = `${platform}/${slug}`;
  if (visited.has(key)) {
    return [];
  }
  visited.add(key);

  const links = repos.inheritance.findParents(platform, slug);
  const nodes: ParentNode[] = [];

  for (const link of links) {
    const parentList = repos.moronList.findByPlatformAndSlug(link.parentPlatform, link.parentSlug);
    if (parentList === null) {
      continue;
    }

    const children = buildParentTree(repos, link.parentPlatform, link.parentSlug, visited);
    const node: ParentNode = {
      platform: parentList.platform,
      slug: parentList.slug,
      name: parentList.name,
    };
    if (children.length > 0) {
      node.parents = children;
    }
    nodes.push(node);
  }

  return nodes;
}

function flushList(repos: Repositories, dataDir: string, platform: string, slug: string): boolean {
  const entries = repos.changelog.findUnflushed(platform, slug);
  if (entries.length === 0) {
    return true;
  }

  const list = repos.moronList.findByPlatformAndSlug(platform, slug);
  if (list === null) {
    logger.error("List not found for flush", { platform, slug });
    return false;
  }

  const listDir = join(dataDir, platform, slug);
  mkdirSync(listDir, { recursive: true });

  // Determine current file state from existing meta or start fresh
  const existingMeta = readExistingMeta(listDir);
  let totalEntries = existingMeta?.entries ?? 0;
  let fileCount = existingMeta?.files ?? 1;

  // Check the current tail file line count
  let tailFilePath = join(listDir, `${String(fileCount)}.txt`);
  let tailLineCount = countLinesInFile(tailFilePath);

  // Convert entries to lines and append
  const lines = entries.map(entryToLine);

  for (const line of lines) {
    if (tailLineCount >= MAX_LINES_PER_FILE) {
      fileCount += 1;
      tailFilePath = join(listDir, `${String(fileCount)}.txt`);
      tailLineCount = 0;
    }

    appendFileSync(tailFilePath, line + "\n", "utf-8");
    tailLineCount += 1;
    totalEntries += 1;
  }

  // Build parent tree
  const parentTree = buildParentTree(repos, platform, slug, new Set<string>());

  // Get subscriber count
  const subscriberCount = repos.subscription.countByList(platform, slug);

  // Write meta.json
  const meta: MetaJson = {
    platform: list.platform,
    slug: list.slug,
    name: list.name,
    description: list.description,
    version: list.version,
    entries: totalEntries,
    files: fileCount,
    parents: parentTree,
    subscriberCount,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };

  writeFileSync(join(listDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf-8");

  // Mark entries as flushed up to the highest version
  const lastEntry = entries[entries.length - 1];
  if (lastEntry === undefined) return false;
  const maxVersion = lastEntry.version;
  repos.changelog.markFlushed(platform, slug, maxVersion);
  repos.flushState.updateState(platform, slug, maxVersion);

  logger.info("Flushed list", { platform, slug, entries: entries.length, totalEntries, fileCount });
  return true;
}

export function flushData(repos: Repositories, dataDir: string): FlushResult {
  mkdirSync(dataDir, { recursive: true });

  const listsToFlush = repos.changelog.findListsWithUnflushed();
  let flushed = 0;
  let errors = 0;

  for (const { platform, slug } of listsToFlush) {
    try {
      const ok = flushList(repos, dataDir, platform, slug);
      if (ok) {
        flushed += 1;
      } else {
        errors += 1;
      }
    } catch (error) {
      logger.error("Failed to flush list", { platform, slug, error });
      errors += 1;
    }
  }

  return { flushed, errors };
}

/**
 * Flush changelog entries to static txt files and meta.json.
 *
 * Stateless: compares the changelog in DB against files on disk.
 * If there are more entries in DB than lines on disk, writes the diff.
 * If files are deleted, rewrites everything from scratch.
 *
 * No flush markers in the DB. The files are the state.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
} from "fs";
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

/**
 * Count total lines across all txt files in a list directory.
 * Files are named 1.txt, 2.txt, etc.
 */
function countLinesOnDisk(listDir: string): number {
  if (!existsSync(listDir)) {
    return 0;
  }

  const files = readdirSync(listDir)
    .filter((f) => f.endsWith(".txt"))
    .sort(compareTxtFiles);
  let total = 0;

  for (const file of files) {
    const content = readFileSync(join(listDir, file), "utf-8");
    if (content !== "") {
      total += content.split("\n").filter((line) => line !== "").length;
    }
  }

  return total;
}

/**
 * Sort txt file names numerically: 1.txt, 2.txt, ..., 10.txt
 */
function compareTxtFiles(a: string, b: string): number {
  const numA = parseInt(a.replace(".txt", ""), 10);
  const numB = parseInt(b.replace(".txt", ""), 10);
  return numA - numB;
}

/**
 * Get the current tail file index and its line count.
 */
function getTailFileState(listDir: string): { fileIndex: number; lineCount: number } {
  if (!existsSync(listDir)) {
    return { fileIndex: 1, lineCount: 0 };
  }

  const files = readdirSync(listDir)
    .filter((f) => f.endsWith(".txt"))
    .sort(compareTxtFiles);

  if (files.length === 0) {
    return { fileIndex: 1, lineCount: 0 };
  }

  const lastFile = files[files.length - 1];
  if (lastFile === undefined) {
    return { fileIndex: 1, lineCount: 0 };
  }

  const fileIndex = parseInt(lastFile.replace(".txt", ""), 10);
  const content = readFileSync(join(listDir, lastFile), "utf-8");
  const lineCount = content === "" ? 0 : content.split("\n").filter((line) => line !== "").length;

  return { fileIndex, lineCount };
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
  const list = repos.moronList.findByPlatformAndSlug(platform, slug);
  if (list === null) {
    logger.error("List not found for flush", { platform, slug });
    return false;
  }

  // Get ALL changelog entries for this list, ordered by version
  const allEntries = repos.changelog.findByList(platform, slug, undefined, 1_000_000);

  const listDir = join(dataDir, platform, slug);
  const linesOnDisk = countLinesOnDisk(listDir);

  // Nothing new to write
  if (allEntries.length <= linesOnDisk) {
    return true;
  }

  // The entries we need to write are everything after what's already on disk
  const newEntries = allEntries.slice(linesOnDisk);

  mkdirSync(listDir, { recursive: true });

  // Get current tail file state
  let { fileIndex, lineCount: tailLineCount } = getTailFileState(listDir);

  // Append new lines
  const lines = newEntries.map(entryToLine);
  for (const line of lines) {
    if (tailLineCount >= MAX_LINES_PER_FILE) {
      fileIndex += 1;
      tailLineCount = 0;
    }

    const filePath = join(listDir, `${String(fileIndex)}.txt`);
    appendFileSync(filePath, line + "\n", "utf-8");
    tailLineCount += 1;
  }

  // Build parent tree
  const parentTree = buildParentTree(repos, platform, slug, new Set<string>());

  // Get subscriber count
  const subscriberCount = repos.subscription.countByList(platform, slug);

  // Write meta.json
  const totalLines = linesOnDisk + newEntries.length;
  const totalFiles = fileIndex;

  const meta: MetaJson = {
    platform: list.platform,
    slug: list.slug,
    name: list.name,
    description: list.description,
    version: list.version,
    entries: totalLines,
    files: totalFiles,
    parents: parentTree,
    subscriberCount,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };

  writeFileSync(join(listDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf-8");

  logger.info("Flushed list", {
    platform,
    slug,
    newEntries: newEntries.length,
    totalEntries: totalLines,
    files: totalFiles,
  });
  return true;
}

export function flushData(repos: Repositories, dataDir: string): FlushResult {
  mkdirSync(dataDir, { recursive: true });

  // Get all lists that have any changelog entries
  const allLists = repos.moronList.findAllPublic();
  let flushed = 0;
  let errors = 0;

  for (const list of allLists) {
    try {
      const ok = flushList(repos, dataDir, list.platform, list.slug);
      if (ok) {
        flushed += 1;
      } else {
        errors += 1;
      }
    } catch (error) {
      logger.error("Failed to flush list", { platform: list.platform, slug: list.slug, error });
      errors += 1;
    }
  }

  return { flushed, errors };
}

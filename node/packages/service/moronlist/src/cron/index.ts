/**
 * Entry point for the cron flush cycle.
 *
 * Intended to be run every 5 minutes via cron or a scheduler.
 * Flushes unflushed changelog entries to static txt files,
 * regenerates the static site, and pushes both repos to git.
 */

import { config } from "../config.js";
import { createRepositories } from "../repositories/sqlite/index.js";
import { flushData } from "./flush-data.js";
import { generateSite } from "./generate-site.js";
import { gitAddCommitPush } from "./git-ops.js";
import { logger } from "logger";

function run(): void {
  logger.info("Cron: starting flush cycle");

  const repos = createRepositories(config.db.sqlite.dbPath);
  const dataDir = config.output.dataDir;
  const siteDir = config.output.siteDir;

  // Flush changelog to txt files
  const flushResult = flushData(repos, dataDir);
  logger.info("Cron: flush complete", flushResult);

  // Generate static site (only if something was flushed)
  if (flushResult.flushed > 0) {
    generateSite(repos, dataDir, siteDir);
    logger.info("Cron: site generated");
  }

  // Push to git repos
  const now = new Date().toISOString();
  gitAddCommitPush(dataDir, `flush ${now}`);
  gitAddCommitPush(siteDir, `update ${now}`);

  logger.info("Cron: cycle complete");
}

run();

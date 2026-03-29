/**
 * Flush changelog to static files.
 *
 * Reads unflushed changelog entries from SQLite, writes txt files
 * and meta.json, regenerates the static site. No git operations —
 * git push is handled by the shell script (scripts/cron.sh).
 *
 * Usage:
 *   Local:      source .env && node --import tsx node/packages/service/moronlist/src/cron/index.ts
 *   Production: ./scripts/cron.sh (calls this, then does git push)
 */

import { config } from "../config.js";
import { createRepositories } from "../repositories/sqlite/index.js";
import { flushData } from "./flush-data.js";
import { generateSite } from "./generate-site.js";
import { logger } from "logger";

function run(): void {
  logger.info("Flush: starting");

  const repos = createRepositories(config.db.sqlite.dbPath);
  const dataDir = config.output.dataDir;
  const siteDir = config.output.siteDir;

  const flushResult = flushData(repos, dataDir);
  logger.info("Flush: data complete", flushResult);

  if (flushResult.flushed > 0) {
    generateSite(repos, dataDir, siteDir);
    logger.info("Flush: site generated");
  }

  logger.info("Flush: done");
}

run();

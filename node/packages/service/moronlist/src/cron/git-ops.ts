/**
 * Git operations helper for the cron flush cycle.
 * Stages all changes, commits, and pushes to the remote repository.
 */

import { execSync } from "child_process";
import { logger } from "logger";

export function gitAddCommitPush(repoDir: string, message: string): boolean {
  try {
    const status = execSync("git status --porcelain", { cwd: repoDir, encoding: "utf-8" });
    if (status.trim() === "") {
      logger.info("No changes to commit", { repoDir });
      return false;
    }

    execSync("git add -A", { cwd: repoDir });
    execSync(`git commit -m "${message}"`, { cwd: repoDir });
    execSync("git push", { cwd: repoDir });
    logger.info("Pushed changes", { repoDir, message });
    return true;
  } catch (error) {
    logger.error("Git push failed", { repoDir, error });
    return false;
  }
}

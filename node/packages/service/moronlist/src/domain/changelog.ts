// Helper functions for querying effective state from the changelog
// Since entries are now append-only log operations, we need to
// check the latest action to determine current state.

import type { Repositories } from "../repositories/interfaces/index.js";

export function isCurrentlyOnList(
  repos: Repositories,
  platform: string,
  slug: string,
  platformUserId: string
): boolean {
  const latest = repos.changelog.findLatestActionForUser(platform, slug, platformUserId);
  if (latest === null) return false;
  return latest.action === "ADD";
}

export function isCurrentlySainted(
  repos: Repositories,
  platform: string,
  slug: string,
  platformUserId: string
): boolean {
  const latest = repos.changelog.findLatestActionForUser(platform, slug, platformUserId);
  if (latest === null) return false;
  return latest.action === "ADD_SAINT";
}

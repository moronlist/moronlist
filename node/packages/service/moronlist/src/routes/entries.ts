/**
 * Moron entry routes (changelog-only)
 *
 * Routes:
 * - POST /api/morons/:platform/:slug/entries — add entries (array body)
 * - DELETE /api/morons/:platform/:slug/entries — remove entries (array body)
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { param } from "../middleware/params.js";
import { addEntriesBody, removeEntriesBody } from "../validation/schemas.js";
import { canWriteList } from "../domain/moron-list.js";
import { isCurrentlyOnList } from "../domain/changelog.js";

export function createEntryRoutes(repos: Repositories): Router {
  const router = Router({ mergeParams: true });

  // POST /entries — add entries to the list
  router.post("/", requireAuth, (req: Request, res: Response) => {
    try {
      const platform = param(req, "platform");
      const slug = param(req, "slug");
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const list = repos.moronList.findByPlatformAndSlug(platform, slug);
      if (list === null) {
        res.status(404).json({ error: "List not found" });
        return;
      }

      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      if (!canWriteList(list, userId)) {
        res.status(403).json({ error: "Only the list owner can add entries" });
        return;
      }

      const parsed = addEntriesBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation error",
          details: parsed.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }

      // Filter out duplicates (already on list via changelog)
      const toAdd = parsed.data.filter(
        (entry) => !isCurrentlyOnList(repos, platform, slug, entry.platformUserId)
      );

      const skipped = parsed.data.length - toAdd.length;

      if (toAdd.length === 0) {
        res.json({ added: 0, skipped });
        return;
      }

      // Increment version once for the whole batch
      const newVersion = repos.moronList.incrementVersion(platform, slug);

      // Write ADD changelog entries
      repos.changelog.createBatch(
        toAdd.map((entry) => ({
          listPlatform: platform,
          listSlug: slug,
          version: newVersion,
          action: "ADD" as const,
          platformUserId: entry.platformUserId,
          userId,
          reason: entry.reason,
        }))
      );

      // Update entry_count on the list
      repos.moronList.updateEntryCounts(platform, slug, toAdd.length, 0);

      res.status(201).json({ added: toAdd.length, skipped });
    } catch (error) {
      logger.error("Add entries error", error);
      res.status(500).json({ error: "Failed to add entries" });
    }
  });

  // DELETE /entries — remove entries from the list
  router.delete("/", requireAuth, (req: Request, res: Response) => {
    try {
      const platform = param(req, "platform");
      const slug = param(req, "slug");
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const list = repos.moronList.findByPlatformAndSlug(platform, slug);
      if (list === null) {
        res.status(404).json({ error: "List not found" });
        return;
      }

      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      if (!canWriteList(list, userId)) {
        res.status(403).json({ error: "Only the list owner can remove entries" });
        return;
      }

      const parsed = removeEntriesBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation error",
          details: parsed.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }

      // Filter to only those currently on the list
      const toRemove = parsed.data.filter((entry) =>
        isCurrentlyOnList(repos, platform, slug, entry.platformUserId)
      );

      const skipped = parsed.data.length - toRemove.length;

      if (toRemove.length === 0) {
        res.json({ removed: 0, skipped });
        return;
      }

      // Increment version once for the whole batch
      const newVersion = repos.moronList.incrementVersion(platform, slug);

      // Write REMOVE changelog entries
      repos.changelog.createBatch(
        toRemove.map((entry) => ({
          listPlatform: platform,
          listSlug: slug,
          version: newVersion,
          action: "REMOVE" as const,
          platformUserId: entry.platformUserId,
          userId,
        }))
      );

      // Update entry_count on the list
      repos.moronList.updateEntryCounts(platform, slug, -toRemove.length, 0);

      res.json({ removed: toRemove.length, skipped });
    } catch (error) {
      logger.error("Remove entries error", error);
      res.status(500).json({ error: "Failed to remove entries" });
    }
  });

  return router;
}

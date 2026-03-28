/**
 * Moron entry routes
 *
 * Routes:
 * - GET /api/morons/:platform/:slug/entries?offset=&limit=
 * - POST /api/morons/:platform/:slug/entries
 * - POST /api/morons/:platform/:slug/entries/batch
 * - DELETE /api/morons/:platform/:slug/entries/:entryId
 * - DELETE /api/morons/:platform/:slug/entries?platformUserId=
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  paginationQuery,
  createEntryBody,
  batchCreateEntriesBody,
  deleteEntryByPlatformUserQuery,
} from "../validation/schemas.js";
import { canReadList, canWriteList } from "../domain/moron-list.js";

export function createEntryRoutes(repos: Repositories): Router {
  const router = Router({ mergeParams: true });

  // GET /entries?offset=&limit=
  router.get("/", optionalAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug } = req.params;
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const list = repos.moronList.findByPlatformAndSlug(platform, slug);
      if (list === null) {
        res.status(404).json({ error: "List not found" });
        return;
      }

      const auth = (req as Request & { auth?: AuthenticatedRequest["auth"] }).auth;
      if (!canReadList(list, auth?.userId)) {
        res.status(404).json({ error: "List not found" });
        return;
      }

      const parsed = paginationQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid pagination parameters" });
        return;
      }

      const { offset, limit } = parsed.data;
      const entries = repos.moronEntry.findByList(platform, slug, offset, limit);
      const total = repos.moronEntry.countByList(platform, slug);

      res.json({
        entries: entries.map(formatEntry),
        total,
        offset,
        limit,
      });
    } catch (error) {
      logger.error("Get entries error", error);
      res.status(500).json({ error: "Failed to get entries" });
    }
  });

  // POST /entries
  router.post("/", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug } = req.params;
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

      const parsed = createEntryBody.safeParse(req.body);
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

      // Check if already exists
      const existing = repos.moronEntry.findByListAndPlatformUser(
        platform,
        slug,
        parsed.data.platformUserId
      );
      if (existing !== null) {
        res.status(409).json({ error: "User is already on this list" });
        return;
      }

      const entry = repos.moronEntry.create({
        listPlatform: platform,
        listSlug: slug,
        platformUserId: parsed.data.platformUserId,
        displayName: parsed.data.displayName,
        reason: parsed.data.reason,
        addedById: userId,
      });

      // Increment version and log changelog
      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.create({
        listPlatform: platform,
        listSlug: slug,
        version: newVersion,
        action: "ADD",
        platformUserId: parsed.data.platformUserId,
        userId,
      });

      res.status(201).json({ entry: formatEntry(entry) });
    } catch (error) {
      logger.error("Create entry error", error);
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  // POST /entries/batch
  router.post("/batch", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug } = req.params;
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

      const parsed = batchCreateEntriesBody.safeParse(req.body);
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

      // Filter out duplicates (already existing entries)
      const newEntries = parsed.data.entries.filter(
        (e) => repos.moronEntry.findByListAndPlatformUser(platform, slug, e.platformUserId) === null
      );

      if (newEntries.length === 0) {
        res.json({ entries: [], added: 0, skipped: parsed.data.entries.length });
        return;
      }

      const created = repos.moronEntry.createBatch(
        newEntries.map((e) => ({
          listPlatform: platform,
          listSlug: slug,
          platformUserId: e.platformUserId,
          displayName: e.displayName,
          reason: e.reason,
          addedById: userId,
        }))
      );

      // Increment version once and log changelog for each entry
      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.createBatch(
        created.map((entry) => ({
          listPlatform: platform,
          listSlug: slug,
          version: newVersion,
          action: "ADD" as const,
          platformUserId: entry.platformUserId,
          userId,
        }))
      );

      res.status(201).json({
        entries: created.map(formatEntry),
        added: created.length,
        skipped: parsed.data.entries.length - newEntries.length,
      });
    } catch (error) {
      logger.error("Batch create entries error", error);
      res.status(500).json({ error: "Failed to create entries" });
    }
  });

  // DELETE /entries/:entryId
  router.delete("/:entryId", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug, entryId } = req.params;
      if (platform === undefined || slug === undefined || entryId === undefined) {
        res.status(400).json({ error: "Platform, slug, and entry ID are required" });
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

      const entry = repos.moronEntry.findById(entryId);
      if (entry === null) {
        res.status(404).json({ error: "Entry not found" });
        return;
      }

      // Verify entry belongs to this list
      if (entry.listPlatform !== platform || entry.listSlug !== slug) {
        res.status(404).json({ error: "Entry not found in this list" });
        return;
      }

      repos.moronEntry.deleteById(entryId);

      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.create({
        listPlatform: platform,
        listSlug: slug,
        version: newVersion,
        action: "REMOVE",
        platformUserId: entry.platformUserId,
        userId,
      });

      res.json({ deleted: true });
    } catch (error) {
      logger.error("Delete entry error", error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // DELETE /entries?platformUserId= (must be registered after /:entryId)
  // Express will route DELETE with no extra path segments here when there's a query param
  // We handle this by checking if the request has a platformUserId query param in a middleware
  // Actually, Express 5 doesn't differentiate; we need to handle both cases in the same handler.
  // The /:entryId route above handles DELETE /entries/some-uuid
  // For DELETE /entries?platformUserId=xxx, we add a separate handler:
  router.delete("/", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug } = req.params;
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const parsed = deleteEntryByPlatformUserQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "platformUserId query parameter is required" });
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

      const { platformUserId } = parsed.data;
      const deleted = repos.moronEntry.deleteByPlatformUser(platform, slug, platformUserId);

      if (!deleted) {
        res.status(404).json({ error: "Entry not found for this platform user" });
        return;
      }

      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.create({
        listPlatform: platform,
        listSlug: slug,
        version: newVersion,
        action: "REMOVE",
        platformUserId,
        userId,
      });

      res.json({ deleted: true });
    } catch (error) {
      logger.error("Delete entry by platform user error", error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  return router;
}

function formatEntry(entry: {
  id: string;
  platformUserId: string;
  displayName: string | null;
  reason: string | null;
  addedById: string;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: entry.id,
    platformUserId: entry.platformUserId,
    displayName: entry.displayName,
    reason: entry.reason,
    addedById: entry.addedById,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * Saint entry routes
 *
 * Routes:
 * - GET /api/morons/:platform/:slug/saints?offset=&limit=
 * - POST /api/morons/:platform/:slug/saints
 * - POST /api/morons/:platform/:slug/saints/batch
 * - DELETE /api/morons/:platform/:slug/saints/:saintId
 * - DELETE /api/morons/:platform/:slug/saints?platformUserId=
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import {
  requireAuth,
  optionalAuth,
  type AuthenticatedRequest,
  type PersonaJWTPayload,
} from "../middleware/auth.js";
import {
  paginationQuery,
  createSaintBody,
  batchCreateSaintsBody,
  deleteSaintByPlatformUserQuery,
} from "../validation/schemas.js";
import { canReadList, canWriteList } from "../domain/moron-list.js";

export function createSaintRoutes(repos: Repositories): Router {
  const router = Router({ mergeParams: true });

  // GET /saints?offset=&limit=
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

      const auth = (req as AuthenticatedRequest).auth as PersonaJWTPayload | undefined;
      if (!canReadList(list, auth === undefined ? undefined : auth.userId)) {
        res.status(404).json({ error: "List not found" });
        return;
      }

      const parsed = paginationQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid pagination parameters" });
        return;
      }

      const { offset, limit } = parsed.data;
      const saints = repos.saintEntry.findByList(platform, slug, offset, limit);
      const total = repos.saintEntry.countByList(platform, slug);

      res.json({
        saints: saints.map(formatSaint),
        total,
        offset,
        limit,
      });
    } catch (error) {
      logger.error("Get saints error", error);
      res.status(500).json({ error: "Failed to get saints" });
    }
  });

  // POST /saints
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
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      if (!canWriteList(list, userId)) {
        res.status(403).json({ error: "Only the list owner can add saints" });
        return;
      }

      const parsed = createSaintBody.safeParse(req.body);
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
      const existing = repos.saintEntry.findByListAndPlatformUser(
        platform,
        slug,
        parsed.data.platformUserId
      );
      if (existing !== null) {
        res.status(409).json({ error: "User is already on the saint list" });
        return;
      }

      const saint = repos.saintEntry.create({
        listPlatform: platform,
        listSlug: slug,
        platformUserId: parsed.data.platformUserId,
        reason: parsed.data.reason,
        addedById: userId,
      });

      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.create({
        listPlatform: platform,
        listSlug: slug,
        version: newVersion,
        action: "ADD_SAINT",
        platformUserId: parsed.data.platformUserId,
        userId,
      });

      res.status(201).json({ saint: formatSaint(saint) });
    } catch (error) {
      logger.error("Create saint error", error);
      res.status(500).json({ error: "Failed to create saint" });
    }
  });

  // POST /saints/batch
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
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      if (!canWriteList(list, userId)) {
        res.status(403).json({ error: "Only the list owner can add saints" });
        return;
      }

      const parsed = batchCreateSaintsBody.safeParse(req.body);
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

      // Filter out duplicates
      const newSaints = parsed.data.saints.filter(
        (s) => repos.saintEntry.findByListAndPlatformUser(platform, slug, s.platformUserId) === null
      );

      if (newSaints.length === 0) {
        res.json({ saints: [], added: 0, skipped: parsed.data.saints.length });
        return;
      }

      const created = repos.saintEntry.createBatch(
        newSaints.map((s) => ({
          listPlatform: platform,
          listSlug: slug,
          platformUserId: s.platformUserId,
          reason: s.reason,
          addedById: userId,
        }))
      );

      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.createBatch(
        created.map((saint) => ({
          listPlatform: platform,
          listSlug: slug,
          version: newVersion,
          action: "ADD_SAINT" as const,
          platformUserId: saint.platformUserId,
          userId,
        }))
      );

      res.status(201).json({
        saints: created.map(formatSaint),
        added: created.length,
        skipped: parsed.data.saints.length - newSaints.length,
      });
    } catch (error) {
      logger.error("Batch create saints error", error);
      res.status(500).json({ error: "Failed to create saints" });
    }
  });

  // DELETE /saints/:saintId
  router.delete("/:saintId", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug, saintId } = req.params;
      if (platform === undefined || slug === undefined || saintId === undefined) {
        res.status(400).json({ error: "Platform, slug, and saint ID are required" });
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
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      if (!canWriteList(list, userId)) {
        res.status(403).json({ error: "Only the list owner can remove saints" });
        return;
      }

      const saint = repos.saintEntry.findById(saintId);
      if (saint === null) {
        res.status(404).json({ error: "Saint not found" });
        return;
      }

      if (saint.listPlatform !== platform || saint.listSlug !== slug) {
        res.status(404).json({ error: "Saint not found in this list" });
        return;
      }

      repos.saintEntry.deleteById(saintId);

      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.create({
        listPlatform: platform,
        listSlug: slug,
        version: newVersion,
        action: "REMOVE_SAINT",
        platformUserId: saint.platformUserId,
        userId,
      });

      res.json({ deleted: true });
    } catch (error) {
      logger.error("Delete saint error", error);
      res.status(500).json({ error: "Failed to delete saint" });
    }
  });

  // DELETE /saints?platformUserId=
  router.delete("/", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug } = req.params;
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const parsed = deleteSaintByPlatformUserQuery.safeParse(req.query);
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
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      if (!canWriteList(list, userId)) {
        res.status(403).json({ error: "Only the list owner can remove saints" });
        return;
      }

      const { platformUserId } = parsed.data;
      const deleted = repos.saintEntry.deleteByPlatformUser(platform, slug, platformUserId);

      if (!deleted) {
        res.status(404).json({ error: "Saint not found for this platform user" });
        return;
      }

      const newVersion = repos.moronList.incrementVersion(platform, slug);
      repos.changelog.create({
        listPlatform: platform,
        listSlug: slug,
        version: newVersion,
        action: "REMOVE_SAINT",
        platformUserId,
        userId,
      });

      res.json({ deleted: true });
    } catch (error) {
      logger.error("Delete saint by platform user error", error);
      res.status(500).json({ error: "Failed to delete saint" });
    }
  });

  return router;
}

function formatSaint(saint: {
  id: string;
  platformUserId: string;
  reason: string | null;
  addedById: string;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: saint.id,
    platformUserId: saint.platformUserId,
    reason: saint.reason,
    addedById: saint.addedById,
    createdAt: saint.createdAt.toISOString(),
  };
}

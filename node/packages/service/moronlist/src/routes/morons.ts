/**
 * Moron list CRUD routes
 *
 * Routes:
 * - POST /api/morons - create list
 * - PUT /api/morons/:platform/:slug - update list
 * - DELETE /api/morons/:platform/:slug - delete list
 * - POST /api/morons/:platform/:slug/actions/fork - fork list
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { param } from "../middleware/params.js";
import {
  createMoronListBody,
  updateMoronListBody,
  forkMoronListBody,
} from "../validation/schemas.js";
import { createList, updateList, deleteList, forkList } from "../domain/moron-list.js";

export function createMoronRoutes(repos: Repositories): Router {
  const router = Router();

  // POST /api/morons - create list
  router.post("/", requireAuth, (req: Request, res: Response) => {
    try {
      const parsed = createMoronListBody.safeParse(req.body);
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

      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const result = createList(repos, {
        platform: parsed.data.platform,
        slug: parsed.data.slug,
        ownerId: userId,
        name: parsed.data.name,
        description: parsed.data.description,
        visibility: parsed.data.visibility,
      });

      if (!result.success) {
        const status =
          result.error.code === "ALREADY_EXISTS"
            ? 409
            : result.error.code === "NOT_FOUND"
              ? 404
              : result.error.code === "FORBIDDEN"
                ? 403
                : 400;
        res.status(status).json({ error: result.error.message, code: result.error.code });
        return;
      }

      res.status(201).json({ list: formatList(result.data) });
    } catch (error) {
      logger.error("Create list error", error);
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  // PUT /api/morons/:platform/:slug - update list
  router.put("/:platform/:slug", requireAuth, (req: Request, res: Response) => {
    try {
      const platform = param(req, "platform");
      const slug = param(req, "slug");
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const parsed = updateMoronListBody.safeParse(req.body);
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

      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const result = updateList(repos, platform, slug, userId, parsed.data);

      if (!result.success) {
        const status =
          result.error.code === "NOT_FOUND" ? 404 : result.error.code === "FORBIDDEN" ? 403 : 400;
        res.status(status).json({ error: result.error.message, code: result.error.code });
        return;
      }

      res.json({ list: formatList(result.data) });
    } catch (error) {
      logger.error("Update list error", error);
      res.status(500).json({ error: "Failed to update list" });
    }
  });

  // DELETE /api/morons/:platform/:slug - delete list
  router.delete("/:platform/:slug", requireAuth, (req: Request, res: Response) => {
    try {
      const platform = param(req, "platform");
      const slug = param(req, "slug");
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      const userRole = auth.roles[0];
      const result = deleteList(repos, platform, slug, userId, userRole);

      if (!result.success) {
        const status =
          result.error.code === "NOT_FOUND" ? 404 : result.error.code === "FORBIDDEN" ? 403 : 400;
        res.status(status).json({ error: result.error.message, code: result.error.code });
        return;
      }

      res.json({ deleted: true });
    } catch (error) {
      logger.error("Delete list error", error);
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // POST /api/morons/:platform/:slug/actions/fork - fork list
  router.post("/:platform/:slug/actions/fork", requireAuth, (req: Request, res: Response) => {
    try {
      const platform = param(req, "platform");
      const slug = param(req, "slug");
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const parsed = forkMoronListBody.safeParse(req.body);
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

      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const result = forkList(repos, platform, slug, {
        slug: parsed.data.slug,
        name: parsed.data.name,
        userId,
      });

      if (!result.success) {
        const status =
          result.error.code === "NOT_FOUND"
            ? 404
            : result.error.code === "ALREADY_EXISTS"
              ? 409
              : result.error.code === "FORBIDDEN"
                ? 403
                : 400;
        res.status(status).json({ error: result.error.message, code: result.error.code });
        return;
      }

      res.status(201).json({ list: formatList(result.data) });
    } catch (error) {
      logger.error("Fork list error", error);
      res.status(500).json({ error: "Failed to fork list" });
    }
  });

  return router;
}

function formatList(list: {
  platform: string;
  slug: string;
  ownerId: string;
  name: string;
  description: string | null;
  visibility: string;
  version: number;
  forkedFromPlatform: string | null;
  forkedFromSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    platform: list.platform,
    slug: list.slug,
    id: `${list.platform}/${list.slug}`,
    ownerId: list.ownerId,
    name: list.name,
    description: list.description,
    visibility: list.visibility,
    version: list.version,
    forkedFrom:
      list.forkedFromPlatform !== null && list.forkedFromSlug !== null
        ? `${list.forkedFromPlatform}/${list.forkedFromSlug}`
        : null,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

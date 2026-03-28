/**
 * Inheritance routes
 *
 * Routes:
 * - GET /api/morons/:platform/:slug/parents
 * - PUT /api/morons/:platform/:slug/parents - full replace
 * - GET /api/morons/:platform/:slug/resolve - full ancestor tree
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
import { updateParentsBody } from "../validation/schemas.js";
import { setParents, resolveAncestorTree } from "../domain/inheritance.js";
import { canReadList } from "../domain/moron-list.js";

export function createInheritanceRoutes(repos: Repositories): Router {
  const router = Router({ mergeParams: true });

  // GET /parents
  router.get("/parents", optionalAuth, (req: Request, res: Response) => {
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

      const parentLinks = repos.inheritance.findParents(platform, slug);
      const parents = parentLinks.map((l) => {
        const parentList = repos.moronList.findByPlatformAndSlug(l.parentPlatform, l.parentSlug);
        return {
          platform: l.parentPlatform,
          slug: l.parentSlug,
          id: `${l.parentPlatform}/${l.parentSlug}`,
          name: parentList?.name ?? null,
          createdAt: l.createdAt.toISOString(),
        };
      });

      res.json({ parents });
    } catch (error) {
      logger.error("Get parents error", error);
      res.status(500).json({ error: "Failed to get parents" });
    }
  });

  // PUT /parents - full replace
  router.put("/parents", requireAuth, (req: Request, res: Response) => {
    try {
      const { platform, slug } = req.params;
      if (platform === undefined || slug === undefined) {
        res.status(400).json({ error: "Platform and slug are required" });
        return;
      }

      const parsed = updateParentsBody.safeParse(req.body);
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

      const result = setParents(repos, platform, slug, userId, parsed.data.parents);

      if (!result.success) {
        const status =
          result.error.code === "NOT_FOUND"
            ? 404
            : result.error.code === "FORBIDDEN"
              ? 403
              : result.error.code === "CYCLE_DETECTED"
                ? 409
                : result.error.code === "MAX_PARENTS_EXCEEDED"
                  ? 400
                  : result.error.code === "CANNOT_INHERIT_OWN_LIST"
                    ? 400
                    : result.error.code === "LIST_NOT_PUBLIC"
                      ? 400
                      : 400;
        res.status(status).json({ error: result.error.message, code: result.error.code });
        return;
      }

      const parentsList = result.data.map((p) => ({
        platform: p.platform,
        slug: p.slug,
        id: `${p.platform}/${p.slug}`,
      }));

      res.json({ parents: parentsList });
    } catch (error) {
      logger.error("Set parents error", error);
      res.status(500).json({ error: "Failed to set parents" });
    }
  });

  // GET /resolve - full ancestor tree
  router.get("/resolve", optionalAuth, (req: Request, res: Response) => {
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

      const result = resolveAncestorTree(repos, platform, slug);

      if (!result.success) {
        res.status(404).json({ error: result.error.message });
        return;
      }

      const ancestors = result.data.map((a) => ({
        platform: a.platform,
        slug: a.slug,
        id: `${a.platform}/${a.slug}`,
        name: a.name,
        depth: a.depth,
        parents: a.parents.map((p) => `${p.platform}/${p.slug}`),
      }));

      res.json({ ancestors });
    } catch (error) {
      logger.error("Resolve ancestors error", error);
      res.status(500).json({ error: "Failed to resolve ancestors" });
    }
  });

  return router;
}

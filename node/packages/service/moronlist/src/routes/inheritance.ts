/**
 * Inheritance routes
 *
 * Routes:
 * - PUT /api/morons/:platform/:slug/parents - full replace
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { param } from "../middleware/params.js";
import { updateParentsBody } from "../validation/schemas.js";
import { setParents } from "../domain/inheritance.js";

export function createInheritanceRoutes(repos: Repositories): Router {
  const router = Router({ mergeParams: true });

  // PUT /parents - full replace
  router.put("/parents", requireAuth, (req: Request, res: Response) => {
    try {
      const platform = param(req, "platform");
      const slug = param(req, "slug");
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

  return router;
}

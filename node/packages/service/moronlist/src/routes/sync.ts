/**
 * Sync routes (browser plugin)
 *
 * Routes:
 * - POST /api/v1/sync - sync subscribed lists
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { syncBody } from "../validation/schemas.js";
import { computeSync } from "../domain/sync.js";

export function createSyncRoutes(repos: Repositories): Router {
  const router = Router();

  // POST /api/v1/sync
  router.post("/", requireAuth, (req: Request, res: Response) => {
    try {
      const parsed = syncBody.safeParse(req.body);
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

      const result = computeSync(repos, userId, parsed.data.lists);

      res.json(result);
    } catch (error) {
      logger.error("Sync error", error);
      res.status(500).json({ error: "Failed to sync" });
    }
  });

  return router;
}

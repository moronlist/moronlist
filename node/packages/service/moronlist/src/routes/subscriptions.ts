/**
 * Subscription routes
 *
 * Routes:
 * - POST /api/subscriptions - subscribe to a list
 * - DELETE /api/subscriptions/:platform/:slug - unsubscribe from a list
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { param } from "../middleware/params.js";
import { createSubscriptionBody } from "../validation/schemas.js";
import { canReadList } from "../domain/moron-list.js";

export function createSubscriptionRoutes(repos: Repositories): Router {
  const router = Router();

  // POST /api/subscriptions
  router.post("/", requireAuth, (req: Request, res: Response) => {
    try {
      const parsed = createSubscriptionBody.safeParse(req.body);
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

      const { moronListId } = parsed.data;
      const slashIndex = moronListId.indexOf("/");
      const platform = moronListId.substring(0, slashIndex);
      const slug = moronListId.substring(slashIndex + 1);

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

      if (!canReadList(list, userId)) {
        res.status(404).json({ error: "List not found" });
        return;
      }

      const subscription = repos.subscription.subscribe(userId, platform, slug);

      res.status(201).json({
        subscription: {
          listPlatform: subscription.listPlatform,
          listSlug: subscription.listSlug,
          listId: `${subscription.listPlatform}/${subscription.listSlug}`,
          subscribedAt: subscription.subscribedAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Subscribe error", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // DELETE /api/subscriptions/:platform/:slug
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

      const deleted = repos.subscription.unsubscribe(userId, platform, slug);
      if (!deleted) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      res.json({ deleted: true });
    } catch (error) {
      logger.error("Unsubscribe error", error);
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  return router;
}

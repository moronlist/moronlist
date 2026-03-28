/**
 * User routes
 *
 * Routes:
 * - GET /api/users/:id - Get user by ID
 * - GET /api/users/:id/morons - Get public lists owned by user
 */

import { Router, type Request, type Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import { param } from "../middleware/params.js";

export function createUserRoutes(repos: Repositories): Router {
  const router = Router();

  // GET /api/users/:id
  router.get("/:id", (req: Request, res: Response) => {
    try {
      const userId = param(req, "id");
      if (userId === undefined || userId === "") {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      const user = repos.user.findById(userId);
      if (user === null) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Get user error", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // GET /api/users/:id/morons
  router.get("/:id/morons", (req: Request, res: Response) => {
    try {
      const userId = param(req, "id");
      if (userId === undefined || userId === "") {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      const user = repos.user.findById(userId);
      if (user === null) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const lists = repos.moronList.findByOwnerId(userId);
      // Only return public lists
      const publicLists = lists.filter((l) => l.visibility === "public");

      res.json({
        lists: publicLists.map((l) => ({
          platform: l.platform,
          slug: l.slug,
          name: l.name,
          description: l.description,
          visibility: l.visibility,
          version: l.version,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      logger.error("Get user lists error", error);
      res.status(500).json({ error: "Failed to get user lists" });
    }
  });

  return router;
}

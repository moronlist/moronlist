/**
 * Route wiring
 * Connects all route modules to the Express app
 */

import type { Express, Request, Response } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import type { PersonaClient } from "../services/persona-client.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { createAuthRoutes } from "./auth.js";
import { createUserRoutes } from "./users.js";
import { createMoronRoutes } from "./morons.js";
import { createEntryRoutes } from "./entries.js";
import { createSaintRoutes } from "./saints.js";
import { createInheritanceRoutes } from "./inheritance.js";
import { createSubscriptionRoutes } from "./subscriptions.js";
import { createSyncRoutes } from "./sync.js";

export function wireRoutes(app: Express, repos: Repositories, personaClient: PersonaClient): void {
  // Auth routes
  app.use("/auth", createAuthRoutes(repos, personaClient));
  logger.info("Auth routes enabled at /auth/*");

  // User routes
  app.use("/api/users", createUserRoutes(repos));
  logger.info("User routes enabled at /api/users/*");

  // My stuff routes (inline since they're small)
  // GET /api/me/morons
  app.get("/api/me/morons", requireAuth, (req: Request, res: Response) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const lists = repos.moronList.findByOwnerId(userId);

      res.json({
        lists: lists.map((l) => ({
          platform: l.platform,
          slug: l.slug,
          id: `${l.platform}/${l.slug}`,
          name: l.name,
          description: l.description,
          visibility: l.visibility,
          version: l.version,
          forkedFrom:
            l.forkedFromPlatform !== null && l.forkedFromSlug !== null
              ? `${l.forkedFromPlatform}/${l.forkedFromSlug}`
              : null,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      logger.error("Get my lists error", error);
      res.status(500).json({ error: "Failed to get lists" });
    }
  });

  // GET /api/me/subscriptions
  app.get("/api/me/subscriptions", requireAuth, (req: Request, res: Response) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      const userId = auth.userId;
      if (userId === undefined) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const subscriptions = repos.subscription.findByUser(userId);

      // Enrich with list details
      const enriched = subscriptions.map((sub) => {
        const list = repos.moronList.findByPlatformAndSlug(sub.listPlatform, sub.listSlug);
        return {
          listPlatform: sub.listPlatform,
          listSlug: sub.listSlug,
          listId: `${sub.listPlatform}/${sub.listSlug}`,
          listName: list?.name ?? null,
          listDescription: list?.description ?? null,
          listVersion: list?.version ?? null,
          subscribedAt: sub.subscribedAt.toISOString(),
        };
      });

      res.json({ subscriptions: enriched });
    } catch (error) {
      logger.error("Get my subscriptions error", error);
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  logger.info("My routes enabled at /api/me/*");

  // Moron list CRUD + browse routes
  app.use("/api/morons", createMoronRoutes(repos));
  logger.info("Moron list routes enabled at /api/morons/*");

  // Entry routes (nested under morons)
  app.use("/api/morons/:platform/:slug/entries", createEntryRoutes(repos));
  logger.info("Entry routes enabled at /api/morons/:platform/:slug/entries/*");

  // Saint routes (nested under morons)
  app.use("/api/morons/:platform/:slug/saints", createSaintRoutes(repos));
  logger.info("Saint routes enabled at /api/morons/:platform/:slug/saints/*");

  // Inheritance routes (nested under morons)
  app.use("/api/morons/:platform/:slug", createInheritanceRoutes(repos));
  logger.info("Inheritance routes enabled at /api/morons/:platform/:slug/(parents|resolve)");

  // Changelog route (inline since it's a single GET)
  app.get("/api/morons/:platform/:slug/changelog", (req: Request, res: Response) => {
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

      const sinceVersionRaw = req.query.sinceVersion;
      const limitRaw = req.query.limit;

      const sinceVersion =
        typeof sinceVersionRaw === "string" && sinceVersionRaw !== ""
          ? parseInt(sinceVersionRaw, 10)
          : undefined;
      const limit =
        typeof limitRaw === "string" && limitRaw !== ""
          ? Math.min(Math.max(parseInt(limitRaw, 10), 1), 1000)
          : 100;

      const entries = repos.changelog.findByList(platform, slug, sinceVersion, limit);

      res.json({
        changelog: entries.map((e) => ({
          id: e.id,
          version: e.version,
          action: e.action,
          platformUserId: e.platformUserId,
          userId: e.userId,
          createdAt: e.createdAt.toISOString(),
        })),
        currentVersion: list.version,
      });
    } catch (error) {
      logger.error("Get changelog error", error);
      res.status(500).json({ error: "Failed to get changelog" });
    }
  });
  logger.info("Changelog route enabled at /api/morons/:platform/:slug/changelog");

  // Subscription routes
  app.use("/api/subscriptions", createSubscriptionRoutes(repos));
  logger.info("Subscription routes enabled at /api/subscriptions/*");

  // Sync routes (plugin)
  app.use("/api/v1/sync", createSyncRoutes(repos));
  logger.info("Sync routes enabled at /api/v1/sync");
}

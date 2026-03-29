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
import { createMoronRoutes } from "./morons.js";
import { createEntryRoutes } from "./entries.js";
import { createSaintRoutes } from "./saints.js";
import { createInheritanceRoutes } from "./inheritance.js";
import { createSubscriptionRoutes } from "./subscriptions.js";

export function wireRoutes(app: Express, repos: Repositories, personaClient: PersonaClient): void {
  // Auth routes
  app.use("/auth", createAuthRoutes(repos, personaClient));
  logger.info("Auth routes enabled at /auth/*");

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

  // Moron list CRUD routes
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
  logger.info("Inheritance routes enabled at /api/morons/:platform/:slug/parents");

  // Subscription routes
  app.use("/api/subscriptions", createSubscriptionRoutes(repos));
  logger.info("Subscription routes enabled at /api/subscriptions/*");
}

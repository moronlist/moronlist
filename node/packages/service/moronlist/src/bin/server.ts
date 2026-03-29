#!/usr/bin/env node

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config as dotenvConfig } from "dotenv";

// Load environment variables FIRST
dotenvConfig();

// Now import config (which validates env vars)
import { config } from "../config.js";
import { logger } from "logger";

// Import repository factory
import { createRepositories } from "../repositories/sqlite/index.js";

// Import services
import { createPersonaClient } from "../services/persona-client.js";

// Import route wiring
import { wireRoutes } from "../routes/index.js";

// Import error handler
import { errorHandler } from "../middleware/error-handler.js";

function startServer(): void {
  try {
    // Initialize repositories
    logger.info("Initializing repositories...");
    const repositories = createRepositories(config.db.sqlite.dbPath);

    // Initialize Persona client
    const personaClient = createPersonaClient(config.persona);
    logger.info(`Persona client enabled: ${config.persona.serviceUrl}`);

    // Create Express app
    const app = express();

    // Trust proxy (for X-Forwarded-Proto behind nginx)
    if (config.isProduction) {
      app.set("trust proxy", 1);
    }

    // CORS — allow configured origins + any Chrome extension
    app.use(
      cors({
        origin: (origin, callback) => {
          if (
            origin === undefined ||
            config.server.corsOrigins.includes(origin) ||
            origin.startsWith("chrome-extension://")
          ) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        credentials: true,
      })
    );

    // Body parsing
    app.use(express.json({ limit: "10mb" }));
    app.use(cookieParser());

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    });

    // Wire all routes
    wireRoutes(app, repositories, personaClient);

    // Error handler (must be last)
    app.use(errorHandler);

    // Start server
    const { host, port } = config.server;

    app.listen(port, host, () => {
      logger.info(`MoronList server running at http://${host}:${String(port)}`);
      logger.info(`Health check: http://${host}:${String(port)}/health`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("\nReceived SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("\nReceived SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the server
startServer();

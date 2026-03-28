/**
 * Global test setup for MoronList integration tests.
 *
 * Creates a test Express app backed by a file-based SQLite database
 * (with Knex migrations applied), wires all routes, and exposes helpers
 * for auth tokens and test user creation.
 */

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import {
  createTestDatabase,
  cleanupTestDatabase,
  truncateAllTables,
  testLogger,
  generateId,
  insertTestUser,
  type TestDatabaseHandle,
} from "test-utils";
import { createRepositories } from "../src/repositories/sqlite/index.js";
import type { Repositories } from "../src/repositories/interfaces/index.js";
import type { PersonaClient } from "../src/services/persona-client.js";
import { wireRoutes } from "../src/routes/index.js";
import { errorHandler } from "../src/middleware/error-handler.js";

// ============================================
// Constants
// ============================================

const TEST_JWT_SECRET = "test-jwt-secret-for-moronlist-integration-tests";

// Ensure the config module picks up our test secret and required env vars
// These must be set BEFORE any config import in route files
process.env.NODE_ENV = "test";
process.env.PERSONA_JWT_SECRET = TEST_JWT_SECRET;
process.env.MORONLIST_SERVER_HOST = "localhost";
process.env.MORONLIST_SERVER_PORT = "0";
process.env.MORONLIST_DATA_DIR = "/tmp/moronlist-test";
process.env.PERSONA_URL = "http://localhost:19999";
process.env.PERSONA_INTERNAL_SECRET = "test-internal-secret";

// ============================================
// State
// ============================================

let dbHandle: TestDatabaseHandle | null = null;
let repos: Repositories | null = null;
let testApp: Express | null = null;

// ============================================
// App factory
// ============================================

function createMockPersonaClient(): PersonaClient {
  return {
    async linkIdentityToUser(identityId, userId, roles) {
      // Return a fresh token pair with the userId baked in
      const accessToken = createAuthToken({
        sub: identityId,
        userId,
        email: `${userId}@test.local`,
        roles,
      });
      return {
        success: true,
        data: {
          success: true,
          accessToken,
          refreshToken: `refresh-${identityId}`,
          identity: {
            id: identityId,
            tenantId: "test-tenant",
            userId,
            email: `${userId}@test.local`,
            roles,
          },
        },
      };
    },
    async updateUserRoles(_userId, _roles) {
      return { success: true, data: { success: true, updatedCount: 1 } };
    },
    async revokeUserSessions(_userId) {
      return { success: true, data: { success: true, revokedCount: 1 } };
    },
  };
}

async function buildApp(): Promise<Express> {
  dbHandle = await createTestDatabase(testLogger);
  repos = createRepositories(dbHandle.dbPath);

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy" });
  });

  const personaClient = createMockPersonaClient();
  wireRoutes(app, repos, personaClient);

  app.use(errorHandler);
  return app;
}

// ============================================
// Lifecycle
// ============================================

export async function setupTestEnvironment(): Promise<void> {
  testApp = await buildApp();
}

export async function teardownTestEnvironment(): Promise<void> {
  if (dbHandle !== null) {
    await cleanupTestDatabase(dbHandle, testLogger);
    dbHandle = null;
  }
  repos = null;
  testApp = null;
}

/**
 * Truncate every table so tests start with a clean slate.
 */
export function resetDatabase(): void {
  if (dbHandle === null) {
    throw new Error("Test database not initialised");
  }
  truncateAllTables(dbHandle.db, testLogger);
}

// ============================================
// Accessors
// ============================================

export function getApp(): Express {
  if (testApp === null) {
    throw new Error("Test app not initialised. Call setupTestEnvironment() first.");
  }
  return testApp;
}

export function getRepos(): Repositories {
  if (repos === null) {
    throw new Error("Repositories not initialised. Call setupTestEnvironment() first.");
  }
  return repos;
}

// ============================================
// Auth helpers
// ============================================

export type TokenOptions = {
  sub?: string;
  userId?: string;
  email?: string;
  name?: string;
  roles?: string[];
  tenant?: string;
  sessionId?: string;
};

/**
 * Create a signed JWT that the auth middleware will accept.
 */
export function createAuthToken(opts: TokenOptions = {}): string {
  const payload = {
    sub: opts.sub ?? generateId(),
    tenant: opts.tenant ?? "test-tenant",
    userId: opts.userId,
    email: opts.email ?? "test@test.local",
    name: opts.name ?? "Test User",
    roles: opts.roles ?? ["USER"],
    sessionId: opts.sessionId ?? generateId(),
  };

  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "1h" });
}

/**
 * Create an identity-only token (no userId) -- simulates pre-onboarding.
 */
export function createPendingToken(opts: { email?: string; name?: string } = {}): string {
  return createAuthToken({
    email: opts.email ?? "pending@test.local",
    name: opts.name ?? "Pending User",
    // deliberately omit userId
  });
}

// ============================================
// Fixture helpers
// ============================================

/**
 * Create a user in the database and return an auth token for that user.
 */
export function createTestUser(
  overrides: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  } = {}
): { userId: string; token: string } {
  const r = getRepos();
  const userId = overrides.id ?? generateId(12);
  const email = overrides.email ?? `${userId}@test.local`;
  const name = overrides.name ?? `User ${userId}`;
  const role = overrides.role ?? "USER";

  // Use the test-utils helper that inserts directly via db
  if (dbHandle === null) {
    throw new Error("Test database not initialised");
  }
  insertTestUser(dbHandle.db, {
    id: userId,
    email,
    name,
    role,
  });

  const token = createAuthToken({
    userId,
    email,
    name,
    roles: [role],
  });

  return { userId, token };
}

/**
 * Auth routes (Persona service integration)
 *
 * Routes:
 * - GET /auth/login - Redirect to Persona OAuth
 * - GET /auth/callback - OAuth callback (serves signed-in page)
 * - GET /auth/me - Get current user
 * - GET /auth/pending-profile - Check if user needs onboarding
 * - POST /auth/complete-onboarding - Create user and link to identity
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Router, type Request, type Response, type CookieOptions } from "express";
import { logger } from "logger";
import type { Repositories } from "../repositories/interfaces/index.js";
import type { PersonaClient } from "../services/persona-client.js";
import { extractAccessToken, verifyPersonaToken } from "../middleware/auth.js";
import { config } from "../config.js";
import { completeOnboardingBody } from "../validation/schemas.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const callbackHtmlPath = join(currentDir, "auth-callback.html");

function extractCookieDomain(hostname: string): string | undefined {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return undefined;
  }
  return `.${hostname.replace(/^www\./, "")}`;
}

function getCookieOptions(isProduction: boolean, domain?: string): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  if (domain !== undefined && domain !== "") {
    options.domain = domain;
  }
  return options;
}

function isRootUserEmail(email: string): boolean {
  return config.auth.rootUserEmails.includes(email.toLowerCase());
}

function buildCallbackHtml(token: string): string {
  // Escape the token for safe embedding in a script tag.
  // JSON.stringify handles quotes and special characters.
  const safeToken = JSON.stringify(token);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MoronList - Signed In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #ffffff; }
    p { font-size: 1rem; color: #a0a0b0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Signed in successfully!</h1>
    <p>This tab will close automatically.</p>
  </div>
  <script>window.location.hash = "token=" + ${safeToken};</script>
</body>
</html>`;
}

export function createAuthRoutes(repos: Repositories, personaClient: PersonaClient): Router {
  const router = Router();
  const cookieDomain = config.auth.cookieDomain ?? extractCookieDomain(config.server.host);
  const cookieOptions = getCookieOptions(config.isProduction, cookieDomain);

  // GET /auth/login
  // Redirects the browser to Persona's Google OAuth flow.
  // After OAuth completes, Persona redirects back to /auth/callback.
  router.get("/login", (_req: Request, res: Response) => {
    const callbackUrl = `${config.server.publicUrl}/auth/callback`;
    const personaOAuthUrl = `${config.persona.serviceUrl}/auth/google?redirect=${encodeURIComponent(callbackUrl)}`;
    res.redirect(personaOAuthUrl);
  });

  // GET /auth/callback
  // Persona redirects here after OAuth. Persona sets cookies on redirect.
  // If we can read access_token from the cookie, serve HTML that places
  // the token in the URL fragment so the Chrome plugin can read it from
  // the tab URL. Otherwise, serve the static HTML page as-is.
  router.get("/callback", (req: Request, res: Response) => {
    const cookies = typeof req.cookies === "object" ? (req.cookies as Record<string, string>) : {};
    const accessToken = cookies.access_token;

    if (typeof accessToken === "string" && accessToken !== "") {
      // Serve the callback page with an inline script that sets the fragment.
      // The Chrome plugin watches chrome.tabs.onUpdated for the #token= fragment.
      res.type("html").send(buildCallbackHtml(accessToken));
      return;
    }

    res.sendFile(callbackHtmlPath);
  });

  // GET /auth/pending-profile
  router.get("/pending-profile", (req: Request, res: Response) => {
    const accessToken = extractAccessToken(req);
    if (accessToken === null) {
      res.json({ profile: null });
      return;
    }

    const payload = verifyPersonaToken(accessToken);
    if (payload === null) {
      res.json({ profile: null });
      return;
    }

    if (payload.userId !== undefined) {
      res.json({ profile: null, alreadyOnboarded: true });
      return;
    }

    res.json({
      profile: {
        identityId: payload.sub,
        email: payload.email,
        name: payload.name,
      },
    });
  });

  // POST /auth/complete-onboarding
  router.post("/complete-onboarding", async (req: Request, res: Response) => {
    try {
      const accessToken = extractAccessToken(req);
      if (accessToken === null) {
        res.status(401).json({ error: "Not authenticated. Please sign in again." });
        return;
      }

      const payload = verifyPersonaToken(accessToken);
      if (payload === null) {
        res.status(401).json({ error: "Invalid token. Please sign in again." });
        return;
      }

      // Check if already onboarded
      if (payload.userId !== undefined) {
        const existingUser = repos.user.findById(payload.userId);
        if (existingUser !== null) {
          res.json({
            success: true,
            user: {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              role: existingUser.role,
              createdAt: existingUser.createdAt.toISOString(),
            },
            alreadyOnboarded: true,
          });
          return;
        }
      }

      // Validate body
      const parsed = completeOnboardingBody.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        res.status(400).json({
          error: firstError !== undefined ? firstError.message : "Validation error",
          field: firstError !== undefined ? firstError.path.join(".") : undefined,
        });
        return;
      }

      const { id: userId, name } = parsed.data;

      // Check if user ID is available
      if (!repos.user.isUserIdAvailable(userId)) {
        res.status(400).json({
          error: "User ID is already taken",
          field: "id",
        });
        return;
      }

      // Determine role
      const email = payload.email.toLowerCase();
      const role = isRootUserEmail(email) ? ("ROOT" as const) : undefined;

      // Create user
      const user = repos.user.create({
        id: userId,
        email,
        name,
        role,
      });

      logger.info("Created new user from onboarding", { userId: user.id, email });

      // Link identity to user via Persona service
      const roles = role !== undefined ? [role] : ["USER"];
      const linkResult = await personaClient.linkIdentityToUser(payload.sub, user.id, roles);

      if (!linkResult.success) {
        logger.error("Failed to link identity to user", linkResult.error, {
          userId: user.id,
          identityId: payload.sub,
        });
        res.status(500).json({ error: "Failed to complete onboarding. Please try again." });
        return;
      }

      // Set new tokens from Persona service
      res.cookie("access_token", linkResult.data.accessToken, cookieOptions);
      res.cookie("refresh_token", linkResult.data.refreshToken, cookieOptions);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Complete onboarding error", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // GET /auth/me
  router.get("/me", (req: Request, res: Response) => {
    try {
      const accessToken = extractAccessToken(req);
      if (accessToken === null) {
        res.status(401).json({ user: null });
        return;
      }

      const payload = verifyPersonaToken(accessToken);
      if (payload === null) {
        res.status(401).json({ user: null, error: "Invalid token" });
        return;
      }

      if (payload.userId === undefined) {
        res.json({
          user: null,
          needsOnboarding: true,
          identity: {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
          },
        });
        return;
      }

      const user = repos.user.findById(payload.userId);
      if (user === null) {
        res.status(401).json({ user: null });
        return;
      }

      if (user.banned) {
        res.status(403).json({
          user: null,
          banned: true,
          banReason: user.banReason,
        });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Get current user error", error);
      res.status(500).json({ user: null, error: "Failed to get user" });
    }
  });

  return router;
}

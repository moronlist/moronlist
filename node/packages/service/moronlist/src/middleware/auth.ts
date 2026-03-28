/**
 * JWT authentication middleware
 * Extracts JWT from Authorization header (Bearer) or access_token cookie,
 * verifies with Persona JWT secret, and attaches user info to request.
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

// JWT payload from Persona service
export type PersonaJWTPayload = {
  sub: string; // identityId
  tenant: string; // tenantId
  userId?: string;
  email: string;
  name?: string;
  profileImageUrl?: string;
  roles: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
};

// Extend Express Request with auth info
export type AuthenticatedRequest = Request & {
  auth: PersonaJWTPayload;
};

// Extract access token from request
export function extractAccessToken(req: Request): string | null {
  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ") === true) {
    return authHeader.slice(7);
  }
  // 2. Check cookie
  const cookies = req.cookies as Record<string, unknown> | undefined;
  if (cookies !== undefined) {
    const cookieToken: unknown = cookies.access_token;
    if (typeof cookieToken === "string" && cookieToken !== "") {
      return cookieToken;
    }
  }
  return null;
}

// Verify JWT from Persona service
export function verifyPersonaToken(token: string): PersonaJWTPayload | null {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as PersonaJWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Middleware that requires a valid JWT with a userId.
 * Rejects with 401 if not authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractAccessToken(req);
  if (token === null) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyPersonaToken(token);
  if (payload === null) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (payload.userId === undefined) {
    res.status(401).json({ error: "Onboarding not complete" });
    return;
  }

  (req as AuthenticatedRequest).auth = payload;
  next();
}

/**
 * Middleware that optionally attaches auth info if a valid JWT is present.
 * Does not reject unauthenticated requests.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractAccessToken(req);
  if (token !== null) {
    const payload = verifyPersonaToken(token);
    if (payload?.userId !== undefined) {
      (req as AuthenticatedRequest).auth = payload;
    }
  }
  next();
}

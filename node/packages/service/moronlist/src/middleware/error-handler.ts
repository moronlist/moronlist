/**
 * Express error handler middleware
 * Standard error response format for the API
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "logger";
import { ZodError } from "zod";

export type ErrorResponse = {
  error: string;
  code?: string;
  details?: unknown;
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    res.status(400).json({
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details,
    } satisfies ErrorResponse);
    return;
  }

  // Standard Error
  if (err instanceof Error) {
    logger.error("Unhandled error", err);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    } satisfies ErrorResponse);
    return;
  }

  // Unknown error shape
  logger.error("Unknown error type", err);
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  } satisfies ErrorResponse);
}

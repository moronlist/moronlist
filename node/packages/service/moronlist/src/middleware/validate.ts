/**
 * Zod validation middleware
 * Validates request body, query, or params against a Zod schema
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export type ValidationTarget = "body" | "query" | "params";

export function validate(schema: ZodSchema<unknown>, target: ValidationTarget = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data: unknown =
      target === "body" ? req.body : target === "query" ? req.query : req.params;
    const result = schema.safeParse(data);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details,
      });
      return;
    }

    // Replace the request data with parsed/transformed values
    if (target === "body") {
      req.body = result.data;
    } else if (target === "query") {
      (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
    } else {
      (req as Request & { validatedParams: unknown }).validatedParams = result.data;
    }

    next();
  };
}

/**
 * Express 5 param extraction helper
 *
 * In Express 5, req.params values are typed as `string | string[]` instead of
 * just `string`. This helper safely extracts a single string value from a
 * route param, returning undefined if the param is missing.
 */

import type { Request } from "express";

export function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

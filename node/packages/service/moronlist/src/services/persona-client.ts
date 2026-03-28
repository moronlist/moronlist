/**
 * Persona Service Client
 * Calls Persona's internal API for linking identities and managing sessions
 */

import { logger } from "logger";
import type { Result } from "../types.js";
import { success, failure, ErrorCode } from "../types.js";

export type PersonaClientConfig = {
  serviceUrl: string;
  internalSecret: string;
};

export type LinkIdentityResponse = {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  identity: {
    id: string;
    tenantId: string;
    userId: string;
    email: string;
    roles: string[];
  };
};

export type UpdateRolesResponse = {
  success: boolean;
  updatedCount: number;
};

export type RevokeSessionsResponse = {
  success: boolean;
  revokedCount: number;
};

export type PersonaClient = {
  linkIdentityToUser(
    identityId: string,
    userId: string,
    roles: string[]
  ): Promise<Result<LinkIdentityResponse>>;

  updateUserRoles(userId: string, roles: string[]): Promise<Result<UpdateRolesResponse>>;

  revokeUserSessions(userId: string): Promise<Result<RevokeSessionsResponse>>;
};

export function createPersonaClient(config: PersonaClientConfig): PersonaClient {
  const { serviceUrl, internalSecret } = config;
  const baseUrl = serviceUrl.endsWith("/") ? serviceUrl.slice(0, -1) : serviceUrl;

  async function callInternalApi<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<Result<T>> {
    try {
      const url = `${baseUrl}${path}`;
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": internalSecret,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
        logger.error("Persona API error", {
          path,
          status: response.status,
          error: errorBody.error,
        });
        return failure({
          code: response.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_ERROR,
          message: errorBody.error ?? `Persona API error: ${String(response.status)}`,
        });
      }

      const data = (await response.json()) as T;
      return success(data);
    } catch (error) {
      logger.error("Failed to call Persona API", error, { path });
      return failure({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: "Persona service unavailable",
      });
    }
  }

  return {
    async linkIdentityToUser(
      identityId: string,
      userId: string,
      roles: string[]
    ): Promise<Result<LinkIdentityResponse>> {
      return callInternalApi<LinkIdentityResponse>(
        "POST",
        `/internal/identity/${identityId}/link`,
        { userId, roles }
      );
    },

    async updateUserRoles(userId: string, roles: string[]): Promise<Result<UpdateRolesResponse>> {
      return callInternalApi<UpdateRolesResponse>("PUT", `/internal/user/${userId}/roles`, {
        roles,
      });
    },

    async revokeUserSessions(userId: string): Promise<Result<RevokeSessionsResponse>> {
      return callInternalApi<RevokeSessionsResponse>("DELETE", `/internal/user/${userId}/sessions`);
    },
  };
}

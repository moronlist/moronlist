import { join } from "path";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`ERROR: Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : defaultValue;
}

function optionalInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  return value !== undefined && value !== "" ? parseInt(value, 10) : defaultValue;
}

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

export const config = {
  // Environment
  isProduction,
  isTest,
  nodeEnv: optional("NODE_ENV", "development"),

  // Server
  server: {
    host: required("MORONLIST_SERVER_HOST"),
    port: optionalInt("MORONLIST_SERVER_PORT", 4100),
    corsOrigins: (process.env.MORONLIST_CORS_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // Database
  db: {
    dataDir: required("MORONLIST_DATA_DIR"),
    sqlite: {
      dbPath: join(required("MORONLIST_DATA_DIR"), "moronlist.db"),
    },
  },

  // Logging
  logging: {
    level: optional("LOG_LEVEL", "info"),
    fileDir: process.env.MORONLIST_LOG_FILE_DIR,
  },

  // JWT & Auth
  auth: {
    jwtSecret: required("PERSONA_JWT_SECRET"),
    cookieDomain: process.env.COOKIE_DOMAIN,
    rootUserEmails: (process.env.ROOT_USER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  },

  // Persona service (required for authentication)
  persona: {
    serviceUrl: required("PERSONA_URL"),
    internalSecret: required("PERSONA_INTERNAL_SECRET"),
  },
};

export type Config = typeof config;

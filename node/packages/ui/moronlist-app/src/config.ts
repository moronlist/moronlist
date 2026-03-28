// Environment variables are set at build time via Vite
// Production values come from .env.production or command-line VITE_* vars
// Local dev values come from .env

function required(name: string): string {
  const value: unknown = import.meta.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Required environment variable ${name} is not set. ` +
        `For local dev, create .env file. For production builds, set VITE_* env vars.`
    );
  }
  return value;
}

// API URL (e.g., https://api.moronlist.com or http://localhost:6000)
export const API_URL = required("VITE_API_URL");

// Persona URL (e.g., https://persona.moronlist.com or http://localhost:6005)
export const PERSONA_URL = required("VITE_PERSONA_URL");

// Site URL (e.g., https://moronlist.com or http://localhost:3000) - used for redirect URLs
// Falls back to window.location.origin if not set
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin;

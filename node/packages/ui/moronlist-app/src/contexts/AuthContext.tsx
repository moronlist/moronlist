import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { API_URL, PERSONA_URL } from "../config.js";

// Track if a token refresh is in progress to avoid concurrent refreshes
let refreshInProgress: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the refresh token cookie.
 * Returns true if refresh succeeded, false otherwise.
 * This is a singleton operation - concurrent calls will wait for the same refresh.
 */
export async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshInProgress !== null) {
    return refreshInProgress;
  }

  refreshInProgress = (async () => {
    try {
      const response = await fetch(`${PERSONA_URL}/token/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  isBanned: boolean;
  banReason: string | null;
};

type AuthContextType = AuthState & {
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AUTH_STORAGE_KEY = "moronlist_user";

const AuthContext = createContext<AuthContextType | null>(null);

function storeUser(user: User | null) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    needsOnboarding: false,
    isBanned: false,
    banReason: null,
  });

  const refreshUser = useCallback(async () => {
    const fetchUser = async (): Promise<Response> => {
      return fetch(`${API_URL}/auth/me`, {
        credentials: "include",
      });
    };

    try {
      let response = await fetchUser();

      // If unauthorized, attempt token refresh and retry once
      if (response.status === 401) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          response = await fetchUser();
        }
      }

      if (response.ok) {
        const data = (await response.json()) as {
          user?: User | null;
          needsOnboarding?: boolean;
        };
        if (data.user !== undefined && data.user !== null) {
          storeUser(data.user);
          setState({
            user: data.user,
            isLoading: false,
            isAuthenticated: true,
            needsOnboarding: false,
            isBanned: false,
            banReason: null,
          });
          return;
        }

        // Authenticated via Persona but no MoronList user yet (needs onboarding)
        if (data.needsOnboarding === true) {
          storeUser(null);
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: true,
            needsOnboarding: true,
            isBanned: false,
            banReason: null,
          });
          return;
        }
      }

      // Check if user is banned (403 response)
      if (response.status === 403) {
        const data = (await response.json()) as { banned?: boolean; banReason?: string };
        if (data.banned === true) {
          storeUser(null);
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            needsOnboarding: false,
            isBanned: true,
            banReason: data.banReason ?? null,
          });
          return;
        }
      }

      // User not found on server, clear local storage
      storeUser(null);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        needsOnboarding: false,
        isBanned: false,
        banReason: null,
      });
    } catch {
      storeUser(null);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        needsOnboarding: false,
        isBanned: false,
        banReason: null,
      });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${PERSONA_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore errors, still clear local state
    }
    storeUser(null);
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      needsOnboarding: false,
      isBanned: false,
      banReason: null,
    });
  }, []);

  // Initial user fetch
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

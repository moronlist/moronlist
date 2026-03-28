import { getApiUrl, getAuthToken } from "./storage.js";

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
};

export type Subscription = {
  id: string;
  moronListId: string;
  platform: string;
  slug: string;
  name: string;
  entryCount: number;
  saintCount: number;
  version: number;
};

export type SyncDelta = {
  listId: string;
  platform: string;
  slug: string;
  version: number;
  snapshot: boolean;
  entries: {
    added: Array<{ platformUserId: string; reason: string | null }>;
    removed: string[];
  };
  saints: {
    added: Array<{ platformUserId: string; reason: string | null }>;
    removed: string[];
  };
  inherits: Array<{ platform: string; slug: string }>;
};

export type SyncResponse = {
  deltas: SyncDelta[];
};

export type MoronEntry = {
  id: string;
  platformUserId: string;
  platform: string;
  reason: string | null;
  addedById: string;
  createdAt: string;
};

async function buildHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = await getAuthToken();
  if (token !== null) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<Result<T>> {
  const apiUrl = await getApiUrl();
  const headers = await buildHeaders();
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> | undefined),
      },
      credentials: "include",
    });
    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${body}` };
    }
    if (response.status === 204) {
      return { success: true, data: undefined as T };
    }
    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function fetchMe(): Promise<Result<User>> {
  return apiRequest<User>("/auth/me");
}

export async function fetchMySubscriptions(): Promise<Result<Subscription[]>> {
  return apiRequest<Subscription[]>("/api/me/subscriptions");
}

export async function sync(lists: Record<string, number>): Promise<Result<SyncResponse>> {
  return apiRequest<SyncResponse>("/api/v1/sync", {
    method: "POST",
    body: JSON.stringify({ lists }),
  });
}

export async function addEntry(
  platform: string,
  slug: string,
  data: { platformUserId: string; reason?: string }
): Promise<Result<MoronEntry>> {
  return apiRequest<MoronEntry>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function removeEntryByUser(
  platform: string,
  slug: string,
  platformUserId: string
): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries?platformUserId=${encodeURIComponent(platformUserId)}`,
    { method: "DELETE" }
  );
}

export async function addSaint(
  platform: string,
  slug: string,
  data: { platformUserId: string; reason?: string }
): Promise<Result<MoronEntry>> {
  return apiRequest<MoronEntry>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function removeSaintByUser(
  platform: string,
  slug: string,
  platformUserId: string
): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints?platformUserId=${encodeURIComponent(platformUserId)}`,
    { method: "DELETE" }
  );
}

export async function subscribe(moronListId: string): Promise<Result<Subscription>> {
  return apiRequest<Subscription>("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify({ moronListId }),
  });
}

export async function unsubscribe(platform: string, slug: string): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/subscriptions/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}

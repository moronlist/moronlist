import { getApiUrl, getAuthToken, getDataUrl } from "./storage.js";

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export type User = {
  id: string;
  name: string;
  email: string;
};

export type MoronList = {
  id: string;
  platform: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
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

export type ListMeta = {
  version: number;
  fileCount: number;
  updatedAt: string;
};

export type BatchResult = {
  added: number;
  skipped: number;
};

export type RemoveBatchResult = {
  removed: number;
  skipped: number;
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

// Auth

export async function fetchMe(): Promise<Result<User>> {
  return apiRequest<User>("/auth/me");
}

export async function completeOnboarding(id: string, name: string): Promise<Result<User>> {
  return apiRequest<User>(`/auth/onboarding`, {
    method: "POST",
    body: JSON.stringify({ id, name }),
  });
}

// Lists

export async function createList(data: {
  platform: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: string;
}): Promise<Result<MoronList>> {
  return apiRequest<MoronList>("/api/lists", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateList(
  platform: string,
  slug: string,
  data: { name?: string; description?: string; visibility?: string }
): Promise<Result<MoronList>> {
  return apiRequest<MoronList>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteList(platform: string, slug: string): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}

export async function forkList(
  platform: string,
  slug: string,
  newSlug: string,
  newName?: string
): Promise<Result<MoronList>> {
  return apiRequest<MoronList>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/fork`,
    {
      method: "POST",
      body: JSON.stringify({ slug: newSlug, name: newName }),
    }
  );
}

// Inheritance

export async function setParents(
  platform: string,
  slug: string,
  parents: string[]
): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/parents`,
    {
      method: "PUT",
      body: JSON.stringify({ parents }),
    }
  );
}

// Entries (array bodies)

export async function addEntries(
  platform: string,
  slug: string,
  entries: Array<{ platformUserId: string; reason?: string }>
): Promise<Result<BatchResult>> {
  return apiRequest<BatchResult>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries`,
    {
      method: "POST",
      body: JSON.stringify(entries),
    }
  );
}

export async function removeEntries(
  platform: string,
  slug: string,
  entries: Array<{ platformUserId: string }>
): Promise<Result<RemoveBatchResult>> {
  return apiRequest<RemoveBatchResult>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries`,
    {
      method: "DELETE",
      body: JSON.stringify(entries),
    }
  );
}

// Saints (array bodies)

export async function addSaints(
  platform: string,
  slug: string,
  saints: Array<{ platformUserId: string; reason?: string }>
): Promise<Result<BatchResult>> {
  return apiRequest<BatchResult>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints`,
    {
      method: "POST",
      body: JSON.stringify(saints),
    }
  );
}

export async function removeSaints(
  platform: string,
  slug: string,
  saints: Array<{ platformUserId: string }>
): Promise<Result<RemoveBatchResult>> {
  return apiRequest<RemoveBatchResult>(
    `/api/lists/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints`,
    {
      method: "DELETE",
      body: JSON.stringify(saints),
    }
  );
}

// Subscriptions

export async function subscribe(moronListId: string): Promise<Result<void>> {
  return apiRequest<void>("/api/subscriptions", {
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

// My stuff

export async function fetchMyLists(): Promise<Result<MoronList[]>> {
  return apiRequest<MoronList[]>("/api/me/lists");
}

export async function fetchMySubscriptions(): Promise<Result<Subscription[]>> {
  return apiRequest<Subscription[]>("/api/me/subscriptions");
}

// Static data (from data.moronlist.com)

export async function fetchMeta(platform: string, slug: string): Promise<Result<ListMeta>> {
  const dataUrl = await getDataUrl();
  try {
    const response = await fetch(
      `${dataUrl}/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/meta.json`
    );
    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${body}` };
    }
    const data = (await response.json()) as ListMeta;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function fetchTxtFile(
  platform: string,
  slug: string,
  fileIndex: number
): Promise<Result<string>> {
  const dataUrl = await getDataUrl();
  try {
    const response = await fetch(
      `${dataUrl}/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/${fileIndex}.txt`
    );
    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${body}` };
    }
    const text = await response.text();
    return { success: true, data: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

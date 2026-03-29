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
};

export type Subscription = {
  listId: string;
  listPlatform: string;
  listSlug: string;
  listName: string;
  subscribedAt: string;
};

export type ListMeta = {
  platform: string;
  slug: string;
  name: string;
  version: number;
  entries: number;
  files: number;
  parents?: ParentNode[];
};

export type ParentNode = {
  platform: string;
  slug: string;
  parents?: ParentNode[];
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
      return { success: false, error: `HTTP ${String(response.status)}: ${body}` };
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

// Server returns: { user: User | null, needsOnboarding?: boolean, identity?: {...} }
export type MeResponse = {
  user: User | null;
  needsOnboarding?: boolean;
  identity?: { id: string; email: string; name?: string };
};

export async function fetchMe(): Promise<Result<MeResponse>> {
  return apiRequest<MeResponse>("/auth/me");
}

// Server returns: { success: true, user: User }
export async function completeOnboarding(id: string, name: string): Promise<Result<User>> {
  const result = await apiRequest<{ success: boolean; user: User }>("/auth/complete-onboarding", {
    method: "POST",
    body: JSON.stringify({ id, name }),
  });
  if (!result.success) return result;
  return { success: true, data: result.data.user };
}

// Lists

// Server returns: { list: MoronList } with 201
export async function createList(data: {
  platform: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: string;
}): Promise<Result<MoronList>> {
  const result = await apiRequest<{ list: MoronList }>("/api/morons", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.success) return result;
  return { success: true, data: result.data.list };
}

// Server returns: { list: MoronList }
export async function updateList(
  platform: string,
  slug: string,
  data: { name?: string; description?: string; visibility?: string }
): Promise<Result<MoronList>> {
  const result = await apiRequest<{ list: MoronList }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  if (!result.success) return result;
  return { success: true, data: result.data.list };
}

// Server returns: { deleted: true }
export async function deleteList(platform: string, slug: string): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}

// Server returns: { list: MoronList } with 201
export async function forkList(
  platform: string,
  slug: string,
  newSlug: string,
  newName?: string
): Promise<Result<MoronList>> {
  const result = await apiRequest<{ list: MoronList }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/actions/fork`,
    {
      method: "POST",
      body: JSON.stringify({ slug: newSlug, name: newName }),
    }
  );
  if (!result.success) return result;
  return { success: true, data: result.data.list };
}

// Inheritance

// Server returns: { parents: [...] }
export async function setParents(
  platform: string,
  slug: string,
  parents: string[]
): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/parents`,
    {
      method: "PUT",
      body: JSON.stringify({ parents }),
    }
  );
}

// Entries (array bodies)

// Server returns: { added: N, skipped: M }
export async function addEntries(
  platform: string,
  slug: string,
  entries: Array<{ platformUserId: string; reason?: string }>
): Promise<Result<BatchResult>> {
  return apiRequest<BatchResult>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries`,
    {
      method: "POST",
      body: JSON.stringify(entries),
    }
  );
}

// Server returns: { removed: N, skipped: M }
export async function removeEntries(
  platform: string,
  slug: string,
  entries: Array<{ platformUserId: string }>
): Promise<Result<RemoveBatchResult>> {
  return apiRequest<RemoveBatchResult>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries`,
    {
      method: "DELETE",
      body: JSON.stringify(entries),
    }
  );
}

// Saints (array bodies)

// Server returns: { added: N, skipped: M }
export async function addSaints(
  platform: string,
  slug: string,
  saints: Array<{ platformUserId: string; reason?: string }>
): Promise<Result<BatchResult>> {
  return apiRequest<BatchResult>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints`,
    {
      method: "POST",
      body: JSON.stringify(saints),
    }
  );
}

// Server returns: { removed: N, skipped: M }
export async function removeSaints(
  platform: string,
  slug: string,
  saints: Array<{ platformUserId: string }>
): Promise<Result<RemoveBatchResult>> {
  return apiRequest<RemoveBatchResult>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints`,
    {
      method: "DELETE",
      body: JSON.stringify(saints),
    }
  );
}

// Subscriptions

// Server returns: { subscription: {...} } with 201
export async function subscribe(moronListId: string): Promise<Result<void>> {
  return apiRequest<void>("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify({ moronListId }),
  });
}

// Server returns: { deleted: true }
export async function unsubscribe(platform: string, slug: string): Promise<Result<void>> {
  return apiRequest<void>(
    `/api/subscriptions/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}

// My stuff

// Server returns: { lists: MoronList[] }
export async function fetchMyLists(): Promise<Result<MoronList[]>> {
  const result = await apiRequest<{ lists: MoronList[] }>("/api/me/morons");
  if (!result.success) return result;
  return { success: true, data: result.data.lists };
}

// Server returns: { subscriptions: Subscription[] }
export async function fetchMySubscriptions(): Promise<Result<Subscription[]>> {
  const result = await apiRequest<{ subscriptions: Subscription[] }>("/api/me/subscriptions");
  if (!result.success) return result;
  return { success: true, data: result.data.subscriptions };
}

// Static data (from data.moronlist.com)

export async function fetchMeta(platform: string, slug: string): Promise<Result<ListMeta>> {
  const dataUrl = await getDataUrl();
  try {
    const response = await fetch(
      `${dataUrl}/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/meta.json`
    );
    if (!response.ok) {
      return { success: false, error: `HTTP ${String(response.status)}` };
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
      `${dataUrl}/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/${String(fileIndex)}.txt`
    );
    if (!response.ok) {
      return { success: false, error: `HTTP ${String(response.status)}` };
    }
    const text = await response.text();
    return { success: true, data: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

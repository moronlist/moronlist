/**
 * API client for the MoronList server.
 * All functions use fetch with credentials: "include" for cookie-based auth.
 */

import { API_URL } from "@/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

export type PendingProfile = {
  identityId: string;
  email: string;
  name: string | null;
};

export type MoronList = {
  platform: string;
  slug: string;
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  visibility: string;
  version: number;
  forkedFrom: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MoronListDetail = MoronList & {
  entryCount: number;
  saintCount: number;
  subscriberCount: number;
  isOwner: boolean;
  isSubscribed: boolean;
};

export type MoronEntry = {
  id: string;
  platformUserId: string;
  displayName: string | null;
  reason: string | null;
  addedById: string;
  createdAt: string;
};

export type SaintEntry = {
  id: string;
  platformUserId: string;
  reason: string | null;
  addedById: string;
  createdAt: string;
};

export type ChangelogEntry = {
  id: string;
  version: number;
  action: string;
  platformUserId: string;
  userId: string;
  createdAt: string;
};

export type Parent = {
  platform: string;
  slug: string;
  id: string;
  name: string | null;
  createdAt: string;
};

export type Ancestor = {
  platform: string;
  slug: string;
  id: string;
  name: string | null;
  depth: number;
  parents: string[];
};

export type Subscription = {
  listPlatform: string;
  listSlug: string;
  listId: string;
  listName: string | null;
  listDescription: string | null;
  listVersion: number | null;
  subscribedAt: string;
};

export type MyList = {
  platform: string;
  slug: string;
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  version: number;
  forkedFrom: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export type PublicList = {
  platform: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof body.error === "string" ? body.error : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function fetchMe(): Promise<{
  user: User | null;
  needsOnboarding?: boolean;
}> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    return { user: null };
  }

  if (response.status === 403) {
    const data = (await response.json()) as { banned?: boolean; banReason?: string };
    if (data.banned === true) {
      throw new ApiError("User is banned", 403, data as Record<string, unknown>);
    }
    return { user: null };
  }

  if (!response.ok) {
    return { user: null };
  }

  return response.json() as Promise<{ user: User | null; needsOnboarding?: boolean }>;
}

export async function fetchPendingProfile(): Promise<PendingProfile | null> {
  const data = await apiFetch<{ profile: PendingProfile | null }>("/auth/pending-profile");
  return data.profile;
}

export async function completeOnboarding(params: {
  id: string;
  name: string;
}): Promise<{ user: User }> {
  return apiFetch<{ user: User }>("/auth/complete-onboarding", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function fetchUser(userId: string): Promise<PublicUser> {
  const data = await apiFetch<{ user: PublicUser }>(`/api/users/${encodeURIComponent(userId)}`);
  return data.user;
}

export async function fetchUserMorons(userId: string): Promise<PublicList[]> {
  const data = await apiFetch<{ lists: PublicList[] }>(
    `/api/users/${encodeURIComponent(userId)}/morons`
  );
  return data.lists;
}

// ---------------------------------------------------------------------------
// Moron Lists CRUD
// ---------------------------------------------------------------------------

export async function createMoronList(params: {
  platform: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: string;
}): Promise<MoronList> {
  const data = await apiFetch<{ list: MoronList }>("/api/morons", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data.list;
}

export async function fetchMoronList(platform: string, slug: string): Promise<MoronListDetail> {
  const data = await apiFetch<{ list: MoronListDetail }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`
  );
  return data.list;
}

export async function updateMoronList(
  platform: string,
  slug: string,
  params: { name?: string; description?: string; visibility?: string }
): Promise<MoronList> {
  const data = await apiFetch<{ list: MoronList }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    {
      method: "PUT",
      body: JSON.stringify(params),
    }
  );
  return data.list;
}

export async function deleteMoronList(platform: string, slug: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}

export async function forkMoronList(
  platform: string,
  slug: string,
  params: { slug: string; name?: string }
): Promise<MoronList> {
  const data = await apiFetch<{ list: MoronList }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/fork`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  return data.list;
}

// ---------------------------------------------------------------------------
// Browse / Search / Popular
// ---------------------------------------------------------------------------

export async function browsePlatform(
  platform: string,
  offset = 0,
  limit = 20
): Promise<{ lists: MoronList[]; total: number; offset: number; limit: number }> {
  return apiFetch(`/api/morons/${encodeURIComponent(platform)}?offset=${offset}&limit=${limit}`);
}

export async function searchPlatform(
  platform: string,
  query: string,
  offset = 0,
  limit = 20
): Promise<{ lists: MoronList[]; offset: number; limit: number }> {
  return apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`
  );
}

export async function popularOnPlatform(
  platform: string,
  offset = 0,
  limit = 20
): Promise<{ lists: MoronList[]; offset: number; limit: number }> {
  return apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/popular?offset=${offset}&limit=${limit}`
  );
}

// ---------------------------------------------------------------------------
// My stuff
// ---------------------------------------------------------------------------

export async function fetchMyMorons(): Promise<MyList[]> {
  const data = await apiFetch<{ lists: MyList[] }>("/api/me/morons");
  return data.lists;
}

export async function fetchMySubscriptions(): Promise<Subscription[]> {
  const data = await apiFetch<{ subscriptions: Subscription[] }>("/api/me/subscriptions");
  return data.subscriptions;
}

// ---------------------------------------------------------------------------
// Parents / Inheritance
// ---------------------------------------------------------------------------

export async function fetchParents(platform: string, slug: string): Promise<Parent[]> {
  const data = await apiFetch<{ parents: Parent[] }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/parents`
  );
  return data.parents;
}

export async function setParents(
  platform: string,
  slug: string,
  parents: Array<{ platform: string; slug: string }>
): Promise<Array<{ platform: string; slug: string; id: string }>> {
  const data = await apiFetch<{ parents: Array<{ platform: string; slug: string; id: string }> }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/parents`,
    {
      method: "PUT",
      body: JSON.stringify({ parents }),
    }
  );
  return data.parents;
}

export async function resolveInheritance(platform: string, slug: string): Promise<Ancestor[]> {
  const data = await apiFetch<{ ancestors: Ancestor[] }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/resolve`
  );
  return data.ancestors;
}

// ---------------------------------------------------------------------------
// Entries (moron list entries)
// ---------------------------------------------------------------------------

export async function fetchEntries(
  platform: string,
  slug: string,
  offset = 0,
  limit = 50
): Promise<{ entries: MoronEntry[]; total: number; offset: number; limit: number }> {
  return apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries?offset=${offset}&limit=${limit}`
  );
}

export async function addEntry(
  platform: string,
  slug: string,
  params: { platformUserId: string; displayName?: string; reason?: string }
): Promise<MoronEntry> {
  const data = await apiFetch<{ entry: MoronEntry }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  return data.entry;
}

export async function addEntriesBatch(
  platform: string,
  slug: string,
  entries: Array<{ platformUserId: string; displayName?: string; reason?: string }>
): Promise<{ entries: MoronEntry[]; added: number; skipped: number }> {
  return apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries/batch`,
    {
      method: "POST",
      body: JSON.stringify({ entries }),
    }
  );
}

export async function removeEntry(platform: string, slug: string, entryId: string): Promise<void> {
  await apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries/${encodeURIComponent(entryId)}`,
    { method: "DELETE" }
  );
}

export async function removeEntryByUser(
  platform: string,
  slug: string,
  platformUserId: string
): Promise<void> {
  await apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/entries?platformUserId=${encodeURIComponent(platformUserId)}`,
    { method: "DELETE" }
  );
}

// ---------------------------------------------------------------------------
// Saints
// ---------------------------------------------------------------------------

export async function fetchSaints(
  platform: string,
  slug: string,
  offset = 0,
  limit = 50
): Promise<{ saints: SaintEntry[]; total: number; offset: number; limit: number }> {
  return apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints?offset=${offset}&limit=${limit}`
  );
}

export async function addSaint(
  platform: string,
  slug: string,
  params: { platformUserId: string; reason?: string }
): Promise<SaintEntry> {
  const data = await apiFetch<{ saint: SaintEntry }>(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  return data.saint;
}

export async function addSaintsBatch(
  platform: string,
  slug: string,
  saints: Array<{ platformUserId: string; reason?: string }>
): Promise<{ saints: SaintEntry[]; added: number; skipped: number }> {
  return apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints/batch`,
    {
      method: "POST",
      body: JSON.stringify({ saints }),
    }
  );
}

export async function removeSaint(platform: string, slug: string, saintId: string): Promise<void> {
  await apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints/${encodeURIComponent(saintId)}`,
    { method: "DELETE" }
  );
}

export async function removeSaintByUser(
  platform: string,
  slug: string,
  platformUserId: string
): Promise<void> {
  await apiFetch(
    `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/saints?platformUserId=${encodeURIComponent(platformUserId)}`,
    { method: "DELETE" }
  );
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

export async function fetchChangelog(
  platform: string,
  slug: string,
  sinceVersion?: number,
  limit = 100
): Promise<{ changelog: ChangelogEntry[]; currentVersion: number }> {
  let url = `/api/morons/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}/changelog?limit=${limit}`;
  if (sinceVersion !== undefined) {
    url += `&sinceVersion=${sinceVersion}`;
  }
  return apiFetch(url);
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function subscribe(
  platform: string,
  slug: string
): Promise<{ listPlatform: string; listSlug: string; listId: string; subscribedAt: string }> {
  const data = await apiFetch<{
    subscription: { listPlatform: string; listSlug: string; listId: string; subscribedAt: string };
  }>("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify({ moronListId: `${platform}/${slug}` }),
  });
  return data.subscription;
}

export async function unsubscribe(platform: string, slug: string): Promise<void> {
  await apiFetch(`/api/subscriptions/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

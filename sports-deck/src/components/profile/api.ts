import type {
  ProfileActivityChartResponse,
  ProfileActivityPost,
  ProfileActivityThread,
  ProfileByUsernameResponse,
  ProfileTeamRef,
} from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export type TeamListItem = Pick<ProfileTeamRef, "id" | "name" | "shortName" | "slug" | "crest">;

export async function fetchTeamsForProfile(): Promise<TeamListItem[]> {
  const res = await fetch("/api/teams", { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to load teams");
  }
  const list = (await res.json()) as TeamListItem[];
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export type MePatchPayload = {
  username?: string;
  displayName?: string | null;
  favoriteTeamId?: number | null;
};

export async function patchMeProfile(
  payload: MePatchPayload,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await requestFn("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
}

export async function uploadMeAvatar(
  file: File,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await requestFn("/api/me/avatar", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Upload failed (${res.status})`);
  }
}

export async function deleteMeAvatar(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await requestFn("/api/me/avatar", { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
}

export async function fetchProfileByUsername(username: string): Promise<ProfileByUsernameResponse> {
  const res = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  return parseJson<ProfileByUsernameResponse>(res);
}

export async function followUser(
  userId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await requestFn(`/api/users/${userId}/follow`, { method: "POST" });
  if (res.status === 401) {
    throw new Error("Please sign in to follow users");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
}

export async function unfollowUser(
  userId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await requestFn(`/api/users/${userId}/follow`, { method: "DELETE" });
  if (res.status === 401) {
    throw new Error("Please sign in");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
}

export async function fetchUserThreadsForProfile(userId: number, limit = 24): Promise<ProfileActivityThread[]> {
  const res = await fetch(`/api/users/${userId}/threads?limit=${limit}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await parseJson<{ threads: ProfileActivityThread[] }>(res);
  return data.threads;
}

export async function fetchUserPostsForProfile(userId: number, limit = 80): Promise<ProfileActivityPost[]> {
  const res = await fetch(`/api/users/${userId}/posts?limit=${limit}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await parseJson<{ posts: ProfileActivityPost[] }>(res);
  return data.posts;
}

export async function fetchUserActivityForProfile(userId: number, days: number): Promise<ProfileActivityChartResponse> {
  const d = Math.min(365, Math.max(1, Math.floor(days)));
  const res = await fetch(`/api/users/${userId}/activity?days=${d}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJson<ProfileActivityChartResponse>(res);
}

export async function submitBanAppeal(
  banId: number,
  message: string,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const res = await requestFn(`/api/bans/${banId}/appeal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to submit appeal");
  }
}

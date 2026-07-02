import type { ConnectionEntry } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchMyFollowing(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<ConnectionEntry[]> {
  const res = await requestFn("/api/me/following", { method: "GET", cache: "no-store" });
  const data = await parseJson<{ following: ConnectionEntry[] }>(res);
  return data.following;
}

export async function fetchMyFollowers(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<ConnectionEntry[]> {
  const res = await requestFn("/api/me/followers", { method: "GET", cache: "no-store" });
  const data = await parseJson<{ followers: ConnectionEntry[] }>(res);
  return data.followers;
}

export async function removeFollower(
  followerUserId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await requestFn(`/api/me/followers/${followerUserId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
}

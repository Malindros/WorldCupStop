import type { ForumTagsResponse, ForumThreadsResponse } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const fallback = `Request failed (${res.status})`;
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || fallback);
  }
  return res.json();
}

export async function fetchForumThreads(params: {
  q?: string;
  team?: string;
  tags?: string;
  limit?: number;
  offset?: number;
}): Promise<ForumThreadsResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.team) query.set("team", params.team);
  if (params.tags) query.set("tags", params.tags);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const res = await fetch(`/api/threads?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  return parseJson<ForumThreadsResponse>(res);
}

export async function fetchForumTags(): Promise<ForumTagsResponse> {
  const res = await fetch("/api/tags", {
    method: "GET",
    cache: "no-store",
  });

  return parseJson<ForumTagsResponse>(res);
}

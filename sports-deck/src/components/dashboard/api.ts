import type { FeedResponse } from "./types";

export async function fetchDashboardFeed(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  limit = 50,
  offset = 0,
): Promise<FeedResponse> {
  const capped = Math.min(100, Math.max(1, Math.floor(limit)));
  const safeOffset = Math.max(0, Math.floor(offset));
  const res = await requestFn(`/api/me/feed?limit=${capped}&offset=${safeOffset}`, {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to load feed (${res.status})`);
  }

  const data = (await res.json()) as FeedResponse;
  return {
    feed: data.feed ?? [],
    hasMore: Boolean(data.hasMore),
  };
}

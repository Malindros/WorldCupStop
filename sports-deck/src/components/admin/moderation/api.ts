import type { ModerationAction, ModerationQueueResponse, QueueDirection, QueueSort } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export async function fetchModerationQueue(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  options?: { sort?: QueueSort; direction?: QueueDirection; type?: "POST" | "THREAD"; limit?: number; offset?: number }
): Promise<ModerationQueueResponse> {
  const params = new URLSearchParams();
  if (options?.sort) params.set("sort", options.sort);
  if (options?.direction) params.set("direction", options.direction);
  if (options?.type) params.set("type", options.type);
  if (typeof options?.limit === "number") params.set("limit", String(options.limit));
  if (typeof options?.offset === "number") params.set("offset", String(options.offset));

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await requestFn(`/api/admin/moderation-queue${suffix}`, {
    method: "GET",
    cache: "no-store",
  });

  return parseJson<ModerationQueueResponse>(res);
}

export async function runModerationAction(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  input: { targetType: "POST" | "THREAD"; targetId: number; action: ModerationAction; reason?: string }
): Promise<void> {
  const res = await requestFn(`/api/admin/moderation-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  await parseJson<{ ok: boolean }>(res);
}

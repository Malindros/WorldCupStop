import type { BanAppealsResponse } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchPendingBanAppeals(
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<BanAppealsResponse> {
  const res = await requestFn("/api/admin/appeals?status=PENDING", {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("Unauthorized");
  return parseJson<BanAppealsResponse>(res);
}

export async function approveAppeal(
  appealId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const res = await requestFn(`/api/admin/appeals/${appealId}/approve`, {
    method: "POST",
  });

  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to approve appeal");
  }
}

export async function rejectAppeal(
  appealId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const res = await requestFn(`/api/admin/appeals/${appealId}/deny`, {
    method: "POST",
  });

  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to reject appeal");
  }
}

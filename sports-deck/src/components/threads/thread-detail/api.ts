import type { SlugLookup, ThreadDetail, ThreadPostsPage, ThreadSentimentResponse } from "./types";
import type { UserReportReasonCode } from "@/lib/reportReasons";

type TranslatePostResponse = {
  translatedText: string;
  cached: boolean;
  alreadyEnglish: boolean;
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function lookupThreadIdBySlug(slug: string): Promise<SlugLookup> {
  const res = await fetch(`/api/threads/slug/${encodeURIComponent(slug)}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJson<SlugLookup>(res);
}

export async function fetchThreadById(id: number): Promise<ThreadDetail> {
  const res = await fetch(`/api/threads/${id}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJson<ThreadDetail>(res);
}

export async function fetchThreadPostsById(id: number, offset: number, limit = 10): Promise<ThreadPostsPage> {
  const qs = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await fetch(`/api/threads/${id}/posts?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJson<ThreadPostsPage>(res);
}

export async function createThreadReply(
  threadId: number,
  content: string,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  parentPostId?: number | null,
): Promise<void> {
  const bodyPayload: any = { content };
  if (parentPostId !== undefined) bodyPayload.parentPostId = parentPostId;

  const res = await requestFn(`/api/threads/${threadId}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to create reply");
  }
}

export async function fetchThreadSentimentById(
  threadId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ThreadSentimentResponse> {
  const res = await requestFn(`/api/threads/${threadId}/sentiment`, {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  return parseJson<ThreadSentimentResponse>(res);
}

export async function translatePostToEnglish(
  postId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<TranslatePostResponse> {
  const res = await requestFn(`/api/posts/${postId}/translate`, {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  return parseJson<TranslatePostResponse>(res);
}

type ReportPayload = {
  reasonCode: UserReportReasonCode;
  additionalComment?: string | null;
};

async function submitReport(
  path: string,
  payload: ReportPayload,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  const res = await requestFn(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || "Failed to submit report");
  }

  return body;
}

export async function reportPostById(
  postId: number,
  payload: ReportPayload,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  return submitReport(`/api/posts/${postId}/report`, payload, requestFn);
}

export async function reportThreadById(
  threadId: number,
  payload: ReportPayload,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  return submitReport(`/api/threads/${threadId}/report`, payload, requestFn);
}

export async function deletePostById(
  postId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const res = await requestFn(`/api/posts/${postId}`, {
    method: "DELETE",
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || "Failed to delete post");
  }
}

export async function deleteThreadById(
  threadId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const res = await requestFn(`/api/threads/${threadId}`, {
    method: "DELETE",
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || "Failed to delete thread");
  }
}

export async function editThreadById(
  threadId: number,
  payload: { title?: string; tags?: string[] },
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ThreadDetail> {
  const res = await requestFn(`/api/threads/${threadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to edit thread");
  }

  return res.json();
}

export async function editPostById(
  postId: number,
  content: string,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<{ id: number; content: string; lastEditedAt: string | null }> {
  const res = await requestFn(`/api/posts/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to edit post");
  }

  return res.json();
}

export type PostHistoryEntry = {
  id: number;
  previousContent: string;
  language: string | null;
  editedAt: string;
  editor: { id: number; username: string } | null;
};

export type PostHistoryResponse = {
  postId: number;
  threadId: number | null;
  createdAt: string;
  updatedAt: string;
  current: { content: string; language: string | null; updatedAt: string };
  history: PostHistoryEntry[];
};

export async function fetchPostHistoryById(
  postId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<PostHistoryResponse> {
  const res = await requestFn(`/api/posts/${postId}/history`, {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("Unauthorized");
  return parseJson<PostHistoryResponse>(res);
}

export async function fetchThreadPolls(
  threadId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  const res = await requestFn(`/api/threads/${threadId}/polls`, { method: "GET", cache: "no-store" });
  return parseJson<any>(res);
}

export async function fetchPollById(
  pollId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  const res = await requestFn(`/api/polls/${pollId}`, { method: "GET", cache: "no-store" });
  return parseJson<any>(res);
}

export async function createThreadPoll(
  threadId: number,
  payload: { question: string; deadline: string; options: string[] },
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  const res = await requestFn(`/api/threads/${threadId}/polls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  return parseJson<any>(res);
}

export async function votePoll(
  pollId: number,
  optionId: number,
  requestFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  const res = await requestFn(`/api/polls/${pollId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  return parseJson<any>(res);
}

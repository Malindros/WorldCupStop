export type QueueSort = "ai_score" | "reports" | "recent";
export type QueueDirection = "asc" | "desc";

export type ModerationUser = {
  id: number;
  username: string;
};

export type QueueAiVerdict = {
  id: number;
  verdict: string;
  toxicityScore: number | null;
  explanation: string | null;
  createdAt: string;
} | null;

export type QueueUserReport = {
  id: number;
  reason: string;
  reasonCode: string;
  additionalComment: string | null;
  createdAt: string;
  reporter: ModerationUser | null;
};

export type QueuePostTarget = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentPostId: number | null;
  author: ModerationUser | null;
  thread: { id: number; title: string; slug: string | null } | null;
  parentPostPreview: { id: number; content: string; author: ModerationUser | null } | null;
  edits: Array<{ id: number; previousContent: string; editedAt: string; editor: ModerationUser | null }>;
};

export type QueueThreadTarget = {
  id: number;
  title: string;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
  isHidden: boolean;
  isClosed: boolean;
  author: ModerationUser | null;
  firstPostPreview: { id: number; content: string; createdAt: string; author: ModerationUser | null } | null;
};

export type QueueItem = {
  type: "POST" | "THREAD";
  targetId: number;
  openReportCount: number;
  userReportCount: number;
  autoReportCount: number;
  lastReportAt: string;
  lastUserReportAt: string | null;
  userReports: QueueUserReport[];
  latestAiVerdict: QueueAiVerdict;
  target: QueuePostTarget | QueueThreadTarget | null;
};

export type ModerationQueueResponse = {
  sort: QueueSort;
  direction: QueueDirection;
  meta: {
    pendingReportCount: number;
    pendingTargetCount: number;
    pageTargetCount: number;
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
  items: QueueItem[];
};

export type ModerationAction = "dismiss" | "remove" | "ban_user";

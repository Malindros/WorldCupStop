import type { QueueItem, QueueUserReport } from "../types";

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE_SPEECH: "Hate speech",
  VIOLENCE: "Violence",
  SEXUAL_CONTENT: "Sexual content",
  MISINFORMATION: "Misinformation",
  OTHER: "Other",
  SYSTEM_FLAGGED: "System flagged",
};

export function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function toxicityPercent(score: number | null) {
  if (score === null || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getTypeBadgeClass(type: QueueItem["type"]) {
  return type === "POST"
    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
    : "bg-violet-500/15 text-violet-700 dark:text-violet-300";
}

export function getVerdictClass(verdict: string | null | undefined) {
  const normalized = (verdict || "").toLowerCase();
  if (normalized.includes("block")) return "bg-red-500/15 text-red-700 dark:text-red-300";
  if (normalized.includes("review")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (normalized.includes("safe")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}

export function getToxicityClass(score: number | null) {
  const percent = toxicityPercent(score);
  if (percent === null) return "bg-muted text-muted-foreground";
  if (percent >= 80) return "bg-red-500/15 text-red-700 dark:text-red-300";
  if (percent >= 50) return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
  if (percent >= 30) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export function getReasonLabel(code: string) {
  return REASON_LABELS[code] || code;
}

export function getReportComment(report: QueueUserReport) {
  if (report.additionalComment) return report.additionalComment;
  const label = getReasonLabel(report.reasonCode);
  const reason = (report.reason || "").trim();
  if (!reason || reason.toLowerCase() === label.toLowerCase()) return null;
  if (reason.toLowerCase().startsWith(`${label.toLowerCase()}:`)) {
    const suffix = reason.slice(label.length + 1).trim();
    return suffix || null;
  }
  return reason;
}

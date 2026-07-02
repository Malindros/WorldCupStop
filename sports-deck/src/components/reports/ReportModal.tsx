"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { REPORT_REASON_OPTIONS, type UserReportReasonCode } from "@/lib/reportReasons";

type ReportModalProps = {
  open: boolean;
  targetLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { reasonCode: UserReportReasonCode; additionalComment: string | null }) => Promise<void>;
  onSubmitted?: () => void;
};

export default function ReportModal({
  open,
  targetLabel,
  onOpenChange,
  onSubmit,
  onSubmitted,
}: ReportModalProps) {
  const [reasonCode, setReasonCode] = useState<UserReportReasonCode | "">("");
  const [additionalComment, setAdditionalComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReasonCode("");
      setAdditionalComment("");
      setSubmitting(false);
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  if (!open) return null;

  const submitReport = async () => {
    if (!reasonCode) {
      setError("Please select a reason.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        reasonCode,
        additionalComment: additionalComment.trim() ? additionalComment.trim() : null,
      });
      setSuccess("Report submitted successfully.");
      onSubmitted?.();
      window.setTimeout(() => onOpenChange(false), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report ${targetLabel}`}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6"
      >
        <h3 className="text-xl font-semibold text-foreground">Report {targetLabel}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the reason that best matches the issue. You can also provide optional details.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Reason
            <select
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as UserReportReasonCode | "")}
              disabled={submitting}
            >
              <option value="">Select a reason</option>
              {REPORT_REASON_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {reasonCode ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              {REPORT_REASON_OPTIONS.find((option) => option.code === reasonCode)?.description}
            </p>
          ) : null}

          <label className="block text-sm font-medium text-foreground">
            Additional comments (optional)
            <textarea
              value={additionalComment}
              onChange={(e) => setAdditionalComment(e.target.value)}
              maxLength={500}
              rows={4}
              disabled={submitting}
              placeholder="Add any context that may help moderators review this faster."
              className="mt-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submitReport} disabled={submitting || !reasonCode}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

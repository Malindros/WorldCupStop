"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type SubmitAppealModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string) => Promise<void>;
};

export default function SubmitAppealModal({ open, onOpenChange, onSubmit }: SubmitAppealModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    if (submitting) return;
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please provide a reason for your appeal.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(trimmed);
      setMessage("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit appeal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={close}
        aria-label="Close modal"
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h2 className="text-xl font-semibold text-foreground">Submit Ban Appeal</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Explain why your ban should be lifted. This will be reviewed by an admin.
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your appeal..."
          className="mt-4 min-h-32 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none"
          maxLength={1000}
          disabled={submitting}
        />
        <p className="mt-1 text-xs text-muted-foreground">{message.length}/1000</p>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Appeal"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";

type UsernameChangeConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsername: string;
  nextUsername: string;
  onConfirm: () => void;
  loading?: boolean;
};

export default function UsernameChangeConfirmModal({
  open,
  onOpenChange,
  currentUsername,
  nextUsername,
  onConfirm,
  loading,
}: UsernameChangeConfirmModalProps) {
  if (!open) return null;

  const close = () => {
    if (loading) return;
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={close} aria-label="Close dialog" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        role="alertdialog"
        aria-labelledby="username-change-title"
        aria-describedby="username-change-desc"
      >
        <h2 id="username-change-title" className="text-lg font-semibold text-foreground">
          Change username?
        </h2>
        <p id="username-change-desc" className="mt-2 text-sm text-muted-foreground">
          Your profile link will change from{" "}
          <span className="font-mono text-foreground">/profile/{currentUsername}</span> to{" "}
          <span className="font-mono text-foreground">/profile/{nextUsername}</span>. Bookmarks and shared links to your
          old URL will stop working.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Saving…" : "Change username"}
          </Button>
        </div>
      </div>
    </div>
  );
}

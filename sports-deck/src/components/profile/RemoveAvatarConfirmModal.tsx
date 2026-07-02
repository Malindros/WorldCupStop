"use client";

import { Button } from "@/components/ui/button";

type RemoveAvatarConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
};

export default function RemoveAvatarConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: RemoveAvatarConfirmModalProps) {
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
        aria-labelledby="remove-avatar-title"
        aria-describedby="remove-avatar-desc"
      >
        <h2 id="remove-avatar-title" className="text-lg font-semibold text-foreground">
          Remove profile photo?
        </h2>
        <p id="remove-avatar-desc" className="mt-2 text-sm text-muted-foreground">
          Your profile picture will be removed. You can upload a new one anytime.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Removing…" : "Remove photo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

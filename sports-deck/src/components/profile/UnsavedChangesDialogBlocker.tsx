"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Blocks in-app navigation when `dirty` (same-origin anchor clicks) with a modal.
 * Tab close / refresh still uses the native beforeunload prompt.
 */
export function UnsavedChangesDialogBlocker({ dirty }: { dirty: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const onLinkClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };

    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, [dirty, pathname]);

  const handleStay = useCallback(() => setPendingHref(null), []);

  const handleLeave = useCallback(() => {
    if (!pendingHref) return;
    const target = pendingHref;
    setPendingHref(null);
    router.push(target);
  }, [pendingHref, router]);

  if (!pendingHref) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={handleStay} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 id="unsaved-changes-title" className="text-lg font-semibold text-foreground">
          Unsaved changes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have unsaved changes. Leave this page? Your edits will be lost if you don&apos;t save first.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleStay}>
            Stay
          </Button>
          <Button type="button" variant="destructive" onClick={handleLeave}>
            Leave without saving
          </Button>
        </div>
      </div>
    </div>
  );
}

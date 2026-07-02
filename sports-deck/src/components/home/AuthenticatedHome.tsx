"use client";

import Link from "next/link";
import { Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthenticatedHome() {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <header className="mb-10 border-b border-border/80 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">SportsDeck</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Welcome back</h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">
          Jump into your daily briefing or catch up on what matters from the fans and teams you follow.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-auto min-h-0 w-full min-w-0 shrink whitespace-normal flex-col items-stretch gap-3 rounded-2xl border-border bg-card/80 p-6 text-left shadow-sm transition hover:border-primary/40 hover:bg-card"
          asChild
        >
          <Link href="/#daily-digest" className="min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold text-foreground">Daily digest</span>
              <span className="mt-1 block text-pretty text-sm font-normal leading-snug text-muted-foreground">
                Open your dashboard for the full digest, league snapshot, and standings highlights.
              </span>
            </span>
          </Link>
        </Button>

        <Button
          variant="outline"
          className="h-auto min-h-0 w-full min-w-0 shrink whitespace-normal flex-col items-stretch gap-3 rounded-2xl border-border bg-card/80 p-6 text-left shadow-sm transition hover:border-primary/40 hover:bg-card"
          asChild
        >
          <Link href="/#activity-feed" className="min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Activity className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold text-foreground">Activity feed</span>
              <span className="mt-1 block text-pretty text-sm font-normal leading-snug text-muted-foreground">
                Jump to the activity feed on your dashboard—updates from follows, replies to you, and your team.
              </span>
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

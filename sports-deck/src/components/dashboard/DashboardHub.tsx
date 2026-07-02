"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DailyDigestSection from "@/components/home/DailyDigestSection";
import DashboardFeed from "@/components/dashboard/DashboardFeed";
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";

export default function DashboardHub() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=%2F");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="p-4 text-sm text-muted-foreground sm:p-8">Loading…</div>;
  }

  if (status === "unauthenticated") {
    return <div className="p-4 text-sm text-muted-foreground sm:p-8">Redirecting to sign in…</div>;
  }

  return (
    <div className="relative isolate mx-auto w-full space-y-14 overflow-hidden p-4 pb-16 sm:p-8">
      <DecorativeSportsIconsBackground />

      <header className="relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border shadow-lg">
        <div className="relative aspect-[5/3] min-h-[200px] max-h-[400px] w-full sm:aspect-[2.6/1] sm:min-h-[220px]">
          <Image
            src="/images/atmosphere/crowd-atmosphere-bokeh.png"
            alt="Your football fan dashboard"
            fill
            priority
            quality={90}
            className="object-cover object-center"
            sizes="(max-width: 1280px) 100vw, 1024px"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/42 to-slate-950/18 dark:from-slate-950/78 dark:via-slate-950/52 dark:to-slate-950/28"
            aria-hidden
          />
          <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/85">Your hub</p>
            <h1
              className="mb-2 text-balance text-white drop-shadow-sm"
              style={{ fontFamily: "Roboto Condensed, sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900 }}
            >
              Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-white/85 sm:text-base">
              Today&apos;s digest and your personalized activity feed in one place.
            </p>
          </div>
        </div>
      </header>

      <section id="daily-digest" className="relative z-10 scroll-mt-24 mx-auto w-full max-w-3xl">
        <DailyDigestSection loginNextPath="%2F" />
      </section>

      <section id="activity-feed" className="relative z-10 scroll-mt-24 mx-auto w-full max-w-3xl">
        <DashboardFeed />
      </section>
    </div>
  );
}

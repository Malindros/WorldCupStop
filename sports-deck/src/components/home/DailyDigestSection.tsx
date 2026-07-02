"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import DailyDigestBanner from "./DailyDigestBanner";

export type DigestResponse = {
  id: number;
  date: string;
  generatedAt: string;
  cached: boolean;
  summary: string;
  sections: {
    topThreads: Array<{ threadId: number; title: string; slug: string | null; postCount: number }>;
    recentMatches: Array<{ matchId: number; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null }>;
    standingsChanges: Array<{ teamId: number; teamName: string; from: number; to: number; delta: number }>;
  };
};

type DailyDigestSectionProps = {
  /** Login redirect when session is invalid */
  loginNextPath?: string;
  className?: string;
};

/**
 * Loads and displays today’s daily digest (loading / error / banner).
 */
export default function DailyDigestSection({ loginNextPath = "%2F", className }: DailyDigestSectionProps) {
  const router = useRouter();
  const { authedFetch } = useAuth();
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDigest = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authedFetch("/api/digests/today", { method: "GET", cache: "no-store" });

        if (res.status === 401) {
          router.replace(`/login?next=${loginNextPath}`);
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to load daily digest");
        }

        const payload = (await res.json()) as DigestResponse;
        if (!cancelled) {
          setDigest(payload);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load daily digest");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDigest();

    return () => {
      cancelled = true;
    };
  }, [authedFetch, router, loginNextPath]);

  return (
    <div className={className}>
      {loading ? <p className="text-sm text-muted-foreground">Loading today&apos;s digest…</p> : null}
      {!loading && error ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-red-600">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : null}
      {!loading && !error && digest ? <DailyDigestBanner digest={digest} /> : null}
    </div>
  );
}

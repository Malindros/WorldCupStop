import Link from "next/link";
import { Sparkles } from "lucide-react";

type DigestThread = {
  threadId: number;
  title: string;
  slug: string | null;
  postCount: number;
};

type DigestMatch = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

type DigestStandingChange = {
  teamId: number;
  teamName: string;
  from: number;
  to: number;
  delta: number;
};

type DigestPayload = {
  id: number;
  date: string;
  generatedAt: string;
  cached: boolean;
  summary: string;
  sections: {
    topThreads: DigestThread[];
    recentMatches: DigestMatch[];
    standingsChanges: DigestStandingChange[];
  };
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DailyDigestBanner({ digest }: { digest: DigestPayload }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(56,189,248,0.2),transparent_55%),radial-gradient(100%_90%_at_100%_10%,rgba(34,197,94,0.16),transparent_55%),linear-gradient(135deg,rgba(8,47,73,0.09),rgba(15,23,42,0.03))] dark:bg-[radial-gradient(120%_120%_at_10%_0%,rgba(56,189,248,0.28),transparent_55%),radial-gradient(100%_90%_at_100%_10%,rgba(34,197,94,0.22),transparent_55%),linear-gradient(135deg,rgba(8,47,73,0.35),rgba(15,23,42,0.25))]" />

        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Daily Digest</h2>
              <p className="text-xs text-muted-foreground">{formatDateLabel(digest.generatedAt)}</p>
            </div>
          </div>

          <p className="whitespace-pre-line text-sm leading-7 text-foreground/95 sm:text-base">{digest.summary}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm">
              <h3 className="mb-2 text-sm font-semibold">Top Discussions</h3>
              {digest.sections.topThreads.length ? (
                <ul className="space-y-1.5 text-sm">
                  {digest.sections.topThreads.slice(0, 3).map((thread) => (
                    <li key={thread.threadId}>
                      <Link
                        href={thread.slug ? `/threads/${thread.slug}` : "/threads"}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {thread.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No discussion spikes yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm">
              <h3 className="mb-2 text-sm font-semibold">Recent Matches</h3>
              {digest.sections.recentMatches.length ? (
                <ul className="space-y-1.5 text-sm">
                  {digest.sections.recentMatches.slice(0, 3).map((match) => (
                    <li key={match.matchId}>
                      <Link href={`/matches/${match.matchId}`} className="text-primary underline-offset-4 hover:underline">
                        {match.homeTeam} {match.homeScore ?? "-"}:{match.awayScore ?? "-"} {match.awayTeam}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No completed matches recently.</p>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm">
              <h3 className="mb-2 text-sm font-semibold">Standings Moves</h3>
              {digest.sections.standingsChanges.length ? (
                <ul className="space-y-1.5 text-sm">
                  {digest.sections.standingsChanges.slice(0, 3).map((change) => (
                    <li key={change.teamId}>
                      <Link href="/standings" className="text-primary underline-offset-4 hover:underline">
                        {change.teamName}: {change.from} to {change.to}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No notable ranking changes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

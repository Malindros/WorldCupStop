import type { ThreadSentimentResponse, ThreadSentimentTeam } from "./types";

type Tone = "positive" | "negative" | "neutral";

function toneColorClasses(tone: Tone, large = false) {
  if (tone === "positive") {
    return large
      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
      : "bg-emerald-500";
  }
  if (tone === "negative") {
    return large
      ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
      : "bg-rose-500";
  }
  return large
    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
    : "bg-amber-500";
}

function scoreToStrength(score: number) {
  const bounded = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 50));
  return Math.round(bounded);
}

function SentimentBar({
  label,
  sentiment,
  score,
  large = false,
}: {
  label: string;
  sentiment: Tone;
  score: number;
  large?: boolean;
}) {
  const strength = scoreToStrength(score);
  const fillClass = toneColorClasses(sentiment);
  const chipClass = toneColorClasses(sentiment, true);

  return (
    <div className={large ? "space-y-3" : "space-y-2"}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p
          title={label}
          className={large
            ? "min-w-0 flex-1 text-sm font-semibold"
            : "min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground"}
        >
          {label}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass}`}>{sentiment}</span>
          <span className="text-sm font-semibold text-foreground">{strength}%</span>
        </div>
      </div>
      <div className={`${large ? "h-3.5" : "h-2.5"} w-full overflow-hidden rounded-full bg-muted`}>
        <div
          className={`${fillClass} h-full rounded-full transition-all duration-500`}
          style={{ width: `${strength}%` }}
          role="progressbar"
          aria-valuenow={strength}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} sentiment strength`}
        />
      </div>
    </div>
  );
}

function findTeamByKind(teams: ThreadSentimentTeam[], kind: "home" | "away") {
  return teams.find((team) => team.kind === kind) ?? null;
}

export default function ThreadSentimentPanel({
  sentiment,
  loading,
  error,
  className,
}: {
  sentiment: ThreadSentimentResponse | null;
  loading: boolean;
  error: string | null;
  className?: string;
}) {
  const wrapperClass = ["w-full rounded-2xl border border-border bg-card p-4 sm:p-5", className]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={wrapperClass}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground">AI Sentiment Analysis</h3>
        <p className="text-xs text-muted-foreground">Live fan mood from thread comments</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Analyzing comments...</p> : null}
      {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && sentiment?.overall ? (
        <div className="space-y-4">
          <SentimentBar
            label="Overall Match Mood"
            sentiment={sentiment.overall.sentiment}
            score={sentiment.overall.score}
            large
          />

          <div className="space-y-3">
            {(() => {
              const home = findTeamByKind(sentiment.teams, "home");
              const away = findTeamByKind(sentiment.teams, "away");

              return (
                <>
                  {home ? (
                    <SentimentBar
                      label={home.teamName ? `${home.teamName} Fans` : "Home Fans"}
                      sentiment={home.sentiment}
                      score={home.score}
                    />
                  ) : null}
                  {away ? (
                    <SentimentBar
                      label={away.teamName ? `${away.teamName} Fans` : "Away Fans"}
                      sentiment={away.sentiment}
                      score={away.score}
                    />
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

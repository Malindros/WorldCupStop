"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Calendar, MapPin, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThreadDetailClient from "@/components/threads/thread-detail/ThreadDetailClient";

type TeamRef = { id: number; name: string; crest?: string | null } | null;

type MatchDetail = {
  id: number | string;
  externalId?: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  startTime?: string | null;
  utcDate?: string | null;
  venue?: string | null;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string | null;
  seasonId?: number | null;
  homeDetails?: { id?: number; name?: string; shortName?: string; tla?: string; crest?: string } | null;
  awayDetails?: { id?: number; name?: string; shortName?: string; tla?: string; crest?: string } | null;
  score?: any;
  goals?: any;
  penalties?: any;
  bookings?: any;
  substitutions?: any;
  referees?: Array<{ id?: number; name?: string; type?: string; nationality?: string }>|null;
  createdAt?: string;
  updatedAt?: string;
  homeTeam?: TeamRef;
  awayTeam?: TeamRef;
};

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/matches/${id}`);
        if (!res.ok) throw new Error(`Failed to fetch match ${id}`);
        const data = await res.json();
        if (cancelled) return;
        setMatch(data ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "");

  const homeColor = '#ef4444';
  const awayColor = '#2563eb';
  const [moreOpen, setMoreOpen] = useState(false);
  const [threads, setThreads] = useState<Array<{id:number; title:string; slug:string}>>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const getStatusLabel = (s?: string | null) => {
    const st = (s ?? '').toString().toUpperCase();
    const map: Record<string,string> = {
      SCHEDULED: 'Upcoming',
      TIMED: 'Upcoming',
      IN_PLAY: 'Live',
      PAUSED: 'Live',
      LIVE: 'Live',
      FINISHED: 'Finished',
      AWARDED: 'Finished',
      POSTPONED: 'Postponed',
      SUSPENDED: 'Suspended',
      CANCELLED: 'Cancelled'
    };
    return map[st] ?? (s ?? '');
  };

  useEffect(() => {
    if (!match || !id) return;
    let cancelled = false;
    const loadThreads = async () => {
      setThreadsLoading(true);
      setThreadsError(null);
      try {
        const res = await fetch(`/api/matches/${id}/threads`);
        if (!res.ok) throw new Error(`Failed to fetch threads for match ${id}`);
        const data = await res.json();
        if (cancelled) return;
        setThreads(Array.isArray(data.threads) ? data.threads : []);
      } catch (err) {
        if (cancelled) return;
        setThreadsError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    };
    loadThreads();
    return () => { cancelled = true; };
  }, [match, id]);

  if (!id) return <div className="p-8">No match id provided</div>;

  return (
    <>
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/matches')}>← Back to matches</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading match...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !match && <p className="text-sm text-muted-foreground">Match not found</p>}

      {match && (
        <div className="space-y-6">
          {/* Match Header */}
          <div className="bg-gradient-to-br from-card via-card to-accent/20 rounded-2xl border border-border p-8 mb-8 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-5"
              style={{
                background: `linear-gradient(135deg, ${homeColor} 0%, transparent 50%, ${awayColor} 100%)`,
              }}
            />

            <div className="relative">
              {/* Live indicator */}
              {(() => {
                const st = (match.status ?? '').toString().toUpperCase();
                const LIVE = new Set(["IN_PLAY", "PAUSED", "LIVE"]);
                if (LIVE.has(st)) {
                  const minute = (match as any).minute ?? (match.score?.minute ?? null);
                  return (
                    <div className="flex items-center justify-center gap-2 mb-6">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-500 font-bold text-lg">LIVE{minute ? ` - ${minute}'` : ''}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Teams and Score (responsive) */}
              <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 md:gap-0">
                {/* Home Team */}
                <div className="flex flex-col items-center w-full md:flex-1">
                  <div className="w-20 h-20 md:w-32 md:h-32 rounded-2xl overflow-hidden mb-4 shadow-2xl bg-muted flex-shrink-0">
                    {match.homeDetails?.crest || match.homeTeam?.crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={match.homeDetails?.crest ?? match.homeTeam?.crest ?? ''} alt={match.homeDetails?.name ?? match.homeTeam?.name ?? ''} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg md:text-xl font-bold text-muted-foreground">{(match.homeDetails?.name ?? match.homeTeam?.name ?? '').split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
                    )}
                  </div>
                  <h2 className="font-bold text-center text-lg md:text-[28px] truncate" style={{ fontFamily: 'Roboto Condensed, sans-serif' }}>
                    {match.homeDetails?.name ?? match.homeTeam?.name}
                  </h2>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center justify-center px-4 md:px-8">
                  <div className="text-sm uppercase font-semibold mb-2 text-muted-foreground">{getStatusLabel(match.status)}</div>
                  {(() => {
                    const hasScore = !!(match.score?.fullTime || (match.homeScore != null && match.awayScore != null));
                    if (hasScore) {
                      const ftHome = match.score?.fullTime?.home ?? match.homeScore ?? '-';
                      const ftAway = match.score?.fullTime?.away ?? match.awayScore ?? '-';
                      const htHome = match.score?.halfTime?.home;
                      const htAway = match.score?.halfTime?.away;
                      return (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-4 md:gap-6">
                            <span className="font-black text-4xl md:text-[72px]" style={{ fontFamily: 'Roboto Condensed, sans-serif', color: homeColor }}>{ftHome}</span>
                            <span className="text-2xl md:text-4xl text-muted-foreground font-bold">-</span>
                            <span className="font-black text-4xl md:text-[72px]" style={{ fontFamily: 'Roboto Condensed, sans-serif', color: awayColor }}>{ftAway}</span>
                          </div>
                          {htHome != null && htAway != null && (
                            <div className="text-sm text-muted-foreground mt-2">(HT: {htHome} - {htAway})</div>
                          )}
                        </div>
                      );
                    }
                    // upcoming
                    return (
                      <div className="text-center">
                        <p className="text-muted-foreground mb-2">Kick-off</p>
                        <p className="text-xl md:text-2xl font-bold">{fmt(match.startTime ?? match.utcDate)}</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center w-full md:flex-1">
                  <div className="w-20 h-20 md:w-32 md:h-32 rounded-2xl overflow-hidden mb-4 shadow-2xl bg-muted flex-shrink-0">
                    {match.awayDetails?.crest || match.awayTeam?.crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={match.awayDetails?.crest ?? match.awayTeam?.crest ?? ''} alt={match.awayDetails?.name ?? match.awayTeam?.name ?? ''} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg md:text-xl font-bold text-muted-foreground">{(match.awayDetails?.name ?? match.awayTeam?.name ?? '').split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
                    )}
                  </div>
                  <h2 className="font-bold text-center text-lg md:text-[28px] truncate" style={{ fontFamily: 'Roboto Condensed, sans-serif' }}>
                    {match.awayDetails?.name ?? match.awayTeam?.name}
                  </h2>
                </div>
              </div>

              {/* Match Info */}
              <div className="flex items-center justify-center gap-8 pt-6 border-t border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-5 h-5" />
                  <span>{fmt(match.startTime ?? match.utcDate)}</span>
                </div>
                {match.venue ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-5 h-5" />
                    <span>{match.venue}</span>
                  </div>
                ) : null}
                {(() => {
                  const stageMap: Record<string,string> = {
                    'LAST_16': 'Last 16',
                    'ROUND_OF_16': 'Last 16',
                    'QUARTER_FINALS': 'Quarter-finals',
                    'SEMI_FINALS': 'Semi-finals',
                    'FINAL': 'Final',
                    'PLAYOFFS': 'Playoffs',
                    'LEAGUE_STAGE': 'Group Stage',
                    'GROUP_STAGE': 'Group Stage'
                  };
                  const st = (match.stage ?? '').toString().toUpperCase();
                  const playoffs = new Set(['PLAYOFFS','QUARTER_FINALS','SEMI_FINALS','LAST_16','ROUND_OF_16','FINAL']);
                  const stageLabel = stageMap[st] ?? (match.stage ?? '');
                  return (
                    <>
                      {stageLabel && <div className="text-muted-foreground">{stageLabel}</div>}
                      {match.matchday != null && !playoffs.has(st) && (
                        <div className="text-muted-foreground">Matchday {match.matchday}</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => setMoreOpen(!moreOpen)}>
              <span className="text-sm font-medium">Additional info</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </Button>

            {moreOpen && (
              <div className="p-4 rounded-lg border border-border bg-card space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Additional</h3>
                  <ul className="text-sm space-y-1">
                    {match.lastUpdated && <li><strong>Last Updated:</strong> {fmt(match.lastUpdated)}</li>}
                    {match.createdAt && <li><strong>Created At:</strong> {fmt(match.createdAt)}</li>}
                    {match.updatedAt && <li><strong>Updated At:</strong> {fmt(match.updatedAt)}</li>}
                  </ul>
                </div>

                {match.referees && match.referees.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Referees</h3>
                    <ul className="text-sm space-y-1">
                      {match.referees.map((r) => (
                        <li key={r.id}><strong>{r.name}</strong> {r.nationality ? `— ${r.nationality}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.goals && Array.isArray(match.goals) && match.goals.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Goals</h3>
                    <ul className="text-sm space-y-1">
                      {match.goals.map((g: any, i: number) => (
                        <li key={i}>{g.minute ?? '?'}' — {g.team ?? ''} — {g.scorer ?? g.player ?? 'Unknown'}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.bookings && Array.isArray(match.bookings) && match.bookings.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Bookings</h3>
                    <ul className="text-sm space-y-1">
                      {match.bookings.map((b: any, i: number) => (
                        <li key={i}>{b.minute ?? '?'}' — {b.team ?? ''} — {b.player ?? 'Unknown'} — {b.card ?? b.type ?? ''}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.substitutions && Array.isArray(match.substitutions) && match.substitutions.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Substitutions</h3>
                    <ul className="text-sm space-y-1">
                      {match.substitutions.map((s: any, i: number) => (
                        <li key={i}>{s.minute ?? '?'}' — {s.team ?? ''} — {s.playerOut ?? s.replaced ?? 'Unknown'} out, {s.playerIn ?? s.substitute ?? 'Unknown'} in</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          



        </div>
      )}
    </div>
    <div className="p-8 max-w-8xl mx-auto">
      {/* Match threads: render thread detail components for each thread */}
      <div>
        <h3 className="text-2xl font-bold mb-3">Match Discussion</h3>
        {threadsLoading && <p className="text-sm text-muted-foreground">Loading threads...</p>}
        {threadsError && <p className="text-sm text-red-600">{threadsError}</p>}
        {!threadsLoading && threads.length === 0 && <p className="text-sm text-muted-foreground">No open discussion thread for this match.</p>}
        <div className="space-y-6">
          {threads.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <ThreadDetailClient slug={t.slug} />
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}

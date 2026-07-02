"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import MatchCard from "./MatchCard";

type ApiMatch = {
  id: string | number;
  homeTeam: { id: number; name: string } | null;
  awayTeam: { id: number; name: string } | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  startTime?: string | null;
  matchday?: number | null;
  venue?: string | null;
  stage?: string | null;
};

export default function MatchList() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished' | 'other'>('all');
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [matchday, setMatchday] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Array<{ id: number; startDate?: string; endDate?: string; }>>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [matchdayCount, setMatchdayCount] = useState<number | null>(null);
  const [stage, setStage] = useState<'all' | 'LEAGUE_STAGE' | 'LAST_16' | 'PLAYOFFS' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'FINAL' | 'GROUP_STAGE'>('all');

  // initial matches load is handled by the season-aware effect below
  
  // Fetch seasons on mount and default selected season to the most recent
  useEffect(() => {
    let cancelled = false;
    const loadSeasons = async () => {
      try {
        const res = await fetch('/api/seasons');
        if (!res.ok) throw new Error('Failed to fetch seasons');
        const data = await res.json();
        if (cancelled) return;
        const filtered = (Array.isArray(data) ? data : []).filter((s) => {
          if (!s?.startDate) return false;
          const year = new Date(s.startDate).getFullYear();
          return Number.isFinite(year) && year >= 2023;
        });
        setSeasons(filtered);
        if (filtered.length > 0) {
          setSelectedSeason(filtered[0].id);
        } else {
          setSelectedSeason(null);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadSeasons();
    return () => { cancelled = true; };
  }, []);

  // Fetch matchday count whenever selectedSeason changes
  useEffect(() => {
    if (selectedSeason == null) return;
    let cancelled = false;
    const loadMatchdays = async () => {
      try {
        const res = await fetch(`/api/seasons/${selectedSeason}/matchdays`);
        if (!res.ok) throw new Error('Failed to fetch matchdays');
        const data = await res.json();
        if (cancelled) return;
        const count = data?.matchdayCount ?? 0;
        setMatchdayCount(count);
        setMatchday(null);
      } catch (err) {
        console.error(err);
      }
    };
    loadMatchdays();
    return () => { cancelled = true; };
  }, [selectedSeason]);

  // Fetch matches whenever season or matchday changes. Do not force matchday filtering when season changes.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedSeason != null) params.set('season', String(selectedSeason));
        if (matchday != null) params.set('matchday', String(matchday));
        const query = params.toString();
        const url = `/api/matches${query ? `?${query}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch matches');
        const data = await res.json();
        if (cancelled) return;
        setMatches(data ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load matches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedSeason, matchday]);

  const STATUS_GROUPS: Record<string, string[]> = {
    live: ['IN_PLAY', 'PAUSED'],
    upcoming: ['SCHEDULED', 'TIMED'],
    finished: ['FINISHED', 'AWARDED'],
    other: ['POSTPONED', 'SUSPENDED', 'CANCELLED'],
  };

  const filteredMatches = useMemo(() => {
    let out = matches;

    if (filter !== 'all') {
      const group = STATUS_GROUPS[filter] ?? [];
      out = out.filter((m) => group.includes((m.status ?? '').toString().toUpperCase()));
    }

    if (stage !== 'all') {
      const wanted = stage.toString().toUpperCase();
      out = out.filter((m) => {
        const s = (m.stage ?? '').toString().toUpperCase();
        if (wanted === 'LEAGUE_STAGE') return s === 'LEAGUE_STAGE' || s === 'GROUP_STAGE';
        if (wanted === 'GROUP_STAGE') return s === 'GROUP_STAGE' || s === 'LEAGUE_STAGE';
        return s === wanted;
      });
    }

    return out;
  }, [filter, matches, stage]);

  // Reset matchday when stage is not league/group stage
  useEffect(() => {
    if (stage !== 'LEAGUE_STAGE' && stage !== 'GROUP_STAGE') {
      setMatchday(null);
    }
  }, [stage]);

  const matchdays = useMemo(() => {
    const vals = matches.map((m) => m.matchday).filter((v) => v != null) as number[];
    const uniq = Array.from(new Set(vals));
    return uniq.sort((a, b) => a - b);
  }, [matches]);

  return (
    <div className="min-h-screen p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-border shadow-lg">
          <div className="relative aspect-[5/3] min-h-[200px] max-h-[400px] w-full sm:aspect-[2.6/1] sm:min-h-[220px]">
            <Image
              src="/images/atmosphere/stadium-crowd-tiers.png"
              alt="Fans in the stands at a football stadium"
              fill
              priority
              quality={90}
              className="object-cover object-center"
              sizes="(max-width: 1280px) 100vw, 1280px"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/42 to-slate-950/18 dark:from-slate-950/78 dark:via-slate-950/52 dark:to-slate-950/28"
              aria-hidden
            />
            <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
              <h1
                className="mb-2 text-balance text-white drop-shadow-sm"
                style={{ fontFamily: "Roboto Condensed, sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900 }}
              >
                Match Center
              </h1>
              <p className="max-w-xl text-white/85 drop-shadow-sm">
                Live scores, upcoming fixtures, and match details
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-4 items-center flex-wrap">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {['all', 'live', 'upcoming', 'finished', 'other'].map((filterOption) => (
              <Button
                key={filterOption}
                onClick={() => setFilter(filterOption as any)}
                variant={filter === filterOption ? 'default' : 'outline'}
                size="lg"
                className="rounded-xl font-bold capitalize whitespace-nowrap"
              >
                {filterOption}
              </Button>
            ))}
          </div>
          <div className="ml-3">
            <div className="flex items-center gap-3">
              <div>
                <label className="text-sm text-muted-foreground mr-2">Season</label>
                <select
                  value={String(selectedSeason ?? 'all')}
                  onChange={(e) => setSelectedSeason(e.target.value === 'all' ? null : Number(e.target.value))}
                  className="h-10 rounded-md border border-border px-3 py-2 bg-background text-foreground"
                >
                  <option value="all">All</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.startDate ? new Date(s.startDate).getFullYear() : s.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mr-2">Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as any)}
                  className="h-10 rounded-md border border-border px-3 py-2 bg-background text-foreground"
                >
                  <option value="all">All</option>
                  <option value="LEAGUE_STAGE">League / Group Stage</option>
                  <option value="PLAYOFFS">Playoffs</option>
                  <option value="LAST_16">Last 16</option>
                  <option value="QUARTER_FINALS">Quarter Finals</option>
                  <option value="SEMI_FINALS">Semi Finals</option>
                  <option value="FINAL">Final</option>
                </select>
              </div>
              { (stage === 'LEAGUE_STAGE' || stage === 'GROUP_STAGE') && (
                <div>
                  <label className="text-sm text-muted-foreground mr-2">Matchday</label>
                  <select
                    value={String(matchday ?? 'all')}
                    onChange={(e) => setMatchday(e.target.value === 'all' ? null : Number(e.target.value))}
                    className="h-10 rounded-md border border-border px-3 py-2 bg-background text-foreground"
                  >
                    <option value="all">All</option>
                    {(matchdayCount && matchdayCount > 0 ? Array.from({ length: matchdayCount }, (_, i) => i + 1) : matchdays).map((md) => (
                      <option key={md} value={md}>Matchday {md}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading matches...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {matches.some((m) => STATUS_GROUPS.live.includes((m.status ?? '').toString().toUpperCase())) && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <h2 className="font-bold" style={{ fontFamily: 'Roboto Condensed, sans-serif', fontSize: '28px' }}>
                Live Now
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6">
              {matches
                .filter((m) => STATUS_GROUPS.live.includes((m.status ?? '').toString().toUpperCase()))
                .map((match) => (
                  <MatchCard key={String(match.id)} match={match} onClick={() => router.push(`/matches/${match.id}`)} />
                ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMatches
            .filter((m) => !STATUS_GROUPS.live.includes((m.status ?? '').toString().toUpperCase()))
            .filter((m) => (matchday === null ? true : Number(m.matchday) === Number(matchday)))
            .map((match) => (
              <div key={String(match.id)}>
                <MatchCard match={match} onClick={() => router.push(`/matches/${match.id}`)} />
              </div>
            ))}
        </div>

        {!loading && filteredMatches.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No matches found</p>
          </div>
        )}
      </div>
    </div>
  );
}

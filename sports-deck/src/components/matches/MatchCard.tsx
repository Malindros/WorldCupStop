"use client";

import React from "react";

type TeamRef = { id: number; name: string } | null;

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
};

type Props = {
  match: ApiMatch;
  onClick?: () => void;
};

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

export default function MatchCard({ match, onClick }: Props) {
  const home = match.homeTeam?.name ?? "Home";
  const away = match.awayTeam?.name ?? "Away";
  const homeCrest = (match.homeTeam as any)?.crest;
  const awayCrest = (match.awayTeam as any)?.crest;
  const rawStatus = (match.status ?? '').toString().toUpperCase();
  const status = getStatusLabel(rawStatus);
  let time: string | undefined = undefined;
  if (match.startTime) {
    try {
      const d = new Date(match.startTime);
      if (!Number.isNaN(d.getTime())) time = d.toLocaleString();
      else time = String(match.startTime);
    } catch {
      time = String(match.startTime);
    }
  }

  return (
    <div onClick={onClick} className="p-4 rounded-lg border border-border bg-card hover:shadow-sm cursor-pointer">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted/10 flex items-center justify-center">
              {homeCrest ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={homeCrest} alt={home} loading="lazy" className="w-full h-full object-contain" />
              ) : (
                <div className="text-sm font-semibold">{home.split(' ').map((s) => s[0]).join('').slice(0, 2)}</div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{time}</div>
              <div className="text-lg font-semibold">{home}</div>
            </div>
          </div>
          <div className="text-right">
            {(['Live'].includes(status)) ? (
              <div className="text-sm text-red-500 font-bold">LIVE</div>
            ) : (
              <div className="text-sm text-muted-foreground">{status}</div>
            )}
            {(['Live', 'Finished'].includes(status)) && (
              <div className="text-xl font-bold">{match.homeScore ?? '-'} - {match.awayScore ?? '-'}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted/10 flex items-center justify-center">
              {awayCrest ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={awayCrest} alt={away} loading="lazy" className="w-full h-full object-contain" />
              ) : (
                <div className="text-sm font-semibold">{away.split(' ').map((s) => s[0]).join('').slice(0, 2)}</div>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{away}</div>
              <div className="text-sm text-muted-foreground">{match.matchday ? `Matchday ${match.matchday}` : ''}</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground text-right">{match.venue ?? ''}</div>
        </div>
      </div>
    </div>
  );
}

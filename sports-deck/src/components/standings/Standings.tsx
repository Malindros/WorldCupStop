import React from "react";
import Image from "next/image";
import { prisma } from "@/lib/db";
import StandingsOverflowHint from "./StandingsOverflowHint";

type TeamRow = {
  position: number;
  team: { id: number; name: string; shortName?: string | null; slug?: string | null } | null;
  playedGames: number | null;
  won: number | null;
  draw: number | null;
  lost: number | null;
  points: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
};

export default async function Standings() {
  // server-side: query prisma directly to avoid URL/fetch issues
  let season = await prisma.season.findFirst({ where: { currentMatchday: { not: null } }, orderBy: { startDate: "desc" } });
  if (!season) season = await prisma.season.findFirst({ orderBy: { startDate: "desc" } });
  if (!season) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No season found</p>
      </div>
    );
  }

  const standings = await prisma.teamStanding.findMany({ where: { seasonId: season.id }, orderBy: { position: "asc" }, include: { team: { select: { id: true, name: true, shortName: true, slug: true, crest: true } } } });

  const matches = await prisma.match.findMany({ where: { seasonId: season.id, status: { in: ["finished", "Finished", "FT", "fulltime", "full_time"] } }, orderBy: { startTime: "desc" }, include: { homeTeam: true, awayTeam: true } });

  const byTeam = new Map<number, any[]>();
  for (const m of matches) {
    const homeId = m.homeTeam?.id ?? m.homeTeamId;
    const awayId = m.awayTeam?.id ?? m.awayTeamId;
    if (homeId) {
      const arr = byTeam.get(homeId) ?? [];
      arr.push(m);
      byTeam.set(homeId, arr);
    }
    if (awayId) {
      const arr = byTeam.get(awayId) ?? [];
      arr.push(m);
      byTeam.set(awayId, arr);
    }
  }

  return (
    <div className="p-6">
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border shadow-lg">
        <div className="relative aspect-[5/3] min-h-[200px] max-h-[400px] w-full sm:aspect-[2.6/1] sm:min-h-[220px]">
          <Image
            src="/images/atmosphere/stadium-modern-lights.png"
            alt="League table and standings"
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
              Standings
            </h1>
            <p className="max-w-xl text-white/85 drop-shadow-sm">
              Table rankings, form, and points race at a glance
            </p>
            {season.currentMatchday ? (
              <div className="mt-3 w-fit rounded-full bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                Matchday {season.currentMatchday}
              </div>
            ) : null}
          </div>
        </div>
      </header>

        <StandingsOverflowHint />
        <div id="standings-wrapper" className="overflow-x-auto rounded-md border bg-card">
          <table id="standings-table" className="w-full min-w-[500px] max-w-[1800px] table-fixed border-collapse bg-card text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-30 w-5 bg-muted p-2 text-left">#</th>
              <th className="sticky left-10 z-20 w-15 bg-muted p-2 text-left">Team</th>
              <th className="w-5 p-2">P</th>
              <th className="w-5 p-2">W</th>
              <th className="w-5 p-2">D</th>
              <th className="w-5 p-2">L</th>
              <th className="w-5 p-2">F</th>
              <th className="w-5 p-2">A</th>
              <th className="w-5 p-2">GD</th>
              <th className="w-5 p-2">Pts</th>
              
            </tr>
          </thead>
          <tbody>
            {standings.map((r: any, idx: number) => {
              const teamId = r.team?.id ?? null;
              const recent = teamId ? (byTeam.get(teamId) ?? []).slice(0, 5) : [];

              return (
                <tr key={idx} className="border-t bg-card">
                  <td className="sticky left-0 z-30 bg-card p-2 text-left">{r.position}</td>
                  <td className="sticky left-10 z-20 bg-card p-2"> 
                    <div className="flex items-center gap-3">
                      {r.team?.crest ? (
                        <img src={r.team.crest} alt={r.team?.name ?? "crest"} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">{(r.team?.shortName ?? r.team?.name ?? "").slice(0,2).toUpperCase()}</div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.team?.shortName ?? r.team?.name ?? "—"}</div>
                        <div className="text-muted-foreground text-xs truncate">{r.team?.name && r.team?.shortName ? `(${r.team.name})` : null}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-center">{r.played ?? "-"}</td>
                  <td className="p-2 text-center">{r.wins ?? "-"}</td>
                  <td className="p-2 text-center">{r.draws ?? "-"}</td>
                  <td className="p-2 text-center">{r.losses ?? "-"}</td>
                  <td className="p-2 text-center">{r.goalsFor ?? "-"}</td>
                  <td className="p-2 text-center">{r.goalsAgainst ?? "-"}</td>
                  <td className="p-2 text-center">
                    {typeof r.goalDifference === 'number' ? (
                      (() => {
                        const gd = r.goalDifference as number;
                        const cls = gd > 0 ? 'bg-emerald-600 text-white dark:bg-emerald-500' : gd < 0 ? 'bg-rose-600 text-white dark:bg-rose-500' : 'text-foreground';
                        const label = gd > 0 ? `+${gd}` : `${gd}`;
                        return <span className={`${cls} px-2 py-1 rounded-md font-semibold`}>{label}</span>;
                      })()
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-2 text-center font-semibold">{r.points ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

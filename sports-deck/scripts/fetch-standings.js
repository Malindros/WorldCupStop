#!/usr/bin/env node
/*
 * This script was written with the help of ChatGPT to fetch standings for a
 * competition/season and upsert `TeamStanding` snapshots into the SportsDeck DB.
 *
 * Usage context: Requires `FOOTBALL_API_KEY`. Running this will create or
 * update local `TeamStanding` records via Prisma; it modifies the database.
 */
/**
 * Fetch standings for competition and season and upsert TeamStanding rows.
 * Usage: FOOTBALL_API_KEY=xxx COMPETITION=PL SEASON=2021 node scripts/fetch-standings.js
 */
const { PrismaClient } = require('../prisma/generated');
const prisma = new PrismaClient();

const API_KEY = process.env.FD_TOKEN;
const COMPETITION = 'WC';
const SEASON = process.env.SEASON;

if (!API_KEY) {
  console.error('FD_TOKEN not set. Aborting.');
  process.exit(1);
}

async function fetchStandings() {
  const url = new URL(`https://api.football-data.org/v4/competitions/${COMPETITION}/standings`);
  if (SEASON) url.searchParams.set('season', String(SEASON));
  const res = await fetch(url.toString(), { headers: { 'X-Auth-Token': API_KEY } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function upsertTeamFromShort(t) {
  if (!t || !t.id) return null;
  const externalId = String(t.id);
  return prisma.team.upsert({
    where: { externalId },
    update: {
      name: t.name ?? undefined,
      shortName: t.shortName ?? null,
      tla: t.tla ?? null,
      crest: t.crest ?? null,
      area: t.area ?? null,
      lastUpdated: new Date(),
    },
    create: {
      externalId,
      name: t.name ?? `Team ${externalId}`,
      shortName: t.shortName ?? null,
      tla: t.tla ?? null,
      crest: t.crest ?? null,
      area: t.area ?? null,
      lastUpdated: new Date(),
    },
  });
}

async function run() {
  const data = await fetchStandings();
  const seasonInfo = data.season;
  // find local season by externalId
  let seasonLocal = null;
  if (seasonInfo && seasonInfo.id) {
    seasonLocal = await prisma.season.findUnique({ where: { externalId: Number(seasonInfo.id) } });
  }
  if (!seasonLocal) {
    console.warn('Local season not found for external season id, trying by dates');
    // attempt match by dates
    if (seasonInfo && seasonInfo.startDate && seasonInfo.endDate) {
      seasonLocal = await prisma.season.findFirst({ where: { startDate: new Date(seasonInfo.startDate), endDate: new Date(seasonInfo.endDate) } });
    }
  }

  if (!seasonLocal) {
    console.warn('No season found locally; create one');
    const s = await prisma.season.create({ data: { externalId: seasonInfo?.id ? Number(seasonInfo.id) : undefined, startDate: new Date(seasonInfo.startDate), endDate: new Date(seasonInfo.endDate), currentMatchday: seasonInfo.currentMatchday ?? null } });
    seasonLocal = s;
  }

  let inserted = 0;
  const standings = data.standings || [];
  for (const st of standings) {
    const table = st.table || [];
    for (const row of table) {
      const teamObj = row.team;
      const team = await upsertTeamFromShort(teamObj);
      const tsData = {
        seasonId: seasonLocal.id,
        teamId: team.id,
        position: row.position,
        played: row.playedGames ?? null,
        wins: row.won ?? null,
        draws: row.draw ?? row.draws ?? null,
        losses: row.lost ?? null,
        goalsFor: row.goalsFor ?? null,
        goalsAgainst: row.goalsAgainst ?? null,
        goalDifference: row.goalDifference ?? null,
        points: row.points ?? null,
      };

      // upsert by seasonId + teamId uniqueness not enforced; try find and update
      const existing = await prisma.teamStanding.findFirst({ where: { seasonId: seasonLocal.id, teamId: team.id } });
      if (existing) {
        await prisma.teamStanding.update({ where: { id: existing.id }, data: tsData });
      } else {
        await prisma.teamStanding.create({ data: tsData });
      }
      inserted += 1;
    }
  }

  await prisma.$disconnect();
  return { inserted };
}

if (require.main === module) {
  run().then(r => { console.log('Done standings:', r.inserted); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { run };

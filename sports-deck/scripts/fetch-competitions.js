#!/usr/bin/env node
/*
 * This script was written with the help of ChatGPT to fetch competition
 * (season) metadata and upsert `Season` rows for the SportsDeck project.
 *
 * Usage context: Requires `FOOTBALL_API_KEY`. It will create/update local
 * `Season` and (possibly) `Team` rows via Prisma. Running it modifies your
 * local database; back it up if necessary.
 */
/**
 * Fetch competition details (seasons) and upsert Seasons into DB.
 * Usage: FOOTBALL_API_KEY=xxx COMPETITION=PL node scripts/fetch-competitions.js
 */
const { PrismaClient } = require('../prisma/generated');
const prisma = new PrismaClient();

const API_KEY = process.env.FD_TOKEN;
const COMPETITION = 'WC';

if (!API_KEY) {
  console.error('FD_TOKEN not set. Aborting.');
  process.exit(1);
}

async function fetchCompetition() {
  const url = `https://api.football-data.org/v4/competitions/${COMPETITION}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
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
      lastUpdated: t.lastUpdated ? new Date(t.lastUpdated) : new Date(),
    },
    create: {
      externalId,
      name: t.name ?? `Team ${externalId}`,
      shortName: t.shortName ?? null,
      tla: t.tla ?? null,
      crest: t.crest ?? null,
      area: t.area ?? null,
      lastUpdated: t.lastUpdated ? new Date(t.lastUpdated) : new Date(),
    },
  });
}

async function run() {
  const data = await fetchCompetition();
  // data.seasons is an array
  const seasons = data.seasons || [];
  let count = 0;
  for (const s of seasons) {
    // if a winner exists, ensure the team exists
    let winnerId = null;
    if (s.winner && s.winner.id) {
      const t = await upsertTeamFromShort(s.winner);
      winnerId = t ? t.id : null;
    }
    const externalId = Number(s.id);
    const existing = await prisma.season.findUnique({ where: { externalId } });
    if (existing) {
      await prisma.season.update({ where: { id: existing.id }, data: { startDate: new Date(s.startDate), endDate: new Date(s.endDate), currentMatchday: s.currentMatchday ?? null, winnerId } });
    } else {
      await prisma.season.create({ data: { externalId, startDate: new Date(s.startDate), endDate: new Date(s.endDate), currentMatchday: s.currentMatchday ?? null, winnerId } });
    }
    count += 1;
  }
  await prisma.$disconnect();
  return { count };
}

if (require.main === module) {
  run().then(r => { console.log('Done seasons:', r.count); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { run };

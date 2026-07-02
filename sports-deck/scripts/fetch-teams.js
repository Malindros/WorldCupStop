#!/usr/bin/env node
/*
 * This script was written with the help of ChatGPT to fetch teams for a
 * competition/season and upsert `Team` rows into the local SportsDeck DB.
 *
 * Usage context: Requires `FOOTBALL_API_KEY`. The script will modify local
 * `Team` rows via Prisma upserts; run with care and consider backing up the DB.
 */
/**
 * Fetch teams for a competition and optional season and upsert into Team.
 * Usage: FOOTBALL_API_KEY=xxx COMPETITION=PL SEASON=2021 node scripts/fetch-teams.js
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

async function fetchTeams() {
  const url = new URL(`https://api.football-data.org/v4/competitions/${COMPETITION}/teams`);
  if (SEASON) url.searchParams.set('season', String(SEASON));
  const res = await fetch(url.toString(), { headers: { 'X-Auth-Token': API_KEY } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function upsertTeam(t) {
  if (!t || !t.id) return null;
  const externalId = String(t.id);
  return prisma.team.upsert({
    where: { externalId },
    update: {
      name: t.name ?? undefined,
      shortName: t.shortName ?? null,
      tla: t.tla ?? null,
      crest: t.crest ?? null,
      address: t.address ?? null,
      website: t.website ?? null,
      founded: t.founded ?? null,
      clubColors: t.clubColors ?? null,
      venue: t.venue ?? null,
      area: t.area ?? null,
      runningCompetitions: t.runningCompetitions ?? null,
      coach: t.coach ?? null,
      marketValue: t.marketValue ? Number(t.marketValue) : null,
      squad: t.squad ?? null,
      staff: t.staff ?? null,
      lastUpdated: t.lastUpdated ? new Date(t.lastUpdated) : new Date(),
    },
    create: {
      externalId,
      name: t.name ?? `Team ${externalId}`,
      shortName: t.shortName ?? null,
      tla: t.tla ?? null,
      crest: t.crest ?? null,
      address: t.address ?? null,
      website: t.website ?? null,
      founded: t.founded ?? null,
      clubColors: t.clubColors ?? null,
      venue: t.venue ?? null,
      area: t.area ?? null,
      runningCompetitions: t.runningCompetitions ?? null,
      coach: t.coach ?? null,
      marketValue: t.marketValue ? Number(t.marketValue) : null,
      squad: t.squad ?? null,
      staff: t.staff ?? null,
      lastUpdated: t.lastUpdated ? new Date(t.lastUpdated) : new Date(),
    },
  });
}

async function run() {
  const data = await fetchTeams();
  const list = data.teams || [];
  let count = 0;
  for (const t of list) {
    await upsertTeam(t);
    count += 1;
  }
  await prisma.$disconnect();
  return { count };
}

if (require.main === module) {
  run().then(r => { console.log('Done teams:', r.count); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { run };

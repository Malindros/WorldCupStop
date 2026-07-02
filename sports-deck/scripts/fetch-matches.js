#!/usr/bin/env node
/*
 * This script was written with the help of ChatGPT to provide a simple
 * fetcher for external match data for the SportsDeck project.
 *
 * Usage context: Requires a valid `FOOTBALL_API_KEY`. The script upserts
 * `Team` and `Match` rows into the local database via Prisma and will modify
 * your local DB. Run with care and back up your DB if needed.
 */
/**
 * Simple fetcher for external match data.
 * Usage: FD_TOKEN=abc COMPETITION=CL FORCE=1 node scripts/fetch-matches.js
 */
const { PrismaClient } = require('../prisma/generated');
const prisma = new PrismaClient();

const API_KEY = process.env.FD_TOKEN;
const COMPETITION = 'WC';

if (!API_KEY) {
  console.error('FD_TOKEN not set. Aborting.');
  process.exit(1);
}

// Rate limit: default 10 requests/minute. Honor provider limits via env var.
const REQUESTS_PER_MIN = Number(process.env.REQUESTS_PER_MIN) || 10;
const MIN_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MIN);
const FORCE = ['1', 'true', 'yes', 'on'].includes(String(process.env.FORCE || '').toLowerCase());
const OLDEST_YEAR = 2023; // sanity check to avoid fetching excessively old seasons
const FRESHNESS_WINDOW_MS = 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchWithRetry(url, opts = {}) {
  const maxRetries = Number(process.env.MAX_RETRIES) || 5;
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;

      // handle rate limit / server errors
      if (res.status === 429) {
        const ra = res.headers.get('retry-after');
        const wait = ra ? Number(ra) * 1000 : Math.min(1000 * 2 ** attempt, 60000);
        console.warn(`429 received, retrying after ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        if (attempt >= maxRetries) throw new Error(`Max retries reached 429`);
        continue;
      }
      if (res.status >= 500 && res.status < 600) {
        const wait = Math.min(1000 * 2 ** attempt, 60000);
        console.warn(`${res.status} server error, retrying after ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        if (attempt >= maxRetries) throw new Error(`Max retries reached ${res.status}`);
        continue;
      }

      // non-retryable error
      const nonRetryableError = new Error(`API returned ${res.status}`);
      nonRetryableError.status = res.status;
      throw nonRetryableError;
    } catch (err) {
      if (attempt >= maxRetries || err.status === 403) throw err;
      const wait = Math.min(1000 * 2 ** attempt, 60000);
      console.warn(`Fetch failed (${err.message}), retrying after ${wait}ms`);
      await sleep(wait);
    }
  }
}

async function fetchMatches({ season, matchday, dateFrom, dateTo } = {}) {
  const url = new URL(`https://api.football-data.org/v4/competitions/${COMPETITION}/matches`);
  if (season) url.searchParams.set('season', String(season));
  if (matchday) url.searchParams.set('matchday', String(matchday));
  if (dateFrom) url.searchParams.set('dateFrom', String(dateFrom));
  if (dateTo) url.searchParams.set('dateTo', String(dateTo));

  // Unfold headers control what's returned; default to provider defaults.
  const headers = { 'X-Auth-Token': API_KEY };
  if (process.env.UNFOLD_LINEUPS) headers['X-Unfold-Lineups'] = String(process.env.UNFOLD_LINEUPS);
  if (process.env.UNFOLD_BOOKINGS) headers['X-Unfold-Bookings'] = String(process.env.UNFOLD_BOOKINGS);
  if (process.env.UNFOLD_SUBS) headers['X-Unfold-Subs'] = String(process.env.UNFOLD_SUBS);
  if (process.env.UNFOLD_GOALS) headers['X-Unfold-Goals'] = String(process.env.UNFOLD_GOALS);

  const res = await fetchWithRetry(url.toString(), { headers });
  return res.json();
}

async function getKnownSeasonsToFetch({ explicitSeason } = {}) {
  if (explicitSeason) {
    const byExternalId = await prisma.season.findUnique({
      where: { externalId: Number(explicitSeason) },
      select: { id: true, externalId: true, startDate: true },
    });

    if (byExternalId) return [byExternalId];

    const byYear = await prisma.season.findMany({
      where: {
        startDate: {
          gte: new Date(`${explicitSeason}-01-01T00:00:00.000Z`),
          lt: new Date(`${Number(explicitSeason) + 1}-01-01T00:00:00.000Z`),
        },
      },
      select: { id: true, externalId: true, startDate: true },
    });

    return byYear;
  }

  return prisma.season.findMany({
    select: { id: true, externalId: true, startDate: true },
    orderBy: { startDate: 'desc' },
  });
}

function getSeasonYearFromRecord(seasonRecord) {
  if (!seasonRecord?.startDate) return null;
  const date = new Date(seasonRecord.startDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

async function shouldSkipSeasonFetch(seasonId) {
  const oldest = await prisma.match.findFirst({
    where: { seasonId },
    orderBy: { updatedAt: 'asc' },
    select: { updatedAt: true },
  });

  if (!oldest?.updatedAt) return false;
  const cutoff = Date.now() - FRESHNESS_WINDOW_MS;
  return oldest.updatedAt.getTime() >= cutoff;
}

function mapMatch(item) {
  const externalId = String(item.id ?? `${item.utcDate}-${item.homeTeam?.id || ''}-${item.awayTeam?.id || ''}`);
  const score = item.score ?? null;
  return {
    externalId,
    startTime: item.utcDate ? new Date(item.utcDate) : new Date(),
    endTime: item.endTime ? new Date(item.endTime) : null,
    status: item.status ?? 'SCHEDULED',
    homeScore: score?.fullTime?.home ?? null,
    awayScore: score?.fullTime?.away ?? null,
    utcDate: item.utcDate ? new Date(item.utcDate) : null,
    minute: item.minute ?? null,
    injuryTime: item.injuryTime ?? null,
    attendance: item.attendance ?? null,
    venue: item.venue ?? null,
    matchday: item.matchday ?? null,
    stage: item.stage ?? null,
    group: item.group ?? null,
    homeDetails: item.homeTeam ?? null,
    awayDetails: item.awayTeam ?? null,
    score,
    goals: item.goals ?? null,
    penalties: score?.penalties ?? item.penalties ?? null,
    bookings: item.bookings ?? null,
    substitutions: item.substitutions ?? null,
    odds: item.odds ?? null,
    referees: item.referees ?? null,
    season: item.season ?? null,
    lastUpdated: new Date(),
  };
}

async function resolveSeasonIdFromPayload(seasonInfo) {
  const seasonExternalId = seasonInfo?.id ? Number(seasonInfo.id) : null;
  if (!seasonExternalId) return null;

  const startDate = seasonInfo?.startDate ? new Date(seasonInfo.startDate) : null;
  const endDate = seasonInfo?.endDate ? new Date(seasonInfo.endDate) : null;
  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    const existing = await prisma.season.findUnique({ where: { externalId: seasonExternalId }, select: { id: true } });
    return existing ? existing.id : null;
  }

  const season = await prisma.season.upsert({
    where: { externalId: seasonExternalId },
    update: {
      startDate,
      endDate,
      currentMatchday: seasonInfo.currentMatchday ?? null,
    },
    create: {
      externalId: seasonExternalId,
      startDate,
      endDate,
      currentMatchday: seasonInfo.currentMatchday ?? null,
    },
    select: { id: true },
  });

  return season.id;
}

async function upsertMatch(m) {
  return prisma.match.upsert({
    where: { externalId: m.externalId },
    update: {
      startTime: m.startTime,
      endTime: m.endTime,
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      utcDate: m.utcDate,
      minute: m.minute,
      injuryTime: m.injuryTime,
      attendance: m.attendance,
      venue: m.venue,
      matchday: m.matchday,
      stage: m.stage,
      group: m.group,
      seasonId: m.seasonId,
      homeDetails: m.homeDetails,
      awayDetails: m.awayDetails,
      score: m.score,
      goals: m.goals,
      penalties: m.penalties,
      bookings: m.bookings,
      substitutions: m.substitutions,
      odds: m.odds,
      referees: m.referees,
      lastUpdated: m.lastUpdated,
    },
    create: {
      externalId: m.externalId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      startTime: m.startTime,
      endTime: m.endTime,
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      utcDate: m.utcDate,
      minute: m.minute,
      injuryTime: m.injuryTime,
      attendance: m.attendance,
      venue: m.venue,
      matchday: m.matchday,
      stage: m.stage,
      group: m.group,
      seasonId: m.seasonId,
      homeDetails: m.homeDetails,
      awayDetails: m.awayDetails,
      score: m.score,
      goals: m.goals,
      penalties: m.penalties,
      bookings: m.bookings,
      substitutions: m.substitutions,
      odds: m.odds,
      referees: m.referees,
      lastUpdated: m.lastUpdated,
    },
  });
}

function getMatchThreadWindow(matchRecord) {
  const start = matchRecord.startTime ? new Date(matchRecord.startTime) : new Date();
  const end = matchRecord.endTime ? new Date(matchRecord.endTime) : start;
  return {
    autoOpenAt: new Date(start.getTime() - TWO_WEEKS_MS),
    autoCloseAt: new Date(end.getTime() + TWO_WEEKS_MS),
  };
}

async function ensureMatchThread(matchRecord, homeTeam, awayTeam) {
  const { autoOpenAt, autoCloseAt } = getMatchThreadWindow(matchRecord);
  const title = `Match Thread: ${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`;
  const existing = await prisma.forumThread.findFirst({
    where: { matchId: matchRecord.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.forumThread.update({
      where: { id: existing.id },
      data: {
        title,
        autoOpenAt,
        autoCloseAt,
      },
    });
    return;
  }

  try {
    await prisma.forumThread.create({
      data: {
        matchId: matchRecord.id,
        title,
        slug: `match-${matchRecord.id}`,
        autoOpenAt,
        autoCloseAt,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      await prisma.forumThread.create({
        data: {
          matchId: matchRecord.id,
          title,
          autoOpenAt,
          autoCloseAt,
        },
      });
      return;
    }
    throw err;
  }
}

async function upsertTeam(teamObj) {
  if (!teamObj || !teamObj.id) return null;
  const externalId = String(teamObj.id);
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(teamObj, key);

  const createData = {
    externalId,
    name: teamObj.name || `Team ${externalId}`,
  };
  const updateData = {
    lastUpdated: new Date(),
  };

  if (hasOwn('name') && teamObj.name) {
    updateData.name = teamObj.name;
  }
  if (hasOwn('shortName')) {
    createData.shortName = teamObj.shortName ?? null;
    updateData.shortName = teamObj.shortName ?? null;
  }
  if (hasOwn('tla')) {
    createData.tla = teamObj.tla ?? null;
    updateData.tla = teamObj.tla ?? null;
  }
  if (hasOwn('crest')) {
    createData.crest = teamObj.crest ?? null;
    updateData.crest = teamObj.crest ?? null;
  }

  const t = await prisma.team.upsert({
    where: { externalId },
    update: updateData,
    create: createData,
  });
  return t;
}

async function run() {
  const explicitSeason = process.env.SEASON;
  const matchday = process.env.MATCHDAY;
  const dateFrom = process.env.DATE_FROM || process.env.DATEFROM;
  const dateTo = process.env.DATE_TO || process.env.DATETO;

  let fetchedMatches = 0;
  let processedSeasons = 0;
  let skippedFresh = 0;
  let skippedForbidden = 0;

  try {
    const seasons = await getKnownSeasonsToFetch({ explicitSeason });

    if (!seasons.length) {
      console.warn('No known seasons found locally. Run fetch-competitions first.');
      return { count: 0, processedSeasons: 0, skippedFresh: 0, skippedForbidden: 0 };
    }

    for (const seasonRecord of seasons) {
      const seasonYear = getSeasonYearFromRecord(seasonRecord);
      if (!seasonYear) {
        console.warn(`Skipping season id=${seasonRecord.id} (missing/invalid startDate)`);
        continue;
      }
      if (seasonYear < OLDEST_YEAR) {
        // console.warn(`Skipping season ${seasonYear}: older than cutoff ${OLDEST_YEAR}`);
        continue;
      }

      if (!FORCE) {
        const skipForFreshness = await shouldSkipSeasonFetch(seasonRecord.id);
        if (skipForFreshness) {
          skippedFresh += 1;
          console.log(`Skipping season ${seasonYear}: data was updated within the last hour`);
          continue;
        }
      }

      processedSeasons += 1;
      console.log(`Fetching season ${seasonYear}...`);

      let json;
      try {
        json = await fetchMatches({ season: seasonYear, matchday, dateFrom, dateTo });
        await sleep(MIN_INTERVAL_MS);
      } catch (err) {
        if (err?.status === 403 || String(err?.message || '').includes('403')) {
          skippedForbidden += 1;
          console.warn(`Skipping season ${seasonYear}: API access restricted (403)`);
          await sleep(MIN_INTERVAL_MS);
          continue;
        }
        throw err;
      }

      const list = json.matches || [];
      for (const item of list) {
        const home = await upsertTeam(item.homeTeam);
        const away = await upsertTeam(item.awayTeam);
        if (!home || !away) {
          console.warn(`Skipping malformed match payload id=${item?.id ?? 'unknown'} (missing home/away team)`);
          continue;
        }
        const mapped = mapMatch(item);
        mapped.homeTeamId = home ? home.id : null;
        mapped.awayTeamId = away ? away.id : null;
        mapped.seasonId = await resolveSeasonIdFromPayload(mapped.season);
        const upsertedMatch = await upsertMatch(mapped);
        await ensureMatchThread(upsertedMatch, home, away);
      }

      fetchedMatches += list.length;
    }

    console.log('Fetched and upserted', fetchedMatches, 'matches');
    return {
      count: fetchedMatches,
      processedSeasons,
      skippedFresh,
      skippedForbidden,
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  run()
    .then((res) => {
      console.log('Done. Matches:', res.count);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fetch failed', err);
      process.exitCode = 1;
    });
}

module.exports = { run };

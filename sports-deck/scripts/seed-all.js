/*
 * This script was written with the help of ChatGPT to provide a comprehensive seed for the SportsDeck application.
 *
 * Seed the SportsDeck database with teams, standings snapshots, users, matches, threads, posts, and edits.
 * Also resets autoincrement counters (SQLite) so IDs start from 1.
 * Usage:
 *   node scripts/seed-all.js            # reset and seed everything
 *   node scripts/seed-all.js --no-reset # seed without truncating existing data
 */

const { PrismaClient } = require("../prisma/generated");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const USERS = [
  { username: "admin", password: "a", role: "ADMIN", favorite: "lions" },
  { username: "homefan", password: "b", role: "USER", favorite: "lions" },
  { username: "awayfan", password: "b", role: "USER", favorite: "tigers" },
  { username: "neutral", password: "b", role: "USER", favorite: null },
  { username: "statsguru", password: "b", role: "USER", favorite: "eagles" },
  { username: "reporter", password: "b", role: "USER", favorite: "sharks" },
  { username: "casual", password: "b", role: "USER", favorite: "lions" },
  { username: "coachmode", password: "b", role: "USER", favorite: "tigers" },
  { username: "northside", password: "b", role: "USER", favorite: "falcons" },
  { username: "southside", password: "b", role: "USER", favorite: "dragons" },
];

const TEAMS = [
  { key: "lions", name: "Metro City Lions", shortName: "Lions", slug: "lions" },
  { key: "tigers", name: "Harbor Tigers", shortName: "Tigers", slug: "tigers" },
  { key: "eagles", name: "Highland Eagles", shortName: "Eagles", slug: "eagles" },
  { key: "sharks", name: "Bay Sharks", shortName: "Sharks", slug: "sharks" },
  { key: "falcons", name: "Forest Falcons", shortName: "Falcons", slug: "falcons" },
  { key: "dragons", name: "River Dragons", shortName: "Dragons", slug: "dragons" },
  // Placeholder for a team with no matches
  { key: "ghosts", name: "Ghost Town Ghosts", shortName: "Ghosts", slug: "ghosts" },
];
// Placeholder seasons to cover /seasons, /seasons/:id, /seasons/:id/standings, /seasons/:id/matchdays, /seasons/:id/matchdays/:matchday/matches
const SEASONS = [
  {
    key: "2024",
    startDate: new Date("2024-08-01"),
    endDate: new Date("2025-05-31"),
    winnerKey: "lions",
    currentMatchday: 2,
    externalId: 2024
  },
  {
    key: "2023",
    startDate: new Date("2023-08-01"),
    endDate: new Date("2024-05-31"),
    winnerKey: "sharks",
    currentMatchday: 5,
    externalId: 2023
  },
];

async function seedSeasons(teamMap) {
  const created = {};
  for (const s of SEASONS) {
    created[s.key] = await prisma.season.create({
      data: {
        startDate: s.startDate,
        endDate: s.endDate,
        winnerId: s.winnerKey ? teamMap[s.winnerKey].id : null,
        currentMatchday: s.currentMatchday,
        externalId: s.externalId,
      },
    });
  }
  console.log(`Seeded ${Object.keys(created).length} seasons`);
  return created;
}

async function resetAll() {
  console.log("Clearing tables...");
  // Order matters due to FK constraints
  await prisma.dailyDigest.deleteMany();
  await prisma.teamStanding.deleteMany();
  await prisma.sentimentSummary.deleteMany();
  await prisma.postEdit.deleteMany();
  await prisma.post.deleteMany();
  await prisma.forumThread.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.translationCache.deleteMany();
  await prisma.user.deleteMany();
  await prisma.season.deleteMany();

  try {
    await prisma.$executeRawUnsafe(
      "DELETE FROM sqlite_sequence WHERE name IN ('DailyDigest','TeamStanding','SentimentSummary','PostEdit','Post','ForumThread','Match','Team','TranslationCache','User', 'Season')"
    );
    console.log("Reset autoincrement counters (sqlite_sequence)");
  } catch (err) {
    console.warn("Skipping autoincrement reset (non-SQLite or not supported)");
  }
}

async function seedTeams() {
  const created = {};
  for (const team of TEAMS) {
    created[team.key] = await prisma.team.create({
      data: {
        name: team.name,
        shortName: team.shortName,
        slug: team.slug,
      },
    });
  }
  console.log(`Seeded ${Object.keys(created).length} teams`);
  return created;
}

async function seedUsers(teamMap) {
  const created = {};
  for (const user of USERS) {
    const hashed = await bcrypt.hash(user.password, 10);
    const favoriteTeamId = user.favorite ? teamMap[user.favorite].id : null;
    created[user.username] = await prisma.user.create({
      data: {
        username: user.username,
        password: hashed,
        role: user.role,
        favoriteTeamId,
      },
    });
  }
  console.log(`Seeded ${Object.keys(created).length} users`);
  return created;
}

async function seedMatches(teamMap) {
  const seasonId = (await prisma.season.findFirst({ where: { externalId: 2024 } })).id;
  const now = Date.now();
  const matches = await prisma.$transaction([
    prisma.match.create({
      data: {
        homeTeamId: teamMap.lions.id,
        awayTeamId: teamMap.tigers.id,
        homeScore: 3,
        awayScore: 1,
        status: "finished",
        startTime: new Date(now - 3 * 60 * 60 * 1000),
        endTime: new Date(now - 2 * 60 * 60 * 1000),
        matchday: 1,
        seasonId: seasonId,
      },
    }),
    prisma.match.create({
      data: {
        homeTeamId: teamMap.eagles.id,
        awayTeamId: teamMap.sharks.id,
        homeScore: 2,
        awayScore: 2,
        status: "finished",
        startTime: new Date(now - 5 * 60 * 60 * 1000),
        endTime: new Date(now - 4 * 60 * 60 * 1000),
        matchday: 1,
        seasonId: seasonId,
      },
    }),
    prisma.match.create({
      data: {
        homeTeamId: teamMap.falcons.id,
        awayTeamId: teamMap.dragons.id,
        homeScore: 0,
        awayScore: 1,
        status: "finished",
        startTime: new Date(now - 8 * 60 * 60 * 1000),
        endTime: new Date(now - 7 * 60 * 60 * 1000),
        matchday: 2,
        seasonId: seasonId,
      },
    }),
    prisma.match.create({
      data: {
        homeTeamId: teamMap.lions.id,
        awayTeamId: teamMap.eagles.id,
        status: "scheduled",
        startTime: new Date(now + 24 * 60 * 60 * 1000),
        matchday: 3,
        seasonId: seasonId,
      },
    }),
  ]);

  const matchThreads = await Promise.all(matches.map(async (match) => {
    const homeTeam = Object.values(teamMap).find((team) => team.id === match.homeTeamId);
    const awayTeam = Object.values(teamMap).find((team) => team.id === match.awayTeamId);
    const start = match.startTime ? new Date(match.startTime) : new Date();
    const end = match.endTime ? new Date(match.endTime) : start;
    const autoOpenAt = new Date(start.getTime() - TWO_WEEKS_MS);
    const autoCloseAt = new Date(end.getTime() + TWO_WEEKS_MS);

    return prisma.forumThread.create({
      data: {
        title: `Match Thread: ${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`,
        slug: `match-${match.id}`,
        matchId: match.id,
        autoOpenAt,
        autoCloseAt,
      },
    });
  }));

  console.log(`Seeded ${matches.length} matches (3 finished, 1 scheduled)`);
  return { matches, matchThreads };
}

async function seedThreads(matchThreads) {

  const teamThreads = await Promise.all([
    prisma.forumThread.create({
      data: {
        title: "Team Thread: Eagles Season Chat",
        slug: "team-eagles",
        teamId: (await prisma.team.findFirst({ where: { slug: "eagles" } })).id,
      },
    }),
    prisma.forumThread.create({
      data: {
        title: "Team Thread: Sharks Tactics Lab",
        slug: "team-sharks",
        teamId: (await prisma.team.findFirst({ where: { slug: "sharks" } })).id,
      },
    }),
    prisma.forumThread.create({
      data: {
        title: "General: Power Rankings Week 5",
        slug: "general-power-rankings",
      },
    }),
    prisma.forumThread.create({
      data: {
        title: "General: Transfer Rumors",
        slug: "general-transfers",
      },
    }),
  ]);

  const allThreads = [...matchThreads, ...teamThreads];
  console.log(`Seeded ${allThreads.length} threads (match + team + general)`);
  return { matchThreads, teamThreads, allThreads };
}

async function seedPosts({ threads, users, teamMap }) {
  const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const matchThreadIds = threads.matchThreads.map((t) => t.id);
  const extraPosts = [];

  // Rich content across all threads with multiple languages and perspectives
  const postsData = [
    { threadId: matchThreadIds[0], authorId: users.homefan.id, content: "What a win! The Lions dominated the second half.", language: "en" },
    { threadId: matchThreadIds[0], authorId: users.awayfan.id, content: "Tough loss, the Tigers defense collapsed late.", language: "en" },
    { threadId: matchThreadIds[0], authorId: users.neutral.id, content: "Great entertainment, both teams showed heart.", language: "en" },
    { threadId: matchThreadIds[0], authorId: users.admin.id, content: "Ref decisions were questionable, but the Lions pressing was key.", language: "en" },
    { threadId: matchThreadIds[1], authorId: users.statsguru.id, content: "xG was 1.9 vs 1.8, a fair draw in my book.", language: "en" },
    { threadId: matchThreadIds[1], authorId: users.reporter.id, content: "Late equalizer felt deserved after the Sharks barrage.", language: "en" },
    { threadId: matchThreadIds[1], authorId: users.casual.id, content: "Increíble partido, los equipos no dejaron de atacar!", language: "es" },
    { threadId: matchThreadIds[2], authorId: users.northside.id, content: "Tough away loss, but Dragons looked clinical.", language: "en" },
    { threadId: matchThreadIds[2], authorId: users.southside.id, content: "驚いた！ドラゴンズのカウンターが鋭かった。", language: "ja" },
    { threadId: threads.teamThreads[0].id, authorId: users.homefan.id, content: "Eagles are building momentum this season!", language: "en" },
    { threadId: threads.teamThreads[0].id, authorId: users.neutral.id, content: "Curious to see if the Eagles can keep up the form.", language: "en" },
    { threadId: threads.teamThreads[0].id, authorId: users.statsguru.id, content: "Their PPDA dropped from 12 to 9, pressing harder now.", language: "en" },
    { threadId: threads.teamThreads[1].id, authorId: users.reporter.id, content: "Sharks experimenting with a back three this week.", language: "en" },
    { threadId: threads.teamThreads[1].id, authorId: users.casual.id, content: "Les Sharks vont surprendre cette année!", language: "fr" },
    { threadId: threads.teamThreads[1].id, authorId: users.awayfan.id, content: "Their wingbacks still look shaky in transition.", language: "en" },
    { threadId: threads.teamThreads[2].id, authorId: users.admin.id, content: "Power Rankings: Lions jump to #1 after a statement win.", language: "en" },
    { threadId: threads.teamThreads[2].id, authorId: users.statsguru.id, content: "Falcons still top-4 in non-pen xG difference.", language: "en" },
    { threadId: threads.teamThreads[2].id, authorId: users.northside.id, content: "Dragons slipping—three straight games without a clean sheet.", language: "en" },
    { threadId: threads.teamThreads[3].id, authorId: users.reporter.id, content: "Rumor: Falcons targeting a creative 10 from South America.", language: "en" },
    { threadId: threads.teamThreads[3].id, authorId: users.southside.id, content: "Los Dragones necesitan un nueve goleador urgente.", language: "es" },
    { threadId: threads.teamThreads[3].id, authorId: users.casual.id, content: "Sharks scouting an academy winger to promote.", language: "en" },
  ];

  // add extra filler posts for volume
  for (let i = 0; i < 20; i++) {
    extraPosts.push({
      threadId: random(threads.allThreads).id,
      authorId: random(Object.values(users)).id,
      content: `Extra chatter ${i + 1} about form, tactics, and vibes.`,
      language: "en",
    });
  }

  const created = [];
  for (const p of [...postsData, ...extraPosts]) {
    const post = await prisma.post.create({ data: p });
    created.push(post);
  }

  console.log(`Seeded ${created.length} posts across ${threads.allThreads.length} threads`);

  // Create some replies (parentPostId) — not every post, just a subset
  const repliesCount = Math.min(30, Math.max(5, Math.floor(created.length * 0.2)));
  const replies = [];
  for (let i = 0; i < repliesCount; i++) {
    const parent = random(created);
    const author = random(Object.values(users));
    const reply = await prisma.post.create({
      data: {
        threadId: parent.threadId,
        authorId: author.id,
        parentPostId: parent.id,
        content: `Reply to post ${parent.id}: I agree with this point and have thoughts.`,
        language: parent.language || "en",
      },
    });
    replies.push(reply);
  }

  console.log(`Seeded ${replies.length} replies`);
  return [...created, ...replies];
}

async function seedEdits(posts, users) {
  const edits = [];

  // Deterministic: only posts with even IDs get edits. No randomness.
  const postsToEdit = posts.filter((p) => Number(p.id) % 2 === 0);

  for (const post of postsToEdit) {
    const prev = `${post.content} (earlier tweak)`;
    const edit = await prisma.postEdit.create({
      data: {
        postId: post.id,
        previousContent: prev,
        language: post.language,
        editorId: users.admin.id,
      },
    });
    edits.push(edit);
  }

  console.log(`Seeded ${edits.length} post edits for ${postsToEdit.length} posts (even IDs only)`);
  return edits;
}

// Standings for each season and matchday
async function seedStandings(teamMap, seasonMap) {
  const now = Date.now();
  let count = 0;
  for (const seasonKey in seasonMap) {
    const season = seasonMap[seasonKey];
    let matchday = 1;
    let pos = 1;
    for (const teamKey of Object.keys(teamMap)) {
      // Only seed for real teams
      if (["ghosts"].includes(teamKey)) continue;
      await prisma.teamStanding.create({
        data: {
          teamId: teamMap[teamKey].id,
          seasonId: season.id,
          position: pos,
          points: 10 + pos,
          goalDifference: 5 - pos,
          played: matchday,
          wins: pos % 2 === 0 ? 1 : 0,
          draws: pos % 3 === 0 ? 1 : 0,
          losses: pos % 2 === 1 ? 1 : 0,
          goalsFor: 2 * pos,
          goalsAgainst: pos,
          updatedAt: new Date(now - matchday * 24 * 60 * 60 * 1000),
        },
      });
      pos++;
      count++;
    }
  }
  console.log(`Seeded ${count} team standings (all seasons, matchdays)`);
}

async function main() {
  const args = process.argv.slice(2);
  const doReset = !args.includes("--no-reset");

  try {
    if (doReset) {
      await resetAll();
    }

    const teamMap = await seedTeams();
    const users = await seedUsers(teamMap);
    const seasonMap = await seedSeasons(teamMap);
    await seedStandings(teamMap, seasonMap);
    const { matchThreads } = await seedMatches(teamMap);
    const threads = await seedThreads(matchThreads);
    const posts = await seedPosts({ threads, users, teamMap });
    await seedEdits(posts, users);

    console.log("Seed complete.");
  } catch (err) {
    console.error("Seeding failed", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

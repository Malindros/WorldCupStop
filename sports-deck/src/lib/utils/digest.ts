// This module was written with the help of ChatGPT, with some manual changes and additions.

import { prisma } from "@/lib/db";
import { client, HF_MODEL } from "@/lib/inference";

const DIGEST_SLOT_HOUR_UTC = Number(process.env.DIGEST_SLOT_HOUR_UTC || 8);
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Return the active digest slot timestamp in UTC.
 * Example with slot hour = 08:00 UTC:
 * - If now is 09:00 UTC, slot is today at 08:00 UTC.
 * - If now is 05:00 UTC, slot is yesterday at 08:00 UTC.
 */
function getDigestSlotStartUtc(now = new Date()) {
    const todaySlot = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        DIGEST_SLOT_HOUR_UTC,
        0,
        0,
        0,
    ));

    if (now >= todaySlot) return todaySlot;
    return new Date(todaySlot.getTime() - DIGEST_WINDOW_MS);
}

/** 
 * Fetch top forum threads since a date, ranked by post count and last activity.
 */
async function fetchTopThreadsSince(since: Date) {
    const groups = await prisma.post.groupBy({
        by: ["threadId"],
        where: { createdAt: { gte: since }, isHidden: false },
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: [
            { _count: { id: "desc" } },
            { _max: { createdAt: "desc" } },
        ],
        take: 5,
    });

    if (!groups.length) return [];

    const groupsWithThreadId = groups.filter((g): g is (typeof g & { threadId: number }) => g.threadId !== null);
    const threadIds = groupsWithThreadId.map((g) => g.threadId);
    if (!threadIds.length) return [];

    const threads = await prisma.forumThread.findMany({
        where: { id: { in: threadIds } },
        select: { id: true, title: true, slug: true },
    });
    const threadMap = new Map(threads.map((t) => [t.id, t]));

    return groupsWithThreadId.map((g) => ({
        threadId: g.threadId,
        title: threadMap.get(g.threadId)?.title || `Thread ${g.threadId}`,
        slug: threadMap.get(g.threadId)?.slug || null,
        postCount: g._count.id,
        lastActivity: g._max.createdAt,
    }));
}

/** 
 * Fetch recently finished matches since the given date. 
*/
async function fetchRecentMatches(since: Date) {
    const matches = await prisma.match.findMany({
        where: {
            AND: [
                { status: "finished" },
                {
                    OR: [
                        { endTime: { gte: since } },
                        { startTime: { gte: since } },
                    ],
                },
            ],
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { endTime: "desc" },
    });

    return matches.map((m) => ({
        matchId: m.id,
        homeTeam: m.homeTeam?.name || "Home",
        awayTeam: m.awayTeam?.name || "Away",
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
        status: m.status,
        startTime: m.startTime,
        endTime: m.endTime,
    }));
}

/** 
 * Compute team standings changes since the provided date. 
 */
async function fetchStandingChanges(since: Date) {
    const standings = await prisma.teamStanding.findMany({
        include: { team: true },
        orderBy: { updatedAt: "desc" },
    });

    const latestByTeam = new Map();
    const previousByTeam = new Map();

    for (const row of standings) {
        if (!latestByTeam.has(row.teamId)) {
            latestByTeam.set(row.teamId, row);
        }
        if (row.updatedAt < since && !previousByTeam.has(row.teamId)) {
            previousByTeam.set(row.teamId, row);
        }
    }

    const changes = [];
    for (const [teamId, latest] of latestByTeam.entries()) {
        const prev = previousByTeam.get(teamId);
        if (!prev) continue;
        const delta = prev.position - latest.position;
        if (delta === 0) continue;
        changes.push({
            teamId,
            teamName: latest.team?.name || `Team ${teamId}`,
            from: prev.position,
            to: latest.position,
            delta,
        });
    }

    return changes;
}

/** Build an AI prompt from top threads, matches, and standings changes. */
function buildPrompt({ topThreads, recentMatches, standingsChanges }: {
    topThreads: Awaited<ReturnType<typeof fetchTopThreadsSince>>;
    recentMatches: Awaited<ReturnType<typeof fetchRecentMatches>>;
    standingsChanges: Awaited<ReturnType<typeof fetchStandingChanges>>;
}) {
    const payload = {
        topThreads,
        recentMatches,
        standingsChanges,
    };

    return [
        "You are an AI sports editor writing a concise daily digest for fans.",
        "Use the provided data to craft a short plaintext summary with three sections: Top Discussions, Recent Matches, Standings Moves.",
        "Keep it fact-based, energetic, and under 250 words. Avoid repeating IDs - prefer team and thread names.",
        "If a section has no data, mention that briefly.",
        "Respond entirely in english. Do not use any formatting, markdown, or special characters. Just plain text.",
        "Input data (JSON):",
        JSON.stringify(payload, null, 2),
    ].join("\n");
}

/** 
 * Call inference API to generate a digest text based on the provided data.
 */
async function generateDigestText({ topThreads, recentMatches, standingsChanges }: {
    topThreads: Awaited<ReturnType<typeof fetchTopThreadsSince>>;
    recentMatches: Awaited<ReturnType<typeof fetchRecentMatches>>;
    standingsChanges: Awaited<ReturnType<typeof fetchStandingChanges>>;
}) {
    const prompt = buildPrompt({ topThreads, recentMatches, standingsChanges });
    console.log("prompt char length:", prompt.length);

    const response = await client.chatCompletion({
        model: HF_MODEL,
        messages: [
            {
                role: "system",
                content: "You turn sports forum activity into a short daily digest, written in english. Respond with plaintext only, no code fences.",
            },
            { role: "user", content: prompt },
        ],
        max_tokens: 600,
    });

    const text = response?.choices?.[0]?.message?.content || "";
    return text.trim();
}

/** 
 * Format a daily digest record for API response, including content and metadata.
 */
function formatDigestForResponse(
    digest: NonNullable<Awaited<ReturnType<typeof prisma.dailyDigest.findUnique>>>,
    cached: boolean,
) {
    const content = (digest.content ?? {}) as Record<string, unknown>;
    return {
        id: digest.id,
        date: digest.date,
        generatedAt: digest.updatedAt,
        cached,
        summary: typeof content.summary === "string" ? content.summary : "",
        sections: {
            topThreads: Array.isArray(content.topThreads) ? content.topThreads : [],
            recentMatches: Array.isArray(content.recentMatches) ? content.recentMatches : [],
            standingsChanges: Array.isArray(content.standingsChanges) ? content.standingsChanges : [],
        },
    };
}

/** Retrieve existing daily digest or generate and persist a new one. */
type DigestOptions = {
    requestedByUserId?: number;
    force?: boolean;
};

export async function getOrCreateDailyDigest({ requestedByUserId, force = false }: DigestOptions = {}) {
    if (!process.env.HF_TOKEN) {
        throw new Error("HF_TOKEN is not configured");
    }

    const now = new Date();
    const slotStart = getDigestSlotStartUtc(now);
    const since = new Date(slotStart.getTime() - DIGEST_WINDOW_MS);
    const digestForSlot = await prisma.dailyDigest.findUnique({ where: { date: slotStart } });

    // If this slot already has a digest and force is not set, return cached digest.
    if (!force && digestForSlot) {
        return { digest: digestForSlot, cached: true, content: formatDigestForResponse(digestForSlot, true) };
    }

    const [topThreads, recentMatches, standingsChanges] = await Promise.all([
        fetchTopThreadsSince(since),
        fetchRecentMatches(since),
        fetchStandingChanges(since),
    ]);

    const digestText = await generateDigestText({ topThreads, recentMatches, standingsChanges });

    const date = slotStart;
    const payload = {
        summary: digestText,
        topThreads,
        recentMatches,
        standingsChanges,
        generatedAt: now.toISOString(),
    };

    const digest = await prisma.dailyDigest.upsert({
        where: { date },
        update: {
            content: payload,
            generatedById: requestedByUserId || null,
        },
        create: {
            date,
            content: payload,
            generatedById: requestedByUserId || null,
        },
    });

    return { digest, cached: false, content: formatDigestForResponse(digest, false) };
}

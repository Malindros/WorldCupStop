// This module was written with the help of ChatGPT, with some manual changes and additions.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { computeThreadSentiment, normalizeSentimentRecord } from "@/lib/utils/sentiment";
import { verifyIdParam } from "@/lib/utils/validation";
import { isThreadVisible } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

type ThreadWithMatch = {
    id: number;
    matchId: number | null;
    match: {
        homeTeamId: number;
        awayTeamId: number;
        homeTeam: { name: string | null } | null;
        awayTeam: { name: string | null } | null;
    } | null;
};

function buildResponse(
    thread: ThreadWithMatch,
    summaries: Awaited<ReturnType<typeof prisma.sentimentSummary.findMany>>,
    cached: boolean,
    postCount: number,
    lastPostAt: Date | null,
) {
    const overall = summaries.find((s) => s.scope === "overall") || null;

    let home = null;
    let away = null;
    if (thread.match) {
        const match = thread.match;
        home = summaries.find((s) => s.teamId === match.homeTeamId) || null;
        away = summaries.find((s) => s.teamId === match.awayTeamId) || null;
    }

    return {
        threadId: thread.id,
        matchId: thread.matchId || null,
        cache: {
            cached,
            invalidation: "new-post",
            postCount,
            lastPostAt,
        },
        overall: overall
            ? {
                ...normalizeSentimentRecord({ score: overall.score }),
                computedAt: overall.computedAt,
            }
            : null,
        teams: [
            home ? {
                    teamId: home.teamId,
                    teamName: thread.match?.homeTeam?.name || null,
                    ...normalizeSentimentRecord({ score: home.score }),
                    computedAt: home.computedAt,
                    kind: "home",
                }
                : null,
            away ? {
                    teamId: away.teamId,
                    teamName: thread.match?.awayTeam?.name || null,
                    ...normalizeSentimentRecord({ score: away.score }),
                    computedAt: away.computedAt,
                    kind: "away",
                }
                : null,
        ].filter(Boolean),
    };
}

/**
 * @swagger
 * /api/threads/{id}/sentiment:
 *   get:
 *     summary: Retrieve sentiment summary for a match thread (requires user auth)
 *     description: >
 *       Computes sentiment for a match thread and updates/creates sentiment summary records in the database.
 *       Sentiment is cached in the database and invalidated whenever new posts appear after the last computation.
 *       Requires authenticated user.
 *     tags:
 *       - Threads
 *       - Sentiment
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Numeric ID of the forum thread
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Sentiment summary returned (computed or cached)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - threadId
 *                 - cache
 *               properties:
 *                 threadId:
 *                   type: integer
 *                   description: Forum thread id
 *                 matchId:
 *                   type: integer
 *                   nullable: true
 *                   description: Associated match id, if any
 *                 cache:
 *                   type: object
 *                   properties:
 *                     cached:
 *                       type: boolean
 *                       description: True if the response was returned from cache
 *                     invalidation:
 *                       type: string
 *                       description: Cache invalidation strategy
 *                     postCount:
 *                       type: integer
 *                       description: Number of visible posts used by cache freshness checks
 *                     lastPostAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Timestamp of latest visible post in the thread
 *                 overall:
 *                   oneOf:
 *                     - type: object
 *                       properties:
 *                         sentiment:
 *                           type: string
 *                           description: Label for overall sentiment (negative, neutral, positive)
 *                         score:
 *                           type: number
 *                           format: float
 *                           description: Numeric sentiment score in range 0-100
 *                         computedAt:
 *                           type: string
 *                           format: date-time
 *                           description: UTC timestamp when this summary was computed
 *                     - type: "null"
 *                 teams:
 *                   type: array
 *                   description: Per-team sentiment summaries (home/away)
 *                   items:
 *                     type: object
 *                     properties:
 *                       teamId:
 *                         type: integer
 *                       sentiment:
 *                         type: string
 *                       score:
 *                         type: number
 *                       computedAt:
 *                         type: string
 *                         format: date-time
 *                       kind:
 *                         type: string
 *                         enum: [home, away]
 *             examples:
 *               sampleResponse:
 *                 value:
 *                   threadId: 1
 *                   matchId: 1
 *                   cache:
 *                     cached: false
 *                     invalidation: "new-post"
 *                     postCount: 37
 *                     lastPostAt: "2026-03-01T23:48:02.103Z"
 *                   overall:
 *                     sentiment: "neutral"
 *                     score: 52
 *                     computedAt: "2026-03-01T23:48:51.419Z"
 *                   teams:
 *                     - teamId: 1
 *                       sentiment: "neutral"
 *                       score: 46
 *                       computedAt: "2026-03-01T23:48:51.419Z"
 *                       kind: "home"
 *                     - teamId: 2
 *                       sentiment: "negative"
 *                       score: 28
 *                       computedAt: "2026-03-01T23:48:51.419Z"
 *                       kind: "away"
 *       '400':
 *         description: Invalid request (e.g., non-numeric id) or server-side failure
 *         content:
 *           application/json:
 *             examples:
 *               invalidId:
 *                 value:
 *                   error: "Invalid thread id"
 *       '404':
 *         description: Thread not found
 *         content:
 *           application/json:
 *             examples:
 *               notFound:
 *                 value:
 *                   error: "Thread not found"
 *       '401':
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             examples:
 *               unauthorized:
 *                 value:
 *                   error: "Unauthorized"
 *       '403':
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             examples:
 *               forbidden:
 *                 value:
 *                   error: "Forbidden"
 */
export const GET = requireUser<RouteParams<{ id: string }>>(async (_request, _user, { params }) => {
    try {
        const { id: threadIdStr } = await params;
        
        const id = verifyIdParam(threadIdStr);
        if (id === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({
            where: { id: id },
            include: { match: { include: { homeTeam: true, awayTeam: true } } },
        });

        if (!thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }
        if (!isThreadVisible(thread)) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }
        if (!thread.matchId) {
            return NextResponse.json({ error: "Sentiment analysis is available only for match threads" }, { status: 400 });
        }

        // console.log(`Computing sentiment for thread ${id} with match ${thread.matchId}`);

        const existingSummaries = await prisma.sentimentSummary.findMany({ where: { threadId: id } });
        const latest = existingSummaries.reduce<(typeof existingSummaries)[number] | null>((acc, s) => {
            if (!acc) return s;
            return acc.computedAt > s.computedAt ? acc : s;
        }, null);

        const postStats = await prisma.post.aggregate({
            where: { threadId: id, isHidden: false },
            _count: { id: true },
            _max: { createdAt: true },
        });

        const lastPostAt = postStats._max.createdAt;
        const postCount = postStats._count.id;

        let hasPostChangesAfterLastComputation = false;
        if (latest) {
            const changedPostsCount = await prisma.post.count({
                where: {
                    threadId: id,
                    updatedAt: { gt: latest.computedAt },
                },
            });
            hasPostChangesAfterLastComputation = changedPostsCount > 0;
        }

        const shouldRecompute = existingSummaries.length === 0 || hasPostChangesAfterLastComputation;

        let summariesToReturn = existingSummaries;
        if (shouldRecompute) {
            // console.log(`need to recompute sentiment for thread ${id}. Post count: ${postCount}, last post at: ${lastPostAt}, last computation at: ${latest ? latest.computedAt : "N/A"}`);
            const result = await computeThreadSentiment(id);
            summariesToReturn = result.summaries;
        } 
        // else {
        //     console.log(`Returning cached sentiment for thread ${id}. Post count: ${postCount}, last post at: ${lastPostAt}, last computation at: ${latest ? latest.computedAt : "N/A"}`);
        // }

        const payload = buildResponse(thread, summariesToReturn, !shouldRecompute, postCount, lastPostAt);
        return NextResponse.json(payload, { status: 200 });
    } catch (err) {
        console.error("Failed to get sentiment", err);
        return NextResponse.json({ error: "Failed to retrieve sentiment" }, { status: 400 });
    }
});

// This module was written with the help of ChatGPT, with some manual changes and additions.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/protect";
import { computeThreadSentiment, normalizeSentimentRecord } from "@/lib/utils/sentiment";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

function buildResponse(
    thread: Awaited<ReturnType<typeof computeThreadSentiment>>["thread"],
    summaries: Awaited<ReturnType<typeof computeThreadSentiment>>["summaries"],
) {
    const overall = summaries.find((s) => s.scope === "overall") || null;

        const homeTeamId = thread.match?.homeTeamId ?? null;
        const awayTeamId = thread.match?.awayTeamId ?? null;
        const home = homeTeamId ? summaries.find((s) => s.teamId === homeTeamId) || null : null;
        const away = awayTeamId ? summaries.find((s) => s.teamId === awayTeamId) || null : null;

    return {
        threadId: thread.id,
        matchId: thread.matchId || null,
        overall: overall
            ? {
                ...normalizeSentimentRecord({ score: overall.score }),
                computedAt: overall.computedAt,
            }
            : null,
        teams: [
            home ? {
                    teamId: home.teamId,
                    ...normalizeSentimentRecord({ score: home.score }),
                    computedAt: home.computedAt,
                    kind: "home",
                }
                : null,
            away ? {
                    teamId: away.teamId,
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
 * /api/threads/{id}/sentiment/recompute:
 *   post:
 *     summary: Force recomputation of thread sentiment (requires admin auth)
 *     description: >
 *       This endpont triggers a full recomputation of the thread's overall sentiment and
 *       per-team sentiment (when the thread is linked to a match). Access is
 *       restricted to authenticated administrators.
 *     tags:
 *       - Threads
 *       - Sentiment
 *     security:
 *       - bearerAuth: []   # requires a valid bearer token; server should validate admin role
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Numeric ID of the thread to recompute sentiment for
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Sentiment successfully recomputed and returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recomputed:
 *                   type: boolean
 *                   description: Indicates the recomputation was performed
 *                 threadId:
 *                   type: integer
 *                 matchId:
 *                   oneOf:
 *                     - type: integer
 *                     - type: "null"
 *                   description: ID of the associated match or null if none
 *                 overall:
 *                   oneOf:
 *                     - type: object
 *                       properties:
 *                         sentiment:
 *                           type: string
 *                           description: Human-friendly sentiment label (negative|neutral|positive)
 *                         score:
 *                           type: number
 *                           description: Numeric sentiment score in range 0-100
 *                         computedAt:
 *                           type: string
 *                           format: date-time
 *                       required:
 *                         - sentiment
 *                         - score
 *                         - computedAt
 *                     - type: "null"
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       teamId:
 *                         type: integer
 *                       sentiment:
 *                         type: string
 *                         description: Team-level sentiment label
 *                       score:
 *                         type: number
 *                       computedAt:
 *                         type: string
 *                         format: date-time
 *                       kind:
 *                         type: string
 *                         enum: [home, away]
 *                     required:
 *                       - teamId
 *                       - sentiment
 *                       - score
 *                       - computedAt
 *                       - kind
 *             examples:
 *               success:
 *                 value:
 *                   recomputed: true
 *                   threadId: 1
 *                   matchId: 1
 *                   overall:
 *                     sentiment: "negative"
 *                     score: 22
 *                     computedAt: "2026-03-01T23:52:11.632Z"
 *                   teams:
 *                     - teamId: 1
 *                       sentiment: "neutral"
 *                       score: 51
 *                       computedAt: "2026-03-01T23:52:11.632Z"
 *                       kind: "home"
 *                     - teamId: 2
 *                       sentiment: "negative"
 *                       score: 29
 *                       computedAt: "2026-03-01T23:52:11.632Z"
 *                       kind: "away"
 *       '400':
 *         description: Bad request — invalid thread id or malformed parameter
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid thread id"
 *       '401':
 *         description: Unauthorized — missing or invalid authentication token
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 *       '403':
 *         description: Forbidden — authenticated user lacks admin privileges
 *         content:
 *           application/json:
 *             example:
 *               error: "Forbidden"
 *       '404':
 *         description: Not found — specified thread does not exist
 *         content:
 *           application/json:
 *             example:
 *               error: "Thread not found"
 */
export const POST = requireAdmin<RouteParams<{ id: string }>>(async (_request, _user, { params }) => {
    try {
        const { id: idStr } = await params;
        const id = verifyIdParam(idStr);
        if (id === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const result = await computeThreadSentiment(id);
        const payload = buildResponse(result.thread, result.summaries);
        return NextResponse.json({ recomputed: true, ...payload }, { status: 200 });
    } catch (err) {
        console.error("Failed to recompute sentiment", err);
        const message = err instanceof Error ? err.message : "Failed to recompute sentiment";
        const status = message === "Thread not found" ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
});

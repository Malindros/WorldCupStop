// This route was written with the help of ChatGPT, with some manual adjustments and fixesj

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/admin/moderation-queue/threads/{id}:
 *   get:
 *     summary: Get moderation detail for a thread (requires admin auth)
 *     description: Returns thread info, all reports against it (with reporter/reviewer), and a summary of posts in the thread.
 *     tags:
 *       - Moderation
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Thread ID to inspect.
 *     responses:
 *       '200':
 *         description: Thread moderation detail fetched
 *         content:
 *           application/json:
 *             examples:
 *               detail:
 *                 value:
 *                   thread:
 *                     id: 9
 *                     title: "Match Thread"
 *                     slug: "match-thread"
 *                     isClosed: false
 *                     isHidden: false
 *                     autoOpenAt: null
 *                     autoCloseAt: null
 *                     createdAt: "2026-03-01T10:00:00.000Z"
 *                     updatedAt: "2026-03-01T10:00:00.000Z"
 *                     author: { id: 3, username: "admin_user" }
 *                     match: { id: 5, homeTeamId: 1, awayTeamId: 2, startTime: "2026-03-01T15:00:00.000Z", status: "FINISHED" }
 *                     team: null
 *                   reports:
 *                     - id: 30
 *                       status: "OPEN"
 *                       reason: "Spam thread"
 *                       createdAt: "2026-03-02T03:00:00.000Z"
 *                       reviewedAt: null
 *                       reporter: { id: 8, username: "mod_user" }
 *                       reviewer: null
 *                   posts:
 *                     - id: 42
 *                       content: "Full post content"
 *                       isHidden: false
 *                       createdAt: "2026-03-01T10:05:00.000Z"
 *                       author: { id: 5, username: "fan_user" }
 *       '400':
 *         description: Invalid thread id
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (not an admin)
 *       '404':
 *         description: Thread not found
 */
export const GET = requireAdmin<RouteParams<{ id: string }>>(async (_request, _user, { params }) => {
    const { id: idStr } = await params;
    const threadId = verifyIdParam(idStr);
    if (threadId === null) {
        return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
    }

    const thread = await prisma.forumThread.findUnique({
        where: { id: threadId },
        include: {
            author: { select: { id: true, username: true } },
            match: { select: { id: true, homeTeamId: true, awayTeamId: true, startTime: true, status: true } },
            team: { select: { id: true, name: true, slug: true } },
        },
    });

    if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const [reports, posts] = await Promise.all([
        prisma.report.findMany({
            where: { targetType: "THREAD", targetId: threadId },
            orderBy: { createdAt: "desc" },
            include: {
                reporter: { select: { id: true, username: true } },
                reviewer: { select: { id: true, username: true } },
            },
        }),
        prisma.post.findMany({
            where: { threadId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                content: true,
                isHidden: true,
                parentPostId: true,
                createdAt: true,
                updatedAt: true,
                author: { select: { id: true, username: true } },
            },
        }),
    ]);

    return NextResponse.json({
        thread: {
            id: thread.id,
            title: thread.title,
            slug: thread.slug,
            isClosed: thread.isClosed,
            isHidden: thread.isHidden,
            autoOpenAt: thread.autoOpenAt,
            autoCloseAt: thread.autoCloseAt,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            author: thread.author ? { id: thread.author.id, username: thread.author.username } : null,
            match: thread.match
                ? {
                    id: thread.match.id,
                    homeTeamId: thread.match.homeTeamId,
                    awayTeamId: thread.match.awayTeamId,
                    startTime: thread.match.startTime,
                    status: thread.match.status,
                }
                : null,
            team: thread.team ? { id: thread.team.id, name: thread.team.name, slug: thread.team.slug } : null,
        },
        reports: reports.map((r) => ({
            id: r.id,
            status: r.status,
            reasonCode: r.reasonCode,
            additionalComment: r.additionalComment,
            reason: r.reason,
            createdAt: r.createdAt,
            reviewedAt: r.reviewedAt,
            reporter: r.reporter ? { id: r.reporter.id, username: r.reporter.username } : null,
            reviewer: r.reviewer ? { id: r.reviewer.id, username: r.reviewer.username } : null,
        })),
        posts: posts.map((p) => ({
            id: p.id,
            content: p.content,
            isHidden: p.isHidden,
            parentPostId: p.parentPostId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            author: p.author ? { id: p.author.id, username: p.author.username } : null,
        })),
    });
});

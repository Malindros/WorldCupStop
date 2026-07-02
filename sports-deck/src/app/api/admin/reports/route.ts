import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import type { NextRequest } from "next/server";

function parsePositiveInt(value: string | null, fallback: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return fallback;
    return parsed;
}

function parseTargetType(value: string | null): "POST" | "THREAD" | undefined {
    const normalized = (value || "").toUpperCase();
    if (normalized === "POST") return "POST";
    if (normalized === "THREAD") return "THREAD";
    return undefined;
}

function parseStatus(value: string | null): "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED" | undefined {
    const normalized = (value || "").toUpperCase();
    if (normalized === "OPEN") return "OPEN";
    if (normalized === "REVIEWED") return "REVIEWED";
    if (normalized === "DISMISSED") return "DISMISSED";
    if (normalized === "ACTIONED") return "ACTIONED";
    return undefined;
}

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: List reports for posts and threads (requires admin auth)
 *     description: Returns paginated report records with target summaries. Supports filtering by target type and status.
 *     tags:
 *       - Admin
 *       - Reports
 *     parameters:
 *       - in: query
 *         name: targetType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [POST, THREAD]
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [OPEN, REVIEWED, DISMISSED, ACTIONED]
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       '200':
 *         description: Reports fetched successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 */
export const GET = requireAdmin(async (request: NextRequest) => {
    const searchParams = new URL(request.url).searchParams;
    const targetType = parseTargetType(searchParams.get("targetType"));
    const status = parseStatus(searchParams.get("status"));
    const offset = parsePositiveInt(searchParams.get("offset"), 0);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 50), 100);

    const where: {
        targetType?: "POST" | "THREAD";
        status?: "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED";
    } = {};

    if (targetType) where.targetType = targetType;
    if (status) where.status = status;

    const [total, reports] = await Promise.all([
        prisma.report.count({ where }),
        prisma.report.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: offset,
            take: limit,
            include: {
                reporter: { select: { id: true, username: true } },
                reviewer: { select: { id: true, username: true } },
            },
        }),
    ]);

    const postIds = Array.from(new Set(reports.filter((r) => r.targetType === "POST").map((r) => r.targetId)));
    const threadIds = Array.from(new Set(reports.filter((r) => r.targetType === "THREAD").map((r) => r.targetId)));

    const [posts, threads] = await Promise.all([
        postIds.length > 0
            ? prisma.post.findMany({
                where: { id: { in: postIds } },
                select: {
                    id: true,
                    content: true,
                    isHidden: true,
                    createdAt: true,
                    author: { select: { id: true, username: true } },
                    thread: { select: { id: true, title: true, slug: true } },
                },
            })
            : [],
        threadIds.length > 0
            ? prisma.forumThread.findMany({
                where: { id: { in: threadIds } },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    isHidden: true,
                    isClosed: true,
                    createdAt: true,
                    author: { select: { id: true, username: true } },
                },
            })
            : [],
    ]);

    const postMap = new Map(posts.map((post) => [post.id, post]));
    const threadMap = new Map(threads.map((thread) => [thread.id, thread]));

    return NextResponse.json({
        total,
        offset,
        limit,
        items: reports.map((report) => {
            const postTarget = report.targetType === "POST" ? postMap.get(report.targetId) || null : null;
            const threadTarget = report.targetType === "THREAD" ? threadMap.get(report.targetId) || null : null;

            return {
                id: report.id,
                targetType: report.targetType,
                targetId: report.targetId,
                reasonCode: report.reasonCode,
                additionalComment: report.additionalComment,
                reason: report.reason,
                status: report.status,
                createdAt: report.createdAt,
                reviewedAt: report.reviewedAt,
                reporter: report.reporter ? { id: report.reporter.id, username: report.reporter.username } : null,
                reviewer: report.reviewer ? { id: report.reviewer.id, username: report.reviewer.username } : null,
                target: report.targetType === "POST"
                    ? postTarget
                        ? {
                            id: postTarget.id,
                            snippet: postTarget.content.slice(0, 200),
                            isHidden: postTarget.isHidden,
                            createdAt: postTarget.createdAt,
                            author: postTarget.author ? { id: postTarget.author.id, username: postTarget.author.username } : null,
                            thread: postTarget.thread ? { id: postTarget.thread.id, title: postTarget.thread.title, slug: postTarget.thread.slug } : null,
                        }
                        : null
                    : threadTarget
                        ? {
                            id: threadTarget.id,
                            title: threadTarget.title,
                            slug: threadTarget.slug,
                            isHidden: threadTarget.isHidden,
                            isClosed: threadTarget.isClosed,
                            createdAt: threadTarget.createdAt,
                            author: threadTarget.author ? { id: threadTarget.author.id, username: threadTarget.author.username } : null,
                        }
                        : null,
            };
        }),
    });
});

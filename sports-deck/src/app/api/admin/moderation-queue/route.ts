// This route was written with the help of ChatGPT, with some manual adjustments and fixes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { computeThreadSentiment } from "@/lib/utils/sentiment";
import { verifyIdParam } from "@/lib/utils/validation";
import { storeModerationForPost, storeThreadMoodModerationVerdict } from "@/lib/utils/moderation";
import type { NextRequest } from "next/server";

type QueueSort = "ai_score" | "reports" | "recent";
type QueueDirection = "asc" | "desc";
type QueueTypeFilter = "POST" | "THREAD" | null;

type PostTarget = {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    parentPostId: number | null;
    author: { id: number; username: string } | null;
    thread: { id: number; title: string; slug: string | null } | null;
    parentPostPreview: { id: number; content: string; author: { id: number; username: string } | null } | null;
    edits: Array<{ id: number; previousContent: string; editedAt: Date; editor: { id: number; username: string } | null }>;
};

type ThreadTarget = {
    id: number;
    title: string;
    slug: string | null;
    createdAt: Date;
    updatedAt: Date;
    isHidden: boolean;
    isClosed: boolean;
    author: { id: number; username: string } | null;
    firstPostPreview: { id: number; content: string; createdAt: Date; author: { id: number; username: string } | null } | null;
};

function parseSort(searchParams: URLSearchParams): QueueSort {
    const value = (searchParams.get("sort") || "").toLowerCase();
    if (value === "reports") return "reports";
    if (value === "recent") return "recent";
    return "ai_score";
}

function parseTypeFilter(searchParams: URLSearchParams): QueueTypeFilter {
    const value = (searchParams.get("type") || "").toUpperCase();
    if (value === "POST") return "POST";
    if (value === "THREAD") return "THREAD";
    return null;
}

function parseDirection(searchParams: URLSearchParams): QueueDirection {
    const value = (searchParams.get("direction") || "").toLowerCase();
    if (value === "asc") return "asc";
    return "desc";
}

function parsePositiveInt(value: string | null, fallback: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function parseOffset(value: string | null) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return 0;
    return parsed;
}

function sanitizeReason(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 500) : null;
}

type ModerationTxClient = {
    post: typeof prisma.post;
    forumThread: typeof prisma.forumThread;
};

async function hideTarget(tx: ModerationTxClient, targetType: "POST" | "THREAD", targetId: number) {
    if (targetType === "POST") {
        const post = await tx.post.update({
            where: { id: targetId },
            data: { isHidden: true },
            select: { threadId: true },
        });
        return post.threadId;
    }

    await tx.forumThread.update({ where: { id: targetId }, data: { isHidden: true, isClosed: true } });
    await tx.post.updateMany({ where: { threadId: targetId }, data: { isHidden: true } });
    return targetId;
}

/**
 * @swagger
 * /api/admin/moderation-queue:
 *   get:
 *     summary: List moderation queue items with full review context (requires admin auth)
 *     description: Returns grouped pending reports for posts and threads, including user report details, AI verdict info, parent/first-post previews, and edit history.
 *     tags:
 *       - Moderation
 *     parameters:
 *       - in: query
 *         name: sort
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ai_score, reports, recent]
 *         description: Sort by highest AI score (default), most user reports, or most recent report.
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [POST, THREAD]
 *         description: Filter to only posts or only threads. Omit for both.
 *     responses:
 *       '200':
 *         description: Moderation queue fetched
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   sort: "ai_score"
 *                   items:
 *                     - type: "POST"
 *                       targetId: 42
 *                       target:
 *                         id: 42
 *                         snippet: "This is the first 200 chars of the post..."
 *                         createdAt: "2026-03-02T04:12:00.000Z"
 *                         updatedAt: "2026-03-02T04:12:00.000Z"
 *                         author: { id: 5, username: "fan_user" }
 *                         thread: { id: 9, title: "Match Thread", slug: "match-thread" }
 *                       openReportCount: 3
 *                       userReportCount: 2
 *                       autoReportCount: 1
 *                       lastReportAt: "2026-03-02T04:15:00.000Z"
 *                       latestAiVerdict:
 *                         id: 11
 *                         verdict: "review"
 *                         toxicityScore: 0.9
 *                         explanation: "Contains personal attack"
 *                         createdAt: "2026-03-02T04:13:00.000Z"
 *                     - type: "THREAD"
 *                       targetId: 9
 *                       target:
 *                         id: 9
 *                         title: "Match Thread"
 *                         slug: "match-thread"
 *                         isClosed: false
 *                         isHidden: false
 *                         createdAt: "2026-03-01T10:00:00.000Z"
 *                         updatedAt: "2026-03-01T10:00:00.000Z"
 *                         author: { id: 3, username: "admin_user" }
 *                       openReportCount: 1
 *                       userReportCount: 1
 *                       autoReportCount: 0
 *                       lastReportAt: "2026-03-02T03:00:00.000Z"
 *                       latestAiVerdict: null
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (not an admin)
 */
export const GET = requireAdmin(async (request: NextRequest) => {
    const searchParams = new URL(request.url).searchParams;
    const sort = parseSort(searchParams);
    const direction = parseDirection(searchParams);
    const typeFilter = parseTypeFilter(searchParams);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 10), 50);
    const requestedOffset = parseOffset(searchParams.get("offset"));

    const whereClause: { status: "OPEN"; targetType?: Exclude<QueueTypeFilter, null> } = { status: "OPEN" };
    if (typeFilter) whereClause.targetType = typeFilter;

    const openReports = await prisma.report.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
            reporter: { select: { id: true, username: true } },
        },
    });

    if (openReports.length === 0) {
        return NextResponse.json({
            sort,
            direction,
            meta: {
                pendingReportCount: 0,
                pendingTargetCount: 0,
                pageTargetCount: 0,
                limit,
                offset: 0,
                totalPages: 1,
                currentPage: 1,
            },
            items: [],
        });
    }

    const groupedReports = new Map<string, {
        targetType: "POST" | "THREAD";
        targetId: number;
        reports: typeof openReports;
        userReportCount: number;
        autoReportCount: number;
        lastReportAt: Date;
        lastUserReportAt: Date | null;
    }>();

    for (const report of openReports) {
        const key = `${report.targetType}:${report.targetId}`;
        const current = groupedReports.get(key) || {
            targetType: report.targetType,
            targetId: report.targetId,
            reports: [],
            userReportCount: 0,
            autoReportCount: 0,
            lastReportAt: report.createdAt,
            lastUserReportAt: null,
        };

        current.reports.push(report);

        if (report.reporterId === null || report.reporterId === undefined) {
            current.autoReportCount += 1;
        } else {
            current.userReportCount += 1;
            if (!current.lastUserReportAt || report.createdAt > current.lastUserReportAt) {
                current.lastUserReportAt = report.createdAt;
            }
        }

        if (report.createdAt > current.lastReportAt) {
            current.lastReportAt = report.createdAt;
        }

        groupedReports.set(key, current);
    }

    const postIds = Array.from(new Set(openReports.filter((r) => r.targetType === "POST").map((r) => r.targetId)));
    const threadIds = Array.from(new Set(openReports.filter((r) => r.targetType === "THREAD").map((r) => r.targetId)));

    const posts = postIds.length > 0
        ? await prisma.post.findMany({
            where: { id: { in: postIds } },
            select: {
                id: true,
                content: true,
                createdAt: true,
                updatedAt: true,
                parentPostId: true,
                author: { select: { id: true, username: true } },
                thread: { select: { id: true, title: true, slug: true } },
                edits: {
                    orderBy: { editedAt: "desc" },
                    select: {
                        id: true,
                        previousContent: true,
                        editedAt: true,
                        editor: { select: { id: true, username: true } },
                    },
                },
            },
        })
        : [];

    const parentPostIds = Array.from(new Set(posts.map((post) => post.parentPostId).filter((id): id is number => id !== null)));
    const parentPosts = parentPostIds.length > 0
        ? await prisma.post.findMany({
            where: { id: { in: parentPostIds } },
            select: {
                id: true,
                content: true,
                author: { select: { id: true, username: true } },
            },
        })
        : [];

    const threads = threadIds.length > 0
        ? await prisma.forumThread.findMany({
            where: { id: { in: threadIds } },
            select: {
                id: true,
                title: true,
                slug: true,
                createdAt: true,
                updatedAt: true,
                isHidden: true,
                isClosed: true,
                author: { select: { id: true, username: true } },
            },
        })
        : [];

    const threadPostsForPreview = threadIds.length > 0
        ? await prisma.post.findMany({
            where: { threadId: { in: threadIds }, isHidden: false },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                threadId: true,
                content: true,
                createdAt: true,
                author: { select: { id: true, username: true } },
            },
        })
        : [];

    const postIdsForVerdict = new Set<number>(posts.map((post) => post.id));
    for (const post of threadPostsForPreview) {
        postIdsForVerdict.add(post.id);
    }

    const verdicts = postIdsForVerdict.size > 0
        ? await prisma.aiModerationVerdict.findMany({
            where: { postId: { in: Array.from(postIdsForVerdict) } },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                postId: true,
                verdict: true,
                toxicityScore: true,
                explanation: true,
                createdAt: true,
            },
        })
        : [];

    const verdictByPostId = new Map<number, (typeof verdicts)[number]>();
    for (const verdict of verdicts) {
        if (!verdictByPostId.has(verdict.postId)) {
            verdictByPostId.set(verdict.postId, verdict);
        }
    }

    const missingVerdictTasks: Array<Promise<unknown>> = [];
    for (const post of posts) {
        if (!verdictByPostId.has(post.id)) {
            missingVerdictTasks.push(storeModerationForPost(post.id, post.content));
        }
    }

    for (const thread of threads) {
        const postsForThread = threadPostsForPreview.filter((post) => post.threadId === thread.id);
        if (postsForThread.length === 0) continue;

        const firstPostId = postsForThread[0]?.id;
        if (!firstPostId || verdictByPostId.has(firstPostId)) continue;

        const firstFive = postsForThread.slice(0, 5);
        const lastFive = postsForThread.slice(Math.max(postsForThread.length - 5, 0));
        const uniqueWindowMap = new Map<number, { id: number; content: string; createdAt: Date }>();
        for (const post of [...firstFive, ...lastFive]) {
            uniqueWindowMap.set(post.id, post);
        }

        const contextPosts = Array.from(uniqueWindowMap.values())
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((post) => ({ id: post.id, content: post.content }));

        missingVerdictTasks.push(storeThreadMoodModerationVerdict(thread.id, thread.title, contextPosts));
    }

    if (missingVerdictTasks.length > 0) {
        await Promise.all(missingVerdictTasks.map((task) => task.catch(() => null)));
    }

    const latestVerdicts = postIdsForVerdict.size > 0
        ? await prisma.aiModerationVerdict.findMany({
            where: { postId: { in: Array.from(postIdsForVerdict) } },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                postId: true,
                verdict: true,
                toxicityScore: true,
                explanation: true,
                createdAt: true,
            },
        })
        : [];

    const postMap = new Map(posts.map((post) => [post.id, post]));
    const parentPostMap = new Map(parentPosts.map((post) => [post.id, post]));
    const threadMap = new Map(threads.map((thread) => [thread.id, thread]));

    const firstThreadPostMap = new Map<number, (typeof threadPostsForPreview)[number]>();
    for (const post of threadPostsForPreview) {
        if (post.threadId === null) continue;
        if (!firstThreadPostMap.has(post.threadId)) {
            firstThreadPostMap.set(post.threadId, post);
        }
    }

    const latestVerdictByPostId = new Map<number, (typeof latestVerdicts)[number]>();
    for (const verdict of latestVerdicts) {
        if (!latestVerdictByPostId.has(verdict.postId)) {
            latestVerdictByPostId.set(verdict.postId, verdict);
        }
    }

    const threadAiVerdict = new Map<number, (typeof latestVerdicts)[number]>();
    const postIdToThreadId = new Map<number, number>();
    for (const post of threadPostsForPreview) {
        if (post.threadId === null) continue;
        postIdToThreadId.set(post.id, post.threadId);
    }
    for (const verdict of latestVerdicts) {
        const threadId = postIdToThreadId.get(verdict.postId);
        if (!threadId) continue;
        if (!threadAiVerdict.has(threadId)) {
            threadAiVerdict.set(threadId, verdict);
        }
    }

    const items: Array<{
        type: "POST" | "THREAD";
        targetId: number;
        openReportCount: number;
        userReportCount: number;
        autoReportCount: number;
        lastReportAt: Date;
        lastUserReportAt: Date | null;
        userReports: Array<{
            id: number;
            reason: string;
            reasonCode: string;
            additionalComment: string | null;
            createdAt: Date;
            reporter: { id: number; username: string } | null;
        }>;
        latestAiVerdict: {
            id: number;
            verdict: string;
            toxicityScore: number | null;
            explanation: string | null;
            createdAt: Date;
        } | null;
        target: PostTarget | ThreadTarget | null;
    }> = [];

    for (const [key, group] of groupedReports.entries()) {
        if (group.targetType === "POST") {
            const post = postMap.get(group.targetId);
            const parentPost = post?.parentPostId ? parentPostMap.get(post.parentPostId) : null;
            const aiVerdict = latestVerdictByPostId.get(group.targetId) || null;

            items.push({
                type: "POST",
                targetId: group.targetId,
                openReportCount: group.reports.length,
                userReportCount: group.userReportCount,
                autoReportCount: group.autoReportCount,
                lastReportAt: group.lastReportAt,
                lastUserReportAt: group.lastUserReportAt,
                userReports: group.reports
                    .filter((report) => report.reporterId !== null)
                    .map((report) => ({
                        id: report.id,
                        reason: report.reason,
                        reasonCode: String(report.reasonCode),
                        additionalComment: report.additionalComment,
                        createdAt: report.createdAt,
                        reporter: report.reporter ? { id: report.reporter.id, username: report.reporter.username } : null,
                    })),
                latestAiVerdict: aiVerdict
                    ? {
                        id: aiVerdict.id,
                        verdict: aiVerdict.verdict,
                        toxicityScore: aiVerdict.toxicityScore,
                        explanation: aiVerdict.explanation,
                        createdAt: aiVerdict.createdAt,
                    }
                    : null,
                target: post
                    ? {
                        id: post.id,
                        content: post.content,
                        createdAt: post.createdAt,
                        updatedAt: post.updatedAt,
                        parentPostId: post.parentPostId,
                        author: post.author ? { id: post.author.id, username: post.author.username } : null,
                        thread: post.thread ? { id: post.thread.id, title: post.thread.title, slug: post.thread.slug } : null,
                        parentPostPreview: parentPost
                            ? {
                                id: parentPost.id,
                                content: parentPost.content,
                                author: parentPost.author ? { id: parentPost.author.id, username: parentPost.author.username } : null,
                            }
                            : null,
                        edits: post.edits.map((edit) => ({
                            id: edit.id,
                            previousContent: edit.previousContent,
                            editedAt: edit.editedAt,
                            editor: edit.editor ? { id: edit.editor.id, username: edit.editor.username } : null,
                        })),
                    }
                    : null,
            });
            continue;
        }

        const thread = threadMap.get(group.targetId);
        const firstPostPreview = firstThreadPostMap.get(group.targetId) || null;
        const aiVerdict = threadAiVerdict.get(group.targetId) || null;

        items.push({
            type: "THREAD",
            targetId: group.targetId,
            openReportCount: group.reports.length,
            userReportCount: group.userReportCount,
            autoReportCount: group.autoReportCount,
            lastReportAt: group.lastReportAt,
            lastUserReportAt: group.lastUserReportAt,
            userReports: group.reports
                .filter((report) => report.reporterId !== null)
                .map((report) => ({
                    id: report.id,
                    reason: report.reason,
                    reasonCode: String(report.reasonCode),
                    additionalComment: report.additionalComment,
                    createdAt: report.createdAt,
                    reporter: report.reporter ? { id: report.reporter.id, username: report.reporter.username } : null,
                })),
            latestAiVerdict: aiVerdict
                ? {
                    id: aiVerdict.id,
                    verdict: aiVerdict.verdict,
                    toxicityScore: aiVerdict.toxicityScore,
                    explanation: aiVerdict.explanation,
                    createdAt: aiVerdict.createdAt,
                }
                : null,
            target: thread
                ? {
                    id: thread.id,
                    title: thread.title,
                    slug: thread.slug,
                    createdAt: thread.createdAt,
                    updatedAt: thread.updatedAt,
                    isHidden: thread.isHidden,
                    isClosed: thread.isClosed,
                    author: thread.author ? { id: thread.author.id, username: thread.author.username } : null,
                    firstPostPreview: firstPostPreview
                        ? {
                            id: firstPostPreview.id,
                            content: firstPostPreview.content,
                            createdAt: firstPostPreview.createdAt,
                            author: firstPostPreview.author ? { id: firstPostPreview.author.id, username: firstPostPreview.author.username } : null,
                        }
                        : null,
                }
                : null,
        });

        void key;
    }

    items.sort((a, b) => {
        let result = 0;
        if (sort === "reports") {
            if (b.userReportCount !== a.userReportCount) {
                result = b.userReportCount - a.userReportCount;
            } else {
                result = b.openReportCount - a.openReportCount;
            }
            return direction === "asc" ? result * -1 : result;
        }

        if (sort === "recent") {
            const recentA = a.lastUserReportAt?.getTime() || 0;
            const recentB = b.lastUserReportAt?.getTime() || 0;
            if (recentB !== recentA) {
                result = recentB - recentA;
            } else {
                result = (b.lastReportAt?.getTime() || 0) - (a.lastReportAt?.getTime() || 0);
            }
            return direction === "asc" ? result * -1 : result;
        }

        const scoreA = a.latestAiVerdict?.toxicityScore ?? -1;
        const scoreB = b.latestAiVerdict?.toxicityScore ?? -1;
        if (scoreB !== scoreA) {
            result = scoreB - scoreA;
            return direction === "asc" ? result * -1 : result;
        }

        if (b.userReportCount !== a.userReportCount) {
            result = b.userReportCount - a.userReportCount;
            return direction === "asc" ? result * -1 : result;
        }

        result = (b.lastUserReportAt?.getTime() || 0) - (a.lastUserReportAt?.getTime() || 0);
        return direction === "asc" ? result * -1 : result;
    });

    const totalTargets = items.length;
    const totalPages = Math.max(Math.ceil(totalTargets / limit), 1);
    const maxOffset = Math.max((totalPages - 1) * limit, 0);
    const offset = Math.min(requestedOffset, maxOffset);
    const pagedItems = items.slice(offset, offset + limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
        sort,
        direction,
        meta: {
            pendingReportCount: openReports.length,
            pendingTargetCount: totalTargets,
            pageTargetCount: pagedItems.length,
            limit,
            offset,
            totalPages,
            currentPage,
        },
        items: pagedItems,
    });
});

/**
 * @swagger
 * /api/admin/moderation-queue:
 *   post:
 *     summary: Apply moderation action to a reported target (requires admin auth)
 *     description: Applies dismiss/remove/ban_user to all open reports for the specified post or thread target.
 *     tags:
 *       - Moderation
 */
export const POST = requireAdmin(async (request: NextRequest, adminUser) => {
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "").toLowerCase();
    const targetType = String(body?.targetType || "").toUpperCase();
    const targetId = verifyIdParam(body?.targetId);
    const reason = sanitizeReason(body?.reason);

    if (targetId === null) {
        return NextResponse.json({ error: "Invalid target id" }, { status: 400 });
    }

    if (targetType !== "POST" && targetType !== "THREAD") {
        return NextResponse.json({ error: "targetType must be POST or THREAD" }, { status: 400 });
    }

    if (action !== "dismiss" && action !== "remove" && action !== "ban_user") {
        return NextResponse.json({ error: "action must be dismiss, remove, or ban_user" }, { status: 400 });
    }

    const openReports = await prisma.report.findMany({
        where: {
            status: "OPEN",
            targetType,
            targetId,
        },
        select: { id: true },
    });

    if (openReports.length === 0) {
        return NextResponse.json({ error: "No open reports found for this target" }, { status: 404 });
    }

    const now = new Date();

    const outcome = await prisma.$transaction(async (tx) => {
        const status = action === "dismiss" ? "DISMISSED" : "ACTIONED";
        let threadIdForSentiment: number | null = null;

        await tx.report.updateMany({
            where: {
                status: "OPEN",
                targetType,
                targetId,
            },
            data: {
                status,
                reviewedAt: now,
                reviewerId: adminUser.id,
            },
        });

        if (action === "remove" || action === "ban_user") {
            threadIdForSentiment = await hideTarget(tx, targetType, targetId);
        }

        let bannedUserId: number | null = null;
        if (action === "ban_user") {
            if (targetType === "POST") {
                const post = await tx.post.findUnique({ where: { id: targetId }, select: { authorId: true } });
                bannedUserId = post?.authorId ?? null;
            } else {
                const thread = await tx.forumThread.findUnique({ where: { id: targetId }, select: { authorId: true } });
                bannedUserId = thread?.authorId ?? null;
            }

            if (!bannedUserId) {
                throw new Error("Cannot ban user for this target");
            }

            const targetUser = await tx.user.findUnique({ where: { id: bannedUserId }, select: { isBanned: true, banUntil: true } });
            const stillBanned = Boolean(targetUser?.isBanned && (!targetUser?.banUntil || targetUser.banUntil.getTime() > Date.now()));

            if (!stillBanned) {
                const banReason = reason || `Banned via moderation queue for ${targetType.toLowerCase()} #${targetId}`;

                await tx.ban.create({
                    data: {
                        userId: bannedUserId,
                        bannedById: adminUser.id,
                        reason: banReason,
                        until: null,
                    },
                });

                await tx.user.update({
                    where: { id: bannedUserId },
                    data: {
                        isBanned: true,
                        banUntil: null,
                        banReason,
                    },
                });
            }
        }

        await tx.moderationAction.create({
            data: {
                actionType: action === "dismiss" ? "DISMISS" : action === "remove" ? "HIDE" : "BAN",
                performedById: adminUser.id,
                details: {
                    targetType,
                    targetId,
                    reportIds: openReports.map((report) => report.id),
                    reason,
                    action,
                    bannedUserId,
                },
            },
        });

        return {
            status,
            affectedReportIds: openReports.map((report) => report.id),
            bannedUserId,
            threadIdForSentiment,
        };
    });

    if (outcome.threadIdForSentiment) {
        // Keep sentiment in sync after moderation changes hide visible content.
        try {
            await computeThreadSentiment(outcome.threadIdForSentiment);
        } catch (err) {
            // Moderation action should succeed even if recompute fails.
            console.error("Failed to recompute sentiment after moderation queue action", {
                targetType,
                targetId,
                threadId: outcome.threadIdForSentiment,
                action,
                error: err,
            });
        }
    }

    return NextResponse.json({ ok: true, ...outcome });
});

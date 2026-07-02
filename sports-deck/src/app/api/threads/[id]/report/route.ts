import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import { isThreadVisible } from "@/lib/utils/threadVisibility";
import { composeReportReason, isUserReportReasonCode, normalizeAdditionalComment } from "@/lib/reportReasons";
import { storeThreadMoodModerationVerdict } from "@/lib/utils/moderation";
import type { AuthUser } from "@/lib/utils/auth";
import type { RouteParams } from "@/lib/types/api";

/**
 * Attempt to get a user ID using the provided user object.
 * If the user object has an id field, return it. 
 * Otherwise, if it has a username field, look up the user in the database and return their id.
 */
async function resolveUserId(user: AuthUser) {
    if (user?.id) return user.id;
    if (!user?.username) return null;

    const dbUser = await prisma.user.findUnique({
        where: { username: user.username },
        select: { id: true },
    });

    return dbUser?.id ?? null;
}

/**
 * @swagger
 * /api/threads/{id}/report:
 *   post:
 *     summary: Report a thread (requires user auth)
 *     description: Submit a report for a thread by id with a short reason. Requires authenticated user.
 *     tags:
 *       - Reports
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Numeric thread ID to report
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reasonCode:
 *                 type: string
 *                 enum: [SPAM, HARASSMENT, HATE_SPEECH, VIOLENCE, SEXUAL_CONTENT, MISINFORMATION, OTHER]
 *                 description: Selected report reason
 *               additionalComment:
 *                 type: string
 *                 description: Optional extra context for moderators
 *     responses:
 *       '201':
 *         description: Report submitted successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   reportId: 2
 *                   targetType: "THREAD"
 *                   targetId: 1
 *                   status: "OPEN"
 *                   createdAt: "2026-03-02T03:20:43.977Z"
 *       '400':
 *         description: Bad request (invalid id or missing reason)
 *         content:
 *           application/json:
 *             examples:
 *               invalid:
 *                 value:
 *                   error: "Invalid thread id"
 *       '401':
 *         description: Unauthorized - authentication required
 *       '404':
 *         description: Thread not found
 *       '409':
 *         description: Conflict - already reported
 *         content:
 *           application/json:
 *             examples:
 *               conflict:
 *                 value:
 *                   error: "You have already reported this thread"
 *       '500':
 *         description: Server error while submitting report
 */
export const POST = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const threadId = verifyIdParam(idStr);
        if (threadId === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const reporterId = await resolveUserId(user);
        if (!reporterId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const reasonCode = body?.reasonCode;
        if (!isUserReportReasonCode(reasonCode)) {
            return NextResponse.json({ error: "A valid reasonCode is required" }, { status: 400 });
        }
        const additionalComment = normalizeAdditionalComment(body?.additionalComment);
        const reason = composeReportReason(reasonCode, additionalComment);

        const threadRecord = await prisma.forumThread.findUnique({ where: { id: threadId } });
        if (!threadRecord || !isThreadVisible(threadRecord)) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        const reportRecord = await prisma.report.create({
            data: {
                reporterId,
                targetType: "THREAD",
                targetId: threadId,
                reasonCode,
                additionalComment,
                reason,
            },
        });

        const firstFive = await prisma.post.findMany({
            where: { threadId, isHidden: false },
            orderBy: { createdAt: "asc" },
            take: 5,
            select: { id: true, content: true, createdAt: true },
        });

        const lastFiveRaw = await prisma.post.findMany({
            where: { threadId, isHidden: false },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, content: true, createdAt: true },
        });
        const lastFive = [...lastFiveRaw].reverse();

        const uniqueWindowMap = new Map<number, { id: number; content: string; createdAt: Date }>();
        for (const post of [...firstFive, ...lastFive]) {
            uniqueWindowMap.set(post.id, post);
        }

        const contextPosts = Array.from(uniqueWindowMap.values())
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((post) => ({ id: post.id, content: post.content }));

        if (contextPosts.length > 0) {
            await storeThreadMoodModerationVerdict(threadId, threadRecord.title, contextPosts);
        }

        return NextResponse.json({
            reportId: reportRecord.id,
            targetType: reportRecord.targetType,
            targetId: reportRecord.targetId,
            reasonCode: reportRecord.reasonCode,
            additionalComment: reportRecord.additionalComment,
            status: reportRecord.status,
            createdAt: reportRecord.createdAt,
        }, { status: 201 });
    } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
            return NextResponse.json({ error: "You have already reported this thread" }, { status: 409 });
        }

        console.error("Failed to submit thread report", err);
        return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
    }
});

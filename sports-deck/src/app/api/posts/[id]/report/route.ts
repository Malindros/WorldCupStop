import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import { composeReportReason, isUserReportReasonCode, normalizeAdditionalComment } from "@/lib/reportReasons";
import { storeModerationForPost } from "@/lib/utils/moderation";
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
 * /api/posts/{id}/report:
 *   post:
 *     summary: Report a post (requires user auth)
 *     description: Submit a report for a post by id with a short reason. Requires authenticated user.
 *     tags:
 *       - Reports
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Numeric post ID to report
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
 *                   targetType: "POST"
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
 *                   error: "Invalid post id"
 *       '401':
 *         description: Unauthorized - authentication required
 *       '404':
 *         description: Post not found
 *       '409':
 *         description: Conflict - already reported
 *         content:
 *           application/json:
 *             examples:
 *               conflict:
 *                 value:
 *                   error: "You have already reported this post"
 *       '500':
 *         description: Server error while submitting report
 */
export const POST = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const postId = verifyIdParam(idStr);
        if (postId === null) {
            return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
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

        const postRecord = await prisma.post.findUnique({ where: { id: postId } });
        if (!postRecord) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const reportRecord = await prisma.report.create({
            data: {
                reporterId,
                targetType: "POST",
                targetId: postId,
                reasonCode,
                additionalComment,
                reason,
            },
        });

        const existingVerdict = await prisma.aiModerationVerdict.findFirst({
            where: { postId },
            select: { id: true },
            orderBy: { createdAt: "desc" },
        });
        if (!existingVerdict) {
            await storeModerationForPost(postId, postRecord.content);
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
            return NextResponse.json({ error: "You have already reported this post" }, { status: 409 });
        }

        console.error("Failed to submit post report", err);
        return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
    }
});

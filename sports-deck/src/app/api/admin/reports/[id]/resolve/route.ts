// This route was written with the help of ChatGPT, with some manual adjustments and fixes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { computeThreadSentiment } from "@/lib/utils/sentiment";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

function sanitizeReason(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 500) : null;
}

/**
 * @swagger
 * /api/admin/reports/{id}/resolve:
 *   post:
 *     summary: Resolve a report (requires admin auth)
 *     description: Dismiss or action (hide) a report. When actioned, the target post/thread is hidden and the report status becomes ACTIONED. Requires admin authentication.
 *     tags:
 *       - Admin
 *       - Reports
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Report ID to resolve
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [dismiss, hide]
 *               reason:
 *                 type: string
 *             required: [action]
 *     responses:
 *       '200':
 *         description: Report resolved
 *         content:
 *           application/json:
 *             example:
 *               report:
 *                 id: 2
 *                 reporterId: 1
 *                 targetType: "POST"
 *                 targetId: 50
 *                 reason: "Saying mean things!"
 *                 status: "ACTIONED"
 *                 createdAt: "2026-03-03T01:45:29.734Z"
 *                 reviewedAt: "2026-03-03T01:45:41.217Z"
 *                 reviewerId: 1
 *       '400':
 *         description: Invalid input or action
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 *       '404':
 *         description: Report not found
 */
export const POST = requireAdmin<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    const { id: idStr } = await params;
    const reportId = verifyIdParam(idStr);
    if (reportId === null) {
        return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const action = (body?.action || "").toLowerCase();
    const reason = sanitizeReason(body?.reason);

    if (!action || (action !== "dismiss" && action !== "hide")) {
        return NextResponse.json({ error: "action must be 'dismiss' or 'hide'" }, { status: 400 });
    }

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const now = new Date();

    if (action === "dismiss") {
        const updated = await prisma.$transaction(async (tx) => {

            // mark the report as dismissed
            const updatedReport = await tx.report.update({
                where: { id: reportId },
                data: { status: "DISMISSED", reviewedAt: now, reviewerId: user.id },
            });

            // log the moderation action
            await tx.moderationAction.create({
                data: {
                    reportId,
                    actionType: "DISMISS",
                    performedById: user.id,
                    details: reason ? { reason } : undefined,
                },
            });

            return updatedReport;
        });

        return NextResponse.json({
            report: updated,
        });
    }

    // action === "hide"
    const { updatedReport, threadIdForSentiment } = await prisma.$transaction(async (tx) => {

        // mark the report as actioned
        const updatedReport = await tx.report.update({
            where: { id: reportId },
            data: { status: "ACTIONED", reviewedAt: now, reviewerId: user.id },
        });

        let threadIdForSentiment: number | null = null;

        // hide the post or thread
        if (report.targetType === "POST") {
            const post = await tx.post.update({
                where: { id: report.targetId },
                data: { isHidden: true },
                select: { threadId: true },
            });
            threadIdForSentiment = post.threadId;
        } else if (report.targetType === "THREAD") {
            await tx.forumThread.update({ where: { id: report.targetId }, data: { isHidden: true, isClosed: true } });
            await tx.post.updateMany({ where: { threadId: report.targetId }, data: { isHidden: true } });
            threadIdForSentiment = report.targetId;
        }

        // log the moderation action
        await tx.moderationAction.create({
            data: {
                reportId,
                actionType: "HIDE",
                performedById: user.id,
                details: reason ? { reason, targetType: report.targetType } : { targetType: report.targetType },
            },
        });

        return { updatedReport, threadIdForSentiment };
    });

    if (threadIdForSentiment) {
        // Recompute sentiment after moderation so hidden posts no longer affect thread mood.
        try {
            await computeThreadSentiment(threadIdForSentiment);
        } catch (err) {
            // Do not fail moderation resolution if sentiment recomputation fails.
            console.error("Failed to recompute sentiment after hide action", {
                reportId,
                threadId: threadIdForSentiment,
                error: err,
            });
        }
    }

    return NextResponse.json({ report: updatedReport });
});

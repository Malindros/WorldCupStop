import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/admin/appeals/{id}/deny:
 *   post:
 *     summary: Deny a ban appeal (requires admin auth)
 *     description: Marks the appeal as DENIED and records a moderation action. Requires admin authentication.
 *     tags:
 *       - Admin
 *       - Appeals
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appeal ID to deny
 *     responses:
 *       '200':
 *         description: Appeal denied
 *         content:
 *           application/json:
 *             example:
 *               appeal:
 *                 id: 4
 *                 banId: 10
 *                 userId: 2
 *                 message: "please unban!"
 *                 status: "DENIED"
 *                 createdAt: "2026-03-03T01:29:48.354Z"
 *                 decidedAt: "2026-03-03T01:30:21.130Z"
 *                 decidedById: 1
 *       '400':
 *         description: Invalid appeal id or appeal already decided
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 *       '404':
 *         description: Appeal not found
 */
export const POST = requireAdmin<RouteParams<{ id: string }>>(async (_request, user, { params }) => {
    const { id: idStr } = await params;
    const appealId = verifyIdParam(idStr);
    if (appealId === null) return NextResponse.json({ error: "Invalid appeal id" }, { status: 400 });

    const appeal = await prisma.banAppeal.findUnique({ where: { id: appealId } });
    if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    if (appeal.status !== "PENDING") return NextResponse.json({ error: "Appeal already decided" }, { status: 400 });

    const now = new Date();
    const updated = await prisma.banAppeal.update({
        where: { id: appealId },
        data: { status: "DENIED", decidedAt: now, decidedById: user.id },
    });

    await prisma.moderationAction.create({
        data: {
            actionType: "DISMISS",
            performedById: user.id,
            details: { appealId, reason: "Appeal denied" },
        },
    });

    return NextResponse.json({ appeal: updated });
});

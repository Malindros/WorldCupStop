import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/admin/appeals/{id}/approve:
 *   post:
 *     summary: Approve a ban appeal (requires admin auth)
 *     description: Marks the appeal as APPROVED, lifts the associated ban and creates an unban moderation action. Requires admin authentication.
 *     tags:
 *       - Admin
 *       - Appeals
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appeal ID to approve
 *     responses:
 *       '200':
 *         description: Appeal approved and ban lifted
 *         content:
 *           application/json:
 *             example:
 *               appeal:
 *                 id: 4
 *                 banId: 10
 *                 userId: 2
 *                 message: "pls unban!!"
 *                 status: "APPROVED"
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

    const appeal = await prisma.banAppeal.findUnique({
        where: { id: appealId },
        include: { ban: true },
    });
    if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    if (appeal.status !== "PENDING") return NextResponse.json({ error: "Appeal already decided" }, { status: 400 });

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
        const updatedAppeal = await tx.banAppeal.update({
            where: { id: appealId },
            data: { status: "APPROVED", decidedAt: now, decidedById: user.id },
        });

        await tx.user.update({
            where: { id: appeal.userId },
            data: { isBanned: false, banUntil: null, banReason: null },
        });

        // mark current ban as lifted
        await tx.ban.update({ where: { id: appeal.banId }, data: { liftedAt: now } });

        await tx.moderationAction.create({
            data: {
                actionType: "UNBAN",
                performedById: user.id,
                details: { appealId, banId: appeal.banId, targetUserId: appeal.userId, reason: "Appeal approved" },
            },
        });

        return updatedAppeal;
    });

    return NextResponse.json({ appeal: result });
});

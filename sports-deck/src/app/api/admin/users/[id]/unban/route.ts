// This route was written with the help of ChatGPT, with some manual adjustments and fixes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/admin/users/{id}/unban:
 *   post:
 *     summary: Unban a user (requires admin auth)
 *     description: Lift bans for a user and update their banned status. Returns who performed the unban and the updated user summary. Requires admin authentication.
 *     tags:
 *       - Admin
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to unban
 *     responses:
 *       '200':
 *         description: Unban performed
 *         content:
 *           application/json:
 *             example:
 *               performedById: 1
 *               targetUser:
 *                 id: 2
 *                 isBanned: false
 *                 banUntil: null
 *                 banReason: null
 *       '400':
 *         description: Invalid input or user not banned
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 *       '404':
 *         description: User not found
 */
export const POST = requireAdmin<RouteParams<{ id: string }>>(async (_request, user, { params }) => {
    const { id: idStr } = await params;
    const targetUserId = verifyIdParam(idStr);
    if (targetUserId === null) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, isBanned: true } });
    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (!targetUser.isBanned) {
        return NextResponse.json({ error: "User is not banned" }, { status: 400 });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
            where: { id: targetUserId },
            data: { isBanned: false, banUntil: null, banReason: null },
        });

        const liftedBans = await tx.ban.updateMany({
            where: { userId: targetUserId, liftedAt: null },
            data: { liftedAt: now },
        });

        await tx.moderationAction.create({
            data: {
                actionType: "UNBAN",
                performedById: user.id,
                details: { targetUserId, unbannedAt: now.toISOString(), liftedCount: liftedBans.count },
            },
        });

        const safeUser = { id: updatedUser.id, isBanned: updatedUser.isBanned, banUntil: updatedUser.banUntil, banReason: updatedUser.banReason };

        return { performedById: user.id, targetUser: safeUser };
    });

    return NextResponse.json(result);
});

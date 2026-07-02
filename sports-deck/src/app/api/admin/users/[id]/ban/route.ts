// This route was written with the help of ChatGPT, with some manual adjustments and fixes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

function sanitizeReason(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 500) : null;
}

/**
 * @swagger
 * /api/admin/users/{id}/ban:
 *   post:
 *     summary: Ban a user (requires admin auth)
 *     description: Create a ban record and mark the user as banned. Optionally include an `until` date or `reportId` reference. Requires admin authentication.
 *     tags:
 *       - Admin
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to ban
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               until:
 *                 type: string
 *                 format: date-time
 *               reportId:
 *                 type: integer
 *     responses:
 *       '200':
 *         description: Created ban record
 *         content:
 *           application/json:
 *             example:
 *               ban:
 *                 id: 1
 *                 userId: 2
 *                 bannedById: 1
 *                 reason: "not being nice"
 *                 until: "2028-03-30T00:00:00.000Z"
 *                 liftedAt: null
 *                 createdAt: "2026-03-03T01:46:49.156Z"
 *       '400':
 *         description: Invalid input
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 *       '404':
 *         description: User not found
 *       '409':
 *         description: User already banned
 */
export const POST = requireAdmin<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    const { id: idStr } = await params;
    const targetUserId = verifyIdParam(idStr);
    if (targetUserId === null) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const body = await request.json().catch(() => null);
    const reason = sanitizeReason(body?.reason) || "Banned by admin";
    const untilStr = body?.until;
    const until = untilStr ? new Date(untilStr) : null;
    if (until && Number.isNaN(until.getTime())) {
        return NextResponse.json({ error: "Invalid until date" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, isBanned: true, banUntil: true } });
    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const stillBanned = targetUser.isBanned && (!targetUser.banUntil || targetUser.banUntil.getTime() > Date.now());
    if (stillBanned) {
        return NextResponse.json({ error: "User already banned" }, { status: 409 });
    }

    const banRecord = await prisma.$transaction(async (tx) => {
        const createdBan = await tx.ban.create({
            data: {
                userId: targetUserId,
                bannedById: user.id,
                reason,
                until,
            },
        });

        await tx.user.update({
            where: { id: targetUserId },
            data: { isBanned: true, banUntil: until, banReason: reason },
        });

        await tx.moderationAction.create({
            data: {
                actionType: "BAN",
                performedById: user.id,
                reportId: body?.reportId ?? null,
                details: { reason, until: until ? until.toISOString() : null, targetUserId },
            },
        });

        return createdBan;
    });

    return NextResponse.json({ ban: banRecord });
});

// This route was written with the help of ChatGPT, with some manual adjustments and fixes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { verifyIdParam } from "@/lib/utils/validation";
import { getNextAppealAllowedAt, isAppealCooldownActive } from "@/lib/utils/banAppeals";
import type { RouteParams } from "@/lib/types/api";

function sanitizeMessage(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 1000) : null;
}

/**
 * @swagger
 * /api/bans/{id}/appeal:
 *   post:
 *     summary: Submit an appeal for a ban (requires user auth)
 *     description: Authenticated users may submit an appeal for their own ban. Creates a pending BanAppeal record.
 *     tags:
 *       - Appeals
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ban ID to appeal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *             required: [message]
 *     responses:
 *       '201':
 *         description: Appeal created
 *         content:
 *           application/json:
 *             example:
 *               appeal:
 *                 id: 1
 *                 banId: 2
 *                 userId: 2
 *                 message: "please unban!"
 *                 status: "PENDING"
 *                 createdAt: "2026-03-03T01:48:43.278Z"
 *                 decidedAt: null
 *                 decidedById: null
 *       '400':
 *         description: Invalid input
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (not the banned user)
 *       '404':
 *         description: Ban not found
 *       '409':
 *         description: Appeal already pending
 */
export const POST = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    const { id: idStr } = await params;
    const banId = verifyIdParam(idStr);
    if (banId === null) return NextResponse.json({ error: "Invalid ban id" }, { status: 400 });

    const ban = await prisma.ban.findUnique({ where: { id: banId } });
    if (!ban) return NextResponse.json({ error: "Ban not found" }, { status: 404 });
    if (ban.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (ban.liftedAt) return NextResponse.json({ error: "Ban already lifted" }, { status: 400 });
    if (ban.until && ban.until.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Ban is no longer active" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const message = sanitizeMessage(body?.message);
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const existingPending = await prisma.banAppeal.findFirst({ where: { banId, status: "PENDING" } });
    if (existingPending) return NextResponse.json({ error: "Appeal already pending" }, { status: 409 });

    const latestAppeal = await prisma.banAppeal.findFirst({
        where: { banId },
        orderBy: { createdAt: "desc" },
        select: { status: true, createdAt: true },
    });

    if (latestAppeal?.status === "DENIED" && isAppealCooldownActive(latestAppeal.createdAt)) {
        const nextAllowedAt = getNextAppealAllowedAt(latestAppeal.createdAt);
        return NextResponse.json({
            error: "You can submit another appeal after the cooldown period",
            nextAllowedAt,
        }, { status: 429 });
    }

    const appeal = await prisma.banAppeal.create({
        data: {
            banId,
            userId: user.id,
            message,
        },
    });

    return NextResponse.json({ appeal }, { status: 201 });
});

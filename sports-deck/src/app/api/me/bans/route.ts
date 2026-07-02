import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";

type BanAppealSummary = {
    id: number;
    status: string;
    createdAt: Date;
    decidedAt: Date | null;
};

type BanWithAppeals = {
    id: number;
    reason: string;
    until: Date | null;
    liftedAt: Date | null;
    createdAt: Date;
    appeals: BanAppealSummary[];
} | null;

function mapBan(ban: BanWithAppeals) {
    if (!ban) return null;
    const now = Date.now();
    const isActive = !ban.liftedAt && (!ban.until || ban.until.getTime() > now);
    const pendingAppeal = ban.appeals.find((appeal) => appeal.status === "PENDING") ?? null;
    const pastAppeals = (ban.appeals || [])
        .filter((appeal) => appeal.status === "DENIED")
        .map((appeal) => ({ id: appeal.id, status: appeal.status, createdAt: appeal.createdAt, decidedAt: appeal.decidedAt }));
    return {
        id: ban.id,
        reason: ban.reason,
        until: ban.until,
        liftedAt: ban.liftedAt,
        createdAt: ban.createdAt,
        isActive,
        pendingAppeal: pendingAppeal
            ? { id: pendingAppeal.id, status: pendingAppeal.status, createdAt: pendingAppeal.createdAt }
            : null,
        pastAppeals: pastAppeals,
    };
}

/**
 * @swagger
 * /api/me/bans:
 *   get:
 *     summary: Get the latest ban for the current user
 *     description: Returns the most recent ban record for the authenticated user, including whether it is still active and any pending appeal.
 *     tags:
 *       - Account
 *     responses:
 *       '200':
 *         description: Latest ban (or null if none)
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Server error while fetching ban
 */
export const GET = requireUser(async (_request, user) => {
    const ban = await prisma.ban.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { appeals: true },
    });

    return NextResponse.json({ ban: mapBan(ban) });
});

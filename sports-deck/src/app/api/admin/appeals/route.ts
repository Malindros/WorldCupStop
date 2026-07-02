import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
import type { NextRequest } from "next/server";

const APPEAL_STATUS = ["PENDING", "APPROVED", "DENIED"] as const;
type AppealStatus = (typeof APPEAL_STATUS)[number];

function parseAppealStatus(value: string | null): AppealStatus {
    const normalized = (value || "PENDING").toUpperCase();
    return APPEAL_STATUS.includes(normalized as AppealStatus) ? (normalized as AppealStatus) : "PENDING";
}

/**
 * @swagger
 * /api/admin/appeals:
 *   get:
 *     summary: List ban appeals (requires admin auth)
 *     description: Returns ban appeals filtered by `status` query parameter. Defaults to `PENDING`. Requires admin authentication.
 *     tags:
 *       - Admin
 *       - Appeals
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DENIED]
 *         description: Filter appeals by status (default PENDING)
 *     responses:
 *       '200':
 *         description: Appeals returned
 *         content:
 *           application/json:
 *             example:
 *               appeals:
 *                 - id: 4
 *                   banId: 10
 *                   userId: 2
 *                   message: "please unban!"
 *                   status: "PENDING"
 *                   createdAt: "2026-03-03T01:29:48.354Z"
 *                   decidedAt: null
 *                   decidedById: null
 *                   user:
 *                     id: 2
 *                     username: "homefan"
 *                   ban:
 *                     id: 10
 *                     userId: 2
 *                     reason: "no"
 *                     until: "2028-03-30T00:00:00.000Z"
 *                     liftedAt: null
 *                     createdAt: "2026-03-03T01:15:38.180Z"
 *               status: "PENDING"
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 *       '500':
 *         description: Server error while fetching appeals
 */
export const GET = requireAdmin(async (request: NextRequest) => {
    const searchParams = new URL(request.url).searchParams;
    const status = parseAppealStatus(searchParams.get("status"));

    const appeals = await prisma.banAppeal.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        include: {
            user: { select: { id: true, username: true } },
            ban: {
                select: {
                    id: true,
                    userId: true,
                    reason: true,
                    until: true,
                    liftedAt: true,
                    createdAt: true,
                    bannedBy: { select: { id: true, username: true } },
                },
            },
        },
    });

    return NextResponse.json({ appeals, status });
});

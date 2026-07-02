import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/protect";
/**
 * @swagger
 * /api/admin/bans:
 *   get:
 *     summary: List active bans (requires admin auth)
 *     description: Admin-only. Returns bans that are not lifted and not expired.
 *     tags:
 *       - Admin
 *     responses:
 *       '200':
 *         description: Active bans returned
 *         content:
 *           application/json:
 *             example:
 *               bans:
 *                 - id: 2
 *                   userId: 2
 *                   bannedById: 1
 *                   reason: "not being nice"
 *                   until: "2028-03-30T00:00:00.000Z"
 *                   liftedAt: null
 *                   createdAt: "2026-03-03T01:47:55.313Z"
 *                   user:
 *                     id: 2
 *                     username: "homefan"
 *                     isBanned: true
 *                     banUntil: "2028-03-30T00:00:00.000Z"
 *                   bannedBy:
 *                     id: 1
 *                     username: "admin"
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (admin only)
 *       '500':
 *         description: Server error while fetching bans
 */
export const GET = requireAdmin(async () => {
     const now = new Date();
     const bans = await prisma.ban.findMany({
         where: {
             liftedAt: null,
             OR: [
                 { until: null },
                 { until: { gt: now } },
             ],
         },
         orderBy: { createdAt: "desc" },
         include: {
             user: { select: { id: true, username: true, isBanned: true, banUntil: true } },
             bannedBy: { select: { id: true, username: true } },
         },
     });

     return NextResponse.json({ bans });
 });

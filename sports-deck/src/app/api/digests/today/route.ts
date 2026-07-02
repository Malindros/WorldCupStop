import { NextResponse } from "next/server";
import { requireUser } from "@/lib/protect";
import { getOrCreateDailyDigest } from "@/lib/utils/digest";

/**
 * @swagger
 * /api/digests/today:
 *   get:
 *     summary: Get today's daily digest (requires user auth)
 *     description: Retrieve the digest for the active daily slot (default 08:00 UTC), generating it on demand if missing or stale. Requires authenticated user.
 *     tags:
 *       - Digests
 *     responses:
 *       '200':
 *         description: Digest retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             examples:
 *               digestExample:
 *                 summary: Sample daily digest response
 *                 value:
 *                   id: 1
 *                   date: "2026-03-02T00:00:00.000Z"
 *                   generatedAt: "2026-03-02T02:08:11.393Z"
 *                   cached: true
 *                   summary: "Top Discussions:\n1. \"Match Thread 1: 1\" by Metro City Lions with 8 posts..."
 *                   sections: {}
 *       '401':
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             examples:
 *               unauthorized:
 *                 value:
 *                   error: "Unauthorized"
 *       '500':
 *         description: Server error while generating digest
 *         content:
 *           application/json:
 *             examples:
 *               serverError:
 *                 value:
 *                   error: "Failed to fetch daily digest"
 */

export const GET = requireUser(async (request, user) => {
    try {
        const result = await getOrCreateDailyDigest({ requestedByUserId: user.id, force: false });
        return NextResponse.json(result.content, { status: 200 });
    } catch (err) {
        console.error("Failed to fetch daily digest", err);
        return NextResponse.json({ error: "Failed to fetch daily digest" }, { status: 500 });
    }
});

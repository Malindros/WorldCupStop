import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/protect";
import { getOrCreateDailyDigest } from "@/lib/utils/digest";

/**
 * @swagger
 * /api/admin/digests/generate:
 *   post:
 *     summary: Force-generate the daily digest (requires admin auth)
 *     description: Generate and persist a fresh daily digest immediately. Intended for administrative use to refresh the digest on-demand. Requires admin authentication.
 *     tags:
 *       - Digests
 *     parameters: []
 *     responses:
 *       '200':
 *         description: Digest generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             examples:
 *               generatedExample:
 *                 summary: Newly generated digest
 *                 value:
 *                   id: 1
 *                   date: "2026-03-02T00:00:00.000Z"
 *                   generatedAt: "2026-03-02T02:08:11.393Z"
 *                   cached: false
 *                   summary: "Top Discussions:\n1. \"Match Thread 1: 1\" by Metro City Lions with 8 posts..."
 *                   sections: {}
 *       '401':
 *         description: Unauthorized - admin authentication required
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
 *                   error: "Failed to generate daily digest"
 */

export const POST = requireAdmin(async (_request, user) => {
    try {
        const result = await getOrCreateDailyDigest({ requestedByUserId: user.id, force: true });
        return NextResponse.json(result.content, { status: 200 });
    } catch (err) {
        console.error("Failed to generate daily digest", err);
        return NextResponse.json({ error: "Failed to generate daily digest" }, { status: 500 });
    }
});

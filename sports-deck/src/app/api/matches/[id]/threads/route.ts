
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/matches/{id}/threads:
 *   get:
 *     summary: List threads for a match
 *     description: Returns a list of forum threads associated with a match.
 *     tags:
 *       - Matches
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Match ID
 *     responses:
 *       200:
 *         description: List of threads for the match
 *       404:
 *         description: Match not found
 *       400:
 *         description: Invalid match id
 *       500:
 *         description: Failed to fetch match threads
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { buildVisibleThreadWhere, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const matchId = verifyIdParam(idStr);
		if (matchId === null) return NextResponse.json({ error: "Invalid match id" }, { status: 400 });

		// Return 404 if the match doesn't exist
		const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
		if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

		const threads = await prisma.forumThread.findMany({
			where: {
				AND: [
					{ matchId },
					buildVisibleThreadWhere(),
				],
			},
		    orderBy: { createdAt: "desc" },
		    include: { author: { select: { id: true, username: true } } }
		});

		threads.sort((a, b) => {
			const aWithin = isThreadWithinWindow(a as any);
			const bWithin = isThreadWithinWindow(b as any);
			if (aWithin && !bWithin) return -1;
			if (!aWithin && bWithin) return 1;
			// If both are within the window (match threads), sort by autoCloseAt (earlier close first).
			if (aWithin && bWithin) {
				const aClose = a.autoCloseAt ? new Date(a.autoCloseAt).getTime() : Number.POSITIVE_INFINITY;
				const bClose = b.autoCloseAt ? new Date(b.autoCloseAt).getTime() : Number.POSITIVE_INFINITY;
				if (aClose !== bClose) return aClose - bClose;
			}
			return b.updatedAt.getTime() - a.updatedAt.getTime();
		});

		const mapped = threads.map(t => ({ id: t.id, title: t.title, slug: t.slug, author: t.author ? { id: t.author.id, username: t.author.username } : null, createdAt: t.createdAt, isWithinWindow: isThreadWithinWindow(t), autoOpenAt: t.autoOpenAt, autoCloseAt: t.autoCloseAt }));
		return NextResponse.json({ matchId, threads: mapped });
	} catch (err) {
		console.error("Failed to fetch match threads", err);
		return NextResponse.json({ error: "Failed to fetch match threads" }, { status: 500 });
	}
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { buildVisibleThreadWhere, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/teams/{id}/threads:
 *   get:
 *     summary: List threads for a team
 *     description: Returns a list of forum threads associated with a team.
 *     tags:
 *       - Teams
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: List of threads for the team
 *       400:
 *         description: Invalid team id
 *       404:
 *         description: Team not found
 *       500:
 *         description: Failed to fetch team threads
 */
export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const teamId = verifyIdParam(idStr);
		if (teamId === null) {
			return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
		}

		const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
		if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

		let threads = await prisma.forumThread.findMany({
			where: {
				AND: [
					{ teamId },
					buildVisibleThreadWhere(),
				],
			},
			orderBy: { updatedAt: "desc" },
			include: { author: { select: { id: true, username: true } } },
		});

        // 1) open match threads (most recently opened first)
        // 2) other threads (most recently created first)
        // 3) soon-to-open match threads (soonest autoOpenAt first)
        // 4) closed match threads (most recently closed first)
        const now = Date.now();
        const openMatch: typeof threads = [];
        const otherThreads: typeof threads = [];
        const soonOpen: typeof threads = [];
        const closedMatch: typeof threads = [];

        for (const t of threads) {
            const isMatch = Boolean(t.matchId);
            const within = isThreadWithinWindow(t as any);
            if (isMatch && within) {
                openMatch.push(t);
            } else if (!isMatch) {
                otherThreads.push(t);
            } else if (isMatch && t.autoOpenAt && new Date(t.autoOpenAt).getTime() > now) {
                soonOpen.push(t);
            } else if (isMatch) {
                closedMatch.push(t);
            } else {
                otherThreads.push(t);
            }
        }

        openMatch.sort((a, b) => {
            const aOpen = a.autoOpenAt ? new Date(a.autoOpenAt).getTime() : a.createdAt.getTime();
            const bOpen = b.autoOpenAt ? new Date(b.autoOpenAt).getTime() : b.createdAt.getTime();
            return bOpen - aOpen; // most recently opened first
        });

        otherThreads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        soonOpen.sort((a, b) => {
            const aOpen = a.autoOpenAt ? new Date(a.autoOpenAt).getTime() : Number.POSITIVE_INFINITY;
            const bOpen = b.autoOpenAt ? new Date(b.autoOpenAt).getTime() : Number.POSITIVE_INFINITY;
            return aOpen - bOpen; // soonest first
        });

        closedMatch.sort((a, b) => {
            const aClose = a.autoCloseAt ? new Date(a.autoCloseAt).getTime() : 0;
            const bClose = b.autoCloseAt ? new Date(b.autoCloseAt).getTime() : 0;
            return bClose - aClose; // most recently closed first
        });

        // Rebuild threads array and assign directly
        const rebuilt = [...openMatch, ...otherThreads, ...soonOpen, ...closedMatch];
        threads = rebuilt;

		const mapped = threads.map(t => ({
			id: t.id,
			title: t.title,
			slug: t.slug,
			matchId: t.matchId,
			isClosed: t.isClosed,
			isWithinWindow: isThreadWithinWindow(t),
			autoOpenAt: t.autoOpenAt,
			autoCloseAt: t.autoCloseAt,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
			author: t.author ? { id: t.author.id, username: t.author.username } : null,
		}));

		return NextResponse.json({ teamId, threads: mapped });
	} catch (err) {
		console.error("Failed to fetch team threads", err);
		return NextResponse.json({ error: "Failed to fetch team threads" }, { status: 500 });
	}
}

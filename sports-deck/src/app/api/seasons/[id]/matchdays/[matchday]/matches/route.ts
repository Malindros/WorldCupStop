
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/seasons/{seasonId}/matchdays/{matchday}/matches:
 *   get:
 *     summary: Get matches for a season matchday
 *     description: Returns all matches for a given season and matchday.
 *     tags:
 *       - Seasons
 *     parameters:
 *       - in: path
 *         name: seasonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Season ID
 *       - in: path
 *         name: matchday
 *         required: true
 *         schema:
 *           type: integer
 *         description: Matchday number
 *     responses:
 *       200:
 *         description: List of matches for the matchday
 *       400:
 *         description: Invalid seasonId or matchday
 *       500:
 *         description: Failed to fetch matchday matches
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

export async function GET(_request: Request, { params }: RouteParams<{ id: string; matchday: string }>) {
	try {
        const { id, matchday } = await params;
		const seasonIdNum = verifyIdParam(id);
		const matchdayNum = Number(matchday);
		if (!seasonIdNum) return NextResponse.json({ error: "Invalid seasonId" }, { status: 400 });
		if (Number.isNaN(matchdayNum) || matchdayNum < 1) return NextResponse.json({ error: "Invalid matchday" }, { status: 400 });

		const matches = await prisma.match.findMany({
			where: { seasonId: seasonIdNum, matchday: matchdayNum },
			orderBy: { startTime: "asc" },
			include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } },
		});

		return NextResponse.json(matches);
	} catch (err) {
		console.error("Failed to fetch matchday matches", err);
		return NextResponse.json({ error: "Failed to fetch matchday matches" }, { status: 500 });
	}
}


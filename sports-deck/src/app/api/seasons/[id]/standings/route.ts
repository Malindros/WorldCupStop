
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/seasons/{seasonId}/standings:
 *   get:
 *     summary: Get standings for a season
 *     description: Returns the standings table for a given season.
 *     tags:
 *       - Seasons
 *     parameters:
 *       - in: path
 *         name: seasonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Season ID
 *     responses:
 *       200:
 *         description: Standings table for the season
 *       400:
 *         description: Invalid season id
 *       404:
 *         description: Season not found
 *       500:
 *         description: Failed to fetch standings
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const seasonId = verifyIdParam(idStr);
		if (seasonId === null) return NextResponse.json({ error: "Invalid season id" }, { status: 400 });

		const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } });
		if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

		const standings = await prisma.teamStanding.findMany({
			where: { seasonId },
			orderBy: { position: "asc" },
			include: { team: { select: { id: true, name: true, shortName: true, slug: true } } },
		});

		const table = standings.map(s => ({
			position: s.position,
			team: s.team ? { id: s.team.id, name: s.team.name, shortName: s.team.shortName, slug: s.team.slug } : null,
			playedGames: s.played ?? null,
			won: s.wins ?? null,
			draw: s.draws ?? null,
			lost: s.losses ?? null,
			points: s.points ?? null,
			goalsFor: s.goalsFor ?? null,
			goalsAgainst: s.goalsAgainst ?? null,
			goalDifference: s.goalDifference ?? null,
		}));

		return NextResponse.json({ seasonId, table });
	} catch (err) {
		console.error("Failed to fetch standings", err);
		return NextResponse.json({ error: "Failed to fetch standings" }, { status: 500 });
	}
}

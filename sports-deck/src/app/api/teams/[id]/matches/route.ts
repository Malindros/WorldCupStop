
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/teams/{id}/matches:
 *   get:
 *     summary: List matches for a team
 *     description: Returns a list of matches for a given team (as home or away).
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
 *         description: List of matches for the team
 *       400:
 *         description: Invalid team id
 *       404:
 *         description: Team not found
 *       500:
 *         description: Failed to fetch team matches
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const teamId = verifyIdParam(idStr);
		if (teamId === null) {
			return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
		}

		const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
		if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

		const matches = await prisma.match.findMany({
			where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
			orderBy: { startTime: "desc" },
			include: {
				homeTeam: { select: { id: true, name: true, shortName: true, slug: true } },
				awayTeam: { select: { id: true, name: true, shortName: true, slug: true } },
			},
		});

		const mapped = matches.map(m => ({
			id: m.id,
			homeTeamId: m.homeTeamId,
			awayTeamId: m.awayTeamId,
			homeTeam: m.homeTeam ? { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName, slug: m.homeTeam.slug } : null,
			awayTeam: m.awayTeam ? { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName, slug: m.awayTeam.slug } : null,
			homeScore: m.homeScore,
			awayScore: m.awayScore,
			status: m.status,
			startTime: m.startTime,
			endTime: m.endTime,
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
		}));

		return NextResponse.json({ teamId, matches: mapped });
	} catch (err) {
		console.error("Failed to fetch team matches", err);
		return NextResponse.json({ error: "Failed to fetch team matches" }, { status: 500 });
	}
}


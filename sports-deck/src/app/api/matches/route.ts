
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: List matches
 *     description: Returns a list of matches, optionally filtered by status, team, date, season, or matchday.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by match status
 *       - in: query
 *         name: team
 *         schema: { type: integer }
 *         description: Filter by team ID (home or away)
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Filter by match date (YYYY-MM-DD)
 *       - in: query
 *         name: season
 *         schema: { type: integer }
 *         description: Filter by season ID
 *       - in: query
 *         name: matchday
 *         schema: { type: integer }
 *         description: Filter by matchday number
 *     tags:
 *       - Matches
 *     responses:
 *       200:
 *         description: List of matches
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "../../../../prisma/generated/client";

// GET /matches?status=&team=&date=YYYY-MM-DD&season=&matchday=
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const status = url.searchParams.get("status");
		const team = url.searchParams.get("team");
		const date = url.searchParams.get("date");
		const seasonParam = url.searchParams.get("season");
		const matchdayParam = url.searchParams.get("matchday");

		const where: Prisma.MatchWhereInput = {};
		if (status) where.status = status;
		if (team && !Number.isNaN(Number(team))) {
			const teamId = Number(team);
			where.OR = [{ homeTeamId: teamId }, { awayTeamId: teamId }];
		}

		// if date provided, use it
		if (date) {
			const start = new Date(date);
			const end = new Date(start);
			end.setDate(end.getDate() + 1);
			where.startTime = { gte: start, lt: end };
		}

		// allow filtering by season without requiring matchday
		if (seasonParam && !Number.isNaN(Number(seasonParam))) {
			where.seasonId = Number(seasonParam);
		}

		// If filtering by matchday, just use the stored matchday field; optionally restrict by season
		if (matchdayParam) {
			const mdNum = Number(matchdayParam);
			if (Number.isNaN(mdNum)) return NextResponse.json({ error: "Invalid matchday" }, { status: 400 });
			where.matchday = mdNum;
			const filtered = await prisma.match.findMany({ where, orderBy: { startTime: "desc" }, include: { homeTeam: { select: { id: true, name: true, crest: true } }, awayTeam: { select: { id: true, name: true, crest: true } } } });
			return NextResponse.json(filtered);
		}

		const matches = await prisma.match.findMany({ where, orderBy: { startTime: "desc" }, include: { homeTeam: { select: { id: true, name: true, crest: true } }, awayTeam: { select: { id: true, name: true, crest: true } } } });

		return NextResponse.json(matches);
	} catch (err) {
		console.error("Failed to fetch matches", err);
		return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
	}
}
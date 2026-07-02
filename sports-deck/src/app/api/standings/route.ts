/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/standings:
 *   get:
 *     summary: Get current standings
 *     description: Returns the current standings table for the most recent season (with a current matchday if available).
 *     tags:
 *       - Standings
 *     responses:
 *       200:
 *         description: Standings table for the current season
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TODO: swagger doc
export async function GET() {
  try {
    // prefer seasons that have a non-null currentMatchday, fallback to most recent season
    let season = await prisma.season.findFirst({ where: { currentMatchday: { not: null } }, orderBy: { startDate: "desc" } });
    if (!season) {
      season = await prisma.season.findFirst({ orderBy: { startDate: "desc" } });
    }
    if (!season) return NextResponse.json({ error: "No season found" }, { status: 404 });

    const standings = await prisma.teamStanding.findMany({ where: { seasonId: season.id }, orderBy: { position: "asc" }, include: { team: { select: { id: true, name: true, shortName: true, slug: true } } } });

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

    return NextResponse.json({ season: { id: season.id, startDate: season.startDate, endDate: season.endDate, currentMatchday: season.currentMatchday }, table });
  } catch (err) {
    console.error("Failed to fetch current standings", err);
    return NextResponse.json({ error: "Failed to fetch current standings" }, { status: 500 });
  }
}


/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/seasons/{seasonId}/matchdays:
 *   get:
 *     summary: Get matchday count for a season
 *     description: Returns the number of matchdays for a given season.
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
 *         description: Matchday count for the season
 *       400:
 *         description: Invalid season id
 *       404:
 *         description: Season not found
 *       500:
 *         description: Failed to fetch matchdays
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

		const season = await prisma.season.findUnique({ where: { id: seasonId } });
		if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

		// Use the stored matchday field on matches, find the maximum matchday for this season?
        // maybe refactor later to store matchday count on season and update when matches are added/updated
		const agg = await prisma.match.aggregate({
			_max: { matchday: true },
			where: { seasonId },
		});

		const matchdayCount = agg._max.matchday ?? 0;
		return NextResponse.json({ seasonId, matchdayCount });
	} catch (err) {
		console.error("Failed to fetch matchdays", err);
		return NextResponse.json({ error: "Failed to fetch matchdays" }, { status: 500 });
	}
}

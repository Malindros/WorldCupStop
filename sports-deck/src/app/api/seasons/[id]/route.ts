
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/seasons/{seasonId}:
 *   get:
 *     summary: Get season by ID
 *     description: Returns a season by its ID, including winner info.
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
 *         description: Season object
 *       400:
 *         description: Invalid season id
 *       404:
 *         description: Season not found
 *       500:
 *         description: Failed to fetch season
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

		const season = await prisma.season.findUnique({
			where: { id: seasonId },
		});

		if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
		return NextResponse.json(season);
	} catch (err) {
		console.error("Failed to fetch season", err);
		return NextResponse.json({ error: "Failed to fetch season" }, { status: 500 });
	}
}

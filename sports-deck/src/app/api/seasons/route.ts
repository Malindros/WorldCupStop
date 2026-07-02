
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/seasons:
 *   get:
 *     summary: List seasons
 *     description: Returns a list of all seasons, ordered by start date descending.
 *     tags:
 *       - Seasons
 *     responses:
 *       200:
 *         description: List of seasons
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /seasons - list seasons
export async function GET() {
	try {
		const seasons = await prisma.season.findMany({
			orderBy: { startDate: "desc" },
		});
		return NextResponse.json(seasons);
	} catch (err) {
		console.error("Failed to fetch seasons", err);
		return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500 });
	}
}

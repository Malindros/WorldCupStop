
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/matches/{id}:
 *   get:
 *     summary: Get match by ID
 *     description: Returns a match by its ID, including home and away team info.
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
 *         description: Match object
 *       400:
 *         description: Invalid match id
 *       404:
 *         description: Match not found
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const id = verifyIdParam(idStr);
		if (id === null) return NextResponse.json({ error: "Invalid match id" }, { status: 400 });

		const match = await prisma.match.findUnique({ where: { id },
            include: { homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } } } 
        });
		if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
		return NextResponse.json(match);
	} catch (err) {
		console.error("Failed to fetch match", err);
		return NextResponse.json({ error: "Failed to fetch match" }, { status: 500 });
	}
}
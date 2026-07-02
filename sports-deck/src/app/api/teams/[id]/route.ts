/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get team by ID
 *     description: Returns a team by its ID.
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
 *         description: Team object
 *       400:
 *         description: Invalid team id
 *       404:
 *         description: Team not found
 *       500:
 *         description: Failed to fetch team
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

// TODO: swagger doc
export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const teamId = verifyIdParam(idStr);
		if (teamId === null) {
			return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
		}

		const team = await prisma.team.findUnique({
			where: { id: teamId },
		});

		if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

		return NextResponse.json(team);
	} catch (err) {
		console.error("Failed to fetch team", err);
		return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
	}
}


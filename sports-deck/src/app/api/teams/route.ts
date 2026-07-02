
/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 *
 */

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: List teams
 *     description: Returns a list of all teams.
 *     tags:
 *       - Teams
 *     responses:
 *       200:
 *         description: List of teams
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TODO: swagger doc
export async function GET() {
    try {
        const teams = await prisma.team.findMany({
            select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
                crest: true,
                createdAt: true,
                updatedAt: true
            },
        });

        return NextResponse.json(teams);
    } catch (err) {
        console.error("Failed to fetch teams", err);
        return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
    }
}
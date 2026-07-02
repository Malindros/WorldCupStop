import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { requireAdmin } from "@/lib/protect";
import type { RouteParams } from "@/lib/types/api";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/tags/{id}:
 *   get:
 *     summary: Get tag details
 *     description: Returns tag metadata and associated thread count.
 *     tags:
 *       - Tags
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag details
 *       400:
 *         description: Invalid tag id
 *       404:
 *         description: Tag not found
 */
export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
	try {
		const { id: idStr } = await params;
		const id = verifyIdParam(idStr);
		if (id === null) return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });

		const tag = await prisma.tag.findUnique({
			where: { id },
			include: {
				_count: { select: { threads: true } },
			},
		});

		if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

		return NextResponse.json({
			id: tag.id,
			name: tag.name,
			slug: tag.slug,
			createdAt: tag.createdAt,
			threadCount: tag._count.threads,
		});
	} catch (err) {
		console.error("Failed to fetch tag", err);
		return NextResponse.json({ error: "Failed to fetch tag" }, { status: 500 });
	}
}

/**
 * @swagger
 * /api/tags/{id}:
 *   delete:
 *     summary: Delete a tag
 *     description: Deletes a tag by ID. Requires admin authentication.
 *     tags:
 *       - Tags
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag deleted
 *       400:
 *         description: Invalid tag id
 *       404:
 *         description: Tag not found
 */
export const DELETE = requireAdmin<RouteParams<{ id: string }>>(async (_request, _user, { params }) => {
	try {
		const { id: idStr } = await params;
		const id = verifyIdParam(idStr);
		if (id === null) return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });

		const existing = await prisma.tag.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!existing) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

		await prisma.tag.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("Failed to delete tag", err);
		return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
	}
});

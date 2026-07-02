import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { sanitizeText, slugify } from "@/lib/utils/validation";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

const TAG_MAX_LENGTH = 30;

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: List tags
 *     description: Returns tags ordered by thread count (desc) then name (asc). Supports optional prefix search.
 *     tags:
 *       - Tags
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Prefix to match against the beginning of tag name or slug.
 *     responses:
 *       200:
 *         description: List of tags
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const q = sanitizeText(searchParams.get("q"));

		const tags = await prisma.tag.findMany({
			where: q
				? {
					OR: [
						{ name: { startsWith: q } },
						{ slug: { startsWith: slugify(q) } },
					],
				}
				: undefined,
			orderBy: [
				{ threads: { _count: "desc" } },
				{ name: "asc" },
			],
			include: {
				_count: { select: { threads: true } },
			},
		});

		return NextResponse.json({
			tags: tags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				slug: tag.slug,
				createdAt: tag.createdAt,
				threadCount: tag._count.threads,
			})),
		});
	} catch (err) {
		console.error("Failed to list tags", err);
		return NextResponse.json({ error: "Failed to list tags" }, { status: 500 });
	}
}

/**
 * @swagger
 * /api/tags:
 *   post:
 *     summary: Create a tag
 *     description: Creates a new tag. Requires authentication.
 *     tags:
 *       - Tags
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 30
 *     responses:
 *       201:
 *         description: Tag created
 *       400:
 *         description: Invalid name
 *       409:
 *         description: Tag already exists
 */
export const POST = requireUser(async (request) => {
	try {
		const body = await request.json().catch(() => null);
		const name = sanitizeText(body?.name);
		if (!name) {
			return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
		}
        if (name.length > TAG_MAX_LENGTH) {
            return NextResponse.json({ error: `Tag name must be at most ${TAG_MAX_LENGTH} characters` }, { status: 400 });
        }   
		const slug = slugify(name);
		if (!slug) {
			return NextResponse.json({ error: "Invalid tag name" }, { status: 400 });
		}

		const created = await prisma.tag.create({
			data: { name, slug },
		});

		return NextResponse.json(created, { status: 201 });
	} catch (err) {
		if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
			return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
		}
		console.error("Failed to create tag", err);
		return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
	}
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { requireUser } from "@/lib/protect";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/posts/{id}/history:
 *   get:
 *     summary: Get post content history
 *     description: Returns the current content and edit snapshots for a post in chronological order.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Post ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Post history returned
 *       '400':
 *         description: Invalid post id
 *       '404':
 *         description: Post not found
 *       '500':
 *         description: Failed to fetch post history
 */
export const GET = requireUser(async (request, user, { params }) => {
	try {
		const { id: idStr } = await params;
		const postId = verifyIdParam(idStr);
		if (postId === null) {
			return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
		}

		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				thread: { select: { id: true, isHidden: true } },
				edits: {
					orderBy: { editedAt: "asc" },
					include: {
						editor: {
							select: {
								id: true,
								username: true,
							},
						},
					},
				},
			},
		});

		if (!post || (post.isHidden || post.thread?.isHidden) && user.role !== "ADMIN") {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		return NextResponse.json({
			postId: post.id,
			threadId: post.threadId,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			current: {
				content: post.content,
				language: post.language,
				updatedAt: post.updatedAt,
			},
			history: post.edits.map((edit) => ({
				id: edit.id,
				previousContent: edit.previousContent,
				language: edit.language,
				editedAt: edit.editedAt,
				editor: edit.editor
					? {
						id: edit.editor.id,
						username: edit.editor.username,
					}
					: null,
			})),
		});
	} catch (err) {
		console.error("Failed to fetch post history", err);
		return NextResponse.json({ error: "Failed to fetch post history" }, { status: 500 });
	}
});
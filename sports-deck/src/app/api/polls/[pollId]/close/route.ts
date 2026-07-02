import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { requireUser } from "@/lib/protect";
import { isThreadVisible } from "@/lib/utils/threadVisibility";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/polls/{id}/close:
 *   post:
 *     summary: Close poll manually
 *     description: Closes a poll. Allowed for poll creator or admin.
 *     tags:
 *       - Polls
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Poll closed
 *       '400':
 *         description: Invalid poll id or poll already closed
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Poll not found
 */

export const POST = requireUser(async (request, user, { params }) => {
	try {
		const { pollId: pollIdStr } = await params;
		const pollId = verifyIdParam(pollIdStr);
		if (pollId === null) return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

		const existing = await prisma.poll.findUnique({
			where: { id: pollId },
			select: {
				id: true,
				createdById: true,
				isClosed: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
			},
		});
		if (!existing) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (existing.threadId && (!existing.thread || !isThreadVisible(existing.thread))) {
			return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
		}
        if (existing.isClosed) return NextResponse.json({ error: "Poll is already closed" }, { status: 400 });
		if (existing.createdById !== user.id && user.role !== "ADMIN") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		if (existing.isClosed) {
			return NextResponse.json({
				id: existing.id,
				isClosed: true,
			});
		}

		const updated = await prisma.poll.update({
			where: { id: pollId },
			data: { isClosed: true },
		});

		return NextResponse.json({
			id: updated.id,
			threadId: updated.threadId,
			question: updated.question,
			isClosed: updated.isClosed,
			deadline: updated.deadline,
			createdAt: updated.createdAt,
		});
	} catch (err) {
		console.error("Failed to close poll", err);
		return NextResponse.json({ error: "Failed to close poll" }, { status: 500 });
	}
});
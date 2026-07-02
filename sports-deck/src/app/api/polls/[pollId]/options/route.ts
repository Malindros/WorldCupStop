import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam, sanitizeText } from "@/lib/utils/validation";
import { requireUser } from "@/lib/protect";
import { isThreadVisible } from "@/lib/utils/threadVisibility";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/polls/{id}/options:
 *   post:
 *     summary: Add poll option
 *     description: Adds a poll option to a poll. Only the poll creator or an admin may add options, and options cannot be added once voting has started or the poll is closed.
 *     tags:
 *       - Polls
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Poll ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label]
 *             properties:
 *               label:
 *                 type: string
 *                 description: Option label (user-visible)
 *                 maxLength: 500
 *               metadata:
 *                 type: object
 *                 nullable: true
 *                 description: Optional metadata object stored with the option
 *           example:
 *             label: "Extend halftime by 5 minutes"
 *             metadata: { "emoji": "🏟️" }
 *     responses:
 *       201:
 *         description: Poll option created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 pollId: { type: integer }
 *                 label: { type: string }
 *                 metadata: { type: object, nullable: true }
 *             example:
 *               id: 42
 *               pollId: 7
 *               label: "Extend halftime by 5 minutes"
 *               metadata: { "emoji": "🏟️" }
 *       400:
 *         description: Invalid input or poll state
 *         content:
 *           application/json:
 *             example: { error: "Invalid poll id" }
 *       403:
 *         description: Forbidden (not poll owner or admin)
 *         content:
 *           application/json:
 *             example: { error: "Forbidden" }
 *       404:
 *         description: Poll not found
 *         content:
 *           application/json:
 *             example: { error: "Poll not found" }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example: { error: "Failed to add poll option" }
 */
export const POST = requireUser(async (request, user, { params }) => {
	try {
		const { pollId: pollIdStr } = await params;
		const pollId = verifyIdParam(pollIdStr);
		if (pollId === null) {
			return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: {
				id: true,
				createdById: true,
				isClosed: true,
				deadline: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
				_count: { select: { votes: true } },
			},
		});

		if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (poll.threadId && (!poll.thread || !isThreadVisible(poll.thread))) {
			return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
		}
		if (poll.createdById !== user.id && user.role !== "ADMIN") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (poll.isClosed || new Date(poll.deadline) <= new Date()) {
			return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
		}
		if (poll._count.votes > 0) {
			return NextResponse.json({ error: "Cannot modify options after voting has started" }, { status: 400 });
		}

		const body = await request.json().catch(() => null);
		const label = sanitizeText(body?.label);
		const metadata = body?.metadata ?? null;

		if (!label) {
			return NextResponse.json({ error: "Option label is required" }, { status: 400 });
		}

		const created = await prisma.pollOption.create({
			data: {
				pollId,
				label,
				metadata,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (err) {
		console.error("Failed to add poll option", err);
		return NextResponse.json({ error: "Failed to add poll option" }, { status: 500 });
	}
});

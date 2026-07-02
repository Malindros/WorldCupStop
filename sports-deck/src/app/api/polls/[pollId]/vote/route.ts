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
 * /api/polls/{id}/vote:
 *   post:
 *     summary: Vote in poll
 *     description: Cast a vote for an option in an open poll. One vote per user per poll.
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
 *             required: [optionId]
 *             properties:
 *               optionId:
 *                 type: integer
 *                 description: ID of the poll option to vote for
 *           example:
 *             optionId: 13
 *     responses:
 *       201:
 *         description: Vote recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 pollId: { type: integer }
 *                 optionId: { type: integer }
 *                 voterId: { type: integer }
 *             example:
 *               id: 101
 *               pollId: 7
 *               optionId: 13
 *               voterId: 55
 *       400:
 *         description: Invalid input or poll closed
 *         content:
 *           application/json:
 *             example: { error: "Invalid poll id" }
 *       404:
 *         description: Poll or option not found
 *         content:
 *           application/json:
 *             example: { error: "Poll option not found" }
 *       409:
 *         description: User has already voted in this poll
 *         content:
 *           application/json:
 *             example: { error: "You have already voted in this poll" }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example: { error: "Failed to cast vote" }
 */
export const POST = requireUser(async (request, user, { params }) => {
	try {
		const { pollId: pollIdStr } = await params;
		const pollId = verifyIdParam(pollIdStr);
		if (pollId === null) {
			return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });
		}

		const body = await request.json().catch(() => null);
		const optionId = verifyIdParam(body?.optionId);
		if (optionId === null) {
			return NextResponse.json({ error: "Invalid option id" }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: {
				id: true,
				isClosed: true,
				deadline: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
			},
		});
		if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (poll.threadId && (!poll.thread || !isThreadVisible(poll.thread))) {
			return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
		}
		if (poll.isClosed || new Date(poll.deadline) <= new Date()) {
			return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
		}

		// Check if the user is currently banned
		const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isBanned: true, banUntil: true } });
		if (dbUser && dbUser.isBanned) return NextResponse.json({ error: "You are banned and cannot perform this action" }, { status: 403 });

		const option = await prisma.pollOption.findUnique({
			where: { id: optionId },
			select: { id: true, pollId: true },
		});
		if (!option || option.pollId !== pollId) {
			return NextResponse.json({ error: "Poll option not found" }, { status: 404 });
		}

		const existingVote = await prisma.pollVote.findUnique({
			where: { pollId_voterId: { pollId, voterId: user.id } },
			select: { id: true, optionId: true },
		});

		if (existingVote) {
			if (existingVote.optionId === optionId) {
				return NextResponse.json({ error: "You have already voted for this option" }, { status: 409 });
			}
			const updated = await prisma.pollVote.update({ where: { id: existingVote.id }, data: { optionId } });
			return NextResponse.json(updated, { status: 200 });
		}

		const vote = await prisma.pollVote.create({
			data: {
				pollId,
				optionId,
				voterId: user.id,
			},
		});

		return NextResponse.json(vote, { status: 201 });
	} catch (err) {
		console.error("Failed to cast vote", err);
		return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
	}
});

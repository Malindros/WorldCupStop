import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { getUserFromRequest } from "@/lib/utils/auth";
import { requireUser } from "@/lib/protect";
import { isThreadVisible } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";
import type { Prisma } from "../../../../../prisma/generated/client";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/polls/{id}:
 *   get:
 *     summary: Get poll details
 *     description: Returns poll metadata with option/vote counts.
 *     tags:
 *       - Polls
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Poll details
 *       400:
 *         description: Invalid poll id
 *       404:
 *         description: Poll not found
 */
export async function GET(_request: Request, { params }: RouteParams<{ pollId: string }>) {
	try {
		const { pollId } = await params;
		const id = verifyIdParam(pollId);
		if (id === null) return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

		const poll = await prisma.poll.findUnique({
			where: { id },
			include: {
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
				options: {
					orderBy: { id: "asc" },
					include: {
						_count: { select: { votes: true } },
					},
				},
				_count: { select: { options: true, votes: true } },
			},
		});

		if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (poll.threadId && (!poll.thread || !isThreadVisible(poll.thread))) {
			return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		}


		let selectedOptionId: number | null = null;
		const requester = getUserFromRequest(_request);
		if (requester) {
			const vote = await prisma.pollVote.findUnique({ where: { pollId_voterId: { pollId: id, voterId: requester.id } }, select: { optionId: true } });
			if (vote) selectedOptionId = vote.optionId;
		}

		return NextResponse.json({
			id: poll.id,
			threadId: poll.threadId,
			question: poll.question,
			deadline: poll.deadline,
			isClosed: poll.isClosed,
			createdAt: poll.createdAt,
			options: poll.options.map((option) => ({
				id: option.id,
				label: option.label,
				metadata: option.metadata,
				voteCount: option._count.votes,
			})),
			optionCount: poll._count.options,
			voteCount: poll._count.votes,
			selectedOptionId,
		});
	} catch (err) {
		console.error("Failed to fetch poll", err);
		return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 });
	}
}

/**
 * @swagger
 * /api/polls/{id}:
 *   patch:
 *     summary: Update a poll
 *     description: Updates a poll's question and/or deadline. Requires user authentication.
 *     tags:
 *       - Polls
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Poll updated
 *       400:
 *         description: Invalid poll id or missing poll name
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Poll not found
 */
export const PATCH = requireUser<RouteParams<{ pollId: string }>>(async (request, user, { params }) => {
    try {
		const { pollId: idStr } = await params;
        const id = verifyIdParam(idStr);
        if (id === null) return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

        const existing = await prisma.poll.findUnique({
            where: { id },
			select: {
				id: true,
				createdById: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
				_count: { select: { votes: true } },
			},
        });
        if (!existing) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (existing.threadId && (!existing.thread || !isThreadVisible(existing.thread))) {
			return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
		}
        if (existing.createdById !== user.id && user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        if (existing._count.votes > 0) {
            return NextResponse.json({ error: "Cannot edit poll with existing votes" }, { status: 400 });
        }

        const body = await request.json().catch(() => null);
		const questionProvided = body && Object.prototype.hasOwnProperty.call(body, "question");
		const deadlineProvided = body && Object.prototype.hasOwnProperty.call(body, "deadline");
		if (!questionProvided && !deadlineProvided) {
			return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }

		const data: Prisma.PollUpdateInput = {};
		if (questionProvided) {
			const question = typeof body?.question === "string" ? body.question.trim() : "";
			if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });
			data.question = question;
		}
		if (deadlineProvided) {
			const deadline = new Date(body?.deadline);
			if (Number.isNaN(deadline.getTime())) return NextResponse.json({ error: "Valid deadline is required" }, { status: 400 });
			if (deadline.getTime() <= Date.now()) {return NextResponse.json({ error: "Deadline must be in the future" }, { status: 400 });}
			data.deadline = deadline;
		}

        const updated = await prisma.poll.update({
            where: { id },
			data,
        });

        return NextResponse.json({
            id: updated.id,
			threadId: updated.threadId,
			question: updated.question,
			deadline: updated.deadline,
			isClosed: updated.isClosed,
            createdAt: updated.createdAt,
        });
    } catch (err) {
        console.error("Failed to update poll", err);
        return NextResponse.json({ error: "Failed to update poll" }, { status: 500 });
    }
});

/**
 * @swagger
 * /api/polls/{id}:
 *   delete:
 *     summary: Delete a poll
 *     description: Deletes a poll by ID. Requires user authentication.
 *     tags:
 *       - Polls
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Poll deleted
 *       400:
 *         description: Invalid poll id
 *       404:
 *         description: Poll not found
 */
export const DELETE = requireUser<RouteParams<{ pollId: string }>>(async (_request, user, { params }) => {
	try {
		const { pollId: idStr } = await params;
		const id = verifyIdParam(idStr);
		if (id === null) return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

		const existing = await prisma.poll.findUnique({
			where: { id },
			select: {
				id: true,
				createdById: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
			},
		});
		if (!existing) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (existing.threadId && (!existing.thread || !isThreadVisible(existing.thread))) {
			return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
		}
		if (existing.createdById !== user.id && user.role !== "ADMIN") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		await prisma.poll.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("Failed to delete poll", err);
		return NextResponse.json({ error: "Failed to delete poll" }, { status: 500 });
	}
});

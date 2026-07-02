import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam, sanitizeText } from "@/lib/utils/validation";
import { requireUser } from "@/lib/protect";
import { isThreadVisible } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/polls/{id}/options/{optionId}:
 *   patch:
 *     summary: Edit poll option
 *     description: Edits an option's label and/or metadata. Only the poll creator or an administrator may edit options. Not allowed once voting has started.
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
 *       - in: path
 *         name: optionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Poll option ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 description: New option label (trimmed and sanitized)
 *                 maxLength: 500
 *               metadata:
 *                 type: object
 *                 nullable: true
 *                 description: Optional metadata to attach to the option (stored as JSON)
 *           example:
 *             label: "Updated option label"
 *             metadata: { "color": "#ffcc00" }
 *     responses:
 *       200:
 *         description: Updated poll option
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
 *               id: 13
 *               pollId: 7
 *               label: "Updated option label"
 *               metadata: { "color": "#ffcc00" }
 *       400:
 *         description: Invalid input or poll state (e.g. poll closed, no updatable fields)
 *         content:
 *           application/json:
 *             example: { error: "Option label is required" }
 *       403:
 *         description: Forbidden (not poll owner or admin)
 *         content:
 *           application/json:
 *             example: { error: "Forbidden" }
 *       404:
 *         description: Poll or option not found
 *         content:
 *           application/json:
 *             example: { error: "Poll option not found" }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example: { error: "Failed to update poll option" }
 *   delete:
 *     summary: Delete poll option
 *     description: Deletes a poll option. Only the poll creator or an administrator may delete options. Not allowed once voting has started. Polls must retain at least two options.
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
 *       - in: path
 *         name: optionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Poll option ID
 *     responses:
 *       200:
 *         description: Option deleted
 *         content:
 *           application/json:
 *             example: { ok: true }
 *       400:
 *         description: Invalid input or poll state (e.g. cannot modify after votes, not enough options)
 *         content:
 *           application/json:
 *             example: { error: "Poll must have at least two options" }
 *       403:
 *         description: Forbidden (not poll owner or admin)
 *         content:
 *           application/json:
 *             example: { error: "Forbidden" }
 *       404:
 *         description: Poll or option not found
 *         content:
 *           application/json:
 *             example: { error: "Poll option not found" }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example: { error: "Failed to delete poll option" }
 */
export const PATCH = requireUser<RouteParams<{ pollId: string; optionId: string }>>(async (request, user, { params }) => {
	try {
		const { pollId: pollIdStr, optionId: optionIdStr } = await params;
		const pollId = verifyIdParam(pollIdStr);
		const optionId = verifyIdParam(optionIdStr);
		if (pollId === null || optionId === null) {
			return NextResponse.json({ error: "Invalid poll id or option id" }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: {
				id: true,
				createdById: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
				_count: { select: { votes: true } },
			},
		});
		if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (poll.threadId && (!poll.thread || !isThreadVisible(poll.thread))) {
			return NextResponse.json({ error: "Thread is not currently open" }, { status: 403 });
		}
		if (poll.createdById !== user.id && user.role !== "ADMIN") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (poll._count.votes > 0) {
			return NextResponse.json({ error: "Cannot modify options after voting has started" }, { status: 400 });
		}

		const existingOption = await prisma.pollOption.findUnique({
			where: { id: optionId },
			select: { id: true, pollId: true },
		});
		if (!existingOption || existingOption.pollId !== pollId) {
			return NextResponse.json({ error: "Poll option not found" }, { status: 404 });
		}

		const body = await request.json().catch(() => null);
		const labelProvided = body && Object.prototype.hasOwnProperty.call(body, "label");
		const metadataProvided = body && Object.prototype.hasOwnProperty.call(body, "metadata");
		if (!labelProvided && !metadataProvided) {
			return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
		}

		const data: { label?: string; metadata?: any } = {};
		if (labelProvided) {
			const label = sanitizeText(body?.label);
			if (!label) return NextResponse.json({ error: "Option label is required" }, { status: 400 });
			data.label = label;
		}
		if (metadataProvided) {
			data.metadata = body?.metadata ?? null;
		}

		const updated = await prisma.pollOption.update({
			where: { id: optionId },
			data,
		});

		return NextResponse.json(updated);
	} catch (err) {
		console.error("Failed to update poll option", err);
		return NextResponse.json({ error: "Failed to update poll option" }, { status: 500 });
	}
});

export const DELETE = requireUser<RouteParams<{ pollId: string; optionId: string }>>(async (_request, user, { params }) => {
	try {
		const { pollId: pollIdStr, optionId: optionIdStr } = await params;
		const pollId = verifyIdParam(pollIdStr);
		const optionId = verifyIdParam(optionIdStr);
		if (pollId === null || optionId === null) {
			return NextResponse.json({ error: "Invalid poll id or option id" }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: {
				id: true,
				createdById: true,
				threadId: true,
				thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
				_count: { select: { votes: true, options: true } },
			},
		});
		if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
		if (poll.threadId && (!poll.thread || !isThreadVisible(poll.thread))) {
			return NextResponse.json({ error: "Thread is not currently open" }, { status: 403 });
		}
		if (poll.createdById !== user.id && user.role !== "ADMIN") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (poll._count.votes > 0) {
			return NextResponse.json({ error: "Cannot modify options after voting has started" }, { status: 400 });
		}
		if (poll._count.options <= 2) {
			return NextResponse.json({ error: "Poll must have at least two options" }, { status: 400 });
		}

		const existingOption = await prisma.pollOption.findUnique({
			where: { id: optionId },
			select: { id: true, pollId: true },
		});
		if (!existingOption || existingOption.pollId !== pollId) {
			return NextResponse.json({ error: "Poll option not found" }, { status: 404 });
		}

		await prisma.pollOption.delete({ where: { id: optionId } });
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("Failed to delete poll option", err);
		return NextResponse.json({ error: "Failed to delete poll option" }, { status: 500 });
	}
});

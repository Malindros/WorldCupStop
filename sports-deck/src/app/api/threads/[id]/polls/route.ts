import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam, sanitizeText } from "@/lib/utils/validation";
import { requireUser } from "@/lib/protect";
import { ensureUserNotBanned } from "@/lib/utils/ban";
import { isThreadVisible, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

function normalizeOptions(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    const options = value
        .map((option) => (typeof option === "string" ? sanitizeText(option) : ""))
        .filter(Boolean);

    return options;
}

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/threads/{id}/polls:
 *   get:
 *     summary: Get polls attached to thread
 *     description: Returns polls associated with a specific thread.
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
 *         description: Poll list returned
 *       '400':
 *         description: Invalid thread id
 *       '500':
 *         description: Failed to fetch polls for thread
 */
export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
    try {
        const { id: threadIdStr } = await params;
        const threadId = verifyIdParam(threadIdStr);
        if (threadId === null) return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });

        const thread = await prisma.forumThread.findUnique({
            where: { id: threadId },
            select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true },
        });
        if (!thread || !isThreadVisible(thread)) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        const polls = await prisma.poll.findMany({
            where: { threadId },
            include: {
                createdBy: { select: { id: true, username: true, displayName: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(polls);
    } catch (err) {
        console.error("Failed to fetch polls for thread", err);
        return NextResponse.json({ error: "Failed to fetch polls for thread" }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/threads/{id}/polls:
 *   post:
 *     summary: Create poll in thread
 *     description: Creates a poll attached to a specific thread.
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
 *             required: [question, deadline, options]
 *             properties:
 *               question:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               options:
 *                 type: array
 *                 minItems: 2
 *                 items:
 *                   type: string
 *     responses:
 *       '201':
 *         description: Poll created
 *       '400':
 *         description: Invalid thread id or request body
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Thread not found
 */
export const POST = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: threadIdStr } = await params;
        const threadId = verifyIdParam(threadIdStr);
        if (threadId === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({
            where: { id: threadId },
            select: { id: true, isHidden: true, isClosed: true, autoOpenAt: true, autoCloseAt: true },
        });
        if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        if (thread.isHidden) return NextResponse.json({ error: "Thread not found" }, { status: 403 });
        if (!isThreadWithinWindow(thread)) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        if (thread.isClosed) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });

        const bannedMessage = await ensureUserNotBanned(user.id);
        if (bannedMessage) return NextResponse.json({ error: bannedMessage }, { status: 403 });

        const body = await request.json().catch(() => null);
        const question = sanitizeText(body?.question);
        const deadlineValue = body?.deadline;
        const deadline = deadlineValue ? new Date(deadlineValue) : null;
        const options = normalizeOptions(body?.options);

        if (!question) {
            return NextResponse.json({ error: "Question is required" }, { status: 400 });
        }
        if (!deadline || Number.isNaN(deadline.getTime())) {
            return NextResponse.json({ error: "Valid deadline is required" }, { status: 400 });
        }
        if (deadline.getTime() <= Date.now()) {
            return NextResponse.json({ error: "Deadline must be in the future" }, { status: 400 });
        }
        if (!options || options.length < 2) {
            return NextResponse.json({ error: "At least two poll options are required" }, { status: 400 });
        }

        const poll = await prisma.poll.create({
            data: {
                threadId,
                question,
                deadline,
                createdById: user.id,
                options: {
                    create: options.map((label) => ({ label })),
                },
            },
            include: {
                options: true,
            },
        });

        return NextResponse.json(poll, { status: 201 });
    } catch (err) {
        console.error("Failed to create poll for thread", err);
        return NextResponse.json({ error: "Failed to create poll for thread" }, { status: 500 });
    }
});


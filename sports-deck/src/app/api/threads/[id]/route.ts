import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam, normalizeTags } from "@/lib/utils/validation";
import { requireUser } from "@/lib/protect";
import { isThreadVisible, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import { getUserFromRequest } from "@/lib/utils/auth";
import type { RouteParams } from "@/lib/types/api";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

function sanitizeTitle(value: unknown) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * @swagger
 * /api/threads/{id}:
 *   get:
 *     summary: Get thread details
 *     description: Returns a thread with author, tags, and post count.
 *     tags:
 *       - Threads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Thread returned
 *       '400':
 *         description: Invalid thread id
 *       '404':
 *         description: Thread not found
 */
export async function GET(request: Request, { params }: RouteParams<{ id: string }>) {
    try {
        const requester = getUserFromRequest(request);
        const isAdmin = requester?.role === "ADMIN";
        const { id: idStr } = await params;
        const threadId = verifyIdParam(idStr);
        if (threadId === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({
            where: { id: threadId },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatarMedia: { select: { id: true, url: true, altText: true } },
                    },
                },
                tags: { select: { id: true, name: true, slug: true } },
            },
        });

        if (!thread || (!isAdmin && !isThreadVisible(thread))) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        const author = thread.author
            ? {
                id: thread.author.id,
                username: thread.author.username,
                avatar: thread.author.avatarMedia
                    ? { id: thread.author.avatarMedia.id, url: thread.author.avatarMedia.url, altText: thread.author.avatarMedia.altText }
                    : null,
            }
            : null;

        return NextResponse.json({
            id: thread.id,
            title: thread.title,
            slug: thread.slug,
            matchId: thread.matchId,
            teamId: thread.teamId,
            isHidden: thread.isHidden,
            isClosed: thread.isClosed,
            isWithinWindow: isThreadWithinWindow(thread),
            autoOpenAt: thread.autoOpenAt,
            autoCloseAt: thread.autoCloseAt,
            tags: thread.tags,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            author,
        });
    } catch (err) {
        console.error("Failed to fetch thread", err);
        return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/threads/{id}:
 *   patch:
 *     summary: Edit thread
 *     description: Updates thread title and/or tags. Requires owner or admin.
 *     tags:
 *       - Threads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Thread updated
 *       '400':
 *         description: Invalid id or invalid payload
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Thread not found
 */
export const PATCH = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const threadId = verifyIdParam(idStr);
        if (threadId === null) return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });

        const thread = await prisma.forumThread.findUnique({
            where: { id: threadId },
            select: { id: true, authorId: true, isHidden: true, autoOpenAt: true, autoCloseAt: true },
        });

        if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

        const isOwner = thread.authorId === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (thread.isHidden) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        if (!isThreadWithinWindow(thread) && !isAdmin) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });

        const body = await request.json().catch(() => null);
        const titleProvided = body && Object.prototype.hasOwnProperty.call(body, "title");
        const tagsProvided = body && Object.prototype.hasOwnProperty.call(body, "tags");

        if (!titleProvided && !tagsProvided) {
            return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }

        const data: {
            title?: string;
            tags?: {
                set: [];
                connectOrCreate: Array<{ where: { slug: string }; create: { name: string; slug: string } }>;
            };
        } = {};
        if (titleProvided) {
            const title = sanitizeTitle(body?.title);
            if (!title) return NextResponse.json({ error: "Title must be a non-empty string" }, { status: 400 });
            data.title = title;
        }

        if (tagsProvided) {
            const normalizedTags = normalizeTags(body?.tags);
            if (normalizedTags === null) {
                return NextResponse.json({ error: "Tags must be an array of strings" }, { status: 400 });
            }

            data.tags = {
                set: [],
                connectOrCreate: normalizedTags.map((tag) => ({
                    where: { slug: tag.slug },
                    create: { name: tag.name, slug: tag.slug },
                })),
            };
        }

        const updated = await prisma.forumThread.update({
            where: { id: threadId },
            data,
            include: { tags: { select: { id: true, name: true, slug: true } } },
        });

        return NextResponse.json(updated);
    } catch (err) {
        console.error("Failed to update thread", err);
        return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
    }
});


/**
 * @swagger
 * /api/threads/{id}:
 *   delete:
 *     summary: Delete thread
 *     description: Deletes a thread. Requires owner or admin.
 *     tags:
 *       - Threads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Thread deleted
 *       '400':
 *         description: Invalid thread id
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Thread not found
 */
export const DELETE = requireUser<RouteParams<{ id: string }>>(async (_request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const threadId = verifyIdParam(idStr);
        if (threadId === null) return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        
        const thread = await prisma.forumThread.findUnique({
            where: { id: threadId },
            select: { id: true, authorId: true, isHidden: true, autoOpenAt: true, autoCloseAt: true },
        });

        if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

        const isOwner = thread.authorId === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (thread.isHidden && !isAdmin) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        if (!isThreadWithinWindow(thread) && !isAdmin) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });

        await prisma.forumThread.delete({ where: { id: threadId } });

        return NextResponse.json({ message: "Thread deleted successfully" });
    } catch (err) {
        console.error("Failed to delete thread", err);
        return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
    }
});
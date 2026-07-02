import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { ensureUserNotBanned } from "@/lib/utils/ban";
import { verifyIdParam, sanitizeText} from "@/lib/utils/validation";
import { isThreadVisible, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

/**
 * @swagger
 * /api/posts/{id}/replies:
 *   get:
 *     summary: Get replies to post
 *     description: Returns replies for a specific post.
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Replies returned
 *       '400':
 *         description: Invalid post id
 *       '404':
 *         description: Post not found
 */
export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
    try {
        const { id: idStr } = await params;
        const postId = verifyIdParam(idStr);
        if (postId === null) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } } },
        });

        if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
        if (!post.thread || !isThreadVisible(post.thread)) return NextResponse.json({ error: "Post not found" }, { status: 404 });

        const replies = await prisma.post.findMany({
            where: { parentPostId: postId, isHidden: false },
            orderBy: { createdAt: "asc" },
            include: {
                author: { select: { id: true, username: true, displayName: true } },
            },
        });

        return NextResponse.json(replies);
    } catch (err) {
        console.error("Failed to fetch replies", err);
        return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/posts/{id}/replies:
 *   post:
 *     summary: Create reply to post
 *     description: Authenticated users can create a reply to a parent post.
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '201':
 *         description: Reply created
 *       '400':
 *         description: Invalid post id or content
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Parent post not found
 */
export const POST = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const postId = verifyIdParam(idStr);
        if (postId === null) {
            return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
        }

        const body = await request.json().catch(() => null);
        const content = sanitizeText(body?.content);

        if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

        const parentPost = await prisma.post.findUnique({
            where: { id: postId },
            select: {
                id: true,
                threadId: true,
                isHidden: true,
                thread: { select: { id: true, isHidden: true, isClosed: true, autoOpenAt: true, autoCloseAt: true } },
            },
        });

        if (!parentPost) return NextResponse.json({ error: "Parent post not found" }, { status: 404 });

        if (parentPost.isHidden) return NextResponse.json({ error: "Cannot reply to hidden post" }, { status: 400 });
        if (!parentPost.thread || parentPost.thread.isHidden) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        if (!isThreadWithinWindow(parentPost.thread)) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        if (parentPost.thread.isClosed) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });

        const bannedMessage = await ensureUserNotBanned(user.id);
        if (bannedMessage) return NextResponse.json({ error: bannedMessage }, { status: 403 });

        const reply = await prisma.post.create({
            data: {
                threadId: parentPost.threadId,
                authorId: user.id,
                parentPostId: postId,
                content,
            },
            include: {
                author: { select: { id: true, username: true, displayName: true } },
            },
        });

        return NextResponse.json(reply, { status: 201 });
    } catch (err) {
        console.error("Failed to create reply", err);
        return NextResponse.json({ error: "Failed to create reply" }, { status: 500 });
    }
});
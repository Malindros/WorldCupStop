import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { storeModerationForPost } from "@/lib/utils/moderation";
import { ensureUserNotBanned } from "@/lib/utils/ban";
import { verifyIdParam, sanitizeText } from "@/lib/utils/validation";
import { isThreadVisible, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import { getUserFromRequest } from "@/lib/utils/auth";
import type { RouteParams } from "@/lib/types/api";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type ThreadPostMapInput = {
    id: number;
    parentPostId: number | null;
    isHidden: boolean;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    edits?: Array<{ editedAt: Date }>;
    author?: {
        id: number;
        username: string;
        avatarMedia?: { id: number; url: string; altText: string | null } | null;
    } | null;
};

function mapPost(post: ThreadPostMapInput) {
    const lastEditedAt = post.edits?.[0]?.editedAt ?? null;
    const author = post.author
        ? {
            id: post.author.id,
            username: post.author.username,
            avatar: post.author.avatarMedia
                ? { id: post.author.avatarMedia.id, url: post.author.avatarMedia.url, altText: post.author.avatarMedia.altText }
                : null,
        }
        : null;
    return {
        id: post.id,
        parentPostId: post.parentPostId,
        isHidden: post.isHidden,
        content: post.content,
        author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        lastEditedAt: lastEditedAt,
    };
}

function toPositiveInt(value: unknown, fallback: number) {
    const n = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}



/**
 * @swagger
 * /api/threads/{id}/posts:
 *   get:
 *     summary: List posts in a thread
 *     description: Returns visible posts for a thread in chronological order. Hidden threads are treated as not found.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Posts returned
 *       '400':
 *         description: Invalid thread id
 *         content:
 *           application/json:
 *             examples:
 *               invalidId:
 *                 value:
 *                   error: "Invalid thread id"
 *       '404':
 *         description: Thread not found
 *       '500':
 *         description: Server error fetching posts
 */
// TODO: UPDATE SWAGGER DOC TO REFLECT ANY CHANGES AND ADD EXAMPLE 200 RESPONSE
export async function GET(request: Request, { params }: RouteParams<{ id: string }>) {
    try {
        const requester = getUserFromRequest(request);
        const isAdmin = requester?.role === "ADMIN";
        const { id: idStr } = await params;
        const threadId = verifyIdParam(idStr);
        if (threadId === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        let limit = toPositiveInt(searchParams.get("limit"), DEFAULT_LIMIT);
        let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
        if (limit > MAX_LIMIT) limit = MAX_LIMIT;
        if (!Number.isInteger(offset) || offset < 0) offset = 0;

        const thread = await prisma.forumThread.findUnique({ where: { id: threadId }, select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } });
        if (!thread || (!isAdmin && !isThreadVisible(thread))) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

        const where = isAdmin ? { threadId } : { threadId, isHidden: false };

        // Count root posts (no parent) for pagination
        const totalRoots = await prisma.post.count({ where: { ...where, parentPostId: null } });

        // Fetch the requested page of root posts
        const roots = await prisma.post.findMany({
            where: { ...where, parentPostId: null },
            orderBy: { createdAt: "asc" },
            skip: offset,
            take: limit,
            select: { id: true, parentPostId: true, isHidden: true, content: true, createdAt: true, updatedAt: true },
        });

        // Fetch all posts for the thread (filtered by visibility for non-admins)
        const allPosts = await prisma.post.findMany({
            where,
            orderBy: { createdAt: "asc" },
            include: {
                edits: { orderBy: { editedAt: "desc" }, take: 1 },
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatarMedia: { select: { id: true, url: true, altText: true } },
                    },
                },
            },
        });

        // Build a map of all posts by id for ancestor traversal
        const byId = new Map<number, typeof allPosts[number]>();
        for (const p of allPosts) byId.set(p.id, p);

        const rootIds = new Set(roots.map((r) => r.id));

        // Determine which posts belong to the selected roots by walking each post's parent chain
        const includedPosts: typeof allPosts = [];
        for (const p of allPosts) {
            let cursor = p;
            while (cursor.parentPostId !== null) {
                const parent = byId.get(cursor.parentPostId);
                if (!parent) {
                    cursor = null as any;
                    break;
                }
                cursor = parent;
            }
            const rootId = cursor ? cursor.id : null;
            if (rootId !== null && rootIds.has(rootId)) includedPosts.push(p);
        }

        const totalPosts = allPosts.length;

        return NextResponse.json({
            threadId,
            limit,
            offset,
            // Keep `totalPosts` as the number of root posts for pagination (client uses this to compute pages)
            totalPosts: totalRoots,
            // Also expose full post count so clients can show reply counts
            totalPostsCount: totalPosts,
            posts: includedPosts.map(mapPost),
        });
    } catch (err) {
        console.error("Failed to fetch posts", err);
        return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/threads/{id}/posts:
 *   post:
 *     summary: Create a post in a thread
 *     description: Authenticated users can add a post (or reply) to an open thread. Hidden/closed threads are blocked.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Thread ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *               parentPostId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       '201':
 *         description: Post created
 *       '400':
 *         description: Validation error (invalid ids or missing content)
 *         content:
 *           application/json:
 *             examples:
 *               missingContent:
 *                 value:
 *                   error: "Content is required"
 *       '403':
 *         description: Forbidden (banned user or blocked thread)
 *         content:
 *           application/json:
 *             examples:
 *               banned:
 *                 value:
 *                   error: "You are banned"
 *               hidden:
 *                 value:
 *                   error: "Thread is hidden"
 *               closed:
 *                 value:
 *                   error: "Thread is closed"
 *       '404':
 *         description: Thread not found
 *       '500':
 *         description: Server error creating post
 */
// TODO: UPDATE SWAGGER DOC TO REFLECT ANY CHANGES AND ADD EXAMPLE 201 RESPONSE
export const POST = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const threadId = verifyIdParam(idStr);
        if (threadId === null) {
            return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({ where: { id: threadId }, select: { id: true, isClosed: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } });
        if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        if (thread.isHidden) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        if (!isThreadWithinWindow(thread)) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        if (thread.isClosed) return NextResponse.json({ error: "Thread is closed" }, { status: 403 });

        const bannedMessage = await ensureUserNotBanned(user.id);
        if (bannedMessage) {
            return NextResponse.json({ error: bannedMessage }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const content = sanitizeText(body?.content);
        const parentPostId = body?.parentPostId !== undefined ? verifyIdParam(body.parentPostId) : null;

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        if (body?.parentPostId !== undefined && parentPostId === null) {
            return NextResponse.json({ error: "Invalid parent post id" }, { status: 400 });
        }

        if (parentPostId !== null) {
            const parent = await prisma.post.findUnique({ where: { id: parentPostId }, select: { id: true, threadId: true, isHidden: true } });
            if (!parent || parent.threadId !== threadId || parent.isHidden) {
                return NextResponse.json({ error: "Parent post not found in thread" }, { status: 400 });
            }
        }

        const post = await prisma.post.create({
            data: {
                threadId,
                authorId: user.id,
                parentPostId: parentPostId ?? null,
                content,
            },
        });

        // Run AI moderation and store the verdict/report for human moderation.
        // Content remains visible by default until moderators take action.
        await storeModerationForPost(post.id, content);

        return NextResponse.json({
            ...mapPost({ ...post, edits: [], author: { id: user.id, username: user.username } }),
        }, { status: 201 });
    } catch (err) {
        console.error("Failed to create post", err);
        return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }
});

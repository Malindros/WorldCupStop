import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { buildVisibleThreadWhere } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * @swagger
 * /api/users/{id}/posts:
 *   get:
 *     summary: Get posts and replies by user
 *     description: Returns posts and replies authored by this user. Includes thread info. Optional limit/offset. No auth required. Hidden posts are excluded.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       '200':
 *         description: List of posts (and replies)
 *       '400':
 *         description: Invalid user id
 *       '404':
 *         description: User not found
 */
export async function GET(request: Request, context: RouteParams<{ id: string }>) {
    const { id: idStr } = await context.params;
    const userId = verifyIdParam(idStr);
    if (userId === null) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    let offset = parseInt(searchParams.get("offset") ?? "0", 10);
    if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (!Number.isInteger(offset) || offset < 0) offset = 0;

    const posts = await prisma.post.findMany({
        where: {
            AND: [
                { authorId: userId, isHidden: false },
                {
                    OR: [
                        { threadId: null },
                        { thread: buildVisibleThreadWhere() },
                    ],
                },
            ],
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
            thread: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    isClosed: true,
                },
            },
        },
    });

    const list = posts.map((p) => ({
        id: p.id,
        threadId: p.threadId,
        parentPostId: p.parentPostId,
        content: p.content,
        language: p.language,
        isReply: p.parentPostId != null,
        thread: p.thread
            ? {
                id: p.thread.id,
                title: p.thread.title,
                slug: p.thread.slug,
                isClosed: p.thread.isClosed,
            }
            : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ posts: list, limit, offset }, { status: 200 });
}

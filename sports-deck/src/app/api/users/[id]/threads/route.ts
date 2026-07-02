import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import { buildVisibleThreadWhere, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import type { RouteParams } from "@/lib/types/api";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * @swagger
 * /api/users/{id}/threads:
 *   get:
 *     summary: Get threads created by user
 *     description: Returns threads authored by this user. Optional limit/offset for pagination. No auth required.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       '200':
 *         description: List of threads
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

    let threads = await prisma.forumThread.findMany({
        where: {
            AND: [
                { authorId: userId },
                buildVisibleThreadWhere(),
            ],
        },
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: limit,
        include: {
            _count: { select: { posts: true } },
            team: { select: { id: true, name: true, slug: true } },
            match: { select: { id: true } },
        },
    });

    // 1) open match threads (most recently opened first)
    // 2) other threads (most recently created first)
    // 3) soon-to-open match threads (soonest autoOpenAt first)
    // 4) closed match threads (most recently closed first)
    const now = Date.now();
    const openMatch: typeof threads = [];
    const otherThreads: typeof threads = [];
    const soonOpen: typeof threads = [];
    const closedMatch: typeof threads = [];

    for (const t of threads) {
        const isMatch = Boolean(t.matchId);
        const within = isThreadWithinWindow(t as any);
        if (isMatch && within) {
            openMatch.push(t);
        } else if (!isMatch) {
            otherThreads.push(t);
        } else if (isMatch && t.autoOpenAt && new Date(t.autoOpenAt).getTime() > now) {
            soonOpen.push(t);
        } else if (isMatch) {
            closedMatch.push(t);
        } else {
            otherThreads.push(t);
        }
    }

    openMatch.sort((a, b) => {
        const aOpen = a.autoOpenAt ? new Date(a.autoOpenAt).getTime() : a.createdAt.getTime();
        const bOpen = b.autoOpenAt ? new Date(b.autoOpenAt).getTime() : b.createdAt.getTime();
        return bOpen - aOpen; // most recently opened first
    });

    otherThreads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    soonOpen.sort((a, b) => {
        const aOpen = a.autoOpenAt ? new Date(a.autoOpenAt).getTime() : Number.POSITIVE_INFINITY;
        const bOpen = b.autoOpenAt ? new Date(b.autoOpenAt).getTime() : Number.POSITIVE_INFINITY;
        return aOpen - bOpen; // soonest first
    });

    closedMatch.sort((a, b) => {
        const aClose = a.autoCloseAt ? new Date(a.autoCloseAt).getTime() : 0;
        const bClose = b.autoCloseAt ? new Date(b.autoCloseAt).getTime() : 0;
        return bClose - aClose; // most recently closed first
    });

    // Rebuild threads array and assign directly
    const rebuilt = [...openMatch, ...otherThreads, ...soonOpen, ...closedMatch];
    threads = rebuilt;

    const list = threads.map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        teamId: t.teamId,
        matchId: t.matchId,
        team: t.team ? { id: t.team.id, name: t.team.name, slug: t.team.slug } : null,
        isClosed: t.isClosed,
        isWithinWindow: isThreadWithinWindow(t),
        postCount: t._count.posts,
        autoOpenAt: t.autoOpenAt,
        autoCloseAt: t.autoCloseAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    }));

    return NextResponse.json({ threads: list, limit, offset }, { status: 200 });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/protect";
import { prisma } from "@/lib/db";
import { buildVisibleThreadWhere, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import type { AuthUser } from "@/lib/utils/auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/me/feed
 * Personalized activity feed: posts/comments from followed users, comments on my posts,
 * favorite team match score updates, and new threads in favorite team's forum.
 */
async function getFeed(currentUser: AuthUser, limit = DEFAULT_LIMIT, offset = 0) {
    const userId = currentUser.id;
    const cappedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const safeOffset = Math.max(0, Math.floor(offset));

    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { favoriteTeamId: true },
    });
    const favoriteTeamId = dbUser?.favoriteTeamId ?? null;

    const followees = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true },
    });
    const followeeIds = followees.map((f) => f.followeeId);
    if (followeeIds.length === 0) followeeIds.push(-1);

    const [
        postsFromFollowed,
        commentsOnMyPosts,
        teamMatches,
        teamThreads,
    ] = await Promise.all([
        prisma.post.findMany({
            where: {
                authorId: { in: followeeIds },
                isHidden: false,
            },
            orderBy: { createdAt: "desc" },
            take: 30,
            include: {
                author: { select: { id: true, username: true, displayName: true } },
                thread: { select: { id: true, title: true, slug: true } },
            },
        }),
        prisma.post.findMany({
            where: {
                isHidden: false,
                parentPost: { authorId: userId },
            },
            orderBy: { createdAt: "desc" },
            take: 30,
            include: {
                author: { select: { id: true, username: true, displayName: true } },
                thread: { select: { id: true, title: true, slug: true } },
                parentPost: { select: { id: true, content: true } },
            },
        }),
        favoriteTeamId
            ? prisma.match.findMany({
                where: {
                    OR: [
                        { homeTeamId: favoriteTeamId },
                        { awayTeamId: favoriteTeamId },
                    ],
                },
                orderBy: { startTime: "desc" },
                take: 15,
                include: {
                    homeTeam: { select: { id: true, name: true, shortName: true } },
                    awayTeam: { select: { id: true, name: true, shortName: true } },
                },
            })
            : Promise.resolve([]),
        favoriteTeamId
            ? prisma.forumThread.findMany({
                where: {
                    AND: [
                        { teamId: favoriteTeamId },
                        buildVisibleThreadWhere(),
                    ],
                },
                orderBy: { createdAt: "desc" },
                take: 15,
                include: {
                    team: { select: { id: true, name: true, slug: true } },
                    author: { select: { id: true, username: true } },
                },
            })
            : Promise.resolve([]),
    ]);

    const items: Array<{ timestamp: Date; [key: string]: unknown }> = [];

    // Group posts from followed users by thread (so "N posts in [thread]" instead of N separate items)
    const postsByThread = new Map<number | null, typeof postsFromFollowed>();
    for (const p of postsFromFollowed) {
        const key = p.threadId;
        if (!postsByThread.has(key)) {
            postsByThread.set(key, []);
        }
        postsByThread.get(key)!.push(p);
    }
    for (const [threadId, posts] of postsByThread) {
        const sorted = posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latest = sorted[0];
        const thread = latest.thread;
        items.push({
            type: "posts_from_followed",
            timestamp: latest.createdAt,
            id: `group-thread-${threadId}`,
            groupKey: `thread:${threadId}`,
            postCount: sorted.length,
            thread: thread ? { id: thread.id, title: thread.title, slug: thread.slug } : null,
            posts: sorted.slice(0, 5).map((p) => ({
                id: p.id,
                content: p.content?.slice(0, 200),
                createdAt: p.createdAt,
                author: p.author,
                isReply: p.parentPostId != null,
            })),
        });
    }

    // Group comments on my posts by parent post (so "N comments on your post" instead of N separate items)
    const commentsByParent = new Map<number, typeof commentsOnMyPosts>();
    for (const p of commentsOnMyPosts) {
        const key = p.parentPostId ?? p.id;
        if (!commentsByParent.has(key)) {
            commentsByParent.set(key, []);
        }
        commentsByParent.get(key)!.push(p);
    }
    for (const [parentId, comments] of commentsByParent) {
        const sorted = comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latest = sorted[0];
        const parentPost = latest.parentPost;
        items.push({
            type: "comments_on_my_post",
            timestamp: latest.createdAt,
            id: `group-parent-${parentId}`,
            groupKey: `parentPost:${parentId}`,
            commentCount: sorted.length,
            parentPost: parentPost
                ? { id: parentPost.id, content: parentPost.content?.slice(0, 200) ?? null }
                : null,
            thread: latest.thread ? { id: latest.thread.id, title: latest.thread.title, slug: latest.thread.slug } : null,
            comments: sorted.slice(0, 5).map((c) => ({
                id: c.id,
                content: c.content?.slice(0, 200),
                createdAt: c.createdAt,
                author: c.author,
            })),
        });
    }

    for (const m of teamMatches) {
        const ts = m.endTime ??  m.startTime;
        items.push({
            type: "match_update",
            timestamp: ts,
            id: `match-${m.id}`,
            match: {
                id: m.id,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                homeTeam: m.homeTeam,
                awayTeam: m.awayTeam,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                status: m.status,
                startTime: m.startTime,
                lastUpdated: m.lastUpdated,
            },
        });
    }

    // sort team threads so open threads come first, then by updatedAt; take top 15
    teamThreads.sort((a, b) => {
        const aWithin = isThreadWithinWindow(a as any);
        const bWithin = isThreadWithinWindow(b as any);
        if (aWithin && !bWithin) return -1;
        if (!aWithin && bWithin) return 1;
        // If both are within the window (match threads), sort by autoCloseAt (earlier close first).
        if (aWithin && bWithin) {
            const aClose = a.autoCloseAt ? new Date(a.autoCloseAt).getTime() : Number.POSITIVE_INFINITY;
            const bClose = b.autoCloseAt ? new Date(b.autoCloseAt).getTime() : Number.POSITIVE_INFINITY;
            if (aClose !== bClose) return aClose - bClose;
        }
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    for (const t of teamThreads) {
        items.push({
            type: "team_thread",
            timestamp: t.createdAt,
            id: `thread-${t.id}`,
            thread: {
                id: t.id,
                title: t.title,
                slug: t.slug,
                team: t.team,
                author: t.author,
                createdAt: t.createdAt,
                isWithinWindow: isThreadWithinWindow(t),
                autoOpenAt: t.autoOpenAt,
                autoCloseAt: t.autoCloseAt,
            },
        });
    }

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const feed = items.slice(safeOffset, safeOffset + cappedLimit);
    const hasMore = safeOffset + cappedLimit < items.length;

    return { feed, hasMore };
}

/**
 * @swagger
 * /api/me/feed:
 *   get:
 *     summary: Get personalized activity feed (grouped)
 *     description: Returns a merged feed with meaningful grouping so many events on the same post/thread do not overwhelm. Posts from followed users are grouped by thread (postCount + up to 5 latest posts). Comments on the user's posts are grouped by parent post (commentCount + up to 5 latest comments). Match updates and team threads remain one item each. Requires authentication.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Max number of feed items (groups) to return.
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *         description: Number of items to skip after sorting (for pagination).
 *     responses:
 *       '200':
 *         description: Feed items sorted by timestamp (newest first); post/comment activity grouped by thread or parent post.
 *       '401':
 *         description: Unauthorized
 */
export const GET = requireUser(async (request, currentUser) => {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam != null
        ? parseInt(limitParam, 10) || DEFAULT_LIMIT
        : DEFAULT_LIMIT;
    const offsetParam = searchParams.get("offset");
    const offset = offsetParam != null ? parseInt(offsetParam, 10) || 0 : 0;
    const result = await getFeed(currentUser, limit, offset);
    return NextResponse.json(result, { status: 200 });
});

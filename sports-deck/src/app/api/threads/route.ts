// This route was written with help from ChatGPT, with some manual adjustments and fixes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { storeModerationForThread } from "@/lib/utils/moderation";
import { ensureUserNotBanned } from "@/lib/utils/ban";
import { verifyIdParam, sanitizeText, normalizeTags, slugify } from "@/lib/utils/validation";
import { buildVisibleThreadWhere, isThreadWithinWindow } from "@/lib/utils/threadVisibility";
import { getUserFromRequest } from "@/lib/utils/auth";

/**
 * @fileoverview
 * This file contains OpenAPI (Swagger) documentation for the API route(s) below.
 * Disclaimer: These docs were created with the help of ChatGPT.
 */

const TAG_MAX_LENGTH = 30;

type ThreadListItem = {
    id: number;
    title: string;
    slug: string | null;
    isHidden: boolean;
    isClosed: boolean;
    createdAt: Date;
    updatedAt: Date;
    matchId: number | null;
    teamId: number | null;
    posts?: Array<{ createdAt: Date; updatedAt: Date }>;
    team?: { id: number; name: string; slug: string | null } | null;
    author?: {
        id: number;
        username: string;
        avatarMedia?: { id: number; url: string; altText: string | null } | null;
    } | null;
    tags: Array<{ id: number; name: string; slug: string }>;
    _count?: { posts: number };
    autoOpenAt?: Date | string | null;
    autoCloseAt?: Date | string | null;
};

function mapThreadListItem(thread: ThreadListItem) {
    const latestPost = thread.posts?.[0] ?? null;
    const latestActivityAt = latestPost?.updatedAt ?? latestPost?.createdAt ?? thread.updatedAt ?? thread.createdAt;

    return {
        id: thread.id,
        title: thread.title,
        slug: thread.slug,
        isHidden: thread.isHidden,
        isClosed: thread.isClosed,
        isWithinWindow: isThreadWithinWindow(thread),
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        latestActivityAt,
        matchId: thread.matchId,
        teamId: thread.teamId,
        team: thread.team
            ? { id: thread.team.id, name: thread.team.name, slug: thread.team.slug }
            : null,
        author: thread.author
            ? {
                id: thread.author.id,
                username: thread.author.username,
                avatar: thread.author.avatarMedia
                    ? {
                        id: thread.author.avatarMedia.id,
                        url: thread.author.avatarMedia.url,
                        altText: thread.author.avatarMedia.altText,
                    }
                    : null,
            }
            : null,
        tags: thread.tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
        replyCount: thread._count?.posts ?? 0,
        autoOpenAt: thread.autoOpenAt,
        autoCloseAt: thread.autoCloseAt,
    };
}

/**
 * Ensure that Team and Match exist in the database.
 */
async function checkTeamAndMatchExistence(teamId: number | null, matchId: number | null) {
    const checks = [];
    if (teamId !== null) {
        checks.push(prisma.team.findUnique({ where: { id: teamId }, select: { id: true } }));
    } else {
        checks.push(Promise.resolve(null));
    }
    if (matchId !== null) {
        checks.push(prisma.match.findUnique({ where: { id: matchId }, select: { id: true } }));
    } else {
        checks.push(Promise.resolve(null));
    }

    const [team, match] = await Promise.all(checks);
    return { teamExists: teamId === null || Boolean(team), matchExists: matchId === null || Boolean(match) };
}

async function createThreadWithFirstPost({
    title,
    content,
    slug,
    teamId,
    matchId,
    authorId,
    tags,
}: {
    title: string;
    content: string;
    slug: string | null;
    teamId: number | null;
    matchId: number | null;
    authorId: number;
    tags: Array<{ name: string; slug: string }>;
}) {
    return prisma.$transaction(async (tx) => {
        const thread = await tx.forumThread.create({
            data: {
                title,
                slug,
                teamId,
                matchId,
                authorId,
                ...(tags?.length
                    ? {
                        tags: {
                            connectOrCreate: tags.map((tag) => ({
                                where: { slug: tag.slug },
                                create: { name: tag.name, slug: tag.slug },
                            })),
                        },
                    }
                    : {}),
            },
            include: { tags: { select: { id: true, name: true, slug: true } } },
        });

        const post = await tx.post.create({
            data: {
                threadId: thread.id,
                authorId,
                content,
                parentPostId: null,
            },
        });

        return { thread, post };
    });
}

/**
 * @swagger
 * /api/threads:
 *   get:
 *     summary: List threads
 *     description: Returns threads and supports optional filtering by title, author username, team id, and comma-separated tags.
 *     tags:
 *       - Threads
 *     parameters:
 *       - in: query
 *         name: title
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: author
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: team
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tags
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated tag names or slugs.
 *     responses:
 *       '200':
 *         description: Threads returned
 *       '400':
 *         description: Invalid team id
 *       '500':
 *         description: Failed to search threads
 */
// GET /api/threads?title=&author=&team=&tags=tag1,tag2
export async function GET(request: Request) {
    try {
        const requester = getUserFromRequest(request);
        const isAdmin = requester?.role === "ADMIN";
        const url = new URL(request.url);
		const title = url.searchParams.get("title");
		const author = url.searchParams.get("author");
		const team = url.searchParams.get("team");
		const tags = url.searchParams.get("tags");
        const q = sanitizeText(url.searchParams.get("q"));

        const where: {
            title?: { contains: string };
            author?: { username: { contains: string } };
            team?: { name: { contains: string } };
            tags?: {
                some: {
                    OR: Array<{ slug?: { in: string[] } }>;
                };
            };
        } = {};
        let teamScopeFilter: {
            OR: Array<
                | { teamId: number }
                | {
                    match: {
                        is: {
                            OR: Array<{ homeTeamId: number } | { awayTeamId: number }>;
                        };
                    };
                }
            >;
        } | null = null;
        if (title) {
            where.title = { contains: title };
        }
        if (author) {
            where.author = { username: { contains: author } };
        }
        if (team) {
            const maybeTeamId = verifyIdParam(team);
            if (maybeTeamId !== null) {
                teamScopeFilter = {
                    OR: [
                        { teamId: maybeTeamId },
                        {
                            match: {
                                is: {
                                    OR: [{ homeTeamId: maybeTeamId }, { awayTeamId: maybeTeamId }],
                                },
                            },
                        },
                    ],
                };
            } else {
                where.team = {
                    name: { contains: team },
                };
            }
        }
        if (tags) {
            const tagList = tags.split(",").map((t: string) => t.trim()).filter((t: string) => t);
            if (tagList.length > 0) {
                const normalizedTagSlugs = tagList.map((tag) => slugify(tag));
                where.tags = {
                    some: {
                        OR: [{ slug: { in: normalizedTagSlugs } }],
                    },
                };
            }
        }

        let threads = await prisma.forumThread.findMany({
            where: {
                AND: [
                    where,
                    ...(teamScopeFilter ? [teamScopeFilter] : []),
                    ...(isAdmin ? [] : [buildVisibleThreadWhere()]),
                ],
            },
            orderBy: { createdAt: "desc" },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatarMedia: { select: { id: true, url: true, altText: true } },
                    },
                },
                team: { select: { id: true, name: true, slug: true } },
                tags: { select: { id: true, name: true, slug: true } },
                posts: {
                    select: { createdAt: true, updatedAt: true },
                    ...(isAdmin ? {} : { where: { isHidden: false } }),
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
                _count: {
                    select: {
                        posts: isAdmin ? true : { where: { isHidden: false } },
                    },
                },
            },
        });

        // pagination params (we'll apply pagination after sorting to preserve custom order)
        const limitParam = url.searchParams.get("limit");
        const offsetParam = url.searchParams.get("offset");
        const DEFAULT_LIMIT = 30;
        const MAX_LIMIT = 200;
        let limit = limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT;
        let offset = offsetParam ? parseInt(offsetParam, 10) || 0 : 0;
        if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
        if (limit > MAX_LIMIT) limit = MAX_LIMIT;
        if (!Number.isInteger(offset) || offset < 0) offset = 0;

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

        // Rebuild threads, then apply case-insensitive text filters before pagination.
        const rebuilt = [...openMatch, ...otherThreads, ...soonOpen, ...closedMatch];
        const titleNeedle = title ? title.toLowerCase() : null;
        const authorNeedle = author ? author.toLowerCase() : null;
        const qNeedle = q ? q.toLowerCase() : null;
        const qNeedleSlug = q ? slugify(q) : null;

        const filtered = rebuilt.filter((t) => {
            const threadTitle = t.title?.toLowerCase() ?? "";
            const authorName = t.author?.username?.toLowerCase() ?? "";
            const teamName = t.team?.name?.toLowerCase() ?? "";
            const hasMatchingTag = (needle: string, needleSlug?: string | null) =>
                t.tags.some((tag) =>
                    tag.name.toLowerCase().includes(needle) || (needleSlug ? tag.slug.includes(needleSlug) : false),
                );

            if (titleNeedle && !threadTitle.includes(titleNeedle)) return false;
            if (authorNeedle && !authorName.includes(authorNeedle)) return false;
            if (qNeedle) {
                const matchesQ =
                    threadTitle.includes(qNeedle) ||
                    authorName.includes(qNeedle) ||
                    teamName.includes(qNeedle) ||
                    hasMatchingTag(qNeedle, qNeedleSlug);
                if (!matchesQ) return false;
            }

            return true;
        });

        const total = filtered.length;
        const page = filtered.slice(offset, offset + limit);

        return NextResponse.json({
            threads: page.map(mapThreadListItem),
            limit,
            offset,
            total,
            hasMore: offset + page.length < total,
        });
    } catch (err) {
        console.error("Failed to search threads", err);
        return NextResponse.json({ error: "Failed to search threads" }, { status: 500 });
    }
}

// create thread ex:
// {
//  "title": "This is a thread title",
// "content": "This is the content of the first post in the thread.",
// "teamId": 123, // optional
// "matchId": 456, // optional
// "slug": "optional-custom-slug"
// }
/**
 * @swagger
 * /api/threads:
 *   post:
 *     summary: Create a new thread (with initial post)
 *     description: Authenticated users can create a thread with its first post. Optional associations to a team or match can be supplied.
 *     tags:
 *       - Threads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               teamId:
 *                 type: integer
 *                 nullable: true
 *               matchId:
 *                 type: integer
 *                 nullable: true
 *               slug:
 *                 type: string
 *                 nullable: true
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *     responses:
 *       '201':
 *         description: Thread created
 *       '400':
 *         description: Validation error (missing title/content or bad ids)
 *         content:
 *           application/json:
 *             examples:
 *               missingTitle:
 *                 value:
 *                   error: "Title and content are required"
 *       '403':
 *         description: User forbidden (banned)
 *         content:
 *           application/json:
 *             examples:
 *               banned:
 *                 value:
 *                   error: "You are banned"
 *       '404':
 *         description: Related team or match not found
 *       '409':
 *         description: Could not generate a unique slug
 *       '500':
 *         description: Server error while creating the thread
 */
// TODO: UPDATE SWAGGER DOC TO REFLECT ANY CHANGES AND ADD EXAMPLE 201 RESPONSE
export const POST = requireUser(async (request, user) => {
    try {
        const body = await request.json().catch(() => null);
        const title = sanitizeText(body?.title);
        const content = sanitizeText(body?.content);
        const teamId = body?.teamId !== undefined ? verifyIdParam(body.teamId) : null;
        const matchId = body?.matchId !== undefined ? verifyIdParam(body.matchId) : null;
        const slugInput = sanitizeText(body?.slug);
        const normalizedTags = normalizeTags(body?.tags);

        if (!title || !content) {
            return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
        }
        if (body?.teamId !== undefined && teamId === null) {
            return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
        }
        if (body?.matchId !== undefined && matchId === null) {
            return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
        }
        if (Array.isArray(body?.tags) && body.tags.some((tag: unknown) => sanitizeText(tag).length > TAG_MAX_LENGTH)) {
            return NextResponse.json({ error: `Each tag must be at most ${TAG_MAX_LENGTH} characters` }, { status: 400 });
        }
        if (body?.tags !== undefined && normalizedTags === null) {
            return NextResponse.json({ error: "Tags must be an array of strings" }, { status: 400 });
        }

        const { teamExists, matchExists } = await checkTeamAndMatchExistence(teamId, matchId);
        if (!teamExists) return NextResponse.json({ error: "Team not found" }, { status: 404 });
        if (!matchExists) return NextResponse.json({ error: "Match not found" }, { status: 404 });

        const bannedMessage = await ensureUserNotBanned(user.id);
        if (bannedMessage) return NextResponse.json({ error: bannedMessage }, { status: 403 });

        let slugCandidate: string | null = slugInput || slugify(title, { maxLength: 80 });
        if (!slugCandidate) slugCandidate = null;

        let teamTitlePart = "";
        if (teamId) {
            const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
            if (team) {
                teamTitlePart = `${team.name}: `;
            }
        }

        let created = null;
        // attempt to create thread with unique slug, if slug collision occurs, generate new slug and retry (up to 6 attempts)
        for (let attempt = 0; attempt < 6; attempt += 1) {
            try {
                created = await createThreadWithFirstPost({
                    title: teamTitlePart + title,
                    content,
                    slug: slugCandidate,
                    teamId,
                    matchId,
                    authorId: user.id,
                    tags: normalizedTags ?? [],
                });
                break;
            } catch (err) {
                if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002" && slugCandidate) {
                    slugCandidate = `${slugCandidate}-${Math.random().toString(36).slice(-6)}`;
                    continue;
                }
                throw err;
            }
        }

        if (!created) {
            return NextResponse.json({ error: "Failed to create a unique slug" }, { status: 409 });
        }

        const { thread, post } = created;

        // Run AI moderation on the thread title + first post together (one AI call).
        // We always keep content visible by default and only store verdict/report for moderator review.
        await storeModerationForThread(thread.id, post.id, title, content);

        return NextResponse.json({
            id: thread.id,
            title: thread.title,
            slug: thread.slug,
            matchId: thread.matchId,
            teamId: thread.teamId,
            isClosed: thread.isClosed,
            isHidden: thread.isHidden,
            tags: thread.tags,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            author: { id: user.id, username: user.username },
            initialPost: {
                id: post.id,
                content: post.content,
                parentPostId: post.parentPostId,
                authorId: post.authorId,
                isHidden: post.isHidden,
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                lastEditedAt: null,
            },
        }, { status: 201 });
    } catch (err) {
        console.error("Failed to create thread", err);
        return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
    }
});

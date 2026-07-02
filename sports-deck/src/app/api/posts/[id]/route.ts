import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { runModerationCheck, shouldFlagContent } from "@/lib/utils/moderation";
import { composeReportReason, normalizeAdditionalComment, SYSTEM_REPORT_REASON_CODE } from "@/lib/reportReasons";
import { ensureUserNotBanned } from "@/lib/utils/ban";
import { computeThreadSentiment } from "@/lib/utils/sentiment";
import { verifyIdParam, sanitizeText } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * This function was written with the help of ChatGPT, with some manual adjustments and fixes
 */
async function storeModerationForPost(postId: number, content: string) {
    try {
        const result = await runModerationCheck({ content, context: "forum post edit" });
        const verdictRecord = await prisma.aiModerationVerdict.create({
            data: {
                postId,
                verdict: result.verdict,
                toxicityScore: result.toxicityScore,
                explanation: result.explanation,
                contentSnapshot: content.slice(0, 2000),
                rawResponse: result.raw ? { raw: result.raw } : undefined,
            },
        });

        if (shouldFlagContent(result)) {
            const additionalComment = normalizeAdditionalComment(result.explanation, 500);
            const reason = composeReportReason(SYSTEM_REPORT_REASON_CODE, additionalComment);
            const report = await prisma.report.create({
                data: {
                    reporterId: null,
                    targetType: "POST",
                    targetId: postId,
                    reasonCode: SYSTEM_REPORT_REASON_CODE,
                    additionalComment,
                    reason,
                },
            });

            await prisma.aiModerationVerdict.update({
                where: { id: verdictRecord.id },
                data: { reportId: report.id },
            });
        }

        return verdictRecord;
    } catch (err) {
        console.error("Failed to store moderation verdict", err);
        return null;
    }
}

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Fetch a single post by id
 *     description: Returns post content with author and thread info when visible.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Post ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Post returned
 *       '400':
 *         description: Invalid post id
 *         content:
 *           application/json:
 *             examples:
 *               invalidId:
 *                 value:
 *                   error: "Invalid post id"
 *       '404':
 *         description: Post not found
 *       '500':
 *         description: Server error fetching post
 */
// TODO: UPDATE SWAGGER DOC TO REFLECT ANY CHANGES AND ADD EXAMPLE 200 RESPONSE
export async function GET(_request: Request, { params }: RouteParams<{ id: string }>) {
    try {
        const { id: idStr } = await params;
        const postId = verifyIdParam(idStr);
        if (postId === null) {
            return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
        }

        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                edits: { orderBy: { editedAt: "desc" }, take: 1 },
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatarMedia: { select: { id: true, url: true, altText: true } },
                    },
                },
                thread: { select: { id: true, title: true, slug: true } },
            },
        });

        if (!post || post.isHidden) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

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
        return NextResponse.json({
            id: post.id,
            parentPostId: post.parentPostId,
            content: post.content,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            lastEditedAt,
            author,
            thread: post.thread ? { id: post.thread.id, title: post.thread.title, slug: post.thread.slug } : null,
        });
    } catch (err) {
        console.error("Failed to fetch post", err);
        return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
    }
}


/**
 * @swagger
 * /api/posts/{id}:
 *   patch:
 *     summary: Edit a post (owner or admin)
 *     description: Requires authentication. Only the post owner or an admin may edit, and hidden/closed content is blocked for non-admins.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Post ID
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
 *     responses:
 *       '200':
 *         description: Post updated
 *       '400':
 *         description: Validation error (invalid id or missing content)
 *         content:
 *           application/json:
 *             examples:
 *               missingContent:
 *                 value:
 *                   error: "Content is required"
 *       '403':
 *         description: Forbidden (not owner/admin, hidden/closed, or banned)
 *         content:
 *           application/json:
 *             examples:
 *               banned:
 *                 value:
 *                   error: "You are banned"
 *               forbidden:
 *                 value:
 *                   error: "Forbidden"
 *       '404':
 *         description: Post not found
 *       '500':
 *         description: Server error updating post
 */
// TODO: UPDATE SWAGGER DOC TO REFLECT ANY CHANGES AND ADD EXAMPLE 200 RESPONSE
export const PATCH = requireUser<RouteParams<{ id: string }>>(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const postId = verifyIdParam(idStr);
        if (postId === null) {
            return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
        }

        const existing = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                thread: { select: { id: true, title: true, slug: true, isClosed: true, isHidden: true } },
                author: { select: { id: true, username: true } },
            },
        });

        if (!existing) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const isOwner = existing.authorId === user.id;
        const isAdmin = user.role === "ADMIN";

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (existing.isHidden) {
            return NextResponse.json({ error: "Post is hidden" }, { status: 403 });
        }

        if (existing.thread?.isHidden) {
            return NextResponse.json({ error: "Thread is hidden" }, { status: 403 });
        }

        if (existing.thread?.isClosed && !isAdmin) {
            return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        }

        const bannedMessage = await ensureUserNotBanned(user.id);
        if (bannedMessage) {
            return NextResponse.json({ error: bannedMessage }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const content = sanitizeText(body?.content);
        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // transaction ensures both actions succeed or fail together
        const updated = await prisma.$transaction(async (tx) => {
            await tx.postEdit.create({
                data: {
                    postId,
                    editorId: user.id,
                    previousContent: existing.content,
                    language: existing.language,
                },
            });

            return tx.post.update({
                where: { id: postId },
                data: { content },
                include: {
                    edits: { orderBy: { editedAt: "desc" }, take: 1 },
                    author: { select: { id: true, username: true } },
                    thread: { select: { id: true, title: true, slug: true } },
                },
            });
        });

        await storeModerationForPost(postId, content);

        if (updated.thread?.id) {
            // Keep thread sentiment in sync after post edits.
            try {
                await computeThreadSentiment(updated.thread.id);
            } catch (err) {
                // Editing should still succeed even if sentiment recompute fails.
                console.error("Failed to recompute sentiment after post edit", {
                    postId,
                    threadId: updated.thread.id,
                    error: err,
                });
            }
        }

        const lastEditedAt = updated.edits?.[0]?.editedAt ?? updated.updatedAt;
        return NextResponse.json({
            id: updated.id,
            parentPostId: updated.parentPostId,
            content: updated.content,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            lastEditedAt,
            author: updated.author ? { id: updated.author.id, username: updated.author.username } : null,
            thread: updated.thread ? { id: updated.thread.id, title: updated.thread.title, slug: updated.thread.slug } : null,
        });
    } catch (err) {
        console.error("Failed to edit post", err);
        return NextResponse.json({ error: "Failed to edit post" }, { status: 500 });
    }
});

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     description: Soft deletes a post by marking it hidden. Requires owner or admin.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Post deleted
 *       '400':
 *         description: Invalid post id
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Post not found
 *       '500':
 *         description: Failed to delete post
 */
export const DELETE = requireUser<RouteParams<{ id: string }>>(async (_request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const postId = verifyIdParam(idStr);
        if (postId === null) {
            return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
        }

        const existing = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                thread: { select: { id: true, title: true, slug: true, isClosed: true, isHidden: true } },
            }
        });

        if (!existing) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const isOwner = existing.authorId === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (existing.isHidden && !isAdmin) {
            return NextResponse.json({ error: "Post is hidden" }, { status: 403 });
        }

        if (existing.thread?.isHidden && !isAdmin) {
            return NextResponse.json({ error: "Thread is hidden" }, { status: 403 });
        }

        await prisma.post.update({
            where: { id: postId },
            data: { isHidden: true },
        });
        return NextResponse.json({ message: "Post hidden" });
    } catch (err) {
        console.error("Failed to delete post", err);
        return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }
});
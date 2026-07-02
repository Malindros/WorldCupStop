import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import translateToEnglish from "@/lib/utils/translate";
import { verifyIdParam } from "@/lib/utils/validation";
import { isThreadVisible } from "@/lib/utils/threadVisibility";

/**
 * @swagger
 * /api/posts/{id}/translate:
 *   get:
 *     summary: Translate a post's content to English (requires user auth)
 *     description: >
 *       AI translate a post's content to English. Optionally translate a specific historical edit
 *       instead of the current post content. You can also provide a sourceLanguage hint to improve accuracy.
 *       Requires authenticated user.
 *     tags:
 *       - Posts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Numeric post ID to translate
 *         schema:
 *           type: integer
 *       - name: sourceLanguage
 *         in: query
 *         required: false
 *         description: Hint language for the translator (e.g. "es", "fr", "de")
 *         schema:
 *           type: string
 *       - name: editId
 *         in: query
 *         required: false
 *         description: Numeric ID of a historical edit to translate instead of the current post content
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Translation succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 translatedText:
 *                   type: string
 *                 cached:
 *                   type: boolean
 *                 alreadyEnglish:
 *                   type: boolean
 *                 editId:
 *                   type: integer
 *             examples:
 *               translatedCurrentPost:
 *                 summary: Translated current post content
 *                 value:
 *                   translatedText: "This is the translated English content."
 *                   cached: false
 *                   alreadyEnglish: false
 *               translatedEdit:
 *                 summary: Translated historical edit
 *                 value:
 *                   translatedText: "Translated English content from edit."
 *                   cached: true
 *                   alreadyEnglish: false
 *                   editId: 123
 *               alreadyEnglish:
 *                 summary: Post already in English
 *                 value:
 *                   translatedText: "Original English content."
 *                   cached: false
 *                   alreadyEnglish: true
 *       '400':
 *         description: Bad request (missing/invalid id, invalid edit id)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               invalidId:
 *                 value:
 *                   error: "Invalid post id"
 *               invalidEditId:
 *                 value:
 *                   error: "Invalid edit id"
 *               translationFailed:
 *                 value:
 *                   error: "Translation failed"
 *       '404':
 *         description: Post or edit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               postNotFound:
 *                 value:
 *                   error: "Post not found"
 *               editNotFound:
 *                 value:
 *                   error: "Post edit not found"
 *       '401':
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             examples:
 *               unauthorized:
 *                 value:
 *                   error: "Unauthorized"
 *       '403':
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             examples:
 *               forbidden:
 *                 value:
 *                   error: "Forbidden"
 */
export const GET = requireUser(async (request, user, { params }) => {
    try {
        const { id: idStr } = await params;
        const id = verifyIdParam(idStr);
        if (id === null) {
            return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
        }

        const postRecord = await prisma.post.findUnique({
            where: { id: Number(id) },
            include: {
                thread: { select: { id: true, isHidden: true, autoOpenAt: true, autoCloseAt: true } },
            },
        });
        if (!postRecord || postRecord.isHidden) return NextResponse.json({ error: "Post not found" }, { status: 404 });
        if (postRecord.thread && !isThreadVisible(postRecord.thread)) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const url = new URL(request.url);
        const sourceLang = url.searchParams.get("sourceLanguage");
        const editIdStr = url.searchParams.get("editId");

        // If an editId is provided, translate that historical version instead
        if (editIdStr) {
            const editId = verifyIdParam(editIdStr);
            if (editId === null) return NextResponse.json({ error: "Invalid edit id" }, { status: 400 });

            const postEditRecord = await prisma.postEdit.findUnique({ where: { id: Number(editId) } });
            if (!postEditRecord) return NextResponse.json({ error: "Post edit not found" }, { status: 404 });

            if (postEditRecord.postId !== postRecord.id) {
                return NextResponse.json({ error: "Edit does not belong to the specified post" }, { status: 400 });
            }

            // If post is marked as English, return original content
            if (postEditRecord.language && postEditRecord.language.toLowerCase() === "en") {
                return NextResponse.json({ translatedText: postEditRecord.previousContent, cached: false, alreadyEnglish: true, editId: Number(editId) }, { status: 200 });
            }

            const sourceLanguage = sourceLang || postEditRecord.language || postRecord.language || null;
            const result = await translateToEnglish(postEditRecord.previousContent, sourceLanguage);
            return NextResponse.json({ translatedText: result.translatedText, cached: result.cached, alreadyEnglish: false, editId: Number(editId) }, { status: 200 });
        }

        // If post is marked as English, return original content
        // if (postRecord.language && postRecord.language.toLowerCase() === "en") {
        //     return NextResponse.json({ translatedText: postRecord.content, cached: false, alreadyEnglish: true }, { status: 200 });
        // }

        const sourceLanguage = sourceLang || postRecord.language || null;
        const result = await translateToEnglish(postRecord.content, sourceLanguage);

        return NextResponse.json({ translatedText: result.translatedText, cached: result.cached, alreadyEnglish: false }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Translation failed" }, { status: 400 });
    }
});

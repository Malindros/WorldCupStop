import { NextResponse } from "next/server";
import { requireUser } from "@/lib/protect";
import { prisma } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const AVATAR_DIR = "public/avatars";

/** Remove avatar file from disk if it exists under AVATAR_DIR (url like /avatars/...). */
async function removeAvatarFileIfExists(url: string | null | undefined) {
    if (!url || typeof url !== "string" || !url.startsWith("/avatars/")) return;
    const filename = url.replace(/^\/avatars\//, "").replace(/[/\\]/g, "");
    if (!filename) return;
    const filepath = path.join(process.cwd(), AVATAR_DIR, filename);
    try {
        await unlink(filepath);
    } catch {
        // ignore missing file
    }
}
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * @swagger
 * /api/me/avatar:
 *   post:
 *     summary: Upload or change avatar
 *     description: Upload an image as profile picture. Accepts multipart/form-data with field "file". Replaces existing avatar.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       '200':
 *         description: Avatar updated; returns user with avatar URL
 *       '400':
 *         description: No file or invalid file type/size
 *       '401':
 *         description: Unauthorized
 */
export const POST = requireUser(async (request, user) => {
    let formData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") ?? formData.get("avatar");
    if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No file provided; use form field 'file' or 'avatar'" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Invalid file type; use JPEG, PNG, GIF, or WebP" }, { status: 400 });
    }

    const ext = path.extname(file.name) || (file.type === "image/jpeg" ? ".jpg" : file.type === "image/png" ? ".png" : ".webp");
    const filename = `${user.id}-${Date.now()}${ext}`;
    const dir = path.join(process.cwd(), AVATAR_DIR);
    const filepath = path.join(dir, filename);

    try {
        await mkdir(dir, { recursive: true });
        const bytes = await file.arrayBuffer();
        await writeFile(filepath, Buffer.from(bytes));
    } catch (err) {
        console.error("Avatar upload error:", err);
        return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }

    const url = `/avatars/${filename}`;

    const previousMedia = await prisma.$transaction(async (tx) => {
        const previous = await tx.user.findUnique({
            where: { id: user.id },
            select: { avatarMediaId: true },
        });
        const previousRecord = previous?.avatarMediaId
            ? await tx.media.findUnique({ where: { id: previous.avatarMediaId }, select: { id: true, url: true } })
            : null;
        const media = await tx.media.create({
            data: {
                url,
                uploadedById: user.id,
                altText: `Avatar of ${user.username}`,
                metadata: { source: "upload" },
            },
        });
        await tx.user.update({
            where: { id: user.id },
            data: { avatarMediaId: media.id },
        });
        if (previous?.avatarMediaId) {
            await tx.media.delete({ where: { id: previous.avatarMediaId } }).catch(() => {});
        }
        return previousRecord;
    });

    if (previousMedia?.url) {
        await removeAvatarFileIfExists(previousMedia.url);
    }

    const updated = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            username: true,
            avatarMedia: { select: { id: true, url: true, altText: true } },
        },
    });

    if (!updated) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        user: {
            id: updated.id,
            username: updated.username,
            avatar: updated.avatarMedia ? { id: updated.avatarMedia.id, url: updated.avatarMedia.url, altText: updated.avatarMedia.altText } : null,
        },
    }, { status: 200 });
});

/**
 * @swagger
 * /api/me/avatar:
 *   delete:
 *     summary: Remove avatar
 *     description: Removes the current user's profile picture.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Avatar removed
 *       '401':
 *         description: Unauthorized
 */
export const DELETE = requireUser(async (_request, user) => {
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { avatarMediaId: true, avatarMedia: { select: { url: true } } },
    });

    if (dbUser?.avatarMediaId) {
        const urlToRemove = dbUser.avatarMedia?.url ?? null;
        await prisma.user.update({
            where: { id: user.id },
            data: { avatarMediaId: null },
        });
        await prisma.media.delete({ where: { id: dbUser.avatarMediaId } }).catch(() => {});
        await removeAvatarFileIfExists(urlToRemove);
    } else {
        return NextResponse.json({ message: "No avatar to remove" }, { status: 200 });
    }

    return NextResponse.json({ message: "Avatar removed" }, { status: 200 });
});

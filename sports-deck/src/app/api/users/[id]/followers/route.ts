import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/users/{id}/followers:
 *   get:
 *     summary: List user followers
 *     description: Returns users who follow this user. Sorted by follow time (newest first). No auth required.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: List of followers with follow time
 *       '400':
 *         description: Invalid user id
 *       '404':
 *         description: User not found
 */
export async function GET(_request: Request, context: RouteParams<{ id: string }>) {
    const { id: idStr } = await context.params;
    const userId = verifyIdParam(idStr);
    if (userId === null) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const follows = await prisma.follow.findMany({
        where: { followeeId: userId },
        orderBy: { createdAt: "desc" },
        include: {
            follower: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarMedia: { select: { id: true, url: true, altText: true } },
                },
            },
        },
    });

    const followers = follows.map((f) => ({
        user: {
            id: f.follower.id,
            username: f.follower.username,
            displayName: f.follower.displayName,
            avatar: f.follower.avatarMedia
                ? { id: f.follower.avatarMedia.id, url: f.follower.avatarMedia.url, altText: f.follower.avatarMedia.altText }
                : null,
        },
        followedAt: f.createdAt,
    }));

    return NextResponse.json({ followers }, { status: 200 });
}

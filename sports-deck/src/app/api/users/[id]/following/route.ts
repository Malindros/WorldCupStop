import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/users/{id}/following:
 *   get:
 *     summary: List users this user follows
 *     description: Returns users that this user follows. Sorted by follow time (newest first). No auth required.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: List of followed users with follow time
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
        where: { followerId: userId },
        orderBy: { createdAt: "desc" },
        include: {
            followee: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarMedia: { select: { id: true, url: true, altText: true } },
                },
            },
        },
    });

    const following = follows.map((f) => ({
        user: {
            id: f.followee.id,
            username: f.followee.username,
            displayName: f.followee.displayName,
            avatar: f.followee.avatarMedia
                ? { id: f.followee.avatarMedia.id, url: f.followee.avatarMedia.url, altText: f.followee.avatarMedia.altText }
                : null,
        },
        followedAt: f.createdAt,
    }));

    return NextResponse.json({ following }, { status: 200 });
}

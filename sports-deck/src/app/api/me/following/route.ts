import { NextResponse } from "next/server";
import { requireUser } from "@/lib/protect";
import { prisma } from "@/lib/db";

/**
 * @swagger
 * /api/me/following:
 *   get:
 *     summary: List users I follow
 *     description: Returns users that the current user follows. Sorted by follow time (newest first). Requires authentication.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of followed users with followedAt
 *       '401':
 *         description: Unauthorized
 */
export const GET = requireUser(async (_request, currentUser) => {
    const follows = await prisma.follow.findMany({
        where: { followerId: currentUser.id },
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
});

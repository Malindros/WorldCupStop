import { NextResponse } from "next/server";
import { requireUser } from "@/lib/protect";
import { prisma } from "@/lib/db";

/**
 * @swagger
 * /api/me/followers:
 *   get:
 *     summary: List my followers
 *     description: Returns users who follow the current user. Sorted by follow time (newest first). Requires authentication.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of followers with followedAt
 *       '401':
 *         description: Unauthorized
 */
export const GET = requireUser(async (_request, currentUser) => {
    const follows = await prisma.follow.findMany({
        where: { followeeId: currentUser.id },
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
});

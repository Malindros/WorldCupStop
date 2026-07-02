import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/protect";
import { ensureUserNotBanned } from "@/lib/utils/ban";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     description: Authenticated user follows the user with the given id. Cannot follow self. Idempotent if already following.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: User id to follow (followee)
 *     responses:
 *       '201':
 *         description: Now following the user
 *       '400':
 *         description: Invalid user id or cannot follow self
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: User to follow not found
 */
export const POST = requireUser<RouteParams<{ id: string }>>(async (_request, currentUser, context) => {
    const bannedMessage = await ensureUserNotBanned(currentUser.id);
    if (bannedMessage) {
        return NextResponse.json({ error: bannedMessage }, { status: 403 });
    }

    const { id: idStr } = await context.params;
    const followeeId = verifyIdParam(idStr);
    if (followeeId === null) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (currentUser.id === followeeId) {
        return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const followee = await prisma.user.findUnique({
        where: { id: followeeId },
        select: { id: true },
    });
    if (!followee) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.follow.findUnique({
        where: {
            followerId_followeeId: { followerId: currentUser.id, followeeId },
        },
    });
    if (existing) {
        return NextResponse.json({ message: "Already following", follow: true }, { status: 200 });
    }

    await prisma.follow.create({
        data: {
            followerId: currentUser.id,
            followeeId,
        },
    });

    return NextResponse.json({ message: "Following", follow: true }, { status: 201 });
});

/**
 * @swagger
 * /api/users/{id}/follow:
 *   delete:
 *     summary: Unfollow a user
 *     description: Authenticated user unfollows the user with the given id.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: User id to unfollow (followee)
 *     responses:
 *       '200':
 *         description: Unfollowed (or was not following)
 *       '400':
 *         description: Invalid user id
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: User not found
 */
export const DELETE = requireUser<RouteParams<{ id: string }>>(async (_request, currentUser, context) => {
    const { id: idStr } = await context.params;
    const followeeId = verifyIdParam(idStr);
    if (followeeId === null) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const followee = await prisma.user.findUnique({
        where: { id: followeeId },
        select: { id: true },
    });
    if (!followee) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.follow.deleteMany({
        where: {
            followerId: currentUser.id,
            followeeId,
        },
    });

    return NextResponse.json({ message: "Unfollowed", follow: false }, { status: 200 });
});

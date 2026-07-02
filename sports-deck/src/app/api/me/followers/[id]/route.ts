import { NextResponse } from "next/server";
import { requireUser } from "@/lib/protect";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/me/followers/{id}:
 *   delete:
 *     summary: Remove a follower
 *     description: Removes the follow relationship so the given user no longer follows the current user. Requires authentication.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: User id of the follower to remove
 *     responses:
 *       '200':
 *         description: Follower removed
 *       '400':
 *         description: Invalid user id
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: No such follower (user is not following you)
 */
export const DELETE = requireUser<RouteParams<{ id: string }>>(async (_request, currentUser, context) => {
    const { id: idStr } = await context.params;
    const followerId = verifyIdParam(idStr);
    if (followerId === null) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const deleted = await prisma.follow.deleteMany({
        where: {
            followeeId: currentUser.id,
            followerId,
        },
    });

    if (deleted.count === 0) {
        return NextResponse.json(
            { error: "User is not following you" },
            { status: 404 }
        );
    }

    return NextResponse.json({ message: "Follower removed" }, { status: 200 });
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get public user profile
 *     description: Returns public profile for a user - username, displayName, avatar, favorite team, counts of followers/following, and counts of threads/posts. No auth required.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: User profile with counts and associated team
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

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            displayName: true,
            favoriteTeamId: true,
            createdAt: true,
            avatarMedia: { select: { id: true, url: true, altText: true } },
            favoriteTeam: {
                select: {
                    id: true,
                    name: true,
                    shortName: true,
                    slug: true,
                    crest: true,
                },
            },
            _count: {
                select: {
                    followers: true,
                    following: true,
                    threads: true,
                    posts: true,
                },
            },
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { _count, ...profile } = user;
    return NextResponse.json({
        user: {
            id: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            favoriteTeamId: profile.favoriteTeamId,
            favoriteTeam: profile.favoriteTeam
                ? {
                    id: profile.favoriteTeam.id,
                    name: profile.favoriteTeam.name,
                    shortName: profile.favoriteTeam.shortName,
                    slug: profile.favoriteTeam.slug,
                    crest: profile.favoriteTeam.crest,
                }
                : null,
            avatar: profile.avatarMedia
                ? { id: profile.avatarMedia.id, url: profile.avatarMedia.url, altText: profile.avatarMedia.altText }
                : null,
            createdAt: profile.createdAt,
            followersCount: _count.followers,
            followingsCount: _count.following,
            threadsCount: _count.threads,
            postsCount: _count.posts,
        },
    }, { status: 200 });
}

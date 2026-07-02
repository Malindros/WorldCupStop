import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/utils/auth";
import { requireUser } from "@/lib/protect";
import { prisma } from "@/lib/db";
import type { JsonBody } from "@/lib/types/api";
import type { Prisma } from "../../../../prisma/generated/client";
import { DISPLAYNAME_MAX_LENGTH, isValidUsername } from "@/lib/validation/profileFields";

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Get currently authenticated user
 *     description: Returns the profile of the user identified by the Bearer token.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current user profile
 *       '401':
 *         description: Unauthorized (missing or invalid token)
 */
export async function GET(request: Request) {
    const user = getUserFromRequest(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            role: true,
            favoriteTeamId: true,
            isBanned: true,
            banUntil: true,
            createdAt: true,
            avatarMedia: { select: { id: true, url: true, altText: true } },
        },
    });

    if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({
        user: {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            displayName: dbUser.displayName,
            role: dbUser.role,
            favoriteTeamId: dbUser.favoriteTeamId,
            avatar: dbUser.avatarMedia ? { id: dbUser.avatarMedia.id, url: dbUser.avatarMedia.url, altText: dbUser.avatarMedia.altText } : null,
            isBanned: dbUser.isBanned,
            banUntil: dbUser.banUntil,
            createdAt: dbUser.createdAt,
        },
    }, { status: 200 });
}

/**
 * @swagger
 * /api/me:
 *   patch:
 *     summary: Update current user profile
 *     description: Update username, displayName, and/or favorite team. All fields optional.
 *     tags:
 *       - Account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, minLength: 2, maxLength: 30 }
 *               displayName: { type: string, maxLength: 100 }
 *               favoriteTeamId: { type: integer, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated user profile
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '409':
 *         description: Username already taken
 */
export const PATCH = requireUser(async (request, user) => {
    type MePatchBody = {
        username?: unknown;
        displayName?: unknown;
        favoriteTeamId?: unknown;
    };

    let body: JsonBody<MePatchBody>;
    try {
        body = (await request.json()) as MePatchBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { username, displayName, favoriteTeamId } = body ?? {};
    const updates: Prisma.UserUpdateInput = {};

    if (username !== undefined) {
        if (typeof username !== "string" || !isValidUsername(username)) {
            return NextResponse.json(
                { error: "Username must be 2–30 characters and contain only letters, numbers, underscores, and hyphens" },
                { status: 400 }
            );
        }
        const trimmed = username.trim();
        const existing = await prisma.user.findFirst({ where: { username: trimmed, id: { not: user.id } } });
        if (existing) {
            return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }
        updates.username = trimmed;
    }

    if (displayName !== undefined) {
        const trimmed = displayName === null || (typeof displayName === "string" && displayName.trim() === "") ? null : String(displayName).trim();
        if (trimmed !== null && trimmed.length > DISPLAYNAME_MAX_LENGTH) {
            return NextResponse.json(
                { error: `displayName must be at most ${DISPLAYNAME_MAX_LENGTH} characters` },
                { status: 400 }
            );
        }
        updates.displayName = trimmed;
    }

    if (favoriteTeamId !== undefined) {
        if (favoriteTeamId === null || favoriteTeamId === "") {
            updates.favoriteTeam = { disconnect: true };
        } else {
            const id = Number(favoriteTeamId);
            if (!Number.isInteger(id) || id < 1) {
                return NextResponse.json({ error: "Invalid favoriteTeamId" }, { status: 400 });
            }
            const team = await prisma.team.findUnique({ where: { id } });
            if (!team) {
                return NextResponse.json({ error: "Team not found" }, { status: 400 });
            }
            updates.favoriteTeam = { connect: { id } };
        }
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            role: true,
            favoriteTeamId: true,
            isBanned: true,
            banUntil: true,
            createdAt: true,
            avatarMedia: { select: { id: true, url: true, altText: true } },
        },
    });

    return NextResponse.json({
        user: {
            id: updated.id,
            email: updated.email,
            username: updated.username,
            displayName: updated.displayName,
            role: updated.role,
            favoriteTeamId: updated.favoriteTeamId,
            avatar: updated.avatarMedia ? { id: updated.avatarMedia.id, url: updated.avatarMedia.url, altText: updated.avatarMedia.altText } : null,
            isBanned: updated.isBanned,
            banUntil: updated.banUntil,
            createdAt: updated.createdAt,
        },
    }, { status: 200 });
});

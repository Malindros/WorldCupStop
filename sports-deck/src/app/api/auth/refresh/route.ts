import { NextResponse } from "next/server";
import { verifyRefreshToken, generateToken, generateRefreshToken, revokeRefreshToken } from "@/lib/utils/auth";
import { prisma } from "@/lib/db";
import { getRefreshTokenFromRequest, setAuthCookies } from "@/lib/utils/authCookies";

type RefreshBody = {
    refreshToken?: unknown;
};

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange a valid refresh token for new access and refresh tokens. Revoked tokens are rejected.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       '200':
 *         description: New accessToken and refreshToken
 *       '400':
 *         description: Missing refresh token
 *       '401':
 *         description: Invalid or revoked refresh token
 */
export async function POST(request: Request) {
    let body: RefreshBody | null;
    try {
        body = (await request.json()) as RefreshBody;
    } catch {
        body = null;
    }

    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : getRefreshTokenFromRequest(request);
    if (!refreshToken) {
        return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
        return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { username: payload.username },
        select: { id: true, role: true, username: true },
    });

    if (!dbUser) {
        return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    revokeRefreshToken(refreshToken);

    const tokenPayload = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
    const newAccessToken = generateToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const response = NextResponse.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    }, { status: 200 });

    const proto = request.headers.get("x-forwarded-proto");
    const isHttps = proto === "https";

    setAuthCookies(response, newAccessToken, newRefreshToken, isHttps);
    return response;
}

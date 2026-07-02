import { NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/utils/auth";
import { clearAuthCookies, getRefreshTokenFromRequest } from "@/lib/utils/authCookies";

type LogoutBody = {
    refreshToken?: unknown;
};

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out and invalidate refresh token
 *     description: Submit the refresh token to invalidate it. After logout, that token can no longer be used to obtain new access tokens.
 *     tags:
 *       - Auth
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       '200':
 *         description: Logged out successfully
 */
export async function POST(request: Request) {
    let body: LogoutBody | null;
    try {
        body = (await request.json()) as LogoutBody;
    } catch {
        body = null;
    }

    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : getRefreshTokenFromRequest(request);
    if (refreshToken) {
        revokeRefreshToken(refreshToken);
    }

    const response = NextResponse.json({ message: "Logged out" }, { status: 200 });

    const proto = request.headers.get("x-forwarded-proto");
    const isHttps = proto === "https";
    clearAuthCookies(response, isHttps);
    return response;
}

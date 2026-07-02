import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { generateToken, generateRefreshToken } from "@/lib/utils/auth";
import { setAuthCookies } from "@/lib/utils/authCookies";

type LoginBody = {
    username?: unknown;
    password?: unknown;
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email or username and password
 *     description: Returns access and refresh JWTs. Use email or username in the username field.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, description: "Email or username" }
 *               password: { type: string }
 *     responses:
 *       '200':
 *         description: Success; returns accessToken and refreshToken
 *       '400':
 *         description: Missing username or password
 *       '401':
 *         description: Invalid credentials
 */
export async function POST(request: Request) {
    let body: LoginBody | null;
    try {
        body = (await request.json()) as LoginBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { username, password } = body ?? {};

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
        return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    const isEmail = typeof username === "string" && username.includes("@");
    const userRecord = await prisma.user.findFirst({
        where: isEmail
            ? { email: username.trim().toLowerCase() }
            : { username: username.trim() },
    });

    if (!userRecord || !userRecord.password || !(await bcrypt.compare(password, userRecord.password))) {
        return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const tokenPayload = { id: userRecord.id, username: userRecord.username, role: userRecord.role };
    const refreshPayload = { id: userRecord.id, username: userRecord.username, role: userRecord.role };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(refreshPayload);

    const response = NextResponse.json({
        user: {
            id: userRecord.id,
            username: userRecord.username,
            role: userRecord.role,
            email: userRecord.email,
        },
        accessToken,
        refreshToken,
    }, { status: 200 });

    const proto = request.headers.get("x-forwarded-proto");
    const isHttps = proto === "https";

    setAuthCookies(response, accessToken, refreshToken, isHttps);
    return response;
}

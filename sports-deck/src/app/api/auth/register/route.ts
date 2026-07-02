import { NextResponse } from "next/server";
import { hashPassword, generateToken, generateRefreshToken } from "@/lib/utils/auth";
import { prisma } from "@/lib/db";
import { generateUniqueUsernameFromValue } from "@/lib/utils/authUsers";
import { setAuthCookies } from "@/lib/utils/authCookies";

type RegisterBody = {
    email?: unknown;
    password?: unknown;
    username?: unknown;
    displayName?: unknown;
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with email and password
 *     description: Creates a new user account. Email required; username optional (auto-generated from email if omitted). Returns accessToken and refreshToken.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               username: { type: string, minLength: 2, maxLength: 30, description: "Optional; auto-generated from email if omitted" }
 *               displayName: { type: string, description: "Optional; if omitted, set to username when provided else email local part (no suffix)" }
 *     responses:
 *       '201':
 *         description: User created; returns user, accessToken, refreshToken
 *       '400':
 *         description: Invalid input or missing required fields
 *       '409':
 *         description: Email or username already in use
 */

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 30;
const DISPLAYNAME_MAX_LENGTH = 100;

/**
 * Validate email format.
 */
function isValidEmail(email: string): boolean {
    if (!email || typeof email !== "string") return false;
    return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate username: alphanumeric, underscore, hyphen; 2–30 chars.
 */
function isValidUsername(username: string): boolean {
    if (!username || typeof username !== "string") return false;
    const t = username.trim();
    return t.length >= USERNAME_MIN_LENGTH && t.length <= USERNAME_MAX_LENGTH && USERNAME_REGEX.test(t);
}

/**
 * Validate password length.
 */
function isValidPassword(password: string): boolean {
    return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

/**
 * POST /api/auth/register
 * Register a new user with email and password.
 * Body: { email, password, username, displayName? }
 */
export async function POST(request: Request) {
    let body: RegisterBody;
    try {
        body = (await request.json()) as RegisterBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { email, password, username, displayName } = body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
        return NextResponse.json(
            { error: "Missing required field: email and password are required" },
            { status: 400 }
        );
    }

    if (!isValidEmail(email)) {
        return NextResponse.json(
            { error: "Invalid email format" },
            { status: 400 }
        );
    }

    if (username !== undefined && username !== null && String(username).trim() !== "" && !isValidUsername(String(username))) {
        return NextResponse.json(
            { error: "Username must be 2–30 characters and contain only letters, numbers, underscores, and hyphens" },
            { status: 400 }
        );
    }

    if (!isValidPassword(password)) {
        return NextResponse.json(
            { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
            { status: 400 }
        );
    }

    const trimmedEmail = email.trim().toLowerCase();
    let trimmedUsername =
        username !== undefined && username !== null && String(username).trim() !== ""
            ? String(username).trim()
            : null;

    const existingByEmail = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingByEmail) {
        return NextResponse.json(
            { error: "An account with this email already exists" },
            { status: 409 }
        );
    }

    const usernameWasProvided = trimmedUsername !== null;
    if (trimmedUsername !== null) {
        const existingByUsername = await prisma.user.findUnique({ where: { username: trimmedUsername } });
        if (existingByUsername) {
            return NextResponse.json(
                { error: "Username is already taken" },
                { status: 409 }
            );
        }
    } else {
        trimmedUsername = await generateUniqueUsernameFromValue(trimmedEmail);
    }

    let finalDisplayName: string | null =
        displayName != null && String(displayName).trim() !== "" ? String(displayName).trim() : null;
    if (finalDisplayName === null) {
        if (usernameWasProvided) {
            finalDisplayName = trimmedUsername;
        } else {
            finalDisplayName = trimmedEmail.replace(/@.*$/, "").trim().slice(0, DISPLAYNAME_MAX_LENGTH) || "User";
        }
    }
    if (finalDisplayName.length > DISPLAYNAME_MAX_LENGTH) {
        return NextResponse.json(
            { error: `displayName must be at most ${DISPLAYNAME_MAX_LENGTH} characters` },
            { status: 400 }
        );
    }

    const safeDisplayName = finalDisplayName;

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
        data: {
            email: trimmedEmail,
            username: trimmedUsername,
            displayName: safeDisplayName,
            password: hashedPassword,
            role: "USER",
        },
        select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            role: true,
            createdAt: true,
        },
    });

    const tokenPayload = { id: user.id, username: user.username, role: user.role };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const response = NextResponse.json(
        {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
                createdAt: user.createdAt,
            },
            accessToken,
            refreshToken,
        },
        { status: 201 }
    );

    const proto = request.headers.get("x-forwarded-proto");
    const isHttps = proto === "https";
    setAuthCookies(response, accessToken, refreshToken, isHttps);
    return response;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyIdParam } from "@/lib/utils/validation";
import type { RouteParams } from "@/lib/types/api";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

/**
 * Parse and validate query params for the activity period.
 * Supports: days (number, default 30, max 365) OR from + to (ISO date strings).
 * @returns {{ start: Date, end: Date } | { error: string }}
 */
type PeriodResult =
    | { start: Date; end: Date; error?: undefined }
    | { error: string; start?: undefined; end?: undefined };

function parsePeriod(searchParams: URLSearchParams): PeriodResult {
    const daysParam = searchParams.get("days");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (fromParam && toParam) {
        const from = new Date(fromParam);
        const to = new Date(toParam);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return { error: "Invalid date format for from or to (use ISO 8601)" };
        }
        if (from > to) {
            return { error: "from must be before or equal to to" };
        }
        const start = new Date(from);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(to);
        end.setUTCHours(23, 59, 59, 999);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        if (daysDiff > MAX_DAYS) {
            return { error: `Date range (from/to) must not exceed ${MAX_DAYS} days` };
        }
        return { start, end };
    }

    let days = DEFAULT_DAYS;
    if (daysParam != null && daysParam !== "") {
        const n = parseInt(daysParam, 10);
        if (!Number.isInteger(n) || n < 1) {
            return { error: "days must be a positive integer" };
        }
        if (n > MAX_DAYS) {
            return { error: `days must be at most ${MAX_DAYS}` };
        }
        days = n;
    }

    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
}

/**
 * Format date as YYYY-MM-DD (UTC).
 */
function toDateKey(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * @swagger
 * /api/users/{id}/activity:
 *   get:
 *     summary: Get user activity over a time period
 *     description: Returns daily activity (posts and comments/replies count) for charting. Activity = posts + comments authored by the user. No auth required.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *         description: Number of days (from today backwards). Ignored if from/to provided.
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Start date (ISO 8601). Use with to.
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: End date (ISO 8601). Use with from.
 *     responses:
 *       '200':
 *         description: Activity timeline with daily buckets (postsCount, commentsCount, totalActivity)
 *       '400':
 *         description: Invalid user id or invalid period params
 *       '404':
 *         description: User not found
 */
export async function GET(request: Request, context: RouteParams<{ id: string }>) {
    const { id: idStr } = await context.params;
    const userId = verifyIdParam(idStr);
    if (userId === null) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const period = parsePeriod(searchParams);
    if ("error" in period) {
        return NextResponse.json({ error: period.error }, { status: 400 });
    }

    const { start, end } = period;

    const posts = await prisma.post.findMany({
        where: {
            authorId: userId,
            isHidden: false,
            createdAt: { gte: start, lte: end },
        },
        select: { createdAt: true, parentPostId: true },
    });

    const buckets = new Map<string, { date: string; postsCount: number; commentsCount: number; totalActivity: number }>();
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = toDateKey(d);
        buckets.set(key, { date: key, postsCount: 0, commentsCount: 0, totalActivity: 0 });
    }

    for (const p of posts) {
        const key = toDateKey(p.createdAt);
        if (!buckets.has(key)) continue;
        const b = buckets.get(key);
        if (!b) continue;
        if (p.parentPostId == null) {
            b.postsCount += 1;
        } else {
            b.commentsCount += 1;
        }
        b.totalActivity = b.postsCount + b.commentsCount;
    }

    const activity = Array.from(buckets.values()).sort(
        (a, b) => a.date.localeCompare(b.date)
    );

    return NextResponse.json({
        activity,
        total: activity.length,
        from: toDateKey(start),
        to: toDateKey(end),
    }, { status: 200 });
}

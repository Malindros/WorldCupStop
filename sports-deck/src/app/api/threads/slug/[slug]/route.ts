import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildVisibleThreadWhere } from "@/lib/utils/threadVisibility";
import { getUserFromRequest } from "@/lib/utils/auth";
import type { RouteParams } from "@/lib/types/api";


/**
 * @swagger
 * /api/threads/slug/{slug}:
 *   get:
 *     summary: Resolve thread ID by slug
 */
export async function GET(request: Request, { params }: RouteParams<{ slug: string }>) {
  try {
    const requester = getUserFromRequest(request);
    const isAdmin = requester?.role === "ADMIN";
    const { slug } = await params;
    const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Invalid thread slug" }, { status: 400 });
    }

    const thread = await prisma.forumThread.findFirst({
      where: {
        AND: [
          { slug: normalizedSlug },
          ...(isAdmin ? [] : [buildVisibleThreadWhere()]),
        ],
      },
      select: { id: true, slug: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ id: thread.id, slug: thread.slug });
  } catch (err) {
    console.error("Failed to resolve thread slug", err);
    return NextResponse.json({ error: "Failed to resolve thread slug" }, { status: 500 });
  }
}

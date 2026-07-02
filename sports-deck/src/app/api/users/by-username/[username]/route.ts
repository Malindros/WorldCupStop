import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/utils/auth";
import { getNextAppealAllowedAt } from "@/lib/utils/banAppeals";
import type { RouteParams } from "@/lib/types/api";

function isActiveBan(until: Date | null, liftedAt: Date | null) {
  if (liftedAt) return false;
  if (!until) return true;
  return until.getTime() > Date.now();
}

export async function GET(request: Request, { params }: RouteParams<{ username: string }>) {
  const { username } = await params;
  const normalizedUsername = typeof username === "string" ? username.trim() : "";
  if (!normalizedUsername) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const requester = getUserFromRequest(request);
  const isAdminViewer = requester?.role === "ADMIN";

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: {
      id: true,
      username: true,
      displayName: true,
      createdAt: true,
      favoriteTeamId: true,
      favoriteTeam: { select: { id: true, name: true, shortName: true, slug: true, crest: true } },
      avatarMedia: { select: { id: true, url: true, altText: true } },
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

  const isSelf = Boolean(requester && requester.id === user.id);
  const canViewBanState = isSelf || isAdminViewer;

  let viewerFollows: boolean | null = null;
  if (requester && !isSelf) {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followeeId: { followerId: requester.id, followeeId: user.id },
      },
      select: { id: true },
    });
    viewerFollows = Boolean(existingFollow);
  }

  let ban: {
    id: number;
    reason: string;
    createdAt: Date;
    until: Date | null;
    bannedBy: { id: number; username: string } | null;
    isActive: boolean;
    pendingAppeal: { id: number; createdAt: Date } | null;
    latestRejectedAppeal: { id: number; createdAt: Date } | null;
    nextAllowedAppealAt: Date | null;
    canSubmitAppeal: boolean;
  } | null = null;

  if (canViewBanState) {
    const latestBan = await prisma.ban.findFirst({
      where: {
        userId: user.id,
        liftedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        bannedBy: { select: { id: true, username: true } },
        appeals: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, createdAt: true },
        },
      },
    });

    if (latestBan && isActiveBan(latestBan.until, latestBan.liftedAt)) {
      const pendingAppeal = latestBan.appeals.find((appeal) => appeal.status === "PENDING") ?? null;
      const latestRejectedAppeal = latestBan.appeals.find((appeal) => appeal.status === "DENIED") ?? null;
      const nextAllowedAppealAt = latestRejectedAppeal ? getNextAppealAllowedAt(latestRejectedAppeal.createdAt) : null;
      const cooldownActive = Boolean(nextAllowedAppealAt && nextAllowedAppealAt.getTime() > Date.now());

      ban = {
        id: latestBan.id,
        reason: latestBan.reason,
        createdAt: latestBan.createdAt,
        until: latestBan.until,
        bannedBy: isAdminViewer && latestBan.bannedBy
          ? { id: latestBan.bannedBy.id, username: latestBan.bannedBy.username }
          : null,
        isActive: true,
        pendingAppeal: pendingAppeal ? { id: pendingAppeal.id, createdAt: pendingAppeal.createdAt } : null,
        latestRejectedAppeal: latestRejectedAppeal ? { id: latestRejectedAppeal.id, createdAt: latestRejectedAppeal.createdAt } : null,
        nextAllowedAppealAt,
        canSubmitAppeal: isSelf ? !pendingAppeal && !cooldownActive : false,
      };
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
      favoriteTeamId: user.favoriteTeamId,
      favoriteTeam: user.favoriteTeam
        ? {
            id: user.favoriteTeam.id,
            name: user.favoriteTeam.name,
            shortName: user.favoriteTeam.shortName,
            slug: user.favoriteTeam.slug,
            crest: user.favoriteTeam.crest,
          }
        : null,
      avatar: user.avatarMedia ? { id: user.avatarMedia.id, url: user.avatarMedia.url, altText: user.avatarMedia.altText } : null,
      followersCount: user._count.followers,
      followingsCount: user._count.following,
      threadsCount: user._count.threads,
      postsCount: user._count.posts,
    },
    isSelf,
    ban,
    viewerFollows,
  });
}
import { prisma } from "@/lib/db";

function isUserUploadedAvatar(url: string | null | undefined, metadata: unknown): boolean {
  if (typeof url === "string" && url.startsWith("/avatars/")) return true;
  const src = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as { source?: string }).source : null;
  return src === "upload";
}

/**
 * Store or update the user's avatar from an OAuth provider profile picture URL.
 * Does not replace avatars the user uploaded in-app (local /avatars/… or metadata.source === "upload").
 */
export async function syncUserAvatarFromOAuthUrl(
  userId: number,
  pictureUrl: string | null | undefined,
  altText: string
): Promise<void> {
  if (!pictureUrl || typeof pictureUrl !== "string") return;
  const trimmed = pictureUrl.trim();
  if (!trimmed.startsWith("https://")) return;

  const safeAlt = altText.trim().slice(0, 200) || "Profile photo";

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarMediaId: true,
      avatarMedia: { select: { id: true, url: true, metadata: true } },
    },
  });

  if (existing?.avatarMedia && isUserUploadedAvatar(existing.avatarMedia.url, existing.avatarMedia.metadata)) {
    return;
  }

  if (existing?.avatarMediaId) {
    await prisma.media.update({
      where: { id: existing.avatarMediaId },
      data: {
        url: trimmed,
        altText: safeAlt,
        metadata: { source: "oauth" },
      },
    });
    return;
  }

  const media = await prisma.media.create({
    data: {
      url: trimmed,
      altText: safeAlt,
      uploadedById: userId,
      metadata: { source: "oauth" },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { avatarMediaId: media.id },
  });
}

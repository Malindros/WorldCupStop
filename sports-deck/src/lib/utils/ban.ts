import { prisma } from "@/lib/db";

/**
 * Returns null if user is allowed, or a short error string if banned or missing.
 */
export async function ensureUserNotBanned(userId: number): Promise<string | null> {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isBanned: true, banUntil: true },
    });
    if (!dbUser) return "User not found";
    if (!dbUser.isBanned) return null;
    if (dbUser.banUntil && dbUser.banUntil.getTime() < Date.now()) return null;
    return "You are banned";
}

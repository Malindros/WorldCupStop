import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 30;

export function deriveBaseUsername(value: string): string {
  return value.replace(/@.*$/, "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "user";
}

export async function generateUniqueUsernameFromValue(value: string): Promise<string> {
  const local = deriveBaseUsername(value);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${local}_${suffix}`.slice(0, USERNAME_MAX_LENGTH);
    if (candidate.length >= USERNAME_MIN_LENGTH && USERNAME_REGEX.test(candidate)) {
      const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
  }

  return `${local}_${Date.now().toString(36)}`.slice(0, USERNAME_MAX_LENGTH);
}

export function generatePlaceholderPassword(): string {
  return `oauth_${randomBytes(24).toString("hex")}`;
}

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getAccessTokenFromRequest } from "@/lib/utils/authCookies";
import {
  getJwtRefreshSecret,
  getJwtSecret,
  JWT_ACCESS_MAX_AGE_SEC,
  JWT_REFRESH_MAX_AGE_SEC,
} from "@/lib/utils/jwtConfig";
import type { NextRequest } from "next/server";
import type { Role } from "../../../prisma/generated/client";

const SALT_ROUNDS = 10;

// Keep revoked tokens on globalThis to survive module reloads in dev/server
type GlobalWithRevokedTokens = typeof globalThis & {
  __revokedRefreshTokens?: Set<string>;
};

const globalWithRevokedTokens = globalThis as GlobalWithRevokedTokens;
if (!globalWithRevokedTokens.__revokedRefreshTokens) {
  globalWithRevokedTokens.__revokedRefreshTokens = new Set();
}
const revokedRefreshTokens = globalWithRevokedTokens.__revokedRefreshTokens;

export type AuthUser = {
  id: number;
  username: string;
  role: Role;
};

export function revokeRefreshToken(token: string): void {
  if (token && typeof token === "string") revokedRefreshTokens.add(token);
}

export function isRefreshTokenRevoked(token: string): boolean {
  return Boolean(token && revokedRefreshTokens.has(token));
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_ACCESS_MAX_AGE_SEC });
}

export function generateRefreshToken(payload: AuthUser): string {
  return jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: JWT_REFRESH_MAX_AGE_SEC });
}

type JwtPayloadShape = {
  id?: number;
  username?: string;
  role?: Role;
};

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayloadShape;
    if (!decoded) {
      return null;
    }
    if (!decoded.username || !decoded.role) {
      return null;
    }
    if (decoded.id == null) {
      return null;
    }
    return { id: decoded.id, username: decoded.username, role: decoded.role };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): AuthUser | null {
  try {
    if (isRefreshTokenRevoked(token)) return null;
    const decoded = jwt.verify(token, getJwtRefreshSecret()) as JwtPayloadShape;
    if (!decoded) return null;
    if (!decoded.username) return null;
    if (decoded.id == null || !decoded.role) return null;
    return { id: decoded.id, username: decoded.username, role: decoded.role };
  } catch {
    return null;
  }
}

export function getUserFromRequest(request: Request | NextRequest): AuthUser | null {
  const authHeader = request.headers.get("Authorization");
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    token = getAccessTokenFromRequest(request);
  }

  if (!token) return null;

  const user = verifyToken(token);
  if (!user) return null;

  return user;
}

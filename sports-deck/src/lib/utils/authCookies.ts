import type { NextRequest, NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { JWT_ACCESS_MAX_AGE_SEC, JWT_REFRESH_MAX_AGE_SEC } from "@/lib/utils/jwtConfig";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function accessCookieOptions(isHttps: boolean): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: JWT_ACCESS_MAX_AGE_SEC,
  };
}

function refreshCookieOptions(isHttps: boolean): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: JWT_REFRESH_MAX_AGE_SEC,
  };
}

function readCookieFromHeader(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const segment of cookieHeader.split(";")) {
    const [name, ...valueParts] = segment.trim().split("=");
    if (name === cookieName) {
      const rawValue = valueParts.join("=");
      return rawValue ? decodeURIComponent(rawValue) : "";
    }
  }

  return null;
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string, isHttps: boolean): void {
  response.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions(isHttps));
  response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions(isHttps));
}

export function clearAuthCookies(response: NextResponse, isHttps: boolean): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...accessCookieOptions(isHttps), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...refreshCookieOptions(isHttps), maxAge: 0 });
}

export function getAccessTokenFromRequest(request: Request | NextRequest): string | null {
  if ("cookies" in request) {
    return request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  }

  return readCookieFromHeader(request, ACCESS_COOKIE);
}

export function getRefreshTokenFromRequest(request: Request | NextRequest): string | null {
  if ("cookies" in request) {
    return request.cookies.get(REFRESH_COOKIE)?.value ?? null;
  }

  return readCookieFromHeader(request, REFRESH_COOKIE);
}

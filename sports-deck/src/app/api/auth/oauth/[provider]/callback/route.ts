import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, generateRefreshToken, generateToken } from "@/lib/utils/auth";
import { setAuthCookies } from "@/lib/utils/authCookies";
import {
  fallbackUsernameSeed,
  isOAuthProvider,
  readNextPathFromState,
  resolveAppBaseUrl,
  resolveOAuthConfig,
  stateCookieName,
  toProviderEnum,
  type OAuthProvider,
} from "@/lib/utils/oauth";
import { generatePlaceholderPassword, generateUniqueUsernameFromValue } from "@/lib/utils/authUsers";
import { syncUserAvatarFromOAuthUrl } from "@/lib/utils/oauthAvatar";

type Params = { params: Promise<{ provider: string }> };

type OAuthProfile = {
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  pictureUrl: string | null;
};

function readCookie(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(";")) {
    const [name, ...rest] = segment.trim().split("=");
    if (name === cookieName) return decodeURIComponent(rest.join("=") || "");
  }
  return null;
}

function redirectToLoginError(request: Request, message: string) {
  const baseUrl = resolveAppBaseUrl(request);
  const url = new URL("/login", baseUrl);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

async function fetchGoogleProfile(code: string, request: Request): Promise<OAuthProfile> {
  const baseUrl = resolveAppBaseUrl(request);
  const config = resolveOAuthConfig("google", baseUrl);

  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) throw new Error("Google token exchange failed");
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("Missing Google access token");

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) throw new Error("Google user profile fetch failed");
  const userJson = (await userRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    given_name?: string;
    picture?: string;
  };
  if (!userJson.sub) throw new Error("Google profile missing subject");

  return {
    providerUserId: userJson.sub,
    email: userJson.email?.toLowerCase() ?? null,
    displayName: userJson.name || userJson.given_name || null,
    pictureUrl: userJson.picture?.trim() || null,
  };
}

async function fetchGithubProfile(code: string, request: Request): Promise<OAuthProfile> {
  const baseUrl = resolveAppBaseUrl(request);
  const config = resolveOAuthConfig("github", baseUrl);

  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) throw new Error("GitHub token exchange failed");
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("Missing GitHub access token");

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "sports-deck",
    },
  });
  if (!userRes.ok) throw new Error("GitHub user profile fetch failed");
  const userJson = (await userRes.json()) as {
    id?: number;
    name?: string;
    login?: string;
    email?: string | null;
    avatar_url?: string | null;
  };
  if (!userJson.id) throw new Error("GitHub profile missing id");

  let email = userJson.email?.toLowerCase() ?? null;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "sports-deck",
      },
    });
    if (emailsRes.ok) {
      const emailsJson = (await emailsRes.json()) as Array<{
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }>;
      const primary = emailsJson.find((e) => e.primary && e.verified) || emailsJson.find((e) => e.verified);
      email = primary?.email?.toLowerCase() ?? null;
    }
  }

  return {
    providerUserId: String(userJson.id),
    email,
    displayName: userJson.name || userJson.login || null,
    pictureUrl: userJson.avatar_url?.trim() || null,
  };
}

async function fetchProfile(provider: OAuthProvider, code: string, request: Request) {
  return provider === "google" ? fetchGoogleProfile(code, request) : fetchGithubProfile(code, request);
}

export async function GET(request: Request, { params }: Params) {
  const { provider: rawProvider } = await params;
  if (!isOAuthProvider(rawProvider)) {
    return NextResponse.json({ error: "Unsupported OAuth provider" }, { status: 400 });
  }

  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  if (!code || !state) {
    return redirectToLoginError(request, "oauth_missing_code_or_state");
  }

  const cookieName = stateCookieName(rawProvider);
  const cookieState = readCookie(request, cookieName);
  if (!cookieState || cookieState !== state) {
    return redirectToLoginError(request, "oauth_invalid_state");
  }

  let profile: OAuthProfile;
  try {
    profile = await fetchProfile(rawProvider, code, request);
  } catch (error) {
    return redirectToLoginError(request, error instanceof Error ? error.message : "oauth_profile_error");
  }

  if (!profile.email) {
    return redirectToLoginError(request, "oauth_email_required");
  }

  const providerEnum = toProviderEnum(rawProvider);

  let user = await prisma.user.findFirst({
    where: { authProvider: providerEnum, authProviderUserId: profile.providerUserId },
    select: { id: true, username: true, role: true },
  });

  if (!user) {
    const byEmail = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, username: true, role: true, authProvider: true, authProviderUserId: true },
    });

    if (byEmail) {
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          authProvider: providerEnum,
          authProviderUserId: profile.providerUserId,
          displayName: profile.displayName ?? undefined,
        },
        select: { id: true, username: true, role: true },
      });
      user = updated;
    } else {
      const username = await generateUniqueUsernameFromValue(fallbackUsernameSeed(profile.email, profile.providerUserId));
      const hashedPassword = await hashPassword(generatePlaceholderPassword());
      user = await prisma.user.create({
        data: {
          email: profile.email,
          username,
          displayName: profile.displayName?.slice(0, 100) || username,
          password: hashedPassword,
          role: "USER",
          authProvider: providerEnum,
          authProviderUserId: profile.providerUserId,
        },
        select: { id: true, username: true, role: true },
      });
    }
  }

  const avatarAlt = profile.displayName?.trim() || user.username;
  await syncUserAvatarFromOAuthUrl(user.id, profile.pictureUrl, `${avatarAlt} profile photo`);

  const tokenPayload = { id: user.id, username: user.username, role: user.role };
  const accessToken = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  const nextPath = readNextPathFromState(state);
  const redirectUrl = new URL(nextPath, resolveAppBaseUrl(request));
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });

  const proto = request.headers.get("x-forwarded-proto");
  const isHttps = proto === "https";
  setAuthCookies(response, accessToken, refreshToken, isHttps);
  return response;
}

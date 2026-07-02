import { createHash, randomBytes } from "crypto";

export type OAuthProvider = "google" | "github";

const PROVIDERS: OAuthProvider[] = ["google", "github"];

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return PROVIDERS.includes(value as OAuthProvider);
}

export function buildOAuthState(nextPath?: string | null): string {
  const nonce = randomBytes(20).toString("hex");
  const next = sanitizeNextPath(nextPath);
  return `${nonce}.${Buffer.from(next, "utf8").toString("base64url")}`;
}

export function readNextPathFromState(state: string): string {
  const idx = state.indexOf(".");
  if (idx < 0) return "/";
  const encoded = state.slice(idx + 1);
  if (!encoded) return "/";
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    return sanitizeNextPath(decoded);
  } catch {
    return "/";
  }
}

export function sanitizeNextPath(nextPath?: string | null): string {
  if (!nextPath || typeof nextPath !== "string") return "/";
  if (!nextPath.startsWith("/")) return "/";
  if (nextPath.startsWith("//")) return "/";
  return nextPath;
}

export function resolveAppBaseUrl(request: Request): string {
  const explicitBase = process.env.APP_BASE_URL?.trim();
  if (explicitBase) return explicitBase.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

export function getOAuthCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: isProd(),
    path: "/",
    maxAge: 60 * 10,
  };
}

export function resolveOAuthConfig(provider: OAuthProvider, baseUrl: string) {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/oauth/google/callback`;
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth is not configured. Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.");
    }
    return { clientId, clientSecret, redirectUri };
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${baseUrl}/api/auth/oauth/github/callback`;
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured. Missing GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET.");
  }
  return { clientId, clientSecret, redirectUri };
}

export function stateCookieName(provider: OAuthProvider): string {
  return `oauth_state_${provider}`;
}

export function toProviderEnum(provider: OAuthProvider): "GOOGLE" | "GITHUB" {
  return provider === "google" ? "GOOGLE" : "GITHUB";
}

export function fallbackUsernameSeed(email: string | null, providerUserId: string): string {
  if (email) return email;
  const suffix = createHash("sha256").update(providerUserId).digest("hex").slice(0, 8);
  return `user_${suffix}`;
}

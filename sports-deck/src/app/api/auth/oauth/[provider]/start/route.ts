import { NextResponse } from "next/server";
import {
  buildOAuthState,
  getOAuthCookieOptions,
  isOAuthProvider,
  resolveAppBaseUrl,
  resolveOAuthConfig,
  stateCookieName,
} from "@/lib/utils/oauth";

type Params = { params: Promise<{ provider: string }> };

export async function GET(request: Request, { params }: Params) {
  const { provider: rawProvider } = await params;
  if (!isOAuthProvider(rawProvider)) {
    return NextResponse.json({ error: "Unsupported OAuth provider" }, { status: 400 });
  }

  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next");
  const state = buildOAuthState(nextPath);
  const baseUrl = resolveAppBaseUrl(request);

  let providerConfig: ReturnType<typeof resolveOAuthConfig>;
  try {
    providerConfig = resolveOAuthConfig(rawProvider, baseUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OAuth provider configuration error" },
      { status: 500 },
    );
  }

  const authUrl = new URL(
    rawProvider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize",
  );
  authUrl.searchParams.set("client_id", providerConfig.clientId);
  authUrl.searchParams.set("redirect_uri", providerConfig.redirectUri);
  authUrl.searchParams.set("state", state);

  if (rawProvider === "google") {
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
  } else {
    authUrl.searchParams.set("scope", "read:user user:email");
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(stateCookieName(rawProvider), state, getOAuthCookieOptions());
  return response;
}

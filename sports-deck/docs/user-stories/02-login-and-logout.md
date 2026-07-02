# User story: Log in and log out seamlessly

**Story:** As a user, I want to log in and log out seamlessly.

## Overview

Authentication is **JWT-based** with **httpOnly cookies** for browser sessions:

- **Access token** — cookie `accessToken`, short TTL (15 minutes per `jwtConfig.ts`).
- **Refresh token** — cookie `refreshToken`, longer TTL (60 minutes); used to mint new pairs; can be **revoked** on logout.

The client rarely handles raw tokens; `credentials: "include"` sends cookies on same-origin API calls.

## Login

| Piece | Location |
| --- | --- |
| API | `src/app/api/auth/login/route.ts` |
| Client | `src/contexts/AuthContext.tsx` — `login(identity, password)` |
| UI | `src/app/login/LoginClient.tsx` — sign-in form |

**API behavior:**

1. Body: `{ username, password }` where `username` may be **email or username** (`username.includes("@")` → lookup by `email`, else by `username`).
2. `bcrypt.compare` against stored hash; failure → `401`.
3. `generateToken` / `generateRefreshToken` with `{ id, username, role }`.
4. JSON body returns `user` summary + tokens; `setAuthCookies(response, accessToken, refreshToken, isHttps)`.

**Client behavior:**

1. `POST /api/auth/login` with credentials.
2. On success, `fetchCurrentUser()` → `GET /api/me` to populate React state (`user`, `status: "authenticated"`).

## Session refresh (keeps login “seamless”)

| Piece | Location |
| --- | --- |
| API | `src/app/api/auth/refresh/route.ts` |
| Client | `AuthContext` — `refreshSession()`, bootstrap, interval |

**Mechanics:**

- On load, if `/api/me` returns `401`, client calls `POST /api/auth/refresh` (refresh token from cookie or body).
- Refresh handler verifies refresh JWT with `verifyRefreshToken`, checks user still exists, **revokes old refresh token** (`revokeRefreshToken`), issues new access + refresh, updates cookies.
- While authenticated, a **45-minute interval** calls `refreshSession()` to reduce expiry interruptions.
- `authedFetch` retries once after refresh on `401`.

**Note:** Revoked refresh tokens are tracked in-memory (`globalThis.__revokedRefreshTokens` in `auth.ts`) — adequate for dev/single instance; production often uses a DB denylist or rotating refresh with storage.

## Logout

| Piece | Location |
| --- | --- |
| API | `src/app/api/auth/logout/route.ts` |
| Client | `AuthContext.logout()` |

**API behavior:**

1. Reads `refreshToken` from JSON body or cookie.
2. `revokeRefreshToken(refreshToken)` so it cannot be reused.
3. `clearAuthCookies` — sets `accessToken` and `refreshToken` cookies to empty with `maxAge: 0`.

**Client:** `logout()` calls `POST /api/auth/logout` with `credentials: "include"`, then sets `user` to `null` and `status` to `unauthenticated`.

**Legacy route:** `src/app/logout/page.tsx` may redirect — check if present for deep links.

## Authorization on API routes

| Piece | Location |
| --- | --- |
| Read user | `getUserFromRequest(request)` in `src/lib/utils/auth.ts` — `Authorization: Bearer` **or** `accessToken` cookie |
| Protect routes | `withAuth` / `requireUser` in `src/lib/protect.ts` |

## Summary

Login sets cookies and hydrates user via `/api/me`. Refresh + periodic refresh keep the session alive without re-entering password. Logout revokes the refresh token and clears cookies, which is the core of “seamless” and secure sign-out.

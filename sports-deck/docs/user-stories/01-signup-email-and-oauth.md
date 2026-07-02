# User story: Sign up with email/password or Google/GitHub

**Story:** As a user, I want to sign up using my email and password or through a major third-party authentication provider like Google or GitHub.

## Overview

The app (`sports-deck`) is a Next.js application. Registration uses two paths:

1. **Email + password** — `POST /api/auth/register` creates a `User` row with a bcrypt-hashed password and issues JWTs.
2. **OAuth (Google or GitHub)** — Browser hits `GET /api/auth/oauth/{provider}/start`, the user authorizes at the provider, then `GET /api/auth/oauth/{provider}/callback` exchanges the code, creates or links a user, and sets the same JWT cookies as password login.

## Data model (Prisma)

Relevant fields on `User` (`prisma/schema.prisma`):

- `email` — unique; required for email signup.
- `username` — unique; auto-generated from email if omitted at registration.
- `password` — bcrypt hash (OAuth users get a placeholder hash).
- `authProvider` / `authProviderUserId` — set for OAuth-linked accounts; `@@unique([authProvider, authProviderUserId])`.
- `displayName`, `role` (default `USER`).

## Email/password registration

| Piece | Location |
| --- | --- |
| API | `src/app/api/auth/register/route.ts` |
| Client | `src/app/login/LoginClient.tsx` — signup form calls `useAuth().register()` |
| Context | `src/contexts/AuthContext.tsx` — `register()` → `POST /api/auth/register` with `credentials: "include"`, then loads `/api/me` |

**Validation (server):** Email regex, password min 8 chars, optional username `^[a-zA-Z0-9_-]+$` length 2–30, optional `displayName` max 100 chars. Conflicts return `409` for duplicate email or username.

**After success:** Response JSON includes `user`, `accessToken`, `refreshToken`; `setAuthCookies()` writes httpOnly cookies (`src/lib/utils/authCookies.ts`). Same session model as login.

## OAuth: start flow

| Piece | Location |
| --- | --- |
| Route | `src/app/api/auth/oauth/[provider]/start/route.ts` |
| Config | `src/lib/utils/oauth.ts` — `resolveOAuthConfig()`, env vars |

**Flow:**

1. Validates `provider` is `google` or `github` (`isOAuthProvider`).
2. Builds OAuth `state` (includes optional `next` path) and stores it in cookie `oauth_state_{provider}`.
3. Redirects to Google (`accounts.google.com/o/oauth2/v2/auth`) or GitHub (`github.com/login/oauth/authorize`) with `client_id`, `redirect_uri`, `scope`, etc.

**Environment (examples):**

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_REDIRECT_URI`.
- GitHub: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, optional `GITHUB_REDIRECT_URI`.

## OAuth: callback

| Piece | Location |
| --- | --- |
| Route | `src/app/api/auth/oauth/[provider]/callback/route.ts` |
| Avatar sync | `src/lib/utils/oauthAvatar.ts` — `syncUserAvatarFromOAuthUrl` |
| Username helpers | `src/lib/utils/authUsers.ts` — `generateUniqueUsernameFromValue`, placeholder password |

**Flow:**

1. Validates `state` against cookie; exchanges `code` for access token (Google: `oauth2.googleapis.com/token`; GitHub: `github.com/login/oauth/access_token`).
2. Fetches profile: Google OpenID userinfo; GitHub `/user` (+ `/user/emails` if email missing).
3. Finds existing user by `(authProvider, authProviderUserId)` or links by **email** if the email already exists (updates `authProvider` fields).
4. If new user: creates row with generated unique username, hashed placeholder password, `authProvider` enum.
5. Syncs avatar from provider picture URL into `Media` / user avatar.
6. Issues `generateToken` / `generateRefreshToken` (`src/lib/utils/auth.ts`), `setAuthCookies`, redirects to `next` path.

## UI entry points

- **Login/signup page:** `src/app/login/page.tsx` → `LoginClient.tsx`
- OAuth buttons call `startOAuth("google" | "github")` → navigates to `/api/auth/oauth/{provider}/start?next=...`

## Related APIs (not signup-specific)

- Tokens use `JWT_SECRET` / `JWT_REFRESH_SECRET` (`src/lib/utils/jwtConfig.ts`).
- OpenAPI/Swagger JSDoc on register route documents the contract.

## Summary

Email signup is a single POST that sets cookies and authenticates the session. OAuth reuses the same JWT cookie strategy after the provider callback, so the client experience (cookies + `/api/me`) matches password users.

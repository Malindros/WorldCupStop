# User story: Edit profile (username, avatar, favorite team) with JWT

**Story:** As a user, I want to edit my profile, including my username, avatar (or profile picture), and favorite team from the league. Authentication should be implemented using a proper JWT setup.

## Overview

Profile fields live on `User` in Prisma: `username`, `displayName` (shown in UI; distinct from username), `favoriteTeamId` → `Team`, `avatarMediaId` → `Media`.

**JWT** identifies the caller on every protected API: access token in httpOnly cookie (or `Authorization: Bearer`) is verified by `getUserFromRequest` → `verifyToken` (`src/lib/utils/auth.ts`). Profile routes use `requireUser` (`src/lib/protect.ts`) so only valid JWTs can update the profile.

## GET current user (for editing UI state)

| API | `GET /api/me` — `src/app/api/me/route.ts` |

Returns: `id`, `email`, `username`, `displayName`, `role`, `favoriteTeamId`, `avatar` `{ id, url, altText }`, ban fields, `createdAt`.

## PATCH profile (username, display name, favorite team)

| API | `PATCH /api/me` — exported as `requireUser` handler in `src/app/api/me/route.ts` |
| Client helpers | `src/components/profile/api.ts` — `patchMeProfile()` |
| Form UI | `src/components/profile/ProfileEditForm.tsx` |
| Page | `src/app/profile/edit/page.tsx` → `EditProfileClient.tsx` |

**Server validation:**

- `username` — shared rules with `src/lib/validation/profileFields.ts` (`isValidUsername`); uniqueness excluding self (`409` if taken).
- `displayName` — optional clear to `null`; max length `DISPLAYNAME_MAX_LENGTH`.
- `favoriteTeamId` — `null` or empty disconnects team; otherwise must exist in `Team` table.

**Important:** Changing `username` does **not** automatically re-issue JWTs in this codebase — the JWT payload still contains the **old** username until the next login/refresh. APIs that identify users by `getUserFromRequest()` use **`id`** from the verified token (`AuthUser.id`), so authorization remains correct. Any code that compares `payload.username` to the DB could be stale until refresh; the `/api/auth/refresh` path reloads user from DB by `payload.username` — after a username change, refresh might fail until re-login if username is used as the refresh lookup key. **Verify in `refresh/route.ts`:** it finds user with `where: { username: payload.username }` — so after username change, **refresh token may break until a new login** issues tokens with the new username. This is an edge case to be aware of when studying the implementation.

## Avatar upload and removal

| API POST | `POST /api/me/avatar` — `src/app/api/me/avatar/route.ts` |
| API DELETE | `DELETE /api/me/avatar` — same file |

**Upload:**

- `multipart/form-data` field `file` or `avatar`.
- Max 5MB; types JPEG, PNG, GIF, WebP.
- Saves under `public/avatars/{userId}-{timestamp}.{ext}`, creates `Media` row, updates `User.avatarMediaId`, deletes previous `Media` and file if replaced.

**Client:** `ProfileEditForm` uses file input → optional `AvatarCropModal` (`cropImage.ts`) → `uploadMeAvatar` / `deleteMeAvatar`. After upload, `refreshUser()` from `AuthContext` syncs client state.

## Favorite team picker

- Teams list: `GET /api/teams` — `fetchTeamsForProfile()` in `src/components/profile/api.ts`.
- UI: `TeamSelectWithCrest.tsx`, `TeamCrestThumb.tsx` for crest display.

## JWT configuration (environment)

| File | `src/lib/utils/jwtConfig.ts` |

- `JWT_SECRET` — signs **access** tokens (`JWT_ACCESS_MAX_AGE_SEC` = 900s).
- `JWT_REFRESH_SECRET` — signs **refresh** tokens (`JWT_REFRESH_MAX_AGE_SEC` = 3600s).

Tokens store `{ id, username, role }` — see `generateToken` in `auth.ts`.

## Components checklist

| Component | Role |
| --- | --- |
| `ProfileEditForm.tsx` | Main form: username, display name, team, avatar |
| `UsernameChangeConfirmModal.tsx` | Confirms username change before PATCH |
| `RemoveAvatarConfirmModal.tsx` | Confirms avatar delete |
| `UnsavedChangesDialogBlocker.tsx` | Blocks navigation with unsaved edits |
| `EditProfileClient.tsx` | Wraps form with auth + profile load |

## Summary

Profile editing is implemented as authenticated REST endpoints (`/api/me`, `/api/me/avatar`) guarded by JWT verification. The edit UI is client-side in the profile package, with team data from `/api/teams` and avatar files stored on disk under `public/avatars`.

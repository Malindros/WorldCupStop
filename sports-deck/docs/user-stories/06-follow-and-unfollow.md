# User story: Follow and unfollow other users

**Story:** As a user, I want to follow/unfollow other users to keep up with their activity.

## Data model

| File | `prisma/schema.prisma` — `Follow` model |

- `followerId` — the user who follows.
- `followeeId` — the user being followed.
- `createdAt` — used for ordering lists (newest first).
- `@@unique([followerId, followeeId])` — one edge per pair.

User relations: `followers` / `following` on `User`.

## API

| Method | Path | File |
| --- | --- | --- |
| `POST` | `/api/users/{id}/follow` | `src/app/api/users/[id]/follow/route.ts` |
| `DELETE` | `/api/users/{id}/follow` | same |

**POST (follow):**

- `requireUser` — must be logged in.
- `ensureUserNotBanned` — banned users cannot follow (`403` with message).
- Cannot follow self (`400`).
- Validates followee exists (`404`).
- Idempotent: if already following, returns `200` `{ message: "Already following", follow: true }`.
- Otherwise creates `Follow` and returns `201`.

**DELETE (unfollow):**

- Removes `Follow` where `followerId = currentUser`, `followeeId = path id`.
- Returns `200` even after delete (idempotent deleteMany).

**Auth:** JWT via cookie or Bearer (`getUserFromRequest` inside `requireUser`).

## Client helpers

| File | `src/components/profile/api.ts` |

- `followUser(userId, authedFetch)` → POST
- `unfollowUser(userId, authedFetch)` → DELETE

Uses `authedFetch` from `AuthContext` so 401 triggers refresh retry.

## UI: profile follow button

| File | `src/components/profile/ProfileFollowButton.tsx` |

- Props include `viewerFollows` from `GET /api/users/by-username/...` (whether current user follows this profile).
- Not logged in: shows **Sign in to follow** linking to `/login?next=/profile/...`.
- Logged in: toggles Follow / Following with loading and error states; calls `onFollowChanged` to refetch profile counts.

## Feed integration

Following a user affects **`/api/me/feed`** — it includes posts from users in `follow` where `followerId = me`. See personalized feed user story doc.

## Summary

Follow/unfollow is a simple `Follow` row create/delete behind authenticated REST endpoints. The profile button is the primary UX entry point; lists of who you follow are on the connections pages.

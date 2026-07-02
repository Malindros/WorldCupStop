# User story: Visitor views a user profile (followers, team, threads, posts, replies)

**Story:** As a visitor, I want to check out a user's profile page, which includes the number of followings, followers, associated team, and a list of threads, posts, and replies.

## Routing

| File | `src/app/profile/[id]/page.tsx` |

The dynamic segment is named `id` but the code treats it as a **username** (`decodeURIComponent(id)`), not numeric id.

## Main client orchestrator

| File | `src/components/profile/ProfileClient.tsx` |

- Fetches `GET /api/users/by-username/{username}` with `credentials: "include"` (so logged-in users get `isSelf`, `viewerFollows`, ban info).
- If `data.isSelf` → `SelfProfileView`; else → `PublicProfileView`.
- Uses `fetchProfileByUsername` from `src/components/profile/api.ts`.

## API: consolidated profile by username

| File | `src/app/api/users/by-username/[username]/route.ts` |

Returns:

- **user** — `id`, `username`, `displayName`, `createdAt`, `favoriteTeamId`, `favoriteTeam` (with `crest` for UI), `avatar`, **`followersCount`**, **`followingsCount`**, **`threadsCount`**, **`postsCount`** (from Prisma `_count`).
- **isSelf** — true if JWT user id matches profile id.
- **viewerFollows** — if authenticated and not self, whether a `Follow` row exists.
- **ban** — optional ban/appeal metadata for self or admin.

## API: additional public endpoints (used by activity section)

These do **not** require auth:

| Endpoint | File | Purpose |
| --- | --- | --- |
| `GET /api/users/{id}` | `src/app/api/users/[id]/route.ts` | Alternative JSON profile by **numeric** id (counts + team + avatar) |
| `GET /api/users/{id}/threads` | `src/app/api/users/[id]/threads/route.ts` | Threads **authored** by user (visible threads only) |
| `GET /api/users/{id}/posts` | `src/app/api/users/[id]/posts/route.ts` | Posts and replies by user (non-hidden, visible threads) |

The profile UI uses **username** route first; threads/posts loaders use **numeric** `userId` from that response.

## UI: summary card (counts + team)

| File | `src/components/profile/ProfileSummaryCard.tsx` |

Displays:

- Avatar or `ProfileAvatarFallback`
- `@username`, `displayName`, **favorite team** with `TeamCrestThumb`
- **Stat tiles** — followers count, following count, threads count, posts count; on own profile, follower/following tiles link to `/connections/followers` and `/connections/following` (`SelfProfileView` passes `followersLinkHref` / `followingLinkHref`).

## UI: follow button (visitor)

| File | `src/components/profile/ProfileFollowButton.tsx` |

Shown on `PublicProfileView` when viewing someone else. Prompts login or calls follow/unfollow APIs (covered in follow user story doc).

## UI: threads, posts, and replies lists

| File | `src/components/profile/ProfileCommunityAndActivity.tsx` | Layout: main column + activity chart sidebar |
| File | `src/components/profile/ProfileActivitySection.tsx` | **Community** section |

`ProfileActivitySection`:

- Parallel fetch: `fetchUserThreadsForProfile(userId)` → `/api/users/{id}/threads?limit=24`, `fetchUserPostsForProfile(userId)` → `/api/users/{id}/posts?limit=80`.
- **Tabs:** **Threads** — thread cards with kind (Match / Team / League), links via `threadHref(slug, id)`.
- **Posts** — top-level posts in threads (`!isReply && thread`).
- **Replies** — replies (`isReply && thread`), rendered as `PostActivityCard` with snippet and link to thread.

Thread ordering on the API includes special sorting for match threads (`threadVisibility` helpers).

## Types

| File | `src/components/profile/types.ts` |

Defines `ProfileUser`, `ProfileActivityThread`, `ProfileActivityPost`, etc., aligned with API shapes.

## Summary

Visitors open `/profile/{username}`. The page loads one consolidated by-username API for counts and team, then loads threads and posts from user-scoped list endpoints. Followers/following **counts** are on the summary card; **full lists** are on separate connections pages (authenticated) or could be built from `/api/users/{id}/followers` and `/following` for public programmatic access.

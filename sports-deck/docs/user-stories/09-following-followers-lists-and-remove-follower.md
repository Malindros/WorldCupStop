# User story: Following and followers lists (sorted by follow time) and remove follower

**Story:** As a user, I want to view a list of users I am following and a list of users who are following me. I also want to remove a follower that I do not like. The lists should be sorted by the time the follow action occurred.

## Sort order (server)

All list endpoints use **`orderBy: { createdAt: "desc" }`** on the `Follow` model — **newest follow relationships first** (the `Follow.createdAt` timestamp is when the follow action occurred).

## APIs for the current user (“my” lists)

| Endpoint | File | Response |
| --- | --- | --- |
| `GET /api/me/following` | `src/app/api/me/following/route.ts` | `{ following: [{ user, followedAt }] }` |
| `GET /api/me/followers` | `src/app/api/me/followers/route.ts` | `{ followers: [{ user, followedAt }] }` |
| `DELETE /api/me/followers/{id}` | `src/app/api/me/followers/[id]/route.ts` | Remove user `{id}` as follower of me |

**Auth:** All require `requireUser` (JWT).

**Following list:** `Follow` where `followerId = currentUser.id`, includes `followee` user fields + avatar.

**Followers list:** `Follow` where `followeeId = currentUser.id`, includes `follower` user fields + avatar.

**Remove follower:** `deleteMany` where `followeeId = currentUser.id` and `followerId = path id`. If zero rows, `404` `"User is not following you"`.

## Public APIs by profile id (same sort)

Useful for arbitrary profiles (no auth):

| Endpoint | File |
| --- | --- |
| `GET /api/users/{id}/following` | `src/app/api/users/[id]/following/route.ts` |
| `GET /api/users/{id}/followers` | `src/app/api/users/[id]/followers/route.ts` |

Same `orderBy: { createdAt: "desc" }` and same response shape (array with `followedAt`).

## UI: connections pages

| Route | File |
| --- | --- |
| `/connections/following` | `src/app/connections/following/page.tsx` |
| `/connections/followers` | `src/app/connections/followers/page.tsx` |

Both gate on `useAuth` — unauthenticated users redirect to login with `next` preserved.

| Component | `src/components/connections/ConnectionsPage.tsx` |
| Variant prop | `"following"` \| `"followers"` |

**Behavior:**

- Loads `fetchMyFollowing` / `fetchMyFollowers` from `src/components/connections/api.ts` (wrappers around `/api/me/...`).
- **Following** tab: each row has **Unfollow** → `unfollowUser` from `src/components/profile/api.ts` (DELETE `/api/users/{id}/follow`).
- **Followers** tab: each row has **Remove** → `removeFollower` → DELETE `/api/me/followers/{id}`; confirmation via `AlertDialog` (`@/components/ui/alert-dialog`).

**Copy:** Headers state “newest first” to match sort.

## Links from profile

| File | `src/components/profile/SelfProfileView.tsx` |

`ProfileSummaryCard` receives `followersLinkHref="/connections/followers"` and `followingLinkHref="/connections/following"` so stat tiles navigate to these lists.

## Types

| File | `src/components/connections/types.ts` |

`ConnectionEntry` aligns with `{ user, followedAt }` from API.

## Summary

**Follow time** is `Follow.createdAt`. Lists are **descending** (most recent relationships first). Authenticated users manage lists at `/connections/*`; remove follower is only available to the followee via `DELETE /api/me/followers/{followerUserId}`.

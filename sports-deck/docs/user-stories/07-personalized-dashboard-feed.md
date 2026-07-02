# User story: Personalized activity feed on the dashboard

**Story:** As a user, I want a personalized activity feed on my dashboard that shows recent posts and comments to my posts, or from the users I follow, as well as recent updates for my favorite team, including new match scores and new threads in the team's forum.

## Where the dashboard lives

| File | `src/app/page.tsx` |

- If `useAuth().status !== "authenticated"` → `PublicHome`.
- If authenticated → `DashboardHub` (`src/components/dashboard/DashboardHub.tsx`).

`DashboardHub` renders:

1. **Daily digest** section (`DailyDigestSection`) — anchor `id="daily-digest"`.
2. **Activity feed** (`DashboardFeed`) — anchor `id="activity-feed"`.

Legacy routes `src/app/dashboard/page.tsx` and `src/app/feed/page.tsx` redirect to `/` (with hash `#activity-feed` for feed).

## Feed API (server)

| File | `src/app/api/me/feed/route.ts` |
| Auth | `requireUser` — JWT only |

`getFeed(currentUser, limit, offset)`:

1. Loads current user’s **`favoriteTeamId`**.
2. Loads **`followeeIds`** from `Follow` where `followerId = userId`. If none, uses a sentinel `-1` for empty `IN` queries (implementation detail).
3. Runs **four** parallel queries:
   - **Posts from followed users** — `Post` where `authorId IN followeeIds`, `isHidden: false`, newest 30, includes `author`, `thread`.
   - **Comments on my posts** — `Post` where `parentPost.authorId = userId` (reply to user’s post), non-hidden, newest 30, includes `parentPost`, `thread`.
   - **Team matches** — if `favoriteTeamId`: `Match` where home or away team is that team, newest 15 by `startTime`.
   - **Team threads** — if `favoriteTeamId`: `ForumThread` where `teamId` matches and `buildVisibleThreadWhere()` passes, newest 15, includes `team`, `author`.

Then the handler **groups** items (see next doc) and merges into a single list sorted by **timestamp descending**, applies `offset`/`limit` pagination.

**Query params:** `limit` (default 50, max 100), `offset` for pagination.

## Feed UI (client)

| File | `src/components/dashboard/DashboardFeed.tsx` |
| Fetch | `src/components/dashboard/api.ts` — `fetchDashboardFeed(authedFetch, limit, offset)` |

- Initial load: `PAGE_SIZE = 15` items, `offset = 0`.
- **Load more** uses `offset = feed.length` (cumulative skip after merge — matches API pagination on merged list).
- Maps each item to `FeedItemBlock` which renders type-specific cards.

| Card component | Feed item type |
| --- | --- |
| `PostsFromFollowedCard` | `posts_from_followed` |
| `CommentsOnMyPostCard` | `comments_on_my_post` |
| Inline in `DashboardFeed` | `match_update` — score + link to `/matches/{id}` |
| Inline in `DashboardFeed` | `team_thread` — link to thread, “Favorite team · New thread” |

Shared styling: `FeedCard`, `AuthorTag`, `formatFeedTime` from `src/components/dashboard/feed/feedShared.tsx`.

## TypeScript types

| File | `src/components/dashboard/types.ts` |

Defines `FeedItem` union: `FeedItemPostsFromFollowed`, `FeedItemCommentsOnMyPost`, `FeedItemMatchUpdate`, `FeedItemTeamThread`.

## Dependencies

- **Favorite team** must be set in profile for match/thread team sections to populate (`PATCH /api/me` with `favoriteTeamId`).
- **Follows** must exist for the “posts from followed” section to have data.

## Summary

The personalized feed is `GET /api/me/feed`, merging social activity (follows + replies to you) with team-centric data (matches + team forum threads) for your **favorite team**. The home dashboard for authenticated users is the main surface; `DashboardFeed` renders the merged, grouped items with pagination.

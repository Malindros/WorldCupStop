# User story: Feed groups data meaningfully

**Story:** As a user, I want my feed to group the data in a meaningful way so I do not get overwhelmed by a large number of events on a specific post/comment.

## Implementation location

All grouping logic is **server-side** in `src/app/api/me/feed/route.ts` inside `getFeed()`.

After fetching raw rows, the code builds a flat `items` array where **each element is already a group** (or a single match/thread event).

## Grouping 1: Posts from followed users → by thread

**Problem:** Many posts in the same thread would flood the feed.

**Approach:**

1. Build `postsByThread` — `Map<threadId | null, Post[]>` from `postsFromFollowed`.
2. For each thread bucket:
   - Sort posts in that bucket by `createdAt` descending.
   - Emit **one** feed item:
     - `type: "posts_from_followed"`
     - `timestamp` — latest post time in group
     - `postCount` — number of posts in group
     - `thread` — ref to thread (or null for orphan posts)
     - `posts` — up to **5** latest posts with snippets (`content` truncated to 200 chars), author, `isReply`
     - `groupKey: "thread:{threadId}"` for stable identity

**UI:** `PostsFromFollowedCard.tsx` — shows summary (“N posts in …”) and list of snippets.

## Grouping 2: Comments on my posts → by parent post

**Problem:** Many replies to the same post would flood the feed.

**Approach:**

1. Build `commentsByParent` — key = `parentPostId` (fallback `p.id`).
2. For each parent bucket:
   - Sort by time descending.
   - Emit **one** item:
     - `type: "comments_on_my_post"`
     - `timestamp` — latest comment
     - `commentCount`
     - `parentPost` snippet, `thread` ref
     - `comments` — up to **5** snippets
     - `groupKey: "parentPost:{parentId}"`

**UI:** `CommentsOnMyPostCard.tsx`.

## Non-grouped items

- **Match updates** — one `match_update` item per match in the fetched batch (timestamp = `endTime ?? startTime`).
- **Team threads** — one `team_thread` item per thread. Additional **sort** for team threads: prefers threads “within window” (match-related visibility), then `autoCloseAt`, then `updatedAt` — see `isThreadWithinWindow` in `src/lib/utils/threadVisibility.ts`.

## Final ordering

All `items` are sorted by **`timestamp` descending**, then sliced for `offset`/`limit`.

**Swagger comment** in the route file explicitly documents grouping behavior for API consumers.

## Client

The client (`DashboardFeed.tsx`) does **not** regroup; it renders each item as one card. Grouping is entirely API responsibility.

## Summary

The feed avoids duplicate noise by collapsing **many posts in the same thread** (from people you follow) into one card with up to five previews, and **many replies to the same parent post** (your posts) into one card with up to five comment previews. Match and team-thread events stay one row each.

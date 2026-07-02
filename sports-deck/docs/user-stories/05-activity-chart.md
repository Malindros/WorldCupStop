# User story: Activity chart over a time period

**Story:** As a visitor, I want to see the activity chart of a user over a certain period of time. Activity is determined based on the number of posts and comments authored by the user.

## Definition of “activity” (backend)

| File | `src/app/api/users/[id]/activity/route.ts` |

- Loads all **non-hidden** `Post` rows by `authorId` in the requested time window.
- For each post:
  - **`parentPostId == null`** → counts as a **post** (thread top-level post).
  - **`parentPostId != null`** → counts as a **comment** (reply).
- Buckets by **UTC calendar day** (`YYYY-MM-DD`).
- Each day: `postsCount`, `commentsCount`, `totalActivity` (= sum of those two counts for the chart’s “total” height).

## Query parameters

| Param | Meaning |
| --- | --- |
| `days` | Positive integer, default **30**, max **365** — rolling window ending **today UTC** |
| `from` + `to` | ISO dates — alternative to `days`; range capped at 365 days; `from` must be ≤ `to` |

Response JSON:

```json
{
  "activity": [ { "date": "2026-04-01", "postsCount": 0, "commentsCount": 0, "totalActivity": 0 } ],
  "total": 30,
  "from": "...",
  "to": "..."
}
```

Every day in range gets a row (including zeros), sorted by date ascending — ideal for charting.

**Auth:** None — public endpoint.

## Frontend data hook

| File | `src/components/profile/useProfileActivityChart.ts` |

- Calls `fetchUserActivityForProfile(userId, days)` → `GET /api/users/{id}/activity?days={d}` (`src/components/profile/api.ts`).
- Computes `maxTotal` (peak daily total for scaling), `totals` (sum of posts/comments across the range).
- Exposes `reload` for retry.

## Chart UI

| File | `src/components/profile/ProfileCommunityAndActivity.tsx` |

Contains:

1. **`ProfileActivityCompactCard`** — last **7 days** fixed (`COMPACT_PREVIEW_DAYS = 7`), stacked bar SVG (`ActivityChartSvg`), amber = posts, violet = replies, Y-axis scale `CompactActivityScale`.
2. **`ProfileActivityTimelineModal`** — full-screen modal with period toggles: 7d, 30d, 90d, 180d, 365d (`PERIODS` constant). Uses same SVG in `variant="modal"` with x-axis labels for selected indices.

**Inline SVG:** `ActivityChartSvg` draws grid lines, stacked rects per day, hover hit areas, optional date labels in modal.

## Where it appears

- Embedded on **every** profile’s community section (both `PublicProfileView` and `SelfProfileView` use `ProfileCommunityAndActivity`).

## Summary

Activity is **API-driven daily buckets** of posts vs replies. The profile page renders a compact 7-day preview and an explorable modal with longer ranges, all fed by `GET /api/users/{id}/activity`.

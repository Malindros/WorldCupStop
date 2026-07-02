export type ThreadDetail = {
  id: number;
  slug: string | null;
  title: string;
  isHidden: boolean;
  isClosed: boolean;
  isWithinWindow?: boolean;
  matchId: number | null;
  teamId: number | null;
  tags: { id: number; name: string; slug: string }[];
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    avatar: { id: number; url: string; altText: string | null } | null;
  } | null;
};

export type SlugLookup = {
  id: number;
  slug: string | null;
};

export type ThreadPost = {
  id: number;
  parentPostId: number | null;
  isHidden: boolean;
  content: string;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string | null;
  author: {
    id: number;
    username: string;
    avatar: { id: number; url: string; altText: string | null } | null;
  } | null;
};

export type ThreadPostsPage = {
  threadId: number;
  limit: number;
  offset: number;
  // `totalPosts` remains for backward compat and represents the number of root posts (used for pagination)
  totalPosts: number;
  // `totalPostsCount` is the total number of posts in the thread (including replies)
  totalPostsCount?: number;
  posts: ThreadPost[];
};

export type ThreadSentimentTone = "positive" | "negative" | "neutral";

export type ThreadSentimentOverall = {
  sentiment: ThreadSentimentTone;
  score: number; // 0-100
  computedAt: string;
};

export type ThreadSentimentTeam = {
  teamId: number;
  teamName: string | null;
  sentiment: ThreadSentimentTone;
  score: number;
  computedAt: string;
  kind: "home" | "away";
};

export type ThreadSentimentResponse = {
  threadId: number;
  matchId: number | null;
  cache: {
    cached: boolean;
    invalidation: "new-post";
    postCount: number;
    lastPostAt: string | null;
  };
  overall: ThreadSentimentOverall | null;
  teams: ThreadSentimentTeam[];
};

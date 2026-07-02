export type FeedAuthor = {
  id: number;
  username: string;
  displayName: string | null;
};

export type FeedPostSnippet = {
  id: number;
  content?: string;
  createdAt: string;
  /** Missing if author row was removed (rare). */
  author: FeedAuthor | null;
  isReply: boolean;
};

export type FeedCommentSnippet = {
  id: number;
  content?: string;
  createdAt: string;
  author: FeedAuthor | null;
};

export type FeedThreadRef = {
  id: number;
  title: string;
  slug: string | null;
};

export type FeedItemPostsFromFollowed = {
  type: "posts_from_followed";
  timestamp: string;
  id: string;
  groupKey: string;
  postCount: number;
  thread: FeedThreadRef | null;
  posts: FeedPostSnippet[];
};

export type FeedItemCommentsOnMyPost = {
  type: "comments_on_my_post";
  timestamp: string;
  id: string;
  groupKey: string;
  commentCount: number;
  parentPost: { id: number; content: string | null } | null;
  thread: FeedThreadRef | null;
  comments: FeedCommentSnippet[];
};

export type FeedMatchTeam = {
  id: number;
  name: string;
  shortName: string | null;
};

export type FeedItemMatchUpdate = {
  type: "match_update";
  timestamp: string;
  id: string;
  match: {
    id: number;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: FeedMatchTeam;
    awayTeam: FeedMatchTeam;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    startTime: string;
    lastUpdated: string | null;
  };
};

export type FeedItemTeamThread = {
  type: "team_thread";
  timestamp: string;
  id: string;
  thread: {
    id: number;
    title: string;
    slug: string | null;
    team: { id: number; name: string; slug: string | null };
    /** Null for auto-generated / system threads. */
    author: FeedAuthor | null;
    createdAt: string;
  };
};

export type FeedItem =
  | FeedItemPostsFromFollowed
  | FeedItemCommentsOnMyPost
  | FeedItemMatchUpdate
  | FeedItemTeamThread;

export type FeedResponse = {
  feed: FeedItem[];
  hasMore: boolean;
};

export type ForumThreadTag = {
  id: number;
  name: string;
  slug: string;
};

export type ForumThreadTeam = {
  id: number;
  name: string;
  slug: string | null;
};

export type ForumThreadAuthor = {
  id: number;
  username: string;
  avatar: {
    id: number;
    url: string;
    altText: string | null;
  } | null;
} | null;

export type ForumThreadListItem = {
  id: number;
  title: string;
  slug: string | null;
  isHidden: boolean;
  isClosed: boolean;
  isWithinWindow?: boolean;
  createdAt: string;
  updatedAt: string;
  latestActivityAt: string;
  matchId: number | null;
  teamId: number | null;
  team: ForumThreadTeam | null;
  author: ForumThreadAuthor;
  tags: ForumThreadTag[];
  replyCount: number;
};

export type ForumThreadsResponse = {
  threads: ForumThreadListItem[];
  limit?: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
};

export type ForumTag = {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  threadCount: number;
};

export type ForumTagsResponse = {
  tags: ForumTag[];
};

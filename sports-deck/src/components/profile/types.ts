export type ProfileTeamRef = {
  id: number;
  name: string;
  shortName: string | null;
  slug: string | null;
  crest?: string | null;
};

export type ProfileUser = {
  id: number;
  username: string;
  displayName: string | null;
  createdAt: string;
  favoriteTeamId: number | null;
  favoriteTeam: ProfileTeamRef | null;
  avatar: { id: number; url: string; altText: string | null } | null;
  followersCount: number;
  followingsCount: number;
  threadsCount: number;
  postsCount: number;
};

export type ProfileBanState = {
  id: number;
  reason: string;
  createdAt: string;
  until: string | null;
  bannedBy: { id: number; username: string } | null;
  isActive: boolean;
  pendingAppeal: { id: number; createdAt: string } | null;
  latestRejectedAppeal: { id: number; createdAt: string } | null;
  nextAllowedAppealAt: string | null;
  canSubmitAppeal: boolean;
};

export type ProfileByUsernameResponse = {
  user: ProfileUser;
  isSelf: boolean;
  ban: ProfileBanState | null;
  /** Whether the current session follows this profile; null if logged out or viewing own profile. */
  viewerFollows: boolean | null;
};

/** Thread row from GET /api/users/:id/threads */
export type ProfileActivityThread = {
  id: number;
  title: string;
  slug: string | null;
  teamId: number | null;
  matchId: number | null;
  team: { id: number; name: string; slug: string | null } | null;
  isClosed: boolean;
  postCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Post row from GET /api/users/:id/posts */
export type ProfileActivityPost = {
  id: number;
  threadId: number | null;
  parentPostId: number | null;
  content: string;
  language: string | null;
  isReply: boolean;
  thread: {
    id: number;
    title: string;
    slug: string | null;
    isClosed: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
};

/** Daily bucket from GET /api/users/:id/activity */
export type ProfileActivityDayBucket = {
  date: string;
  postsCount: number;
  commentsCount: number;
  totalActivity: number;
};

export type ProfileActivityChartResponse = {
  activity: ProfileActivityDayBucket[];
  total: number;
  from: string;
  to: string;
};

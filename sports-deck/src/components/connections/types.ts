export type ConnectionUser = {
  id: number;
  username: string;
  displayName: string | null;
  avatar: { id: number; url: string; altText: string | null } | null;
};

export type ConnectionEntry = {
  user: ConnectionUser;
  /** ISO timestamp of when the follow relationship was created (newest-first from API). */
  followedAt: string;
};

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "./api";

type ProfileFollowButtonProps = {
  profileUserId: number;
  profileUsername: string;
  /** When logged in and viewing another user: whether you follow them. */
  viewerFollows: boolean | null;
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  isAuthenticated: boolean;
  onFollowChanged: () => void | Promise<void>;
};

export default function ProfileFollowButton({
  profileUserId,
  profileUsername,
  viewerFollows,
  authedFetch,
  isAuthenticated,
  onFollowChanged,
}: ProfileFollowButtonProps) {
  const [following, setFollowing] = useState(viewerFollows === true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (viewerFollows !== null) {
      setFollowing(viewerFollows);
    }
  }, [viewerFollows]);

  const loginHref = `/login?next=${encodeURIComponent(`/profile/${encodeURIComponent(profileUsername)}`)}`;

  const toggle = useCallback(async () => {
    if (!isAuthenticated) return;
    setPending(true);
    setError(null);
    try {
      if (following) {
        await unfollowUser(profileUserId, authedFetch);
        setFollowing(false);
      } else {
        await followUser(profileUserId, authedFetch);
        setFollowing(true);
      }
      await onFollowChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }, [following, isAuthenticated, profileUserId, authedFetch, onFollowChanged]);

  if (!isAuthenticated) {
    return (
      <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
        <Button variant="default" size="lg" className="w-full gap-2 sm:w-auto" asChild>
          <Link href={loginHref}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Sign in to follow
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground sm:text-right">
          Follow @{profileUsername} to see their activity in your feed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
      <Button
        type="button"
        variant={following ? "outline" : "default"}
        size="lg"
        className="w-full gap-2 sm:w-auto"
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={following}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : following ? (
          <UserMinus className="h-4 w-4" aria-hidden />
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden />
        )}
        {pending ? "Please wait…" : following ? "Following" : "Follow"}
      </Button>
      {error ? <p className="text-center text-xs text-destructive sm:text-right">{error}</p> : null}
    </div>
  );
}

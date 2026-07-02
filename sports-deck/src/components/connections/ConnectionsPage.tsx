"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, UserMinus, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ProfileAvatarFallback from "@/components/profile/ProfileAvatarFallback";
import { unfollowUser } from "@/components/profile/api";
import { formatFeedTime } from "@/components/dashboard/feed/feedShared";
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";
import { fetchMyFollowers, fetchMyFollowing, removeFollower } from "./api";
import type { ConnectionEntry, ConnectionUser } from "./types";

type Variant = "following" | "followers";

function ConnectionRow({
  entry,
  variant,
  onUnfollow,
  onRemoveClick,
  busyUserId,
}: {
  entry: ConnectionEntry;
  variant: Variant;
  onUnfollow: (user: ConnectionUser) => void;
  onRemoveClick: (user: ConnectionUser) => void;
  busyUserId: number | null;
}) {
  const { user, followedAt } = entry;
  const profileHref = `/profile/${encodeURIComponent(user.username)}`;
  const busy = busyUserId === user.id;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        "border-l-4 border-l-primary/70 bg-gradient-to-br from-card to-muted/15",
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <Link
          href={profileHref}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted"
          aria-label={`View ${user.username}'s profile`}
        >
          {user.avatar?.url ? (
            <Image
              src={user.avatar.url}
              alt={user.avatar.altText || user.username}
              width={56}
              height={56}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <ProfileAvatarFallback username={user.username} displayName={user.displayName} size="md" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="block truncate text-base font-semibold text-foreground hover:underline">
            @{user.username}
          </Link>
          {user.displayName ? (
            <p className="truncate text-sm text-muted-foreground">{user.displayName}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {variant === "followers" ? (
              <>
                Followed you · <time dateTime={followedAt}>{formatFeedTime(followedAt)}</time>
              </>
            ) : (
              <>
                You followed · <time dateTime={followedAt}>{formatFeedTime(followedAt)}</time>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        {variant === "following" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onUnfollow(user)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserMinus className="h-4 w-4" aria-hidden />}
            Unfollow
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => onRemoveClick(user)}
          >
            <UserX className="h-4 w-4" aria-hidden />
            Remove
          </Button>
        )}
      </div>
    </article>
  );
}

function ConnectionsTabs({ variant }: { variant: Variant }) {
  return (
    <nav aria-label="Switch between following and followers" className="mb-6 flex w-full max-w-md rounded-full border border-border bg-muted/40 p-1">
      <Link
        href="/connections/following"
        aria-current={variant === "following" ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-center text-sm font-medium transition-colors",
          variant === "following"
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Following
      </Link>
      <Link
        href="/connections/followers"
        aria-current={variant === "followers" ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-center text-sm font-medium transition-colors",
          variant === "followers"
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Followers
      </Link>
    </nav>
  );
}

export default function ConnectionsPage({ variant }: { variant: Variant }) {
  const { authedFetch, status } = useAuth();
  const [items, setItems] = useState<ConnectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ConnectionUser | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      setLoading(true);
      setError(null);
      const data =
        variant === "following" ? await fetchMyFollowing(authedFetch) : await fetchMyFollowers(authedFetch);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load list");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, status, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnfollow = async (user: ConnectionUser) => {
    try {
      setBusyUserId(user.id);
      await unfollowUser(user.id, authedFetch);
      setItems((prev) => prev.filter((e) => e.user.id !== user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unfollow");
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      setBusyUserId(removeTarget.id);
      await removeFollower(removeTarget.id, authedFetch);
      setItems((prev) => prev.filter((e) => e.user.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove follower");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="relative isolate overflow-hidden p-4 pb-16 sm:p-8">
      <DecorativeSportsIconsBackground />
      <div className="relative z-10 mx-auto w-full max-w-2xl">
      <header className="mb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">People</h1>
            <p className="text-sm text-muted-foreground">
              {variant === "following"
                ? "Accounts you follow, newest first."
                : "Who follows you, newest first."}
            </p>
          </div>
        </div>
      </header>

      <ConnectionsTabs variant={variant} />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
          <Button type="button" variant="link" className="ml-2 h-auto p-0 text-destructive underline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span>Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/70" aria-hidden />
          <p className="mt-4 text-base font-medium text-foreground">
            {variant === "following" ? "You are not following anyone yet" : "No followers yet"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {variant === "following"
              ? "Discover people on threads and match discussions, then follow to see them here."
              : "When others follow you, they will appear here in order of when they followed."}
          </p>
          <Button asChild className="mt-6" variant="secondary">
            <Link href="/threads">Browse threads</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3" aria-busy={loading}>
          {items.map((entry) => (
            <li key={entry.user.id}>
              <ConnectionRow
                entry={entry}
                variant={variant}
                onUnfollow={handleUnfollow}
                onRemoveClick={setRemoveTarget}
                busyUserId={busyUserId}
              />
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent size="default" className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove follower?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget ? (
                <>
                  <span className="font-medium text-foreground">@{removeTarget.username}</span> will no longer follow you.
                  They can follow you again later if they choose.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyUserId !== null}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busyUserId !== null}
              onClick={() => void confirmRemove()}
            >
              {busyUserId !== null && removeTarget && busyUserId === removeTarget.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

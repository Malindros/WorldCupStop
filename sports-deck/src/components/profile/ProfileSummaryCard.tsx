import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProfileUser } from "./types";
import ProfileAvatarFallback from "./ProfileAvatarFallback";
import TeamCrestThumb from "./TeamCrestThumb";
import { cn } from "@/lib/utils";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function StatTile({
  label,
  value,
  href,
  ariaLabel,
}: {
  label: string;
  value: number;
  href?: string;
  /** Used when `href` is set (screen reader hint for the link). */
  ariaLabel?: string;
}) {
  const className = cn(
    "rounded-xl border border-border bg-background p-3",
    href &&
      "block transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  const inner = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel ?? `${label}: ${value}`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export default function ProfileSummaryCard({
  profile,
  headerRight,
  followersLinkHref,
  followingLinkHref,
}: {
  profile: ProfileUser;
  headerRight?: ReactNode;
  /** When set (e.g. on your own profile), the Followers tile links to this URL. */
  followersLinkHref?: string;
  /** When set, the Following tile links to this URL. */
  followingLinkHref?: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {profile.avatar?.url ? (
              <Image src={profile.avatar.url} alt={profile.username} width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <ProfileAvatarFallback
                username={profile.username}
                displayName={profile.displayName}
                teamId={profile.favoriteTeam?.id ?? null}
                teamCrestUrl={profile.favoriteTeam?.crest ?? null}
                size="lg"
              />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">@{profile.username}</h1>
            {profile.displayName ? <p className="text-sm text-muted-foreground">{profile.displayName}</p> : null}
            {profile.favoriteTeam ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">Favorite team</span>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <TeamCrestThumb crestUrl={profile.favoriteTeam.crest} label={profile.favoriteTeam.name} size="md" />
                <span className="font-medium text-foreground">
                  {profile.favoriteTeam.shortName || profile.favoriteTeam.name}
                </span>
              </div>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">Joined {formatDate(profile.createdAt)}</p>
          </div>
        </div>
        {headerRight ? <div className="w-full shrink-0 lg:max-w-xs lg:pt-0.5">{headerRight}</div> : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Followers"
          value={profile.followersCount}
          href={followersLinkHref}
          ariaLabel={`Followers: ${profile.followersCount}. Open your followers list.`}
        />
        <StatTile
          label="Following"
          value={profile.followingsCount}
          href={followingLinkHref}
          ariaLabel={`Following: ${profile.followingsCount}. Open people you follow.`}
        />
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Threads</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{profile.threadsCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Posts & replies</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{profile.postsCount}</p>
        </div>
      </div>
    </section>
  );
}

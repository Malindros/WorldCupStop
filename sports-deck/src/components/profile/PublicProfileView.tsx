import ProfileCommunityAndActivity from "./ProfileCommunityAndActivity";
import ProfileFollowButton from "./ProfileFollowButton";
import ProfileSummaryCard from "./ProfileSummaryCard";
import { AlertTriangle } from "lucide-react";
import type { ProfileBanState, ProfileUser } from "./types";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

type PublicProfileViewProps = {
  profile: ProfileUser;
  ban: ProfileBanState | null;
  isAdminViewer: boolean;
  viewerFollows: boolean | null;
  isAuthenticated: boolean;
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onProfileUpdated: () => void | Promise<void>;
};

export default function PublicProfileView({
  profile,
  ban,
  isAdminViewer,
  viewerFollows,
  isAuthenticated,
  authedFetch,
  onProfileUpdated,
}: PublicProfileViewProps) {
  const showAdminBanBanner = isAdminViewer && Boolean(ban?.isActive);

  return (
    <div className="space-y-6">
      {showAdminBanBanner ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-3 text-2xl font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-8 w-8" />
              This user is banned.
            </p>
            <p className="text-sm text-red-800 dark:text-red-200">
              Reason: <span className="font-medium">{ban?.reason}</span>
            </p>
            <p className="text-sm text-red-800 dark:text-red-200">Ban date: {formatDate(ban?.createdAt)}</p>
            <p className="text-sm text-red-800 dark:text-red-200">Banned until: {formatDate(ban?.until)}</p>
            <p className="text-sm text-red-800 dark:text-red-200">Banned by: {ban?.bannedBy?.username || "Unknown"}</p>
          </div>
        </section>
      ) : null}

      <ProfileSummaryCard
        profile={profile}
        headerRight={
          <ProfileFollowButton
            profileUserId={profile.id}
            profileUsername={profile.username}
            viewerFollows={viewerFollows}
            authedFetch={authedFetch}
            isAuthenticated={isAuthenticated}
            onFollowChanged={onProfileUpdated}
          />
        }
      />

      <ProfileCommunityAndActivity
        userId={profile.id}
        username={profile.username}
        threadsTotal={profile.threadsCount}
        postsTotal={profile.postsCount}
      />
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileCommunityAndActivity from "./ProfileCommunityAndActivity";
import ProfileSummaryCard from "./ProfileSummaryCard";
import type { ProfileBanState, ProfileUser } from "./types";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

type SelfProfileViewProps = {
  profile: ProfileUser;
  ban: ProfileBanState | null;
  successMessage: string | null;
  onOpenAppeal: () => void;
};

export default function SelfProfileView({
  profile,
  ban,
  successMessage,
  onOpenAppeal,
}: SelfProfileViewProps) {
  const showBanBanner = Boolean(ban?.isActive);

  return (
    <>
      {showBanBanner ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-3 text-2xl font-bold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-8 w-8" />
                You are banned.
              </p>
              <p className="text-sm text-red-800 dark:text-red-200">
                Reason: <span className="font-medium">{ban?.reason}</span>
              </p>
              <p className="text-sm text-red-800 dark:text-red-200">Ban date: {formatDate(ban?.createdAt)}</p>
              <p className="text-sm text-red-800 dark:text-red-200">Banned until: {formatDate(ban?.until)}</p>

              {ban?.pendingAppeal ? (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Appeal pending review since {formatDate(ban.pendingAppeal.createdAt)}.
                </p>
              ) : null}

              {!ban?.pendingAppeal && !ban?.canSubmitAppeal && ban?.latestRejectedAppeal && ban?.nextAllowedAppealAt ? (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Your last appeal was rejected. You can submit another appeal on {formatDate(ban.nextAllowedAppealAt)}.
                </p>
              ) : null}

              {successMessage ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{successMessage}</p> : null}
            </div>

            <div className="sm:pt-1">
              <Button onClick={onOpenAppeal} disabled={!ban?.canSubmitAppeal}>
                Submit Appeal
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        <ProfileSummaryCard
          profile={profile}
          followersLinkHref="/connections/followers"
          followingLinkHref="/connections/following"
          headerRight={
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
              <Button variant="default" size="lg" asChild className="w-full gap-2 sm:w-auto">
                <Link href="/profile/edit">
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit profile
                </Link>
              </Button>
            </div>
          }
        />

        <ProfileCommunityAndActivity
          userId={profile.id}
          username={profile.username}
          threadsTotal={profile.threadsCount}
          postsTotal={profile.postsCount}
        />
      </div>
    </>
  );
}

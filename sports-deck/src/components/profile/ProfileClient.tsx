"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfileByUsername, submitBanAppeal } from "./api";
import SubmitAppealModal from "./SubmitAppealModal";
import type { ProfileByUsernameResponse } from "./types";
import SelfProfileView from "./SelfProfileView";
import PublicProfileView from "./PublicProfileView";
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";

export default function ProfileClient({ username }: { username: string }) {
  const { authedFetch, user, status } = useAuth();
  const isAuthenticated = status === "authenticated";
  const [data, setData] = useState<ProfileByUsernameResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await fetchProfileByUsername(username);
      setData(profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [username]);

  /** Re-fetch profile without full-page loading state (after inline edits). */
  const reloadProfile = useCallback(async () => {
    try {
      const profile = await fetchProfileByUsername(username);
      setData(profile);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }, [username]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSubmitAppeal = async (message: string) => {
    if (!data?.ban?.id) throw new Error("No active ban found");
    await submitBanAppeal(data.ban.id, message, authedFetch);
    setSuccess("Your appeal has been submitted successfully.");
    await reloadProfile();
    window.setTimeout(() => setSuccess(null), 3000);
  };

  if (loading) {
    return <div className="p-4 sm:p-8 text-muted-foreground">Loading profile...</div>;
  }

  if (error || !data) {
    return <div className="p-4 sm:p-8 text-red-600">{error || "Profile not found"}</div>;
  }

  const profile = data.user;
  const ban = data.ban;

  return (
    <div className="relative isolate overflow-hidden p-4 sm:p-8">
      <DecorativeSportsIconsBackground />
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        {data.isSelf ? (
          <SelfProfileView
            profile={profile}
            ban={ban}
            successMessage={success}
            onOpenAppeal={() => setAppealOpen(true)}
          />
        ) : (
          <PublicProfileView
            profile={profile}
            ban={ban}
            isAdminViewer={user?.role === "ADMIN"}
            viewerFollows={data.viewerFollows}
            isAuthenticated={isAuthenticated}
            authedFetch={authedFetch}
            onProfileUpdated={reloadProfile}
          />
        )}
      </div>

      <SubmitAppealModal open={appealOpen} onOpenChange={setAppealOpen} onSubmit={handleSubmitAppeal} />
    </div>
  );
}

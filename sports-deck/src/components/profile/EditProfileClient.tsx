"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfileByUsername } from "./api";
import ProfileEditForm from "./ProfileEditForm";
import type { ProfileUser } from "./types";
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";

export default function EditProfileClient() {
  const router = useRouter();
  const { user, status, authedFetch, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const username = user?.username;

  const load = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchProfileByUsername(username);
      if (!res.isSelf) {
        setError("You can only edit your own profile.");
        setProfile(null);
        return;
      }
      setProfile(res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=/profile/edit");
      return;
    }
    if (status === "authenticated" && username) {
      void load();
    }
  }, [status, username, load, router]);

  const reloadProfile = useCallback(async () => {
    await load();
  }, [load]);

  if (status === "loading" || (status === "authenticated" && loading && !profile)) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-muted-foreground">Loading profile editor…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  if (error || !profile) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-red-600">{error || "Unable to load profile."}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative isolate p-4 sm:p-8">
      <DecorativeSportsIconsBackground />
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 h-auto w-fit justify-start gap-1 px-2 py-1.5 text-muted-foreground hover:text-foreground">
          <Link href={`/profile/${encodeURIComponent(profile.username)}`}>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to profile
          </Link>
        </Button>

        <ProfileEditForm
          profile={profile}
          authedFetch={authedFetch}
          refreshUser={refreshUser}
          reloadProfile={reloadProfile}
        />
      </div>
    </div>
  );
}

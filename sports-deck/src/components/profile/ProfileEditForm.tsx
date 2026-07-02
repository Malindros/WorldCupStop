"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  USERNAME_MAX_LENGTH,
  displayNameClientError,
  usernameClientError,
} from "@/lib/validation/profileFields";
import {
  deleteMeAvatar,
  fetchTeamsForProfile,
  patchMeProfile,
  uploadMeAvatar,
  type MePatchPayload,
  type TeamListItem,
} from "./api";
import AvatarCropModal from "./AvatarCropModal";
import ProfileAvatarFallback from "./ProfileAvatarFallback";
import TeamSelectWithCrest from "./TeamSelectWithCrest";
import { UnsavedChangesDialogBlocker } from "./UnsavedChangesDialogBlocker";
import RemoveAvatarConfirmModal from "./RemoveAvatarConfirmModal";
import UsernameChangeConfirmModal from "./UsernameChangeConfirmModal";
import type { ProfileUser } from "./types";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60";
const inputErrorClass = "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type ProfileEditFormProps = {
  profile: ProfileUser;
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  refreshUser: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

export default function ProfileEditForm({ profile, authedFetch, refreshUser, reloadProfile }: ProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [favoriteTeamId, setFavoriteTeamId] = useState(
    profile.favoriteTeamId != null ? String(profile.favoriteTeamId) : "",
  );

  const [teams, setTeams] = useState<TeamListItem[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayNameErr, setDisplayNameErr] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  /** Blob URL for crop modal; cleared after upload or cancel. */
  const [imageToCropSrc, setImageToCropSrc] = useState<string | null>(null);
  const [avatarDropActive, setAvatarDropActive] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<MePatchPayload | null>(null);
  const [removeAvatarOpen, setRemoveAvatarOpen] = useState(false);

  useEffect(() => {
    setUsername(profile.username);
    setDisplayName(profile.displayName ?? "");
    setFavoriteTeamId(profile.favoriteTeamId != null ? String(profile.favoriteTeamId) : "");
    setUsernameError(null);
    setDisplayNameErr(null);
    setFormError(null);
  }, [profile.username, profile.displayName, profile.favoriteTeamId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchTeamsForProfile();
        if (!cancelled) {
          setTeams(list);
          setTeamsError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setTeams([]);
          setTeamsError(e instanceof Error ? e.message : "Could not load teams");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imageToCropSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(imageToCropSrc);
      }
    };
  }, [imageToCropSrc]);

  const displayAvatarSrc = profile.avatar?.url ?? null;

  /** Preview fallback: cleared selection → no crest; otherwise match dropdown or saved profile. */
  const fallbackTeam = useMemo(() => {
    if (favoriteTeamId === "") return null;
    const id = Number(favoriteTeamId);
    if (!Number.isFinite(id)) return profile.favoriteTeam;
    const fromList = teams?.find((t) => t.id === id);
    if (fromList) return { id: fromList.id, crest: fromList.crest ?? null };
    return profile.favoriteTeam;
  }, [favoriteTeamId, teams, profile.favoriteTeam]);

  const profileDirty = useMemo(() => {
    const nextDisplay = displayName.trim() === "" ? null : displayName.trim();
    const nextTeam = favoriteTeamId === "" ? null : Number(favoriteTeamId);
    const cropPending = Boolean(imageToCropSrc);
    return (
      cropPending ||
      username.trim() !== profile.username ||
      nextDisplay !== profile.displayName ||
      nextTeam !== profile.favoriteTeamId
    );
  }, [
    imageToCropSrc,
    username,
    displayName,
    favoriteTeamId,
    profile.username,
    profile.displayName,
    profile.favoriteTeamId,
  ]);

  const onUsernameBlur = useCallback(() => {
    setUsernameError(usernameClientError(username));
  }, [username]);

  const onDisplayNameBlur = useCallback(() => {
    setDisplayNameErr(displayNameClientError(displayName));
  }, [displayName]);

  const handlePickPhoto = useCallback(() => {
    setFormError(null);
    fileInputRef.current?.click();
  }, []);

  const beginCropFromFile = useCallback(
    (file: File) => {
      setFormError(null);
      if (file.size > AVATAR_MAX_BYTES) {
        setFormError("Image must be 5MB or smaller.");
        return;
      }
      if (!AVATAR_TYPES.includes(file.type)) {
        setFormError("Use a JPEG, PNG, GIF, or WebP image.");
        return;
      }
      setImageToCropSrc((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [],
  );

  const closeCropModal = useCallback(() => {
    setImageToCropSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleCropConfirm = useCallback(
    async (file: File) => {
      setFormError(null);
      try {
        setAvatarUploading(true);
        await uploadMeAvatar(file, authedFetch);
        setImageToCropSrc((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        await refreshUser();
        await reloadProfile();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Upload failed");
        throw err;
      } finally {
        setAvatarUploading(false);
      }
    },
    [authedFetch, refreshUser, reloadProfile],
  );

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      beginCropFromFile(file);
    },
    [beginCropFromFile],
  );

  const handleAvatarDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (avatarUploading || avatarRemoving) return;
    setAvatarDropActive(true);
  }, [avatarUploading, avatarRemoving]);

  const handleAvatarDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setAvatarDropActive(false);
    }
  }, []);

  const handleAvatarDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setAvatarDropActive(false);
      if (avatarUploading || avatarRemoving) return;
      const file = e.dataTransfer.files?.[0];
      if (file) beginCropFromFile(file);
    },
    [avatarUploading, avatarRemoving, beginCropFromFile],
  );

  const handleRemoveAvatar = useCallback(async () => {
    if (!profile.avatar?.url) return;
    setFormError(null);
    try {
      setAvatarRemoving(true);
      await deleteMeAvatar(authedFetch);
      setRemoveAvatarOpen(false);
      await refreshUser();
      await reloadProfile();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setAvatarRemoving(false);
    }
  }, [authedFetch, profile.avatar?.url, refreshUser, reloadProfile]);

  const buildPatchPayload = useCallback((): MePatchPayload | null => {
    const nextDisplay = displayName.trim() === "" ? null : displayName.trim();
    const nextTeam = favoriteTeamId === "" ? null : Number(favoriteTeamId);
    const payload: MePatchPayload = {};
    if (username.trim() !== profile.username) {
      payload.username = username.trim();
    }
    if (nextDisplay !== profile.displayName) {
      payload.displayName = nextDisplay;
    }
    if (nextTeam !== profile.favoriteTeamId) {
      payload.favoriteTeamId = nextTeam;
    }
    return Object.keys(payload).length === 0 ? null : payload;
  }, [displayName, favoriteTeamId, profile.displayName, profile.favoriteTeamId, profile.username, username]);

  const applySavedProfile = useCallback(
    async (payload: MePatchPayload) => {
      await refreshUser();
      if (payload.username && payload.username !== profile.username) {
        router.replace(`/profile/${encodeURIComponent(payload.username)}`);
      } else {
        await reloadProfile();
      }
      setSaveSuccess("Profile updated.");
      window.setTimeout(() => setSaveSuccess(null), 4000);
    },
    [profile.username, refreshUser, reloadProfile, router],
  );

  const performSave = useCallback(
    async (payload: MePatchPayload) => {
      await patchMeProfile(payload, authedFetch);
      await applySavedProfile(payload);
    },
    [applySavedProfile, authedFetch],
  );

  const handleSaveProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaveSuccess(null);
      setFormError(null);

      const uErr = usernameClientError(username);
      const dErr = displayNameClientError(displayName);
      setUsernameError(uErr);
      setDisplayNameErr(dErr);
      if (uErr || dErr) return;

      const payload = buildPatchPayload();
      if (!payload) return;

      if (payload.username !== undefined) {
        setPendingPatch(payload);
        setUsernameModalOpen(true);
        return;
      }

      try {
        setSaving(true);
        await performSave(payload);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not save profile");
      } finally {
        setSaving(false);
      }
    },
    [buildPatchPayload, displayName, performSave, username],
  );

  const handleConfirmUsernameChange = useCallback(async () => {
    if (!pendingPatch) return;
    try {
      setSaving(true);
      setFormError(null);
      await performSave(pendingPatch);
      setUsernameModalOpen(false);
      setPendingPatch(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }, [pendingPatch, performSave]);

  const handleDismissUsernameModal = useCallback(() => {
    if (saving) return;
    setUsernameModalOpen(false);
    setPendingPatch(null);
  }, [saving]);

  const canSave = profileDirty && !usernameError && !displayNameErr && !saving;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="edit-profile-heading">
      <h2 id="edit-profile-heading" className="text-lg font-semibold text-foreground sm:text-xl">
        Edit profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Update how you appear to others. Changes apply immediately after saving.
      </p>

      <div className="mt-6 flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3 sm:w-40">
          <div
            className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-full border bg-muted transition-colors ${
              avatarDropActive ? "border-primary ring-2 ring-primary/30" : "border-border"
            }`}
            onDragEnter={handleAvatarDragOver}
            onDragOver={handleAvatarDragOver}
            onDragLeave={handleAvatarDragLeave}
            onDrop={handleAvatarDrop}
          >
            {avatarUploading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : displayAvatarSrc ? (
              <Image
                src={displayAvatarSrc}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-cover"
                draggable={false}
                unoptimized
              />
            ) : (
              <ProfileAvatarFallback
                username={username}
                displayName={displayName}
                teamId={fallbackTeam?.id ?? null}
                teamCrestUrl={fallbackTeam?.crest ?? null}
              />
            )}
          </div>
          <p className="max-w-[14rem] text-center text-xs text-muted-foreground">
            Drag and drop an image here, or use the button below.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="sr-only"
            aria-label="Choose profile photo"
            onChange={handleFileSelected}
          />
          <div className="flex w-full max-w-[12rem] flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handlePickPhoto}
              disabled={avatarUploading || avatarRemoving}
            >
              <Camera className="mr-1" aria-hidden />
              {avatarUploading ? "Uploading…" : "Change photo"}
            </Button>
            {profile.avatar?.url ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setRemoveAvatarOpen(true)}
                disabled={avatarUploading || avatarRemoving}
              >
                <Trash2 className="mr-1" aria-hidden />
                Remove photo
              </Button>
            ) : null}
          </div>
          <p className="max-w-[12rem] text-center text-xs text-muted-foreground">JPEG, PNG, GIF, or WebP · max 5MB</p>
        </div>

        <form className="min-w-0 flex-1 space-y-4" onSubmit={(e) => void handleSaveProfile(e)}>
          {formError ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200" role="alert">
              {formError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200" role="status">
              {saveSuccess}
            </p>
          ) : null}
          {teamsError ? <p className="text-sm text-amber-700 dark:text-amber-300">{teamsError}</p> : null}

          <div className="space-y-1">
            <label htmlFor="profile-username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="profile-username"
              value={username}
              onChange={(ev) => {
                setUsername(ev.target.value);
                if (usernameError) setUsernameError(usernameClientError(ev.target.value));
              }}
              onBlur={onUsernameBlur}
              autoComplete="username"
              maxLength={USERNAME_MAX_LENGTH}
              aria-invalid={Boolean(usernameError)}
              aria-describedby={usernameError ? "profile-username-error" : "profile-username-hint"}
              className={`${inputClass} ${usernameError ? inputErrorClass : ""}`}
            />
            <p id="profile-username-hint" className="text-xs text-muted-foreground">
              2–30 characters. Letters, numbers, underscores, and hyphens only. Changing your username updates your
              profile URL.
            </p>
            {usernameError ? (
              <p id="profile-username-error" className="text-sm text-red-600" role="alert">
                {usernameError}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-display" className="text-sm font-medium text-foreground">
              Display name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="profile-display"
              value={displayName}
              onChange={(ev) => {
                setDisplayName(ev.target.value);
                if (displayNameErr) setDisplayNameErr(displayNameClientError(ev.target.value));
              }}
              onBlur={onDisplayNameBlur}
              className={`${inputClass} ${displayNameErr ? inputErrorClass : ""}`}
              aria-invalid={Boolean(displayNameErr)}
              aria-describedby={displayNameErr ? "profile-display-error" : undefined}
            />
            {displayNameErr ? (
              <p id="profile-display-error" className="text-sm text-red-600" role="alert">
                {displayNameErr}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-team" className="text-sm font-medium text-foreground">
              Favorite team
            </label>
            {teams === null && !teamsError ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Loading teams…
              </div>
            ) : (
              <TeamSelectWithCrest
                id="profile-team"
                teams={teams ?? []}
                value={favoriteTeamId}
                onChange={setFavoriteTeamId}
                className={inputClass}
              />
            )}
            <p className="text-xs text-muted-foreground">Shown on your public profile and used to personalize your experience.</p>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <Button type="submit" size="lg" disabled={!canSave}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
            {!profileDirty ? <span className="text-sm text-muted-foreground">No unsaved changes.</span> : null}
          </div>
        </form>
      </div>

      <UsernameChangeConfirmModal
        open={usernameModalOpen}
        onOpenChange={(open) => {
          if (!open) handleDismissUsernameModal();
        }}
        currentUsername={profile.username}
        nextUsername={pendingPatch?.username ?? username.trim()}
        onConfirm={() => void handleConfirmUsernameChange()}
        loading={saving}
      />

      <RemoveAvatarConfirmModal
        open={removeAvatarOpen}
        onOpenChange={setRemoveAvatarOpen}
        onConfirm={() => void handleRemoveAvatar()}
        loading={avatarRemoving}
      />

      <UnsavedChangesDialogBlocker dirty={profileDirty} />

      {imageToCropSrc ? (
        <AvatarCropModal
          key={imageToCropSrc}
          imageSrc={imageToCropSrc}
          open
          onClose={closeCropModal}
          onConfirm={(file) => handleCropConfirm(file)}
        />
      ) : null}
    </section>
  );
}

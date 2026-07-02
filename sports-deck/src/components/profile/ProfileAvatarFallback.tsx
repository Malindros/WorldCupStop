"use client";

import { cn } from "@/lib/utils";
import { getProfileInitials, teamThemeFromId } from "@/lib/utils/avatarInitials";

type ProfileAvatarFallbackProps = {
  username: string;
  displayName?: string | null;
  teamId?: number | null;
  teamCrestUrl?: string | null;
  className?: string;
  /** Larger text for profile header */
  size?: "md" | "lg";
};

export default function ProfileAvatarFallback({
  username,
  displayName,
  teamId,
  teamCrestUrl,
  className,
  size = "md",
}: ProfileAvatarFallbackProps) {
  const initials = getProfileInitials(displayName, username);
  const theme = teamThemeFromId(teamId ?? null);
  const textSize = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div
      className={cn("relative flex h-full w-full items-center justify-center overflow-hidden", className)}
      style={{
        background: `linear-gradient(145deg, hsl(${theme.h} ${theme.s}% ${theme.l1}%) 0%, hsl(${theme.h} ${theme.s}% ${theme.l2}%) 100%)`,
      }}
    >
      {teamCrestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={teamCrestUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.35] object-contain opacity-[0.22] blur-[2px]"
          aria-hidden
          draggable={false}
        />
      ) : null}
      <span
        className={cn(
          "relative z-[1] font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
          textSize,
        )}
      >
        {initials}
      </span>
    </div>
  );
}

/**
 * Two-letter initials when possible (display name with spaces, else username).
 */
export function getProfileInitials(displayName: string | null | undefined, username: string): string {
  const d = displayName?.trim();
  if (d) {
    const parts = d.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    if (d.length >= 2) return d.slice(0, 2).toUpperCase();
    return d.charAt(0).toUpperCase() || "?";
  }
  const u = username.trim();
  if (u.length >= 2) return u.slice(0, 2).toUpperCase();
  return u.charAt(0).toUpperCase() || "?";
}

/** Deterministic HSL seed from team id for subtle themed backgrounds. */
export function teamThemeFromId(teamId: number | null | undefined): { h: number; s: number; l1: number; l2: number } {
  if (teamId == null) {
    return { h: 215, s: 35, l1: 32, l2: 22 };
  }
  const h = (teamId * 47) % 360;
  const s = 38 + (teamId % 4) * 6;
  return { h, s: Math.min(s, 58), l1: 30 + (teamId % 5), l2: 18 + (teamId % 4) };
}

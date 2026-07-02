/** Shared relative time for feeds, thread lists, etc. (matches activity feed wording). */
export function formatRelativeIsoTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 0) return d.toLocaleDateString(undefined, {month: "short", day: "numeric", 
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

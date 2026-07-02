"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function CreateThreadPage() {
  const router = useRouter();
  const { authedFetch, status } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [teamId, setTeamId] = useState<number | "">("");
  const [teams, setTeams] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/teams", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTeams(data ?? []);
      } catch (e) {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }
    setLoading(true);
    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      const payload: any = { title: title.trim(), content: content.trim(), tags };
      if (teamId !== "") payload.teamId = Number(teamId);

      const res = await authedFetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        const next = encodeURIComponent(`/create-thread`);
        router.push(`/login?next=${next}`);
        return;
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to create thread");

      const slugOrId = body.slug ?? body.id;
      router.push(`/threads/${slugOrId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">Create Thread</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
            <div className="flex items-center gap-3">
              {teamId !== "" && (
                <span className="font-medium text-foreground">{teams.find((t) => t.id === Number(teamId))?.name}: </span>
              )}
                <div className="flex-1">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className="w-full rounded-md border border-border px-3 py-2 bg-background text-foreground" />
                  <div className="mt-1 text-xs text-muted-foreground">{title.length}/100</div>
                </div>
            </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Team (optional)</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border border-border px-3 py-2 bg-background text-foreground">
            <option value="">General (no team)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Tags (comma-separated)</label>
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2" className="w-full rounded-md border border-border px-3 py-2 bg-background text-foreground" />
        </div>
        <div>
          <label className="block text-sm mb-1">First post</label>
          <p className="text-xs text-muted-foreground mb-2">Describe what the thread is about — this is the first post that will appear in the thread.</p>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Write the first post for this thread..." className="w-full rounded-md border border-border px-3 py-2 bg-background text-foreground" />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={loading}>{loading ? "Creating..." : "Create Thread"}</Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUserActivityForProfile } from "./api";
import type { ProfileActivityDayBucket } from "./types";

export function useProfileActivityChart(userId: number, days: number) {
  const [data, setData] = useState<ProfileActivityDayBucket[] | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserActivityForProfile(userId, days);
      setData(res.activity);
      setRange({ from: res.from, to: res.to });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity");
      setData([]);
      setRange(null);
    } finally {
      setLoading(false);
    }
  }, [userId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const activity = useMemo(() => data ?? [], [data]);

  const maxTotal = useMemo(() => {
    let m = 1;
    for (const row of activity) {
      if (row.totalActivity > m) m = row.totalActivity;
    }
    return m;
  }, [activity]);

  const totals = useMemo(() => {
    let posts = 0;
    let comments = 0;
    for (const row of activity) {
      posts += row.postsCount;
      comments += row.commentsCount;
    }
    return { posts, comments, all: posts + comments };
  }, [activity]);

  return { activity, range, loading, error, reload: load, maxTotal, totals };
}

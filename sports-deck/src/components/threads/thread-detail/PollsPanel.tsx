"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DateTimePicker from "@/components/polls/DateTimePicker";

type PollSummary = { id: number; question: string; deadline: string; isClosed: boolean; createdAt: string; createdById?: number; createdBy?: { id: number; username: string; displayName?: string | null } };
type PollDetail = {
  id: number;
  threadId: number | null;
  question: string;
  deadline: string;
  isClosed: boolean;
  createdAt: string;
  createdById?: number;
  options: { id: number; label: string; voteCount: number; metadata?: any }[];
  voteCount: number;
  optionCount: number;
  selectedOptionId?: number | null;
};

export default function PollsPanel({ threadId, isWithinWindow = true }: { threadId: number; isWithinWindow?: boolean }) {
  const { status, authedFetch, user } = useAuth();
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [detailsMap, setDetailsMap] = useState<Record<number, PollDetail | null>>({});
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingVote, setPendingVote] = useState<Record<number, number | null>>({});

  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editOptionLabel, setEditOptionLabel] = useState("");
  const [addingOptionFor, setAddingOptionFor] = useState<number | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState("");

  // create form state
  const [question, setQuestion] = useState("");
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorsMap, setErrorsMap] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/threads/${threadId}/polls`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load polls");
        const data = await res.json();
        if (!cancelled) setPolls(data);
      } catch (e) {
        if (!cancelled) setPolls([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [threadId]);


  const toggleExpand = async (id: number) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
    if (!detailsMap[id]) {
      try {
        const res = await fetch(`/api/polls/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load poll");
        const data = (await res.json()) as PollDetail;
        setDetailsMap((m) => ({ ...m, [id]: data }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorsMap((m) => ({ ...m, [id]: msg }));
      }
    }
  };

  const vote = async (pollId: number, optionId: number) => {
    if (isWithinWindow === false) {
      throw new Error("Thread is closed");
    }
    if (status !== "authenticated") {
      throw new Error("Unauthorized");
    }
    // set pending immediately so the button disables optimistically
    setPendingVote((p) => ({ ...p, [pollId]: optionId }));
    try {
      const res = await authedFetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to vote");

      // refresh poll details and keep pending until we get the poll response
      const detRes = await fetch(`/api/polls/${pollId}`, { cache: "no-store" });
      if (detRes.ok) {
        const updated = (await detRes.json()) as PollDetail;
        setDetailsMap((m) => ({ ...m, [pollId]: updated }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorsMap((m) => ({ ...m, [pollId]: msg }));
    } finally {
      // clear pending so UI becomes interactive again
      setPendingVote((p) => { const copy = { ...p }; delete copy[pollId]; return copy; });
    }
  };

  const submitCreate = async () => {
    if (isWithinWindow === false) {
      setFormError("Thread is closed");
      return;
    }
    setFormError(null);
    if (!question.trim()) return setFormError("Question is required");
    if (!deadline) return setFormError("Deadline is required");
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) return setFormError("Invalid deadline");
    if (date.getTime() <= Date.now()) return setFormError("Deadline must be in the future");
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return setFormError("At least two options are required");

    try {
      setCreating(true);
      const payload = { question: question.trim(), deadline: date.toISOString(), options: opts };
      const res = await authedFetch(`/api/threads/${threadId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to create poll");
      // refresh list and clear form
      const created = await res.json();
      setQuestion("");
      setDeadline("");
      setOptions(["", ""]);
      setPolls((p) => [created as PollSummary, ...p]);
      setDetailsMap((m) => ({ ...m, [created.id]: created as PollDetail }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  function isoToDatetimeLocal(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  }

  function dateAndTimeToLocalDatetime(date?: Date, time?: string) {
    if (!date) return "";
    const copy = new Date(date);
    if (time) {
      const parts = time.split(":").map((s) => Number(s));
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      copy.setHours(h, m, s, 0);
    }
    const tzOffset = copy.getTimezoneOffset() * 60000;
    const local = new Date(copy.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  }

  function parseLocalDatetime(value?: string) {
    if (!value) return { date: undefined as Date | undefined, time: undefined as string | undefined };
    const [datePart, timePart = "00:00"] = value.split("T");
    const [Y, M, D] = datePart.split("-").map((n) => Number(n));
    const [H, Min] = timePart.split(":").map((n) => Number(n));
    const d = new Date();
    d.setFullYear(Y, (M || 1) - 1, D || 1);
    d.setHours(H || 0, Min || 0, 0, 0);
    const time = `${String(H).padStart(2, "0")}:${String(Min).padStart(2, "0")}:00`;
    return { date: d, time };
  }

  const startEditPoll = (p: PollDetail) => {
    setEditingPollId(p.id);
    setEditQuestion(p.question);
    setEditDeadline(isoToDatetimeLocal(p.deadline));
    setErrorsMap((m) => ({ ...m, [p.id]: null }));
  };

  const saveEditPoll = async (pollId: number) => {
    try {
      const body: any = {};
      if (editQuestion.trim()) body.question = editQuestion.trim();
      if (editDeadline) body.deadline = new Date(editDeadline).toISOString();
      const res = await authedFetch(`/api/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to update poll");
      const updated = await fetch(`/api/polls/${pollId}`, { cache: "no-store" }).then((r) => r.json());
      setDetailsMap((m) => ({ ...m, [pollId]: updated }));
      setPolls((list) => list.map((x) => (x.id === pollId ? { ...x, question: updated.question, deadline: updated.deadline } : x)));
      // Clear any existing error for this poll after successful save
      setErrorsMap((m) => { const copy = { ...m }; delete copy[pollId]; return copy; });
      setEditingPollId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorsMap((m) => ({ ...m, [pollId]: msg }));
    }
  };

  const deletePoll = async (pollId: number) => {
    try {
      const res = await authedFetch(`/api/polls/${pollId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to delete poll");
      setPolls((list) => list.filter((x) => x.id !== pollId));
      setDetailsMap((m) => { const copy = { ...m }; delete copy[pollId]; return copy; });
      setExpanded((s) => { const copy = { ...s }; delete copy[pollId]; return copy; });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorsMap((m) => ({ ...m, [pollId]: msg }));
    }
  };

  const startEditOption = (optId: number, label: string, pollId: number) => {
    setEditingOptionId(optId);
    setEditOptionLabel(label);
    setErrorsMap((m) => ({ ...m, [pollId]: null }));
  };

  const saveEditOption = async (pollId: number, optionId: number) => {
    try {
      const res = await authedFetch(`/api/polls/${pollId}/options/${optionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editOptionLabel }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to update option");
      const updated = await fetch(`/api/polls/${pollId}`, { cache: "no-store" }).then((r) => r.json());
      setDetailsMap((m) => ({ ...m, [pollId]: updated }));
      setEditingOptionId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorsMap((m) => ({ ...m, [pollId]: msg }));
    }
  };

  const deleteOption = async (pollId: number, optionId: number) => {
    try {
      const res = await authedFetch(`/api/polls/${pollId}/options/${optionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to delete option");
      const updated = await fetch(`/api/polls/${pollId}`, { cache: "no-store" }).then((r) => r.json());
      setDetailsMap((m) => ({ ...m, [pollId]: updated }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorsMap((m) => ({ ...m, [pollId]: msg }));
    }
  };

  const startAddOption = (pollId: number) => {
    setAddingOptionFor(pollId);
    setNewOptionLabel("");
    setErrorsMap((m) => ({ ...m, [pollId]: null }));
  };

  const cancelAddOption = () => {
    setAddingOptionFor(null);
    setNewOptionLabel("");
  };

  const saveAddOption = async (pollId: number) => {
    if (!newOptionLabel.trim()) return setErrorsMap((m) => ({ ...m, [pollId]: "Option label is required" }));
    try {
      const res = await authedFetch(`/api/polls/${pollId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newOptionLabel.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to add option");
      const updated = await fetch(`/api/polls/${pollId}`, { cache: "no-store" }).then((r) => r.json());
      setDetailsMap((m) => ({ ...m, [pollId]: updated }));
      setAddingOptionFor(null);
      setNewOptionLabel("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorsMap((m) => ({ ...m, [pollId]: msg }));
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4">
      <h3 className="mb-3 text-lg font-semibold">Polls</h3>
      {loading ? <div className="text-sm text-muted-foreground">Loading polls...</div> : null}
      {formError ? <div className="text-sm text-red-600 mb-2">{formError}</div> : null}

      {status === "authenticated" ? (
        <div className="mb-3">
            <div className="flex">
              <Button onClick={() => setCreateOpen((c) => !c)} className="w-full justify-center gap-2" disabled={isWithinWindow === false}>
                <ChevronDown className={`h-4 w-4 transition-transform ${createOpen ? "rotate-180" : "rotate-0"}`} />
                <span className="font-medium">Create a poll</span>
              </Button>
            </div>
          {createOpen ? (
            <div className="mt-3 space-y-2">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" className="w-full rounded-md border p-2 bg-transparent" />
              <div>
                <DateTimePicker
                  initialDate={parseLocalDatetime(deadline).date}
                  initialTime={parseLocalDatetime(deadline).time}
                  onChange={(d, t) => setDeadline(dateAndTimeToLocalDatetime(d, t))}
                />
              </div>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={opt} onChange={(e) => setOptions((s) => { const copy = [...s]; copy[i] = e.target.value; return copy; })} placeholder={`Option ${i+1}`} className="flex-1 rounded-md border p-2 bg-transparent" />
                    <Button variant="ghost" onClick={() => setOptions((s) => s.filter((_, idx) => idx !== i))} disabled={options.length <= 2}>Remove</Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setOptions((s) => [...s, ""]) }>Add option</Button>
              </div>
                <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setCreateOpen(false); setFormError(null); setQuestion(""); setDeadline(""); setOptions(["", ""]); }}>Cancel</Button>
                <Button onClick={submitCreate} disabled={creating || isWithinWindow === false}>{creating ? "Creating..." : "Create Poll"}</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mb-3 text-sm text-muted-foreground">Log in to create or vote in polls.</div>
      )}

      <div className="space-y-3">
        {polls.length === 0 ? <div className="text-sm text-muted-foreground">No polls in this thread.</div> : polls.map((p) => {
          const det = detailsMap[p.id] ?? null;
          const isOpen = !!expanded[p.id];
          const totalVotes = det ? det.voteCount : 0;
          return (
            <div key={p.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                            <button onClick={() => toggleExpand(p.id)} className={`flex items-center gap-2 text-sm font-medium ${isOpen ? "text-foreground" : "text-foreground"}`}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                      <span className="whitespace-normal break-words" style={{ overflowWrap: "anywhere" }}>{p.question}</span>
                    </button>
                  </div>
                          <div className="text-xs text-muted-foreground">Closes at: {new Date(p.deadline).toLocaleString()}</div>
                          {p.createdBy ? (
                            <div className="text-xs text-muted-foreground">by {p.createdBy.displayName ?? p.createdBy.username}</div>
                          ) : null}
                </div>
              </div>

              {isOpen && det ? (
                <div className="mt-3 space-y-3">
                  {errorsMap[p.id] ? <div className="text-sm text-red-600">{errorsMap[p.id]}</div> : null}
                  {/* Poll management controls and add-option UI */}
                  {(() => {
                    const isOwner = user?.id && ((det && det.createdById === user.id) || p.createdById === user.id);
                    const isAdmin = user?.role === "ADMIN";
                    const canManage = !!(isOwner || isAdmin) && isWithinWindow !== false;
                    const votesExist = totalVotes > 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-end gap-2">
                          {editingPollId === p.id ? (
                            <div className="flex gap-2 w-full flex-col">
                              <input className="rounded-md border p-2" value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} />
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">Closes at</div>
                                <DateTimePicker
                                  initialDate={parseLocalDatetime(editDeadline).date}
                                  initialTime={parseLocalDatetime(editDeadline).time}
                                  onChange={(d, t) => setEditDeadline(dateAndTimeToLocalDatetime(d, t))}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => { setEditingPollId(null); setErrorsMap((m) => ({ ...m, [p.id]: null })); }}>Cancel</Button>
                                <Button onClick={() => saveEditPoll(p.id)}>Save</Button>
                              </div>
                            </div>
                          ) : (
                            canManage ? (
                              <>
                                {votesExist ? (
                                  <span title="Cannot edit poll after votes have been cast" className="inline-block" style={{ pointerEvents: "auto" }}>
                                    <Button variant="ghost" disabled>Edit Poll</Button>
                                  </span>
                                ) : (
                                  <Button variant="ghost" onClick={() => startEditPoll(det)}>Edit Poll</Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete Poll</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete poll?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the poll and its votes.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deletePoll(p.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            ) : null
                          )}
                        </div>

                        {canManage && !votesExist && editingPollId === p.id ? (
                          addingOptionFor === p.id ? (
                            <div className="flex gap-2 w-full">
                              <input value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} placeholder="New option label" className="flex-1 min-w-40 rounded-md border p-2 w-[90%]" />
                              <Button className="flex-shrink-0" onClick={() => saveAddOption(p.id)}>Add</Button>
                              <Button className="flex-shrink-0" variant="outline" onClick={cancelAddOption}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <Button variant="outline" onClick={() => startAddOption(p.id)}>Add option</Button>
                            </div>
                          )
                        ) : null}
                      </div>
                    );
                  })()}

                  {det.options.map((opt) => {
                    const isOwner = user?.id && ((det && det.createdById === user.id) || p.createdById === user.id);
                    const isAdmin = user?.role === "ADMIN";
                    const canManage = !!(isOwner || isAdmin);
                    const count = opt.voteCount ?? 0;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 break-words break-all whitespace-normal text-sm text-foreground pr-4">
                            {editingOptionId === opt.id ? (
                              <input value={editOptionLabel} onChange={(e) => setEditOptionLabel(e.target.value)} className="w-full rounded-md border p-1" />
                            ) : (
                              opt.label
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-foreground">{count}</div>
                            <div className="text-xs text-foreground">{percent}%</div>
                            {editingOptionId === opt.id ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setEditingOptionId(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => saveEditOption(p.id, opt.id)}>Save</Button>
                              </>
                            ) : (
                              <>
                                  {(() => {
                                    const now = new Date();
                                    let voteDisabledReason: string | undefined;
                                    if (status !== "authenticated") voteDisabledReason = "Log in to vote";
                                    else if (isWithinWindow === false) voteDisabledReason = "Thread is closed";
                                    else if (det.isClosed) voteDisabledReason = "Poll is closed";
                                    else if (new Date(det.deadline) <= now) voteDisabledReason = "Poll deadline passed";
                                    else if (pendingVote[p.id] != null) voteDisabledReason = "Voting...";
                                    else if (det.selectedOptionId === opt.id) voteDisabledReason = "You already voted for this option";
                                    const voteDisabled = !!voteDisabledReason;
                                    return (
                                      <>
                                        {voteDisabled ? (
                                          <span title={voteDisabledReason} className="inline-block" style={{ pointerEvents: "auto" }}>
                                            <Button size="sm" disabled>Vote</Button>
                                          </span>
                                        ) : (
                                          <Button size="sm" onClick={() => vote(p.id, opt.id)}>Vote</Button>
                                        )}
                                        {editingPollId === p.id && canManage ? (
                                          (() => {
                                            const votesExist = totalVotes > 0;
                                            return (
                                              <>
                                                {votesExist ? (
                                                  <span title="Cannot edit options after votes have been cast" className="inline-block" style={{ pointerEvents: "auto" }}>
                                                    <Button size="sm" variant="ghost" disabled>Edit</Button>
                                                  </span>
                                                ) : (
                                                  <Button size="sm" variant="ghost" onClick={() => startEditOption(opt.id, opt.label, p.id)}>Edit</Button>
                                                )}
                                                {votesExist ? (
                                                  <span title="Cannot delete options after votes have been cast" className="inline-block" style={{ pointerEvents: "auto" }}>
                                                    <Button size="sm" variant="destructive" disabled>Delete</Button>
                                                  </span>
                                                ) : (
                                                  <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                      <Button size="sm" variant="destructive">Delete</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete option?</AlertDialogTitle>
                                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteOption(p.id, opt.id)}>Delete</AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                  </AlertDialog>
                                                )}
                                              </>
                                            );
                                          })()
                                        ) : null}
                                      </>
                                    );
                                  })()}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`bg-emerald-500 h-full rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-sm text-foreground">Total votes: {det.voteCount}</div>
                </div>
              ) : isOpen && !det ? (
                <div className="mt-3 text-sm text-muted-foreground">Loading...</div>
              ) : null}
            </div>
          );
        })}
      </div>

      
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TeamListItem } from "./api";
import TeamCrestThumb from "./TeamCrestThumb";

type TeamSelectWithCrestProps = {
  id: string;
  teams: TeamListItem[];
  value: string;
  onChange: (teamId: string) => void;
  disabled?: boolean;
  className?: string;
};

function teamLabel(t: TeamListItem): string {
  return t.shortName ? `${t.name} (${t.shortName})` : t.name;
}

export default function TeamSelectWithCrest({
  id,
  teams,
  value,
  onChange,
  disabled,
  className,
}: TeamSelectWithCrestProps) {
  const listId = useId();
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = value === "" ? null : teams.find((t) => String(t.id) === value);
  const selectedLabel = selected ? teamLabel(selected) : "No favorite team";

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      const label = teamLabel(t).toLowerCase();
      const short = t.shortName?.toLowerCase() ?? "";
      return (
        label.includes(q) ||
        t.name.toLowerCase().includes(q) ||
        short.includes(q) ||
        (t.slug?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [teams, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
  }, [open]);

  const pick = useCallback(
    (teamId: string) => {
      onChange(teamId);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-auto min-h-10 w-full justify-between gap-2 border-border bg-background px-3 py-2 font-normal",
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {selected ? (
              <>
                <TeamCrestThumb crestUrl={selected.crest} label={selected.name} size="md" />
                <span className="min-w-0 truncate">{selectedLabel}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No favorite team</span>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-60 transition", open && "rotate-180")} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        role="listbox"
        aria-labelledby={id}
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={12}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          queueMicrotask(() => searchInputRef.current?.focus());
        }}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-0 max-w-[min(100vw-1.5rem,var(--radix-popover-trigger-width))] gap-0 p-0",
          "flex max-h-72 flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md",
          "ring-0 ring-offset-0 outline-none",
        )}
      >
        <div className="shrink-0 border-b border-border p-2">
          <label htmlFor={searchId} className="sr-only">
            Search teams
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={searchInputRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search teams…"
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="off"
            />
          </div>
        </div>
        <ul className="max-h-52 overflow-y-auto py-1">
          <li role="option" aria-selected={value === ""}>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => pick("")}
            >
              <span className="h-8 w-8 shrink-0 rounded border border-dashed border-border bg-muted/50" aria-hidden />
              <span className="text-muted-foreground">No favorite team</span>
              {value === "" ? <Check className="ml-auto h-4 w-4 shrink-0" aria-hidden /> : null}
            </button>
          </li>
          {filteredTeams.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">No teams match your search.</li>
          ) : (
            filteredTeams.map((t) => {
              const v = String(t.id);
              const sel = value === v;
              return (
                <li key={t.id} role="option" aria-selected={sel}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => pick(v)}
                  >
                    <TeamCrestThumb crestUrl={t.crest} label={t.name} size="md" />
                    <span className="min-w-0 flex-1 truncate">{teamLabel(t)}</span>
                    {sel ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

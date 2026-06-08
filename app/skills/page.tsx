"use client";

import { ArrowLeft, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import type { Skill } from "@/lib/skills/skills";
import { useMeasuredHeight } from "@/lib/use-measured-height";
import { cn } from "@/lib/utils";

type ListState = {
  skills: Skill[];
  loading: boolean;
  error: string | null;
};

type SkillsShellStyle = CSSProperties & {
  "--header-height"?: string;
};

export default function SkillsPage() {
  const [headerRef, headerHeight] = useMeasuredHeight<HTMLElement>();
  const [state, setState] = useState<ListState>({ skills: [], loading: true, error: null });
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));

    try {
      const response = await fetch("/api/skills");
      const body: { skills?: Skill[]; error?: string } = await response.json();

      if (!response.ok || !body.skills) {
        throw new Error(body.error ?? "Failed to load skills.");
      }

      setState({ skills: body.skills, loading: false, error: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load skills.",
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return state.skills;
    }

    return state.skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query),
    );
  }, [state.skills, filter]);

  const selected = useMemo(
    () => state.skills.find((skill) => skill.id === selectedId) ?? null,
    [state.skills, selectedId],
  );

  // Drop a selection that no longer exists after a refresh (e.g. the skill was
  // deleted out-of-band) so the detail pane doesn't keep pointing at a ghost.
  useEffect(() => {
    if (selectedId !== null && !state.skills.some((skill) => skill.id === selectedId)) {
      setSelectedId(null);
    }
  }, [state.skills, selectedId]);

  // On narrow viewports the master and detail panes swap in and out; on lg+ both
  // render side by side. `showDetail` drives that swap.
  const showDetail = creating || selected !== null;

  const shellStyle = useMemo<SkillsShellStyle | undefined>(
    () => (headerHeight === null ? undefined : { "--header-height": `${headerHeight}px` }),
    [headerHeight],
  );

  function selectSkill(id: string) {
    setSelectedId(id);
    setCreating(false);
  }

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
  }

  function closeDetail() {
    setCreating(false);
    setSelectedId(null);
  }

  return (
    <main
      className="h-dvh overflow-hidden bg-background [--header-height:4.5rem]"
      style={shellStyle}
    >
      <AppHeader ref={headerRef} />

      {/* Persistent top-level heading for the route. The visible "Skills" label
          lives inside the master pane, which is removed from the DOM on narrow
          viewports once a skill is selected — so a route-level h1 must exist
          outside the swapped panes to keep a valid heading hierarchy. */}
      <h1 className="sr-only">Skills</h1>

      <div className="fixed inset-x-0 bottom-0 top-[var(--header-height)] flex">
        <section
          aria-label="Skills"
          className={cn(
            "h-full w-full flex-col border-border lg:flex lg:w-80 lg:shrink-0 lg:border-r xl:w-96",
            showDetail ? "hidden" : "flex",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Skills</h2>
              <p aria-live="polite" className="mt-0.5 text-[11px] text-muted-foreground">
                {state.loading ? "Loading…" : `${state.skills.length} total`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                aria-busy={state.loading}
                aria-label="Refresh skills"
                disabled={state.loading}
                onClick={() => void refresh()}
                size="sm"
                type="button"
                variant="ghost"
              >
                <RefreshCw className={cn("size-3.5", state.loading && "animate-spin")} />
              </Button>
              <Button
                aria-pressed={creating}
                className={cn(creating && "border-primary/60 bg-primary/5 text-primary")}
                onClick={startCreate}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="size-3.5" />
                New skill
              </Button>
            </div>
          </div>

          <div className="px-4 pt-3 sm:px-6">
            <label className="relative block">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
              <input
                aria-label="Filter skills"
                className="w-full rounded-md border border-border bg-background py-1.5 pr-2.5 pl-8 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by name or description"
                type="search"
                value={filter}
              />
            </label>
          </div>

          {state.error ? (
            <p
              className="mx-4 mt-3 rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive sm:mx-6"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4 sm:px-6">
            {filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground" role="status">
                {state.loading
                  ? "Loading skills…"
                  : state.skills.length === 0
                    ? "No skills yet. Create one to get started."
                    : "No skills match your filter."}
              </p>
            ) : (
              filtered.map((skill) => (
                <SkillRow
                  key={skill.id}
                  onSelect={() => selectSkill(skill.id)}
                  selected={skill.id === selectedId}
                  skill={skill}
                />
              ))
            )}
          </div>
        </section>

        <section
          aria-label="Skill detail"
          className={cn("h-full min-w-0 flex-1 flex-col lg:flex", showDetail ? "flex" : "hidden")}
        >
          <DetailPane creating={creating} onBack={closeDetail} skill={selected} />
        </section>
      </div>
    </main>
  );
}

function SkillRow({
  skill,
  selected,
  onSelect,
}: {
  skill: Skill;
  selected: boolean;
  onSelect: () => void;
}) {
  const referenceCount = skill.resourceCount ?? 0;
  const hasBody = skill.body.trim().length > 0;

  return (
    <button
      aria-pressed={selected}
      className={cn(
        "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/5"
          : "border-border/80 hover:border-border hover:bg-muted/60",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "min-w-0 truncate text-xs font-semibold",
            selected ? "text-primary" : "text-foreground",
          )}
          title={skill.name}
        >
          {skill.name}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            skill.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
          )}
        >
          {skill.enabled ? "enabled" : "disabled"}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
        {referenceCount} {referenceCount === 1 ? "reference" : "references"}
        {" · "}
        {hasBody ? "body present" : "no body"}
      </p>
    </button>
  );
}

function DetailPane({
  skill,
  creating,
  onBack,
}: {
  skill: Skill | null;
  creating: boolean;
  onBack: () => void;
}) {
  if (!creating && !skill) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <Sparkles className="size-6 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">Select a skill</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Pick a skill from the list to view its details. The full editor lands in a follow-up.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-8 lg:hidden">
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-2xl">
          {creating ? (
            <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
              <Plus className="mx-auto size-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-foreground">New skill</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                The skill editor lands in a follow-up. For now, create skills via the API.
              </p>
            </div>
          ) : skill ? (
            <SkillDetailSummary skill={skill} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SkillDetailSummary({ skill }: { skill: Skill }) {
  const referenceCount = skill.resourceCount ?? 0;
  const hasBody = skill.body.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{skill.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
        </div>
        <span
          className={cn(
            "mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            skill.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
          )}
        >
          {skill.enabled ? "enabled" : "disabled"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="References" value={String(referenceCount)} />
        <Stat label="Body" value={hasBody ? "Present" : "Empty"} />
        <Stat label="Version" value={String(skill.version)} />
        <Stat label="Compatibility" value={skill.compatibility ?? "—"} />
      </dl>

      <p className="rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
        The full skill editor — body, resources, and metadata — lands in a follow-up.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/80 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

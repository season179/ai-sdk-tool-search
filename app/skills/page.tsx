"use client";

import {
  ArrowLeft,
  DatabaseZap,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { AppHeader } from "@/components/app-header";
import { SkillMeasurementStrip } from "@/components/skill-measurement-strip";
import { Button } from "@/components/ui/button";
import type { Skill, SkillResource } from "@/lib/skills/skills";
import { useMeasuredHeight } from "@/lib/use-measured-height";
import { cn } from "@/lib/utils";

type ListState = {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  /**
   * The skills service couldn't be reached (5xx or a network failure) — almost
   * always a missing/down Postgres, since the route only 500s on DB errors. Drives
   * the full-surface "needs the database" state instead of a misleading "no skills
   * yet" empty state or a dead spinner.
   */
  unavailable: boolean;
};

type SkillsShellStyle = CSSProperties & {
  "--header-height"?: string;
};

export default function SkillsPage() {
  const [headerRef, headerHeight] = useMeasuredHeight<HTMLElement>();
  const [state, setState] = useState<ListState>({
    skills: [],
    loading: true,
    error: null,
    unavailable: false,
  });
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The editor reports its unsaved-edits state up so navigation away from a dirty
  // editor can be intercepted (see `requestNavigation`).
  const [editorDirty, setEditorDirty] = useState(false);
  // A navigation deferred behind the unsaved-changes dialog. `null` when no guard
  // is pending; otherwise the action to run if the user chooses to discard.
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));

    try {
      const response = await fetch("/api/skills");
      const body: { skills?: Skill[]; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !body.skills) {
        // Keep any already-loaded skills on a failed refresh — a transient blip
        // shouldn't blow away the visible list. A 5xx means the service is down
        // (DB unreachable); a 4xx is a request error surfaced inline.
        setState((current) => ({
          ...current,
          loading: false,
          error: body.error ?? "Failed to load skills.",
          unavailable: response.status >= 500,
        }));
        return;
      }

      setState({ skills: body.skills, loading: false, error: null, unavailable: false });
    } catch (error) {
      // A thrown fetch (no response at all) means we couldn't reach the app/DB.
      // Treat it as unavailable but, again, retain whatever was already loaded.
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load skills.",
        unavailable: true,
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

  // Take over the whole surface with the DB-unavailable state only when we have
  // nothing to show; if a refresh fails but skills are still cached, keep the panes
  // and surface the failure inline instead.
  const showUnavailable = state.unavailable && state.skills.length === 0;
  // Initial fetch still in flight with nothing to show yet → skeletons.
  const firstLoad = state.loading && state.skills.length === 0 && !state.unavailable;
  // Fetch settled with an empty, reachable catalog (no error) → first-run teaching.
  const noSkills =
    !state.loading && !state.unavailable && !state.error && state.skills.length === 0;

  const shellStyle = useMemo<SkillsShellStyle | undefined>(
    () => (headerHeight === null ? undefined : { "--header-height": `${headerHeight}px` }),
    [headerHeight],
  );

  // Imperatively reset the detail pane without consulting the dirty guard — used
  // after a save/create/delete where the edits are already persisted or gone.
  const resetDetail = useCallback(() => {
    setCreating(false);
    setSelectedId(null);
    setEditorDirty(false);
  }, []);

  // Gate a pane-switching action behind the unsaved-changes dialog when the editor
  // has pending edits; otherwise run it immediately.
  const requestNavigation = useCallback(
    (action: () => void) => {
      if (editorDirty) {
        setPendingNav(() => action);
        return;
      }
      action();
    },
    [editorDirty],
  );

  function selectSkill(id: string) {
    if (id === selectedId && !creating) {
      return;
    }
    requestNavigation(() => {
      setSelectedId(id);
      setCreating(false);
      setEditorDirty(false);
    });
  }

  function startCreate() {
    if (creating) {
      return;
    }
    requestNavigation(() => {
      setCreating(true);
      setSelectedId(null);
      setEditorDirty(false);
    });
  }

  function closeDetail() {
    requestNavigation(resetDetail);
  }

  function discardPendingNav() {
    const action = pendingNav;
    setPendingNav(null);
    action?.();
  }

  // Stable so the dialog's keydown effect doesn't re-subscribe on every render.
  const keepEditing = useCallback(() => setPendingNav(null), []);

  // After a create, refresh so the new row appears, then select it — the await
  // ordering keeps the "drop unknown selection" effect from clearing it mid-flight.
  const handleCreated = useCallback(
    async (skill: Skill) => {
      setEditorDirty(false);
      await refresh();
      setSelectedId(skill.id);
      setCreating(false);
    },
    [refresh],
  );

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
        {showUnavailable ? (
          <DatabaseUnavailable loading={state.loading} onRetry={() => void refresh()} />
        ) : (
          <>
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
                    {firstLoad ? "Loading…" : `${state.skills.length} total`}
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

              {/* An empty list paired with an error (skills.length === 0 but not a
                  first-run state) renders nothing here — the banner above already
                  explains it, so we avoid a misleading "no skills yet" / "no matches". */}
              <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4 sm:px-6">
                {firstLoad ? (
                  <SkillListSkeleton />
                ) : noSkills ? (
                  <SkillsListEmpty onCreate={startCreate} />
                ) : state.skills.length === 0 ? null : filtered.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground" role="status">
                    No skills match your filter.
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
              className={cn(
                "h-full min-w-0 flex-1 flex-col lg:flex",
                showDetail ? "flex" : "hidden",
              )}
            >
              {showDetail ? (
                <SkillEditor
                  key={creating ? "new" : (selected?.id ?? "none")}
                  onBack={closeDetail}
                  onCreated={handleCreated}
                  onDeleted={() => {
                    resetDetail();
                    void refresh();
                  }}
                  onDirtyChange={setEditorDirty}
                  onUpdated={() => void refresh()}
                  skill={creating ? null : selected}
                />
              ) : firstLoad ? (
                <EditorSkeleton />
              ) : noSkills ? (
                <FirstRunDetail onCreate={startCreate} />
              ) : (
                <EmptyDetail />
              )}
            </section>
          </>
        )}
      </div>

      {pendingNav ? (
        <UnsavedChangesDialog onDiscard={discardPendingNav} onKeepEditing={keepEditing} />
      ) : null}
    </main>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <Sparkles className="size-6 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">Select a skill</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Pick a skill from the list to edit it, or create a new one.
      </p>
    </div>
  );
}

// --- Empty / loading / unavailable states -----------------------------------

/** Compact first-run teaching shown in the master list when no skills exist. */
function SkillsListEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-8 text-center" role="status">
      <Sparkles className="size-5 text-muted-foreground/60" />
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">No skills yet</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A skill bundles instructions and files the agent loads progressively — only the metadata
          stays in context.
        </p>
      </div>
      <Button onClick={onCreate} size="sm" type="button">
        <Plus className="size-3.5" />
        Create your first skill
      </Button>
    </div>
  );
}

/**
 * Rich first-run teaching for the detail pane: spells out the three
 * progressive-disclosure tiers so the empty surface explains the model rather
 * than just saying "nothing here."
 */
function FirstRunDetail({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="skills-enter flex h-full flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <Sparkles className="mx-auto size-7 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Create your first skill</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A skill teaches the agent something new without bloating every request. Its three tiers
            load progressively, so you only pay for what the agent actually reaches for.
          </p>
        </div>

        <ul className="space-y-2 text-left">
          <TierExplainer
            alwaysLoaded
            description="Name and description — always in the system prompt so the agent knows the skill exists."
            title="Metadata"
          />
          <TierExplainer
            description="The full instructions, fetched only when the agent invokes the skill."
            title="Body"
          />
          <TierExplainer
            description="Bundled files the agent reads on demand via skill_read — free until it does."
            title="References"
          />
        </ul>

        <Button onClick={onCreate} type="button">
          <Plus className="size-3.5" />
          Create your first skill
        </Button>
      </div>
    </div>
  );
}

function TierExplainer({
  title,
  description,
  alwaysLoaded = false,
}: {
  title: string;
  description: string;
  alwaysLoaded?: boolean;
}) {
  return (
    <li className="flex gap-2.5 rounded-md border border-border/70 px-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          alwaysLoaded ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
              alwaysLoaded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {alwaysLoaded ? "Always loaded" : "Loaded on demand"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

/**
 * Full-surface state when the skills service can't be reached. The catalog lives
 * in Postgres while chat runs without it, so this is the expected state on a
 * DB-less setup — explain the fix instead of spinning forever.
 */
function DatabaseUnavailable({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-full max-w-md space-y-4">
        <DatabaseZap className="mx-auto size-7 text-muted-foreground/70" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Skills need the database</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The skill catalog lives in Postgres, and chat can run without it — so this page stays
            dark until the database is reachable.
          </p>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2.5 text-left">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
              DATABASE_URL
            </code>{" "}
            and start Postgres on port <span className="font-mono text-foreground">5433</span> (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
              docker compose up -d
            </code>
            ), then run{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
              pnpm db:migrate
            </code>
            .
          </p>
        </div>
        <Button aria-busy={loading} disabled={loading} onClick={onRetry} type="button">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {loading ? "Retrying…" : "Retry"}
        </Button>
      </div>
    </div>
  );
}

// --- Skeletons --------------------------------------------------------------

/** Pulse placeholder. `animate-pulse` is neutralized by the reduced-motion rule. */
function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-muted", className)} />;
}

function SkillListSkeleton() {
  return (
    <div aria-hidden className="space-y-1.5">
      {Array.from({ length: 6 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div className="rounded-md border border-border/80 px-3 py-2.5" key={index}>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3.5 w-12 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div aria-hidden className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

// --- Unsaved-changes guard --------------------------------------------------

/**
 * Modal shown when the user tries to leave a dirty editor. Blocks the pending
 * navigation until they choose; Escape and the backdrop both mean "keep editing"
 * (the safe default — never silently discard).
 */
function UnsavedChangesDialog({
  onDiscard,
  onKeepEditing,
}: {
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the modal on open (so the safe default is reachable) and let
  // Escape mean "keep editing" — never silently discard.
  useEffect(() => {
    dialogRef.current?.focus();

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onKeepEditing();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeepEditing]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop. */}
      <button
        aria-label="Keep editing"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
        onClick={onKeepEditing}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-describedby="unsaved-changes-body"
        aria-labelledby="unsaved-changes-title"
        aria-modal="true"
        className="skills-enter relative w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)] outline-none"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="text-sm font-semibold text-foreground" id="unsaved-changes-title">
          Discard unsaved changes?
        </h2>
        <p
          className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
          id="unsaved-changes-body"
        >
          You've edited this skill but haven't saved. Leaving now drops those changes.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onKeepEditing} type="button" variant="ghost">
            Keep editing
          </Button>
          <Button onClick={onDiscard} type="button" variant="destructive">
            Discard changes
          </Button>
        </div>
      </div>
    </div>
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

// --- Editor -----------------------------------------------------------------

// Mirror of the server-side rule in `validateSkillInput` so bad names are caught
// before the round-trip. Kept in sync by hand — the API stays the source of truth.
const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

type FormState = {
  name: string;
  description: string;
  compatibility: string;
  license: string;
  allowedTools: string[];
  metadataText: string;
  body: string;
};

type FieldErrors = Partial<Record<"name" | "description" | "compatibility" | "metadata", string>>;

function metadataToText(metadata: Skill["metadata"]): string {
  return metadata ? JSON.stringify(metadata, null, 2) : "";
}

function toForm(skill: Skill | null): FormState {
  return {
    name: skill?.name ?? "",
    description: skill?.description ?? "",
    compatibility: skill?.compatibility ?? "",
    license: skill?.license ?? "",
    allowedTools: skill?.allowedTools ?? [],
    metadataText: metadataToText(skill?.metadata ?? null),
    body: skill?.body ?? "",
  };
}

function parseMetadata(
  text: string,
): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Metadata must be valid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Metadata must be a JSON object." };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

function validate(
  form: FormState,
  isCreate: boolean,
): { errors: FieldErrors; metadata: Record<string, unknown> | null } {
  const errors: FieldErrors = {};

  if (isCreate) {
    const name = form.name.trim();
    if (!name) {
      errors.name = "Name is required.";
    } else if (name.length > 64) {
      errors.name = "Name must be 64 characters or fewer.";
    } else if (!SKILL_NAME_RE.test(name)) {
      errors.name = "Lowercase letters, numbers and single hyphens only (e.g. pdf-export).";
    }
  }

  const description = form.description.trim();
  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length > 1024) {
    errors.description = "Description must be 1024 characters or fewer.";
  }

  if (form.compatibility.trim().length > 500) {
    errors.compatibility = "Compatibility must be 500 characters or fewer.";
  }

  const metadata = parseMetadata(form.metadataText);
  if (!metadata.ok) {
    errors.metadata = metadata.error;
  }

  return { errors, metadata: metadata.ok ? metadata.value : null };
}

function stringArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function SkillEditor({
  skill,
  onBack,
  onCreated,
  onUpdated,
  onDeleted,
  onDirtyChange,
}: {
  /** The skill being edited, or `null` to create a new one. */
  skill: Skill | null;
  /** Close the detail pane (mobile back / cancel-create). */
  onBack: () => void;
  /** Called after a successful POST with the newly created skill. */
  onCreated: (skill: Skill) => void;
  /** Called after a successful PATCH (field save or enabled toggle). */
  onUpdated: () => void;
  /** Called after a successful DELETE. */
  onDeleted: () => void;
  /** Reports whether the form holds unsaved edits, so the parent can guard
      navigation away from this editor. */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const isCreate = skill === null;

  const [form, setForm] = useState<FormState>(() => toForm(skill));
  const [enabled, setEnabled] = useState(skill?.enabled ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enabledPending, setEnabledPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // References load lazily inside `ReferencesSection`; it reports their aggregate
  // size up so the measurement strip can price the deferred references tier.
  // `null` until the first load (or in create mode, where none exist yet).
  const [referenceSummary, setReferenceSummary] = useState<{
    count: number;
    chars: number;
  } | null>(null);

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  // Dirty against the baseline form — blank in create mode, the saved skill in
  // edit mode. Drives both the Save button and the parent's unsaved-changes guard,
  // so "dirty" means the same thing in both places.
  const isDirty = useMemo(() => {
    const base = toForm(skill);

    return (
      form.name !== base.name ||
      form.description !== base.description ||
      form.body !== base.body ||
      form.license !== base.license ||
      form.compatibility !== base.compatibility ||
      form.metadataText !== base.metadataText ||
      !stringArraysEqual(form.allowedTools, base.allowedTools)
    );
  }, [form, skill]);

  // Surface the dirty state up, and clear it on unmount so a freshly opened editor
  // never inherits the previous one's guard.
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // Native guard for full-page exits (reload, tab close, external link) that the
  // in-app dialog can't intercept. Only armed while there are unsaved edits.
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      // `preventDefault()` is the spec-compliant trigger for the browser's
      // leave-confirmation prompt in current browsers (the legacy `returnValue`
      // is deprecated).
      event.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  async function handleSave() {
    const { errors: nextErrors, metadata } = validate(form, isCreate);
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const allowedTools = form.allowedTools.length > 0 ? form.allowedTools : null;
    const compatibility = form.compatibility.trim() || null;
    const license = form.license.trim() || null;
    const description = form.description.trim();

    setSaving(true);

    try {
      if (isCreate) {
        const response = await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description,
            body: form.body,
            license,
            compatibility,
            allowedTools,
            metadata,
            enabled,
          }),
        });
        const data: { skill?: Skill; error?: string } = await response.json();

        if (!response.ok || !data.skill) {
          throw new Error(data.error ?? "Failed to create the skill.");
        }

        onCreated(data.skill);
      } else {
        const response = await fetch(`/api/skills/${skill.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            body: form.body,
            license,
            compatibility,
            allowedTools,
            metadata,
          }),
        });
        const data: { skill?: Skill; error?: string } = await response.json();

        if (!response.ok || !data.skill) {
          throw new Error(data.error ?? "Failed to save the skill.");
        }

        // Re-seed the form from the saved row so normalized values (trimmed
        // strings, re-serialized metadata) settle the dirty state. `enabled` is
        // intentionally left untouched: the save payload never carries it, so the
        // response echoes the pre-toggle value and would clobber an in-flight
        // toggle — the toggle owns that field.
        setForm(toForm(data.skill));
        onUpdated();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save the skill.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    const next = !enabled;

    // No row exists yet in create mode; the choice rides along with the POST.
    if (isCreate || skill === null) {
      setEnabled(next);
      return;
    }

    setEnabled(next);
    setEnabledPending(true);
    setFormError(null);

    try {
      const response = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data: { skill?: Skill; error?: string } = await response.json();

      if (!response.ok || !data.skill) {
        throw new Error(data.error ?? "Failed to update the enabled state.");
      }

      onUpdated();
    } catch (error) {
      setEnabled(!next);
      setFormError(error instanceof Error ? error.message : "Failed to update the enabled state.");
    } finally {
      setEnabledPending(false);
    }
  }

  async function handleDelete() {
    if (skill === null) {
      return;
    }

    setDeleting(true);
    setFormError(null);

    try {
      const response = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });

      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete the skill.");
      }

      onDeleted();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to delete the skill.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const saveDisabled = saving || deleting || (!isCreate && !isDirty);

  return (
    <div className="skills-enter flex h-full flex-col">
      {/* Identity bar — pinned above the scrolling field stack. */}
      <div className="shrink-0 border-b border-border bg-background px-4 pt-4 pb-3 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="lg:hidden">
            <Button className="-ml-2 mb-2" onClick={onBack} size="sm" type="button" variant="ghost">
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {isCreate ? (
                <div>
                  <label
                    className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    htmlFor="skill-name"
                  >
                    Name
                  </label>
                  <input
                    className={cn(FIELD_CLASS, "mt-1 font-mono")}
                    id="skill-name"
                    maxLength={64}
                    onChange={(event) => update({ name: event.target.value })}
                    placeholder="my-skill"
                    spellCheck={false}
                    value={form.name}
                  />
                  {errors.name ? (
                    <p className="mt-1 text-[11px] text-destructive" role="alert">
                      {errors.name}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <h2 className="truncate font-mono text-base font-semibold text-foreground">
                    {skill.name}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Name is locked after creation.
                  </p>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="flex select-none items-center gap-2 text-xs font-medium text-foreground">
                <EnabledToggle
                  enabled={enabled}
                  onToggle={() => void handleToggleEnabled()}
                  pending={enabledPending || saving || deleting}
                />
                {enabled ? "Enabled" : "Disabled"}
              </span>

              <Button disabled={saveDisabled} onClick={() => void handleSave()} type="button">
                {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create skill" : "Save"}
              </Button>

              {isCreate ? (
                <Button disabled={saving} onClick={onBack} type="button" variant="ghost">
                  Cancel
                </Button>
              ) : confirmingDelete ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    type="button"
                    variant="destructive"
                  >
                    {deleting ? "Deleting…" : "Confirm delete"}
                  </Button>
                  <Button
                    disabled={deleting}
                    onClick={() => setConfirmingDelete(false)}
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  aria-label="Delete skill"
                  onClick={() => setConfirmingDelete(true)}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          {formError ? <ErrorBanner message={formError} /> : null}

          <SkillMeasurementStrip
            body={form.body}
            description={form.description}
            name={form.name}
            referenceChars={referenceSummary?.chars ?? null}
            referenceCount={referenceSummary?.count ?? null}
          />

          {/* Metadata tier — always shipped to the model. */}
          <section className="space-y-4">
            <TierHeader
              description="Shipped to the model on every request."
              tier="Always loaded"
              title="Metadata"
            />

            <Field
              error={errors.description}
              htmlFor="skill-description"
              label="Description"
              required
            >
              <textarea
                className={cn(FIELD_CLASS, "min-h-[4.5rem] resize-y")}
                id="skill-description"
                maxLength={1024}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="One or two sentences on what the skill does and when to use it."
                value={form.description}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                error={errors.compatibility}
                hint="≤ 500 chars"
                htmlFor="skill-compatibility"
                label="Compatibility"
              >
                <input
                  className={FIELD_CLASS}
                  id="skill-compatibility"
                  maxLength={500}
                  onChange={(event) => update({ compatibility: event.target.value })}
                  placeholder="e.g. requires Postgres 17"
                  value={form.compatibility}
                />
              </Field>

              <Field htmlFor="skill-license" label="License">
                <input
                  className={FIELD_CLASS}
                  id="skill-license"
                  onChange={(event) => update({ license: event.target.value })}
                  placeholder="e.g. MIT"
                  value={form.license}
                />
              </Field>
            </div>

            <Field hint="Enter or comma to add" htmlFor="skill-allowed-tools" label="Allowed tools">
              <ChipInput
                id="skill-allowed-tools"
                onChange={(allowedTools) => update({ allowedTools })}
                value={form.allowedTools}
              />
            </Field>

            <Field
              error={errors.metadata}
              hint="JSON object"
              htmlFor="skill-metadata"
              label="Metadata"
            >
              <textarea
                className={cn(FIELD_CLASS, "min-h-[6rem] resize-y font-mono")}
                id="skill-metadata"
                onChange={(event) => update({ metadataText: event.target.value })}
                placeholder={'{\n  "key": "value"\n}'}
                spellCheck={false}
                value={form.metadataText}
              />
            </Field>
          </section>

          {/* Body tier — fetched only when the skill is invoked. */}
          <section className="space-y-4">
            <TierHeader
              description="Fetched only when the skill is invoked."
              tier="Loaded on demand"
              title="Body"
            />

            <BodyEditor onChange={(body) => update({ body })} value={form.body} />
          </section>

          {/* References tier — bundled files the agent reads on demand. Each row is
              its own CRUD entity against the resource endpoints, not part of Save. */}
          <section className="space-y-4">
            <TierHeader
              description="Bundled files an agent reads on demand via skill_read."
              tier="Loaded on demand"
              title="References"
            />

            {isCreate || skill === null ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Create the skill first, then add references to it.
              </p>
            ) : (
              <ReferencesSection
                onChanged={onUpdated}
                onResourcesChange={setReferenceSummary}
                skillId={skill.id}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TierHeader({
  title,
  tier,
  description,
}: {
  title: string;
  tier: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {tier}
      </span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      className="rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive"
      role="alert"
    >
      {message}
    </p>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-foreground" htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EnabledToggle({
  enabled,
  pending,
  onToggle,
}: {
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-checked={enabled}
      aria-label="Skill enabled"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:opacity-50",
        enabled ? "bg-primary" : "bg-input",
      )}
      disabled={pending}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "size-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

function ChipInput({
  value,
  onChange,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tokens = draft
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      setDraft("");
      return;
    }

    const next = [...value];
    for (const token of tokens) {
      if (!next.includes(token)) {
        next.push(token);
      }
    }

    onChange(next);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
      {value.map((tool) => (
        <span
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground"
          key={tool}
        >
          {tool}
          <button
            aria-label={`Remove ${tool}`}
            className="text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => onChange(value.filter((existing) => existing !== tool))}
            type="button"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[8rem] flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        id={id}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? "Add a tool and press Enter" : ""}
        spellCheck={false}
        value={draft}
      />
    </div>
  );
}

function BodyEditor({
  value,
  onChange,
  placeholder = "# Skill body\n\nMarkdown loaded on demand when the skill runs.",
  minHeightClass = "min-h-[20rem]",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeightClass?: string;
}) {
  const [view, setView] = useState<"edit" | "preview">("edit");

  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
        <ViewToggle active={view === "edit"} onClick={() => setView("edit")}>
          <Pencil className="size-3.5" />
          Edit
        </ViewToggle>
        <ViewToggle active={view === "preview"} onClick={() => setView("preview")}>
          <Eye className="size-3.5" />
          Preview
        </ViewToggle>
      </div>

      {view === "edit" ? (
        <textarea
          className={cn(FIELD_CLASS, minHeightClass, "resize-y font-mono leading-6")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
        />
      ) : value.trim() ? (
        <div
          className={cn(minHeightClass, "rounded-md border border-border bg-background px-4 py-3")}
        >
          <Streamdown className="break-words text-sm leading-6">{value}</Streamdown>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-12 text-center text-xs text-muted-foreground">
          Nothing to preview yet.
        </p>
      )}
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

// --- References tier --------------------------------------------------------

// Preset content types offered in the select; a freeform override covers the rest.
const RESOURCE_CONTENT_TYPES = ["text/markdown", "application/json", "text/plain"] as const;
const CUSTOM_CONTENT_TYPE = "__custom__";

// Mirror of the server-side `validateResourcePath` so bad paths are caught before
// the round-trip. The API stays the source of truth and owns duplicate detection.
function validateResourcePathClient(path: string): string | null {
  if (!path) {
    return "Path is required.";
  }
  if (path.startsWith("/")) {
    return "Path must not start with '/'.";
  }
  if (path.includes("..")) {
    return "Path must not contain '..' segments.";
  }
  return null;
}

// `add` opens a blank editor at the foot of the list; `edit` swaps a single row
// for its editor. Only one is ever open at a time, so reusing one input id is safe.
type ResourceEditTarget = { kind: "add" } | { kind: "edit"; id: string } | null;

function ReferenceListSkeleton() {
  return (
    <ul aria-hidden className="space-y-2">
      {Array.from({ length: 2 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <li className="rounded-md border border-border/80 px-3 py-2.5" key={index}>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-1.5 h-2.5 w-24" />
        </li>
      ))}
    </ul>
  );
}

function ReferencesSection({
  skillId,
  onChanged,
  onResourcesChange,
}: {
  skillId: string;
  onChanged: () => void;
  /** Reports the loaded references' aggregate size so the parent can price the
      references tier in the measurement strip. Fires on every (re)load. */
  onResourcesChange?: (summary: { count: number; chars: number }) => void;
}) {
  const [resources, setResources] = useState<SkillResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ResourceEditTarget>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/skills/${skillId}/resources`);
      const data: { resources?: SkillResource[]; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.resources) {
        throw new Error(data.error ?? "Failed to load references.");
      }

      setResources(data.resources);
      onResourcesChange?.({
        count: data.resources.length,
        chars: data.resources.reduce((sum, resource) => sum + resource.body.length, 0),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load references.");
    } finally {
      setLoading(false);
    }
  }, [skillId, onResourcesChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // After a successful add/edit: collapse the open editor, reload the list, and let
  // the parent refresh its reference-count badge.
  const handleSaved = useCallback(async () => {
    setEditTarget(null);
    await refresh();
    onChanged();
  }, [refresh, onChanged]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/skills/${skillId}/resources/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete the reference.");
      }

      setConfirmingDeleteId(null);
      await refresh();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the reference.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorBanner message={error} /> : null}

      {loading && resources.length === 0 ? (
        <ReferenceListSkeleton />
      ) : resources.length === 0 && editTarget?.kind !== "add" ? (
        <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground" role="status">
            No references yet — references load on demand via{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
              skill_read
            </code>
            ; they cost nothing until the agent reads them.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {resources.map((resource) =>
            editTarget?.kind === "edit" && editTarget.id === resource.id ? (
              <li key={resource.id}>
                <ResourceEditor
                  onCancel={() => setEditTarget(null)}
                  onSaved={() => void handleSaved()}
                  resource={resource}
                  skillId={skillId}
                />
              </li>
            ) : (
              <li key={resource.id}>
                <ResourceRow
                  confirming={confirmingDeleteId === resource.id}
                  deleting={deletingId === resource.id}
                  disabled={
                    editTarget !== null || (deletingId !== null && deletingId !== resource.id)
                  }
                  onCancelDelete={() => setConfirmingDeleteId(null)}
                  onConfirmDelete={() => void handleDelete(resource.id)}
                  onEdit={() => {
                    setConfirmingDeleteId(null);
                    setError(null);
                    setEditTarget({ kind: "edit", id: resource.id });
                  }}
                  onRequestDelete={() => {
                    setError(null);
                    setConfirmingDeleteId(resource.id);
                  }}
                  resource={resource}
                />
              </li>
            ),
          )}
        </ul>
      )}

      {editTarget?.kind === "add" ? (
        <ResourceEditor
          onCancel={() => setEditTarget(null)}
          onSaved={() => void handleSaved()}
          resource={null}
          skillId={skillId}
        />
      ) : (
        <Button
          disabled={editTarget !== null}
          onClick={() => {
            setConfirmingDeleteId(null);
            setError(null);
            setEditTarget({ kind: "add" });
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="size-3.5" />
          Add reference
        </Button>
      )}
    </div>
  );
}

function ResourceRow({
  resource,
  confirming,
  deleting,
  disabled,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  resource: SkillResource;
  confirming: boolean;
  deleting: boolean;
  disabled: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/80 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p
            className="truncate font-mono text-xs font-medium text-foreground"
            title={resource.path}
          >
            {resource.path}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {resource.contentType}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <Button
              disabled={deleting}
              onClick={onConfirmDelete}
              size="sm"
              type="button"
              variant="destructive"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </Button>
            <Button
              disabled={deleting}
              onClick={onCancelDelete}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              aria-label={`Edit ${resource.path}`}
              disabled={disabled}
              onClick={onEdit}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              aria-label={`Delete ${resource.path}`}
              disabled={disabled}
              onClick={onRequestDelete}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ResourceEditor({
  skillId,
  resource,
  onCancel,
  onSaved,
}: {
  skillId: string;
  /** The resource being edited, or `null` to add a new one. */
  resource: SkillResource | null;
  onCancel: () => void;
  onSaved: (resource: SkillResource) => void;
}) {
  const isNew = resource === null;

  const [path, setPath] = useState(resource?.path ?? "");
  const [contentType, setContentType] = useState(resource?.contentType ?? "text/markdown");
  const [body, setBody] = useState(resource?.body ?? "");
  const [pathError, setPathError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDirty =
    isNew ||
    path !== resource.path ||
    contentType !== resource.contentType ||
    body !== resource.body;

  async function handleSave() {
    const trimmedPath = path.trim();
    const nextPathError = validateResourcePathClient(trimmedPath);
    setPathError(nextPathError);
    setFormError(null);

    if (nextPathError) {
      return;
    }

    setSaving(true);

    try {
      const url = isNew
        ? `/api/skills/${skillId}/resources`
        : `/api/skills/${skillId}/resources/${resource.id}`;

      // An empty custom content type would otherwise be stored verbatim — the
      // server's `?? "text/markdown"` default only fires on null/undefined, not "".
      const response = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: trimmedPath,
          contentType: contentType.trim() || "text/markdown",
          body,
        }),
      });
      const data: { resource?: SkillResource; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.resource) {
        const message = data.error ?? "Failed to save the reference.";
        // The unique (skill_id, path) collision comes back as 409 — surface it on the
        // path field where it can be fixed, not as a generic form-level error.
        if (response.status === 409) {
          setPathError(message);
        } else {
          setFormError(message);
        }
        return;
      }

      onSaved(data.resource);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save the reference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="skills-enter space-y-4 rounded-md border border-primary/40 bg-primary/[0.03] px-3 py-3">
      {formError ? <ErrorBanner message={formError} /> : null}

      <Field
        error={pathError ?? undefined}
        hint="e.g. schemas/request.json"
        htmlFor="resource-path"
        label="Path"
        required
      >
        <input
          className={cn(FIELD_CLASS, "font-mono")}
          id="resource-path"
          onChange={(event) => setPath(event.target.value)}
          placeholder="reference.md"
          spellCheck={false}
          value={path}
        />
      </Field>

      <Field htmlFor="resource-content-type" label="Content type">
        <ContentTypeSelect
          id="resource-content-type"
          onChange={setContentType}
          value={contentType}
        />
      </Field>

      <div>
        <span className="text-xs font-medium text-foreground">Body</span>
        <div className="mt-1">
          <BodyEditor
            minHeightClass="min-h-[12rem]"
            onChange={setBody}
            placeholder={"# reference\n\nMarkdown body, loaded on demand via skill_read."}
            value={body}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={saving || !isDirty}
          onClick={() => void handleSave()}
          size="sm"
          type="button"
        >
          {saving ? "Saving…" : isNew ? "Add reference" : "Save reference"}
        </Button>
        <Button disabled={saving} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ContentTypeSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}) {
  const isPreset = (RESOURCE_CONTENT_TYPES as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <div className="space-y-2">
      <select
        className={FIELD_CLASS}
        id={id}
        onChange={(event) => {
          if (event.target.value === CUSTOM_CONTENT_TYPE) {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(event.target.value);
        }}
        value={custom ? CUSTOM_CONTENT_TYPE : value}
      >
        {RESOURCE_CONTENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
        <option value={CUSTOM_CONTENT_TYPE}>Custom…</option>
      </select>

      {custom ? (
        <input
          aria-label="Custom content type"
          className={cn(FIELD_CLASS, "font-mono")}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. application/yaml"
          spellCheck={false}
          value={value}
        />
      ) : null}
    </div>
  );
}

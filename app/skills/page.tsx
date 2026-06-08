"use client";

import { ArrowLeft, Eye, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Streamdown } from "streamdown";

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

  // After a create, refresh so the new row appears, then select it — the await
  // ordering keeps the "drop unknown selection" effect from clearing it mid-flight.
  const handleCreated = useCallback(
    async (skill: Skill) => {
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
          {showDetail ? (
            <SkillEditor
              key={creating ? "new" : (selected?.id ?? "none")}
              onBack={closeDetail}
              onCreated={handleCreated}
              onDeleted={() => {
                closeDetail();
                void refresh();
              }}
              onUpdated={() => void refresh()}
              skill={creating ? null : selected}
            />
          ) : (
            <EmptyDetail />
          )}
        </section>
      </div>
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

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  const isDirty = useMemo(() => {
    if (isCreate || skill === null) {
      return true;
    }

    return (
      form.description !== (skill.description ?? "") ||
      form.body !== (skill.body ?? "") ||
      form.license !== (skill.license ?? "") ||
      form.compatibility !== (skill.compatibility ?? "") ||
      form.metadataText !== metadataToText(skill.metadata) ||
      !stringArraysEqual(form.allowedTools, skill.allowedTools ?? [])
    );
  }, [form, skill, isCreate]);

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
    <div className="flex h-full flex-col">
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
          {formError ? (
            <p
              className="rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

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

function BodyEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
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
          className={cn(FIELD_CLASS, "min-h-[20rem] resize-y font-mono leading-6")}
          onChange={(event) => onChange(event.target.value)}
          placeholder="# Skill body&#10;&#10;Markdown loaded on demand when the skill runs."
          spellCheck={false}
          value={value}
        />
      ) : value.trim() ? (
        <div className="min-h-[20rem] rounded-md border border-border bg-background px-4 py-3">
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

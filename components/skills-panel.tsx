"use client";

import { Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Skill } from "@/lib/skills/skills";

type PanelState = {
  skills: Skill[];
  loading: boolean;
  error: string | null;
};

type FormData = {
  name: string;
  description: string;
  body: string;
  compatibility: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  body: "",
  compatibility: "",
};

export function SkillsPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState>({ skills: [], loading: false, error: null });
  const [editing, setEditing] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [pending, setPending] = useState(false);

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
    if (!open) {
      return;
    }

    void refresh();
  }, [open, refresh]);

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setState((current) => ({ ...current, error: null }));
  }

  function startEdit(skill: Skill) {
    setEditing(skill);
    setCreating(false);
    setForm({
      name: skill.name,
      description: skill.description,
      body: skill.body,
      compatibility: skill.compatibility ?? "",
    });
    setState((current) => ({ ...current, error: null }));
  }

  function cancelForm() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
    setState((current) => ({ ...current, error: null }));
  }

  async function handleCreate() {
    setPending(true);
    setState((current) => ({ ...current, error: null }));

    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          body: form.body,
          compatibility: form.compatibility || null,
        }),
      });
      const body: { skill?: Skill; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create skill.");
      }

      setCreating(false);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Failed to create skill.",
      }));
    } finally {
      setPending(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;

    setPending(true);
    setState((current) => ({ ...current, error: null }));

    try {
      const response = await fetch(`/api/skills/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          body: form.body,
          compatibility: form.compatibility || null,
        }),
      });
      const body: { skill?: Skill; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to update skill.");
      }

      setEditing(null);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Failed to update skill.",
      }));
    } finally {
      setPending(false);
    }
  }

  async function handleToggleEnabled(skill: Skill) {
    setState((current) => ({ ...current, error: null }));

    try {
      const response = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      const body: { skill?: Skill; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to toggle skill.");
      }

      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Failed to toggle skill.",
      }));
    }
  }

  async function handleDelete(skill: Skill) {
    setState((current) => ({ ...current, error: null }));

    try {
      const response = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
      const body: { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to delete skill.");
      }

      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Failed to delete skill.",
      }));
    }
  }

  return (
    <details className="relative shrink-0" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="block cursor-pointer list-none rounded-md px-2 py-1 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          Skills
        </span>
        <span className="block text-right tabular-nums text-sm font-semibold text-foreground">
          {state.skills.length}
        </span>
      </summary>

      <div className="absolute right-0 top-full z-20 mt-3 w-[min(calc(100vw-2rem),26rem)] rounded-lg border border-border bg-background p-4 text-left shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Skills</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Create and manage agent skills.
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              aria-label="Create skill"
              onClick={startCreate}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Plus className="size-3.5" />
            </Button>
            <Button
              aria-label="Refresh skills"
              disabled={state.loading}
              onClick={() => void refresh()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RefreshCw className={`size-3.5 ${state.loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {state.error ? (
          <p className="mt-3 rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {state.error}
          </p>
        ) : null}

        {creating || editing ? (
          <div className="mt-3 space-y-2 rounded-md border border-border/80 px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">
              {creating ? "New skill" : `Edit: ${editing?.name}`}
            </p>
            {creating ? (
              <label className="block">
                <span className="text-[11px] font-medium text-muted-foreground">Name</span>
                <input
                  className="mt-0.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  disabled={pending}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="my-skill-name"
                  value={form.name}
                />
              </label>
            ) : null}
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">Description</span>
              <input
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                disabled={pending}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this skill does"
                value={form.description}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">Body</span>
              <textarea
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                disabled={pending}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Skill instructions / prompt body"
                rows={3}
                value={form.body}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">Compatibility</span>
              <input
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                disabled={pending}
                onChange={(e) => setForm((f) => ({ ...f, compatibility: e.target.value }))}
                placeholder="Optional compatibility info"
                value={form.compatibility}
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button
                disabled={pending || (creating && !form.name.trim()) || !form.description.trim()}
                onClick={() => void (creating ? handleCreate() : handleUpdate())}
                size="sm"
                type="button"
                variant="outline"
              >
                {creating ? "Create" : "Save"}
              </Button>
              <Button
                disabled={pending}
                onClick={cancelForm}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {state.skills.length === 0 && !state.loading && !creating ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No skills yet. Click + to create one.
            </p>
          ) : (
            state.skills.map((skill) => (
              <SkillCard
                key={skill.id}
                onDelete={() => void handleDelete(skill)}
                onEdit={() => startEdit(skill)}
                onToggleEnabled={() => void handleToggleEnabled(skill)}
                skill={skill}
              />
            ))
          )}
        </div>
      </div>
    </details>
  );
}

function SkillCard({
  skill,
  onEdit,
  onToggleEnabled,
  onDelete,
}: {
  skill: Skill;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-border/80 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-foreground" title={skill.name}>
          {skill.name}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              skill.enabled
                ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={onToggleEnabled}
            title={skill.enabled ? "Click to disable" : "Click to enable"}
            type="button"
          >
            {skill.enabled ? "on" : "off"}
          </button>
        </div>
      </div>

      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{skill.description}</p>

      <div className="mt-2 flex gap-1.5">
        <button
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onEdit}
          title="Edit skill"
          type="button"
        >
          <Pencil className="size-3" />
        </button>
        <button
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          title="Delete skill"
          type="button"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

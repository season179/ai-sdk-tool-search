# Design System

Register: **product**. This app is a measurement instrument for agent behavior. The interface
serves the task; familiarity and consistency beat novelty. Calm, precise, evidential.

## Color

Tokens live in `app/globals.css` as OKLCH custom properties, mapped to Tailwind via `@theme inline`.
Strategy: **restrained** — tinted cool neutrals plus one teal accent used only for primary actions,
selection, and live-state indicators. Never decorative color.

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `oklch(0.995 0 0)` | Page background |
| `--foreground` | `oklch(0.18 0.012 245)` | Primary text |
| `--card` | `oklch(0.985 0.003 245)` | Raised panel surface (editor forms) |
| `--muted` | `oklch(0.955 0.006 245)` | Hover fills, selection fills, skeletons, code blocks |
| `--muted-foreground` | `oklch(0.43 0.022 245)` | Secondary text, labels, hints |
| `--border` | `oklch(0.89 0.008 245)` | Hairline dividers and outlines |
| `--input` | `oklch(0.83 0.012 245)` | Form control borders (darker than `--border`) |
| `--primary` | `oklch(0.55 0.115 178)` | Teal accent: primary buttons, enabled dots, focus rings |
| `--destructive` | `oklch(0.49 0.17 27)` | Delete actions, error text and borders |

Rules:

- Body text is `--foreground` or `--muted-foreground`; both pass 4.5:1 on all surfaces. Don't
  invent lighter grays.
- Accent tints: `bg-primary/10 text-primary` for positive badges; `border-destructive/30` +
  `text-destructive` for error containers. No other alpha tints.
- Status is shown with a small dot (`size-1.5 rounded-full`): `bg-primary` = active/enabled,
  `bg-input` = inactive. Plus a text badge when space allows.

## Typography

One family: the system sans stack (set on `body` in `globals.css`). No display font, no font
pairing. `font-mono` (system mono) only for code, ids, and markdown-editing textareas.

Fixed rem scale, tight steps (product register):

| Step | Class | Use |
| --- | --- | --- |
| 18px semibold | `text-lg font-semibold` | Detail-view title (one per view) |
| 14px semibold | `text-sm font-semibold` | Page title, panel headings |
| 14px | `text-sm` | Body, descriptions, controls |
| 12px medium/semibold | `text-xs` | Field labels, section headings, nav items |
| 11px | `text-[11px]` | Hints, counters, metadata chips |

Markdown content renders through `Streamdown` at `text-sm leading-6`, capped at `max-w-[72ch]`.
Prose-width caps (`max-w-[65ch]`–`max-w-[72ch]`) apply to all running text; data and controls may
run wider.

## Spacing & Layout

Tailwind's 4pt scale. Rhythm: tight within groups (`gap-1`–`gap-3`, `space-y-0.5` for list rows),
generous between sections (`mt-6`–`mt-10`, `gap-10` between panes).

- Page chrome: full-width translucent header pinned to the top (`sticky top-0 z-30
  bg-background/95 backdrop-blur`, no border); left side is the page title over a status row
  (teal `size-1.5` dot + short runtime status), right side is the nav cluster
  (`flex min-w-0 flex-wrap items-center justify-end gap-2`). Content centered in `max-w-7xl`
  with `px-4 sm:px-8 lg:px-10` gutters. Every page uses the same container.
- **Management surfaces are master-detail on wide screens**: a `lg:grid
  lg:grid-cols-[minmax(16rem,21rem)_minmax(0,1fr)]` split with a sticky list rail
  (`lg:sticky lg:top-26`, clearing the pinned header) and a content pane. Below `lg` the panes
  stack; selecting a list item scrolls the detail into view (`scroll-mt-40 sm:scroll-mt-24`,
  clearing the wrapped mobile header).
- Chat is the exception: a fixed-viewport shell (`h-dvh`, fixed header/composer) because the
  conversation owns the page. Its header is `fixed` rather than `sticky` but shares the same
  look.
- Forms group short fields side by side on `sm:` (`grid sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]`)
  instead of stacking everything full-width.

## Radius & Elevation

`--radius: 0.5rem`. `rounded-md` for controls and list rows, `rounded-lg` for panels, `rounded-full`
for badges and dots only. Elevation is borders-first: hairline `border-border` separates surfaces;
shadows are reserved for floating layers (menus, scroll-to-bottom button). Never border + large
shadow on the same element.

## Components

Source of truth: `components/ui/button.tsx` (cva variants), `components/site-nav.tsx`,
`components/ai-elements/*`.

- **Button**: `default` (teal, primary action — at most one per view), `outline` (secondary),
  `ghost` (tertiary/inline), `destructive`. Sizes `default` / `sm` / `icon`. Labels are
  verb + object ("Create skill", "Save changes").
- **Nav**: segmented pill group (`bg-muted/60 p-1`, active item `bg-background shadow-sm`),
  rendered in the header right cluster on every page.
- **Field**: label + optional hint + control + optional counter (top-right, `tabular-nums`) +
  inline error (`text-[11px] text-destructive`, `role="alert"`) below the control.
- **Badge**: `rounded-full px-2 py-0.5 text-[10px] font-medium`, tinted per state.
- **Metadata chip** (`CopyableId`): `bg-muted/60` pill with icon + label + mono value,
  click-to-copy.
- **Alert**: `rounded-lg border-destructive/30` container with `AlertCircle`, message, and a
  retry action where applicable.

Every interactive element has hover (`hover:bg-muted/60` or variant-specific), focus
(`focus-visible:ring-2 ring-primary/30`), and disabled (`opacity-50`) states.

## States

- **Loading**: skeleton blocks (`animate-pulse rounded bg-muted`) shaped like the real layout.
  Never centered spinners.
- **Empty**: dashed-border panel with an icon, one explanatory sentence, and the primary action.
- **Error**: inline alert with the server's message and a retry button; field-level validation
  errors render under the field.
- **Destructive flows**: confirm before delete; deletes are soft (server-side).

## Motion

State feedback only, no choreography: `transition-colors` (~150ms) on interactive elements,
`animate-pulse` on skeletons, smooth scroll for in-page navigation. Honor
`prefers-reduced-motion` (global rule in `globals.css` collapses all animation).

## Icons

`lucide-react`, `size-3`–`size-4` inline with text, always `aria-hidden="true"` with a text label
or `aria-label` alongside.

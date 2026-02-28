# DESIGN.md — GDTF Creator

## Design Language: "The Venue"

---

## 1. Design Philosophy

**Brutalist raw utilitarianism.** Every element earns its pixels. No decoration without function.

The metaphor is a **dark venue before doors open** — a technical space where lighting professionals work. The UI is the control surface: dense, monospaced, 1px-bordered, unapologetically functional. Accents come from the lights themselves: cyan beams cutting through haze, magenta lasers, amber tungsten warmth, UV blacklight glow.

### Principles

- **Form follows fixture.** The interface serves the GDTF specification. Every panel, field, and interaction maps to a real fixture property. No abstraction layers between the user and the data.
- **No cosmetic radius.** `border-radius: 0` everywhere. Rounded corners imply softness. This is a tool, not a toy.
- **No elevation theater.** No `box-shadow`. Depth comes from 1px borders and surface lightness differentials. Panels are separated by structure, not illusion.
- **Dense by default.** Information density is a feature. Lighting professionals read channel strips, DMX tables, and parameter grids. White space is deliberate negative space, not padding anxiety.
- **Monospace truth.** Values, addresses, and labels render in monospace. What you see is what gets written to the GDTF file.

---

## 2. Color System

All colors defined in OKLCH for Tailwind CSS v4. The surface scale is named after stage architecture, bottom to top.

### Surface Scale

| Token     | Role                          | OKLCH Value                    | Approx Hex |
|-----------|-------------------------------|--------------------------------|------------|
| `void`    | Page background, true black   | `oklch(0.11 0.005 260)`       | `#0d0e11`  |
| `pit`     | Recessed areas, wells         | `oklch(0.14 0.005 260)`       | `#131419`  |
| `deck`    | Primary surface, panels       | `oklch(0.17 0.006 260)`       | `#191b21`  |
| `rig`     | Elevated surface, cards       | `oklch(0.20 0.006 260)`       | `#1f2128`  |
| `truss`   | Toolbar, navigation           | `oklch(0.23 0.007 260)`       | `#262830`  |
| `grid`    | Hover state, active surface   | `oklch(0.27 0.007 260)`       | `#2e3039`  |
| `haze`    | Subtle borders                | `oklch(0.32 0.008 260)`       | `#393b45`  |
| `wash`    | Muted text, placeholders      | `oklch(0.50 0.010 260)`       | `#6b6e7a`  |
| `spot`    | Secondary text, labels        | `oklch(0.68 0.010 260)`       | `#a0a3ad`  |
| `flood`   | Primary text, high contrast   | `oklch(0.92 0.005 260)`       | `#e8e9ec`  |

### Accent Colors — Stage Lighting

| Token     | Role                  | OKLCH Value                    | Approx Hex |
|-----------|-----------------------|--------------------------------|------------|
| `cyan`    | Primary action, focus | `oklch(0.82 0.18 195)`        | `#00d4ff`  |
| `magenta` | Highlight, selection  | `oklch(0.68 0.25 330)`        | `#e040a0`  |
| `amber`   | Warning, warmth       | `oklch(0.78 0.18 75)`         | `#e8a020`  |
| `uv`      | Tertiary, special     | `oklch(0.58 0.25 290)`        | `#8040e0`  |

### Accent Muted Variants (for backgrounds, badges)

| Token          | OKLCH Value                    | Use case                |
|----------------|--------------------------------|-------------------------|
| `cyan-dim`     | `oklch(0.25 0.06 195)`        | Cyan-tinted surface     |
| `magenta-dim`  | `oklch(0.22 0.08 330)`        | Magenta-tinted surface  |
| `amber-dim`    | `oklch(0.25 0.06 75)`         | Amber-tinted surface    |
| `uv-dim`       | `oklch(0.20 0.08 290)`        | UV-tinted surface       |

### Semantic Signal Colors

| Token      | Role             | OKLCH Value                    | Approx Hex |
|------------|------------------|--------------------------------|------------|
| `ok`       | Success, valid   | `oklch(0.72 0.19 155)`        | `#30c870`  |
| `error`    | Error, invalid   | `oklch(0.65 0.22 25)`         | `#e04040`  |
| `caution`  | Warning, review  | `oklch(0.78 0.18 75)`         | `#e8a020`  |
| `info`     | Informational    | `oklch(0.82 0.18 195)`        | `#00d4ff`  |

> `caution` maps to `amber`, `info` maps to `cyan`. Intentional aliasing — fewer colors, stronger system.

### Tailwind CSS v4 `@theme` Definition

```css
@theme {
  /* Surface scale */
  --color-void:    oklch(0.11 0.005 260);
  --color-pit:     oklch(0.14 0.005 260);
  --color-deck:    oklch(0.17 0.006 260);
  --color-rig:     oklch(0.20 0.006 260);
  --color-truss:   oklch(0.23 0.007 260);
  --color-grid:    oklch(0.27 0.007 260);
  --color-haze:    oklch(0.32 0.008 260);
  --color-wash:    oklch(0.50 0.010 260);
  --color-spot:    oklch(0.68 0.010 260);
  --color-flood:   oklch(0.92 0.005 260);

  /* Accent — stage lighting */
  --color-cyan:        oklch(0.82 0.18 195);
  --color-magenta:     oklch(0.68 0.25 330);
  --color-amber:       oklch(0.78 0.18 75);
  --color-uv:          oklch(0.58 0.25 290);

  /* Accent — dim variants */
  --color-cyan-dim:    oklch(0.25 0.06 195);
  --color-magenta-dim: oklch(0.22 0.08 330);
  --color-amber-dim:   oklch(0.25 0.06 75);
  --color-uv-dim:      oklch(0.20 0.08 290);

  /* Semantic */
  --color-ok:      oklch(0.72 0.19 155);
  --color-error:   oklch(0.65 0.22 25);
  --color-caution: oklch(0.78 0.18 75);
  --color-info:    oklch(0.82 0.18 195);
}
```

### Contrast Ratios (WCAG 2.1 AA Verification)

Text on surfaces — must meet **4.5:1** for normal text, **3:1** for large text (18px+ bold or 24px+):

| Foreground   | Background | Ratio   | AA Normal | AA Large |
|--------------|------------|---------|-----------|----------|
| `flood`      | `void`     | 14.2:1  | Pass      | Pass     |
| `flood`      | `deck`     | 10.8:1  | Pass      | Pass     |
| `flood`      | `rig`      | 9.1:1   | Pass      | Pass     |
| `spot`       | `void`     | 6.8:1   | Pass      | Pass     |
| `spot`       | `deck`     | 5.2:1   | Pass      | Pass     |
| `wash`       | `void`     | 3.5:1   | Fail      | Pass     |
| `wash`       | `deck`     | 2.7:1   | Fail      | Fail     |
| `cyan`       | `void`     | 11.0:1  | Pass      | Pass     |
| `cyan`       | `deck`     | 8.4:1   | Pass      | Pass     |
| `magenta`    | `void`     | 6.0:1   | Pass      | Pass     |
| `magenta`    | `deck`     | 4.6:1   | Pass      | Pass     |
| `amber`      | `void`     | 8.8:1   | Pass      | Pass     |
| `uv`         | `void`     | 4.1:1   | Fail      | Pass     |
| `uv`         | `deck`     | 3.1:1   | Fail      | Pass     |
| `flood`      | `cyan-dim` | 8.5:1   | Pass      | Pass     |
| `flood`      | `uv-dim`   | 11.6:1  | Pass      | Pass     |

> **Rule:** `wash` is for decorative/placeholder text only — never for actionable content. `uv` is large-text-only or used on `void`/`pit` backgrounds with supporting icons.

---

## 3. Typography

### Font Stack

| Role      | Family          | Weight        | Load                                 |
|-----------|-----------------|---------------|--------------------------------------|
| Primary   | JetBrains Mono  | 400, 500, 700 | Google Fonts variable, `display=swap` |
| Prose     | Inter           | 400, 500, 600 | Google Fonts variable, `display=swap` |

JetBrains Mono is the default. Inter is used only for long-form prose where monospace impedes readability (help text, descriptions, documentation blocks).

### Type Scale

| Role               | Class                                                 | Size / Line Height |
|--------------------|-------------------------------------------------------|--------------------|
| Display            | `font-mono text-3xl font-bold tracking-tight`         | 30px / 36px        |
| Page title         | `font-mono text-xl font-bold tracking-tight`          | 20px / 28px        |
| Section heading    | `font-mono text-base font-bold uppercase tracking-widest` | 16px / 24px    |
| Panel label        | `font-mono text-xs font-medium uppercase tracking-widest` | 12px / 16px    |
| Body               | `font-mono text-sm font-normal`                       | 14px / 20px        |
| Body prose         | `font-sans text-sm font-normal`                       | 14px / 20px        |
| Caption            | `font-mono text-xs font-normal`                       | 12px / 16px        |
| DMX value          | `font-mono text-sm font-bold tabular-nums`            | 14px / 20px        |
| Channel address    | `font-mono text-xs font-bold tabular-nums`            | 12px / 16px        |

### Tailwind CSS v4 Font Configuration

```css
@theme {
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --font-sans: "Inter", ui-sans-serif, sans-serif;
}
```

### Rules

- All numeric values use `tabular-nums` for column alignment.
- Labels are `uppercase tracking-widest` — the DMX console aesthetic.
- No font size below `text-xs` (12px). Readability floor.
- Color for text: `flood` for primary, `spot` for secondary, `wash` for disabled/placeholder only.

---

## 4. Spacing & Layout

### Grid

Base unit: **4px**. All spacing derives from multiples of 4.

```
4  8  12  16  20  24  32  40  48  64  80  96
```

Tailwind: `p-1` = 4px, `p-2` = 8px, `gap-1` = 4px, etc.

### Application Shell

The layout follows DMX control software conventions: a fixed topbar, a collapsible sidebar, and a content area.

```
┌──────────────────────────────────────────────┐
│  TOPBAR  (h-12, bg-truss, border-b border-haze) │
├────────────┬─────────────────────────────────┤
│            │                                 │
│  SIDEBAR   │         CONTENT                 │
│  (w-56)    │         (bg-void)               │
│  bg-pit    │                                 │
│  border-r  │                                 │
│  border-haze│                                │
│            │                                 │
└────────────┴─────────────────────────────────┘
```

```html
<div class="grid h-screen grid-rows-[48px_1fr] grid-cols-[224px_1fr] bg-void">
  <header class="col-span-2 flex items-center border-b border-haze bg-truss px-4">
    <!-- topbar -->
  </header>
  <aside class="overflow-y-auto border-r border-haze bg-pit p-3">
    <!-- sidebar -->
  </aside>
  <main class="overflow-y-auto bg-void p-6">
    <!-- content -->
  </main>
</div>
```

### Dense Channel-Strip Grid

For DMX channel displays and parameter tables, use a 1px-gap grid with `haze`-colored gap lines:

```html
<div class="grid grid-cols-8 gap-px bg-haze">
  <div class="bg-deck p-2 font-mono text-xs"><!-- cell --></div>
  <div class="bg-deck p-2 font-mono text-xs"><!-- cell --></div>
  <!-- ... -->
</div>
```

The `gap-px bg-haze` technique creates 1px border lines between cells without actual borders. Cells paint their own `bg-deck` over the gap color.

### Panel Spacing

| Context             | Padding | Gap between items |
|---------------------|---------|-------------------|
| Page content        | `p-6`   | `gap-6`           |
| Panel / card body   | `p-4`   | `gap-3`           |
| Dense grid cells    | `p-2`   | `gap-px`          |
| Topbar              | `px-4`  | `gap-3`           |
| Sidebar items       | `px-3 py-2` | `gap-0.5`    |
| Form fields         | `p-0`   | `gap-4`           |

---

## 5. Components

### Buttons

Three tiers reflecting a lighting console's control hierarchy.

**Primary — "Go" button** (cyan accent, used for main actions):

```html
<button class="bg-cyan text-void font-mono text-sm font-bold uppercase tracking-widest px-4 py-2 border border-cyan hover:bg-cyan/80 active:bg-cyan/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan disabled:opacity-40 disabled:cursor-not-allowed">
  Export GDTF
</button>
```

**Secondary — "Preset" button** (bordered, used for secondary actions):

```html
<button class="bg-transparent text-flood font-mono text-sm font-medium uppercase tracking-widest px-4 py-2 border border-haze hover:border-spot hover:text-flood active:bg-grid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan disabled:opacity-40 disabled:cursor-not-allowed">
  Add Channel
</button>
```

**Ghost — "Bump" button** (minimal, inline actions):

```html
<button class="bg-transparent text-spot font-mono text-xs font-medium uppercase tracking-widest px-2 py-1 hover:text-flood hover:bg-grid active:bg-haze focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan disabled:opacity-40 disabled:cursor-not-allowed">
  Remove
</button>
```

**Danger variant** (for destructive actions, any tier):

Add `border-error text-error hover:bg-error hover:text-void` to override accent colors.

### Inputs

All inputs: no border-radius, 1px border, monospace.

**Text input:**

```html
<input
  type="text"
  class="w-full bg-pit text-flood font-mono text-sm px-3 py-2 border border-haze placeholder:text-wash focus:border-cyan focus:outline-none"
  placeholder="Fixture name"
/>
```

**Select:**

```html
<select class="w-full appearance-none bg-pit text-flood font-mono text-sm px-3 py-2 border border-haze focus:border-cyan focus:outline-none">
  <option>DMX Mode 1</option>
</select>
```

**Checkbox / Toggle:**

```html
<label class="flex items-center gap-2 cursor-pointer">
  <div class="relative w-4 h-4 border border-haze bg-pit flex items-center justify-center">
    <input type="checkbox" class="peer sr-only" />
    <div class="hidden peer-checked:block w-2 h-2 bg-cyan"></div>
  </div>
  <span class="font-mono text-sm text-spot">Virtual dimmer</span>
</label>
```

**Label pattern:**

```html
<label class="flex flex-col gap-1">
  <span class="font-mono text-xs font-medium uppercase tracking-widest text-spot">DMX Address</span>
  <input ... />
</label>
```

### Cards / Panels

Panels are bordered regions on `deck` or `rig` surfaces:

```html
<div class="border border-haze bg-deck">
  <div class="border-b border-haze px-4 py-2">
    <h3 class="font-mono text-xs font-bold uppercase tracking-widest text-spot">Physical Description</h3>
  </div>
  <div class="p-4 flex flex-col gap-3">
    <!-- content -->
  </div>
</div>
```

### Data Tables

Dense, monospaced, 1px-separated:

```html
<div class="border border-haze">
  <!-- Header -->
  <div class="grid grid-cols-[80px_1fr_100px_80px] gap-px bg-haze">
    <div class="bg-truss px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-spot">Ch</div>
    <div class="bg-truss px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-spot">Function</div>
    <div class="bg-truss px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-spot">Default</div>
    <div class="bg-truss px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-spot">DMX</div>
  </div>
  <!-- Rows -->
  <div class="grid grid-cols-[80px_1fr_100px_80px] gap-px bg-haze">
    <div class="bg-deck px-3 py-2 font-mono text-sm tabular-nums text-flood">001</div>
    <div class="bg-deck px-3 py-2 font-mono text-sm text-flood">Dimmer</div>
    <div class="bg-deck px-3 py-2 font-mono text-sm tabular-nums text-spot">0</div>
    <div class="bg-deck px-3 py-2 font-mono text-sm tabular-nums text-spot">0–255</div>
  </div>
</div>
```

### File Upload Zone

```html
<div class="border border-dashed border-haze bg-pit p-8 flex flex-col items-center gap-3 hover:border-cyan hover:bg-cyan-dim transition-colors">
  <svg class="w-8 h-8 text-wash"><!-- Lucide upload-cloud icon --></svg>
  <p class="font-mono text-sm text-spot">Drop <span class="text-cyan">.gdtf</span> or <span class="text-cyan">.3ds</span> file here</p>
  <p class="font-mono text-xs text-wash">or click to browse</p>
</div>
```

### Progress Bar

```html
<div class="h-1 w-full bg-pit">
  <div class="h-full bg-cyan transition-all duration-300" style="width: 65%"></div>
</div>
```

With label:

```html
<div class="flex flex-col gap-1">
  <div class="flex justify-between font-mono text-xs">
    <span class="text-spot uppercase tracking-widest">Export Progress</span>
    <span class="text-flood tabular-nums">65%</span>
  </div>
  <div class="h-1 w-full bg-pit">
    <div class="h-full bg-cyan" style="width: 65%"></div>
  </div>
</div>
```

### Step Indicator

Horizontal step indicator for multi-step workflows (e.g., fixture creation wizard):

```html
<div class="flex items-center gap-0">
  <!-- Completed step -->
  <div class="flex items-center gap-2 px-3 py-2 bg-cyan-dim border border-cyan/30">
    <span class="font-mono text-xs font-bold tabular-nums text-cyan">01</span>
    <span class="font-mono text-xs uppercase tracking-widest text-flood">Metadata</span>
  </div>
  <div class="w-6 h-px bg-cyan"></div>
  <!-- Active step -->
  <div class="flex items-center gap-2 px-3 py-2 border border-cyan">
    <span class="font-mono text-xs font-bold tabular-nums text-cyan">02</span>
    <span class="font-mono text-xs uppercase tracking-widest text-flood">Channels</span>
  </div>
  <div class="w-6 h-px bg-haze"></div>
  <!-- Pending step -->
  <div class="flex items-center gap-2 px-3 py-2 border border-haze">
    <span class="font-mono text-xs font-bold tabular-nums text-wash">03</span>
    <span class="font-mono text-xs uppercase tracking-widest text-wash">Export</span>
  </div>
</div>
```

### Navigation — Topbar

```html
<header class="flex items-center justify-between border-b border-haze bg-truss px-4 h-12">
  <div class="flex items-center gap-3">
    <span class="font-mono text-sm font-bold uppercase tracking-widest text-cyan">GDTF</span>
    <span class="font-mono text-sm font-bold uppercase tracking-widest text-flood">Creator</span>
  </div>
  <div class="flex items-center gap-2">
    <!-- Ghost buttons for top-level actions -->
    <button class="text-spot font-mono text-xs uppercase tracking-widest px-2 py-1 hover:text-flood hover:bg-grid">
      New
    </button>
    <button class="text-spot font-mono text-xs uppercase tracking-widest px-2 py-1 hover:text-flood hover:bg-grid">
      Import
    </button>
    <button class="bg-cyan text-void font-mono text-xs font-bold uppercase tracking-widest px-3 py-1">
      Export
    </button>
  </div>
</header>
```

### Navigation — Sidebar

```html
<nav class="flex flex-col gap-0.5 p-2">
  <!-- Active item -->
  <a href="#" class="flex items-center gap-2 px-3 py-2 bg-grid border-l-2 border-cyan text-flood">
    <svg class="w-4 h-4"><!-- Lucide icon --></svg>
    <span class="font-mono text-sm">Channels</span>
  </a>
  <!-- Default item -->
  <a href="#" class="flex items-center gap-2 px-3 py-2 text-spot hover:text-flood hover:bg-grid border-l-2 border-transparent">
    <svg class="w-4 h-4"><!-- Lucide icon --></svg>
    <span class="font-mono text-sm">Physical</span>
  </a>
</nav>
```

### Modal

```html
<!-- Backdrop -->
<div class="fixed inset-0 bg-void/80 flex items-center justify-center z-50">
  <!-- Dialog -->
  <div class="border border-haze bg-deck w-full max-w-lg">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-haze px-4 py-3">
      <h2 class="font-mono text-sm font-bold uppercase tracking-widest text-flood">Confirm Export</h2>
      <button class="text-wash hover:text-flood p-1">
        <svg class="w-4 h-4"><!-- Lucide x icon --></svg>
      </button>
    </div>
    <!-- Body -->
    <div class="p-4 flex flex-col gap-4">
      <p class="font-sans text-sm text-spot">The fixture file will be exported as GDTF 1.2 format.</p>
    </div>
    <!-- Footer -->
    <div class="flex justify-end gap-2 border-t border-haze px-4 py-3">
      <button class="text-spot font-mono text-sm uppercase tracking-widest px-4 py-2 border border-haze hover:border-spot">
        Cancel
      </button>
      <button class="bg-cyan text-void font-mono text-sm font-bold uppercase tracking-widest px-4 py-2">
        Export
      </button>
    </div>
  </div>
</div>
```

---

## 6. Motion & Animation

Animations reference stage lighting mechanics. Restrained by default — every motion has a lighting metaphor.

### Tailwind CSS v4 `@theme` Keyframes

```css
@theme {
  --animate-scan: scan 3s linear infinite;
  --animate-pulse-glow: pulse-glow 2s ease-in-out infinite;
  --animate-strobe: strobe 0.15s steps(2, start) 3;
  --animate-waveform: waveform 1.2s ease-in-out infinite;
}

@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

@keyframes strobe {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes waveform {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}
```

### Usage

| Animation      | Purpose                                                    | Class                   |
|----------------|------------------------------------------------------------|-------------------------|
| `scan`         | Scan-line overlay on loading states                        | `animate-scan`          |
| `pulse-glow`   | Subtle breathing on active/selected elements               | `animate-pulse-glow`    |
| `strobe`       | Flash confirmation on save/export success (3 blinks, stop) | `animate-strobe`        |
| `waveform`     | Audio-meter-style bars for upload/processing progress      | `animate-waveform`      |

### Transition Defaults

All interactive state changes use:

```html
class="transition-colors duration-150"
```

No `transition-all`. Only transition properties that actually change.

---

## 7. Visual Elements

### Scan-Line Overlay

A subtle horizontal scan-line texture applied to loading states or hero areas:

```html
<div class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,oklch(0.11_0.005_260/0.3)_2px,oklch(0.11_0.005_260/0.3)_4px)]"></div>
```

### Dot-Grid Pattern

Background pattern for empty states or canvas areas:

```html
<div class="bg-[radial-gradient(oklch(0.32_0.008_260)_1px,transparent_1px)] bg-[length:16px_16px]"></div>
```

### Accent Glow

Subtle glow effect for focused or active accent elements. Applied sparingly:

```css
.glow-cyan {
  box-shadow: 0 0 12px oklch(0.82 0.18 195 / 0.3);
}

.glow-magenta {
  box-shadow: 0 0 12px oklch(0.68 0.25 330 / 0.3);
}
```

> Use glow only on focus states and hero UI moments. Not on static elements — this is box-shadow, which otherwise contradicts the no-shadow principle. The exception is intentional: stage lights glow.

### Icons

Use **Lucide** (`lucide-react`) line icons exclusively.

- Size: `w-4 h-4` (16px) for inline, `w-5 h-5` (20px) for standalone.
- Stroke width: default (2px).
- Color: inherit from parent text color (`currentColor`).

Preferred icons by context:

| Context              | Icon           |
|----------------------|----------------|
| Add / create         | `plus`         |
| Delete / remove      | `trash-2`      |
| Edit                 | `pencil`       |
| Settings / config    | `sliders`      |
| Export / download    | `download`     |
| Import / upload      | `upload`       |
| File / fixture       | `file`         |
| Channel              | `git-commit`   |
| DMX mode             | `layers`       |
| Physical geometry    | `box`          |
| Wheel / color        | `palette`      |
| Close / dismiss      | `x`            |
| Navigation collapse  | `panel-left`   |
| External link        | `external-link` |
| Info                 | `info`         |
| Warning              | `alert-triangle` |
| Error                | `alert-circle` |
| Success              | `check-circle` |

---

## 8. Accessibility

### Contrast Compliance

All interactive and readable text meets WCAG 2.1 AA:

- **Normal text** (< 18px bold, < 24px): minimum 4.5:1 contrast ratio.
- **Large text** (>= 18px bold, >= 24px): minimum 3:1 contrast ratio.

Verified pairings (see Section 2 contrast table):
- `flood` on any surface (`void` through `grid`): **Pass AA**
- `spot` on `void`, `pit`, `deck`: **Pass AA**
- `cyan` on any dark surface: **Pass AA**
- `magenta` on `void`, `pit`, `deck`: **Pass AA normal**
- `wash` on dark surfaces: **Fail AA normal** — restricted to placeholder/decorative use
- `uv` on dark surfaces: **Pass AA large only** — restricted to large text or icon+label combos

### Focus Indicator

All interactive elements use a visible focus ring:

```css
focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan
```

This produces a 2px cyan outline offset 2px from the element — high visibility on all dark surfaces.

### Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

All scan-line, pulse, strobe, and waveform animations halt. Transitions collapse to instant state changes.

### Color-Independent Status

Never rely on color alone to convey status. Every semantic state includes a secondary indicator:

| Status   | Color    | Secondary Indicator                          |
|----------|----------|----------------------------------------------|
| Success  | `ok`     | Checkmark icon (`check-circle`) + text label |
| Error    | `error`  | Alert icon (`alert-circle`) + text label     |
| Warning  | `caution`| Warning icon (`alert-triangle`) + text label |
| Info     | `info`   | Info icon (`info`) + text label              |
| Active   | `cyan`   | Left border indicator (2px) + bold text      |
| Selected | `magenta`| Filled checkbox/indicator + bold text        |
| Disabled | `wash`   | Reduced opacity (0.4) + `cursor-not-allowed` |

### Keyboard Navigation

- All interactive elements are focusable via `Tab`.
- Modal traps focus within its bounds.
- `Escape` closes modals and dropdowns.
- Arrow keys navigate within data tables and channel grids.

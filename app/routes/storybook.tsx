import { useState, useEffect, useRef } from "react";
import { Topbar } from "~/components/topbar";
import { Panel } from "~/components/panel";
import { Field, FieldRow } from "~/components/field";
import { DmxTable } from "~/components/dmx-table";
import { ExtractionProgress } from "~/components/extraction-progress";
import { Background } from "~/components/background";
import type { DmxMode } from "../../convex/schema/fixture";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function meta() {
  return [
    { title: "Storybook — GDTF Creator" },
    { name: "description", content: "Component showcase" },
  ];
}

// ---------------------------------------------------------------------------
// Sections config
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
  { id: "panel", label: "Panel" },
  { id: "field", label: "Field" },
  { id: "dmx-table", label: "DmxTable" },
  { id: "extraction-progress", label: "Progress" },
  { id: "step-badge", label: "StepBadge" },
  { id: "background", label: "Background" },
  { id: "animations", label: "Animations" },
] as const;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_DMX_MODE: DmxMode = {
  name: "Standard",
  channelCount: 12,
  channels: [
    { channel: 1, gdtfAttribute: "Dimmer", prettyName: "Dimmer", defaultValue: 0 },
    {
      channel: 2,
      gdtfAttribute: "Pan",
      prettyName: "Pan",
      defaultValue: 128,
      functions: [
        { name: "Pan", dmxFrom: 0, dmxTo: 255, physicalFrom: 0, physicalTo: 540 },
      ],
    },
    {
      channel: 3,
      gdtfAttribute: "Tilt",
      prettyName: "Tilt",
      defaultValue: 128,
      functions: [
        { name: "Tilt", dmxFrom: 0, dmxTo: 255, physicalFrom: -130, physicalTo: 130 },
      ],
    },
    {
      channel: 4,
      gdtfAttribute: "ColorAdd_R",
      prettyName: "Red",
      defaultValue: 255,
    },
  ],
  subFixtures: {
    name: "Pixel",
    count: 8,
    firstChannel: 5,
    channels: [
      { gdtfAttribute: "Dimmer", prettyName: "Pixel Dimmer", defaultValue: 0 },
      {
        gdtfAttribute: "ColorAdd_R",
        prettyName: "Red",
        defaultValue: 255,
        functions: [
          { name: "Red", dmxFrom: 0, dmxTo: 255, attribute: "ColorAdd_R", physicalFrom: 0, physicalTo: 100 },
        ],
      },
      { gdtfAttribute: "ColorAdd_G", prettyName: "Green", defaultValue: 255 },
      { gdtfAttribute: "ColorAdd_B", prettyName: "Blue", defaultValue: 255 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Color palette data
// ---------------------------------------------------------------------------

const SURFACE_COLORS = [
  { name: "void", css: "bg-void", value: "oklch(0.11 0.005 260)" },
  { name: "pit", css: "bg-pit", value: "oklch(0.14 0.005 260)" },
  { name: "deck", css: "bg-deck", value: "oklch(0.17 0.006 260)" },
  { name: "rig", css: "bg-rig", value: "oklch(0.20 0.006 260)" },
  { name: "truss", css: "bg-truss", value: "oklch(0.23 0.007 260)" },
  { name: "grid", css: "bg-grid", value: "oklch(0.27 0.007 260)" },
  { name: "haze", css: "bg-haze", value: "oklch(0.32 0.008 260)" },
  { name: "wash", css: "bg-wash", value: "oklch(0.50 0.010 260)" },
  { name: "spot", css: "bg-spot", value: "oklch(0.68 0.010 260)" },
  { name: "flood", css: "bg-flood", value: "oklch(0.92 0.005 260)" },
];

const ACCENT_COLORS = [
  { name: "cyan", css: "bg-cyan", value: "oklch(0.82 0.18 195)" },
  { name: "magenta", css: "bg-magenta", value: "oklch(0.68 0.25 330)" },
  { name: "amber", css: "bg-amber", value: "oklch(0.78 0.18 75)" },
  { name: "uv", css: "bg-uv", value: "oklch(0.58 0.25 290)" },
];

const ACCENT_DIM_COLORS = [
  { name: "cyan-dim", css: "bg-cyan-dim", value: "oklch(0.25 0.06 195)" },
  { name: "magenta-dim", css: "bg-magenta-dim", value: "oklch(0.22 0.08 330)" },
  { name: "amber-dim", css: "bg-amber-dim", value: "oklch(0.25 0.06 75)" },
  { name: "uv-dim", css: "bg-uv-dim", value: "oklch(0.20 0.08 290)" },
];

const SEMANTIC_COLORS = [
  { name: "ok", css: "bg-ok", value: "oklch(0.72 0.19 155)" },
  { name: "error", css: "bg-error", value: "oklch(0.65 0.22 25)" },
  { name: "caution", css: "bg-caution", value: "oklch(0.78 0.18 75)" },
  { name: "info", css: "bg-info", value: "oklch(0.82 0.18 195)" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Storybook() {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { root: content, rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const section of SECTIONS) {
      const el = content.querySelector(`#${section.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <Topbar />

      <div className="grid h-[calc(100vh-48px)] grid-cols-[240px_1fr] grid-rows-1">
        {/* Sidebar */}
        <aside className="overflow-y-auto border-r border-haze bg-pit p-3">
          <div className="px-3 pb-1 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-wash">
              Components
            </span>
          </div>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  contentRef.current
                    ?.querySelector(`#${s.id}`)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex items-center border-l-2 px-3 py-2 text-sm transition-colors duration-150 ${
                  activeSection === s.id
                    ? "border-cyan bg-grid text-flood"
                    : "border-transparent text-spot hover:bg-grid hover:text-flood"
                }`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main ref={contentRef} className="overflow-y-auto bg-void p-6">
          <div className="flex flex-col gap-8">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-flood">
                Component Storybook
              </h1>
              <p className="mt-1 text-sm text-spot">
                Live showcase of the GDTF Creator design system.
              </p>
            </div>

            {/* ---- Colors ---- */}
            <section id="colors">
              <Panel title="Color Palette">
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Surface Scale
                    </span>
                    <div className="mt-2 grid grid-cols-5 gap-px bg-haze">
                      {SURFACE_COLORS.map((c) => (
                        <div key={c.name} className="flex flex-col gap-1 bg-deck p-3">
                          <div className={`h-10 border border-haze ${c.css}`} />
                          <span className="text-xs font-bold text-flood">{c.name}</span>
                          <span className="text-[10px] text-wash">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Accent
                    </span>
                    <div className="mt-2 grid grid-cols-4 gap-px bg-haze">
                      {ACCENT_COLORS.map((c) => (
                        <div key={c.name} className="flex flex-col gap-1 bg-deck p-3">
                          <div className={`h-10 border border-haze ${c.css}`} />
                          <span className="text-xs font-bold text-flood">{c.name}</span>
                          <span className="text-[10px] text-wash">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Accent Dim
                    </span>
                    <div className="mt-2 grid grid-cols-4 gap-px bg-haze">
                      {ACCENT_DIM_COLORS.map((c) => (
                        <div key={c.name} className="flex flex-col gap-1 bg-deck p-3">
                          <div className={`h-10 border border-haze ${c.css}`} />
                          <span className="text-xs font-bold text-flood">{c.name}</span>
                          <span className="text-[10px] text-wash">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Semantic
                    </span>
                    <div className="mt-2 grid grid-cols-4 gap-px bg-haze">
                      {SEMANTIC_COLORS.map((c) => (
                        <div key={c.name} className="flex flex-col gap-1 bg-deck p-3">
                          <div className={`h-10 border border-haze ${c.css}`} />
                          <span className="text-xs font-bold text-flood">{c.name}</span>
                          <span className="text-[10px] text-wash">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Typography ---- */}
            <section id="typography">
              <Panel title="Typography">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["Display", "font-mono text-3xl font-bold tracking-tight", "30px / 36px"],
                      ["Page title", "font-mono text-xl font-bold tracking-tight", "20px / 28px"],
                      ["Section heading", "font-mono text-base font-bold uppercase tracking-widest", "16px / 24px"],
                      ["Panel label", "font-mono text-xs font-medium uppercase tracking-widest", "12px / 16px"],
                      ["Body", "font-mono text-sm font-normal", "14px / 20px"],
                      ["Body prose", "font-sans text-sm font-normal", "14px / 20px"],
                      ["Caption", "font-mono text-xs font-normal", "12px / 16px"],
                      ["DMX value", "font-mono text-sm font-bold tabular-nums", "14px / 20px"],
                      ["Channel address", "font-mono text-xs font-bold tabular-nums", "12px / 16px"],
                    ]}
                    headers={["Role", "Classes", "Size"]}
                  />

                  <div className="flex flex-col gap-3 border border-haze bg-pit p-4">
                    <span className="text-3xl font-bold tracking-tight text-flood">
                      Display — JetBrains Mono
                    </span>
                    <span className="text-xl font-bold tracking-tight text-flood">
                      Page title — JetBrains Mono
                    </span>
                    <span className="text-base font-bold uppercase tracking-widest text-flood">
                      Section Heading
                    </span>
                    <span className="text-xs font-medium uppercase tracking-widest text-spot">
                      Panel Label
                    </span>
                    <span className="text-sm text-flood">
                      Body text — JetBrains Mono (default)
                    </span>
                    <span className="font-sans text-sm text-flood">
                      Body prose — Inter (sans-serif)
                    </span>
                    <span className="text-xs text-spot">
                      Caption — small mono text
                    </span>
                    <span className="text-sm font-bold tabular-nums text-flood">
                      001 — DMX Value
                    </span>
                    <span className="text-xs font-bold tabular-nums text-flood">
                      DMX/001 — Channel Address
                    </span>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Buttons ---- */}
            <section id="buttons">
              <Panel title="Buttons">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["Primary", "bg-cyan text-void", "Main actions (Export, Save)"],
                      ["Secondary", "border-haze bg-transparent text-flood", "Secondary actions (Add, Edit)"],
                      ["Ghost", "bg-transparent text-spot text-xs", "Inline actions (Remove, Cancel)"],
                      ["Danger", "border-error text-error", "Destructive actions (Delete)"],
                    ]}
                    headers={["Variant", "Key classes", "Usage"]}
                  />

                  <div className="flex flex-col gap-3 border border-haze bg-pit p-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Default
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="border border-cyan bg-cyan px-4 py-2 text-sm font-bold uppercase tracking-widest text-void transition-colors duration-150 hover:bg-cyan/80 active:bg-cyan/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
                      >
                        Primary
                      </button>
                      <button
                        type="button"
                        className="border border-haze bg-transparent px-4 py-2 text-sm font-medium uppercase tracking-widest text-flood transition-colors duration-150 hover:border-spot hover:text-flood active:bg-grid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
                      >
                        Secondary
                      </button>
                      <button
                        type="button"
                        className="bg-transparent px-2 py-1 text-xs font-medium uppercase tracking-widest text-spot transition-colors duration-150 hover:bg-grid hover:text-flood active:bg-haze focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
                      >
                        Ghost
                      </button>
                      <button
                        type="button"
                        className="border border-error bg-transparent px-4 py-2 text-sm font-medium uppercase tracking-widest text-error transition-colors duration-150 hover:bg-error hover:text-void focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
                      >
                        Danger
                      </button>
                    </div>

                    <span className="mt-2 text-xs font-bold uppercase tracking-widest text-spot">
                      Disabled
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled
                        className="border border-cyan bg-cyan px-4 py-2 text-sm font-bold uppercase tracking-widest text-void disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Primary
                      </button>
                      <button
                        type="button"
                        disabled
                        className="border border-haze bg-transparent px-4 py-2 text-sm font-medium uppercase tracking-widest text-flood disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Secondary
                      </button>
                      <button
                        type="button"
                        disabled
                        className="bg-transparent px-2 py-1 text-xs font-medium uppercase tracking-widest text-spot disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Ghost
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Inputs ---- */}
            <section id="inputs">
              <Panel title="Inputs">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["Text", "input[type=text]", "bg-pit border-haze focus:border-cyan"],
                      ["Select", "select", "appearance-none bg-pit border-haze"],
                      ["Checkbox", "custom div", "w-4 h-4 border, inner bg-cyan"],
                    ]}
                    headers={["Type", "Element", "Key classes"]}
                  />

                  <div className="grid grid-cols-2 gap-4 border border-haze bg-pit p-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-widest text-spot">
                        Text Input
                      </span>
                      <input
                        type="text"
                        className="w-full border border-haze bg-pit px-3 py-2 text-sm text-flood placeholder:text-wash focus:border-cyan focus:outline-none"
                        placeholder="Fixture name"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-widest text-spot">
                        Select
                      </span>
                      <select className="w-full appearance-none border border-haze bg-pit px-3 py-2 text-sm text-flood focus:border-cyan focus:outline-none">
                        <option>DMX Mode 1</option>
                        <option>DMX Mode 2</option>
                        <option>Extended</option>
                      </select>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2">
                      <div className="relative flex h-4 w-4 items-center justify-center border border-haze bg-pit">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          defaultChecked
                        />
                        <div className="hidden h-2 w-2 bg-cyan peer-checked:block" />
                      </div>
                      <span className="text-sm text-spot">Virtual dimmer</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2">
                      <div className="relative flex h-4 w-4 items-center justify-center border border-haze bg-pit">
                        <input type="checkbox" className="peer sr-only" />
                        <div className="hidden h-2 w-2 bg-cyan peer-checked:block" />
                      </div>
                      <span className="text-sm text-spot">16-bit mode</span>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-widest text-spot">
                        Disabled Input
                      </span>
                      <input
                        type="text"
                        disabled
                        className="w-full cursor-not-allowed border border-haze bg-pit px-3 py-2 text-sm text-wash opacity-40"
                        value="Read only"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-widest text-spot">
                        Focused Input
                      </span>
                      <input
                        type="text"
                        className="w-full border border-cyan bg-pit px-3 py-2 text-sm text-flood outline-none"
                        defaultValue="Focused state"
                      />
                    </label>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Panel ---- */}
            <section id="panel">
              <Panel title="Panel Component">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["title", "string", "(required)", "Panel heading text"],
                      ["children", "ReactNode", "(required)", "Panel body content"],
                      ["actions", "ReactNode", "undefined", "Right-aligned header slot"],
                    ]}
                    headers={["Prop", "Type", "Default", "Description"]}
                  />

                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Basic
                    </span>
                    <Panel title="Basic Panel">
                      <p className="text-sm text-flood">
                        Panel content renders here. Bordered container on the deck surface.
                      </p>
                    </Panel>

                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      With Actions
                    </span>
                    <Panel
                      title="Panel with Actions"
                      actions={
                        <span className="text-xs tabular-nums text-wash">
                          12 items
                        </span>
                      }
                    >
                      <p className="text-sm text-flood">
                        The actions slot renders in the panel header, right-aligned.
                      </p>
                    </Panel>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Field ---- */}
            <section id="field">
              <Panel title="Field + FieldRow">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["label", "string", "(required)", "Label text"],
                      ["value", "string", "(required)", "Display value"],
                      ["mono", "boolean", "true", "Use tabular-nums (mono) or font-sans"],
                    ]}
                    headers={["Prop", "Type", "Default", "Description"]}
                  />

                  <div className="flex flex-col gap-3 border border-haze bg-pit p-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Mono (default)
                    </span>
                    <FieldRow>
                      <Field label="Short Name" value="MAC-Encore-P" />
                      <Field label="Fixture Type" value="MovingHead" />
                    </FieldRow>

                    <span className="mt-2 text-xs font-bold uppercase tracking-widest text-spot">
                      Sans-serif
                    </span>
                    <FieldRow>
                      <Field label="Manufacturer" value="Martin Professional" mono={false} />
                      <Field label="Name" value="MAC Encore Performance" mono={false} />
                    </FieldRow>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- DmxTable ---- */}
            <section id="dmx-table">
              <Panel
                title="DmxTable"
                actions={
                  <span className="text-xs tabular-nums text-wash">
                    {MOCK_DMX_MODE.channelCount} channels
                  </span>
                }
              >
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["mode", "DmxMode", "(required)", "DMX mode with channels, functions, sub-fixtures"],
                    ]}
                    headers={["Prop", "Type", "Default", "Description"]}
                  />
                  <DmxTable mode={MOCK_DMX_MODE} />
                </div>
              </Panel>
            </section>

            {/* ---- ExtractionProgress ---- */}
            <section id="extraction-progress">
              <Panel title="ExtractionProgress">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["progress", "number", "(required)", "0–100 percentage value"],
                      ["stage", "string", "(required)", "Current stage description"],
                    ]}
                    headers={["Prop", "Type", "Default", "Description"]}
                  />

                  <div className="flex flex-col gap-6 border border-haze bg-pit p-6">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        25% — Uploading
                      </span>
                      <div className="mt-3 flex justify-center">
                        <ExtractionProgress progress={25} stage="Uploading PDF..." />
                      </div>
                    </div>
                    <div className="border-t border-haze pt-6">
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        65% — Extracting
                      </span>
                      <div className="mt-3 flex justify-center">
                        <ExtractionProgress progress={65} stage="Extracting fixture data with AI..." />
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- StepBadge ---- */}
            <section id="step-badge">
              <Panel title="StepBadge">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["number", "string", "(required)", "Step number (e.g. '01')"],
                      ["label", "string", "(required)", "Step label"],
                      ["active", "boolean", "false", "Active/current step"],
                      ["done", "boolean", "false", "Completed step"],
                    ]}
                    headers={["Prop", "Type", "Default", "Description"]}
                  />

                  <div className="flex flex-col gap-3 border border-haze bg-pit p-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      States
                    </span>
                    <div className="flex items-center gap-3">
                      <StepBadge number="01" label="Upload" done />
                      <StepBadge number="02" label="Extract" active />
                      <StepBadge number="03" label="Export" />
                    </div>

                    <span className="mt-2 text-xs font-bold uppercase tracking-widest text-spot">
                      Connected Steps
                    </span>
                    <div className="flex items-center gap-0">
                      <StepBadge number="01" label="Upload" done />
                      <div className="h-px w-6 bg-cyan" />
                      <StepBadge number="02" label="Extract" done />
                      <div className="h-px w-6 bg-cyan" />
                      <StepBadge number="03" label="Export" active />
                    </div>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Background ---- */}
            <section id="background">
              <Panel title="Background">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["blobCount", "number", "4", "Number of gradient blobs"],
                      ["opacity", "number", "0.15", "Overall canvas opacity"],
                      ["colors", "AccentColor[]", '["cyan","magenta","amber","uv"]', "Accent colors to use"],
                      ["speed", "number", "1", "Animation speed multiplier"],
                      ["contained", "boolean", "false", "Use absolute instead of fixed positioning"],
                    ]}
                    headers={["Prop", "Type", "Default", "Description"]}
                  />

                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Default (all colors, opacity 0.15)
                    </span>
                    <div className="relative h-64 overflow-hidden border border-haze bg-void">
                      <Background contained />
                      <div className="relative flex h-full items-center justify-center">
                        <span className="text-sm text-flood">Default — all four accent colors</span>
                      </div>
                    </div>

                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      High opacity (0.4)
                    </span>
                    <div className="relative h-64 overflow-hidden border border-haze bg-void">
                      <Background opacity={0.4} contained />
                      <div className="relative flex h-full items-center justify-center">
                        <span className="text-sm text-flood">Opacity 0.4 — visible blobs</span>
                      </div>
                    </div>

                    <span className="text-xs font-bold uppercase tracking-widest text-spot">
                      Cyan + Magenta only
                    </span>
                    <div className="relative h-64 overflow-hidden border border-haze bg-void">
                      <Background colors={["cyan", "magenta"]} opacity={0.3} contained />
                      <div className="relative flex h-full items-center justify-center">
                        <span className="text-sm text-flood">Subset palette — cyan & magenta</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </section>

            {/* ---- Animations ---- */}
            <section id="animations">
              <Panel title="Animations">
                <div className="flex flex-col gap-4">
                  <PropsTable
                    rows={[
                      ["scan", "animate-scan", "3s linear infinite", "Scan-line overlay on loading states"],
                      ["pulse-glow", "animate-pulse-glow", "2s ease-in-out infinite", "Breathing effect on active elements"],
                      ["strobe", "animate-strobe", "0.15s steps(2) x3", "Flash confirmation on save/export"],
                      ["waveform", "animate-waveform", "1.2s ease-in-out infinite", "Audio-meter bars for processing"],
                      ["lightshow", "animate-lightshow", "2s ease-in-out infinite", "Stage cones tilting side-view to top-view"],
                    ]}
                    headers={["Name", "Class", "Timing", "Usage"]}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    {/* Scan */}
                    <div className="flex flex-col gap-2 border border-haze bg-pit p-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        Scan
                      </span>
                      <div className="relative h-20 overflow-hidden border border-haze bg-void">
                        <div className="absolute inset-x-0 h-px animate-scan bg-cyan" />
                      </div>
                    </div>

                    {/* Pulse Glow */}
                    <div className="flex flex-col gap-2 border border-haze bg-pit p-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        Pulse Glow
                      </span>
                      <div className="flex h-20 items-center justify-center border border-haze bg-void">
                        <div className="h-8 w-8 animate-pulse-glow bg-cyan" />
                      </div>
                    </div>

                    {/* Strobe */}
                    <div className="flex flex-col gap-2 border border-haze bg-pit p-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        Strobe
                      </span>
                      <StrobeDemo />
                    </div>

                    {/* Waveform */}
                    <div className="flex flex-col gap-2 border border-haze bg-pit p-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        Waveform
                      </span>
                      <div className="flex h-20 items-end justify-center gap-1 border border-haze bg-void p-3">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-8 w-1.5 origin-bottom animate-waveform bg-cyan"
                            style={{
                              animationDelay: `${i * 0.1}s`,
                              opacity: 0.3 + (i / 12) * 0.7,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Lightshow */}
                    <div className="col-span-2 flex flex-col gap-2 border border-haze bg-pit p-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-spot">
                        Lightshow
                      </span>
                      <div className="flex h-28 items-start justify-center gap-3 border border-haze bg-void px-4 pt-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} style={{ perspective: "200px" }}>
                            <div
                              className="relative animate-lightshow"
                              style={{
                                transformStyle: "preserve-3d",
                                transformOrigin: "top center",
                                width: "32px",
                                height: "48px",
                                animationDelay: `${i * 0.15}s`,
                              }}
                            >
                              {/* Cone body — triangle */}
                              <div
                                className="absolute inset-0"
                                style={{
                                  clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                                  background:
                                    "linear-gradient(to bottom, oklch(0.82 0.18 195), oklch(0.82 0.18 195 / 0.15))",
                                }}
                              />
                              {/* Glow overlay — brightens bottom as cone tilts */}
                              <div
                                className="absolute inset-0 animate-lightshow-glow"
                                style={{
                                  clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                                  background:
                                    "linear-gradient(to bottom, transparent 30%, oklch(0.82 0.18 195 / 0.8))",
                                  animationDelay: `${i * 0.15}s`,
                                }}
                              />
                              {/* Cone base — circle lying flat */}
                              <div
                                className="absolute left-0 animate-lightshow-base"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  bottom: "-16px",
                                  borderRadius: "50%",
                                  transform: "rotateX(90deg)",
                                  animationDelay: `${i * 0.15}s`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function PropsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="border border-haze">
      <div
        className="gap-px bg-haze"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
        }}
      >
        {headers.map((h) => (
          <div
            key={h}
            className="bg-truss px-3 py-2 text-xs font-bold uppercase tracking-widest text-spot"
          >
            {h}
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="gap-px bg-haze"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
          }}
        >
          {row.map((cell, j) => (
            <div
              key={j}
              className="bg-deck px-3 py-1.5 text-xs text-flood"
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StepBadge({
  number,
  label,
  active,
  done,
}: {
  number: string;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  let borderClass = "border-haze";
  let numberClass = "text-wash";
  let labelClass = "text-wash";
  let bgClass = "";

  if (done) {
    borderClass = "border-cyan/30";
    numberClass = "text-cyan";
    labelClass = "text-flood";
    bgClass = "bg-cyan-dim";
  } else if (active) {
    borderClass = "border-cyan";
    numberClass = "text-cyan";
    labelClass = "text-flood";
  }

  return (
    <div
      className={`flex items-center gap-2 border px-3 py-2 ${borderClass} ${bgClass}`}
    >
      <span className={`text-xs font-bold tabular-nums ${numberClass}`}>
        {number}
      </span>
      <span className={`text-xs uppercase tracking-widest ${labelClass}`}>
        {label}
      </span>
    </div>
  );
}

function StrobeDemo() {
  const [playing, setPlaying] = useState(false);
  const [key, setKey] = useState(0);

  return (
    <div className="flex h-20 flex-col items-center justify-center gap-2 border border-haze bg-void">
      {playing ? (
        <div
          key={key}
          className="h-8 w-8 animate-strobe bg-flood"
          onAnimationEnd={() => setPlaying(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setKey((k) => k + 1);
            setPlaying(true);
          }}
          className="px-2 py-1 text-xs uppercase tracking-widest text-spot transition-colors duration-150 hover:bg-grid hover:text-flood"
        >
          Trigger
        </button>
      )}
    </div>
  );
}

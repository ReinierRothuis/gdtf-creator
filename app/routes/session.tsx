import { useState, useCallback } from "react";
import {
  Download,
  CheckCircle,
  Layers,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useQuery, useAction } from "convex/react";
import type { Route } from "./+types/session";
import { Topbar } from "~/components/topbar";
import { Background } from "~/components/background";
import { Panel } from "~/components/panel";
import { Field, FieldRow } from "~/components/field";
import { DmxTable } from "~/components/dmx-table";
import { ExtractionProgress } from "~/components/extraction-progress";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { FixtureData, Wheel } from "../../convex/schema/fixture";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Session — GDTF Creator" },
    { name: "description", content: "Fixture data extraction session" },
  ];
}

export default function Session({ params }: Route.ComponentProps) {
  const session = useQuery(api.sessions.getSession, {
    id: params.id as Id<"sessions">,
  });
  const exportGdtf = useAction(api.export.exportGdtf);

  const [selectedMode, setSelectedMode] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportReady, setExportReady] = useState(false);

  const fixture = session?.fixtureData as FixtureData | undefined;
  const currentMode = fixture?.dmxModes[selectedMode];
  const status = session?.status;

  const handleExport = useCallback(async () => {
    if (!session) return;
    setIsExporting(true);
    try {
      const url = await exportGdtf({
        sessionId: session._id,
      });
      if (url) {
        setExportReady(true);
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        const manufacturer = fixture?.manufacturer ?? "Unknown";
        const shortName = fixture?.shortName ?? "fixture";
        a.download = `${manufacturer}-${shortName}`.replace(/\s+/g, "-") + ".gdtf";
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // Export error — could surface to UI
    } finally {
      setIsExporting(false);
    }
  }, [session, exportGdtf, fixture?.manufacturer, fixture?.shortName]);

  // Loading state — waiting for Convex query
  if (session === undefined) {
    return (
      <div className="flex min-h-screen flex-col bg-void">
        <Topbar sessionActive />
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <Loader2 className="h-8 w-8 animate-spin text-cyan" />
          <p className="mt-4 text-xs uppercase tracking-widest text-spot">
            Loading session...
          </p>
        </main>
      </div>
    );
  }

  // Session not found
  if (session === null) {
    return (
      <div className="flex min-h-screen flex-col bg-void">
        <Topbar sessionActive />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <AlertCircle className="h-8 w-8 text-error" />
          <p className="text-sm text-error">Session not found.</p>
          <a
            href="/"
            className="border border-haze px-4 py-2 text-sm font-medium uppercase tracking-widest text-flood transition-colors duration-150 hover:border-spot"
          >
            Start Over
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <Topbar sessionActive />

      {(status === "uploading" || status === "extracting") && (
        <div className="grid h-[calc(100vh-48px)] grid-cols-[240px_1fr]">
          {/* Sidebar — extraction steps */}
          <aside className="flex flex-col border-r border-haze bg-pit p-3">
            <nav className="flex flex-col gap-0.5">
              <div className="px-3 pb-1 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-wash">
                  Session
                </span>
              </div>
              <div className="flex items-center gap-2 border-l-2 border-transparent px-3 py-2 text-spot">
                <FileText className="h-4 w-4" />
                <div className="flex flex-col">
                  <span className="text-sm">{params.id}</span>
                  <span className="text-xs text-wash">Session ID</span>
                </div>
              </div>

              <div className="px-3 pb-1 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-wash">
                  Pipeline
                </span>
              </div>
              <ExtractionStep
                number="01"
                label="Upload"
                done={status === "extracting"}
                active={status === "uploading"}
              />
              <ExtractionStep
                number="02"
                label="Extract"
                active={status === "extracting"}
              />
              <ExtractionStep number="03" label="Export" />
            </nav>
          </aside>

          {/* Content — progress */}
          <main className="relative flex flex-col bg-void p-8">
            <Background opacity={0.3} contained />
            <div className="relative z-10 mb-6">
              <h1 className="text-xl font-bold tracking-tight text-flood">
                {status === "uploading" ? "Uploading" : "Extracting"}
              </h1>
              <p className="mt-1 text-sm text-spot">
                {status === "uploading"
                  ? "Sending your PDF to the extraction pipeline..."
                  : "AI is reading the document and structuring fixture data..."}
              </p>
            </div>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
              <ExtractionProgress
                progress={status === "uploading" ? 5 : 50}
                stage={
                  status === "uploading"
                    ? "Uploading PDF..."
                    : "Extracting fixture data with AI..."
                }
              />
            </div>
          </main>
        </div>
      )}

      {status === "complete" && fixture && currentMode && (
        <div className="grid h-[calc(100vh-48px)] grid-cols-[240px_1fr] grid-rows-1">
          {/* Sidebar */}
          <aside className="overflow-y-auto border-r border-haze bg-pit p-3">
            <nav className="flex flex-col gap-0.5">
              <SidebarSection label="Session" />
              <SidebarItem
                icon={<FileText className="h-4 w-4" />}
                label={params.id}
                sublabel="Session ID"
              />

              <SidebarSection label="Fixture" />
              <SidebarItem
                icon={<CheckCircle className="h-4 w-4 text-ok" />}
                label={fixture.name}
                sublabel={fixture.manufacturer}
                active
              />

              <SidebarSection label="DMX Modes" />
              {fixture.dmxModes.map((mode, i) => (
                <button
                  key={mode.name}
                  type="button"
                  onClick={() => setSelectedMode(i)}
                  className={`flex items-center gap-2 border-l-2 px-3 py-2 text-left transition-colors duration-150 ${
                    selectedMode === i
                      ? "border-cyan bg-grid text-flood"
                      : "border-transparent text-spot hover:bg-grid hover:text-flood"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span className="text-sm">{mode.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-wash">
                    {mode.channelCount}ch
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="overflow-y-auto bg-void p-6">
            <div className="flex flex-col gap-6">
              {/* Header with export */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-flood">
                    {fixture.name}
                  </h1>
                  <p className="mt-1 text-sm text-spot">
                    {fixture.manufacturer}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {exportReady && (
                    <span className="flex items-center gap-1 text-xs text-ok">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Ready
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 border border-cyan bg-cyan px-4 py-2 text-sm font-bold uppercase tracking-widest text-void transition-colors duration-150 hover:bg-cyan/80 active:bg-cyan/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    {isExporting ? "Exporting..." : "Export GDTF"}
                  </button>
                </div>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-0">
                <StepBadge number="01" label="Upload" done />
                <div className="h-px w-6 bg-cyan" />
                <StepBadge number="02" label="Extract" done />
                <div className="h-px w-6 bg-cyan" />
                <StepBadge
                  number="03"
                  label="Export"
                  active={!exportReady}
                  done={exportReady}
                />
              </div>

              {/* Fixture metadata */}
              <Panel title="Fixture Metadata">
                <FieldRow>
                  <Field label="Manufacturer" value={fixture.manufacturer} mono={false} />
                  <Field label="Name" value={fixture.name} mono={false} />
                </FieldRow>
                <FieldRow>
                  <Field label="Short Name" value={fixture.shortName} />
                  <Field label="Fixture Type" value={fixture.fixtureType} />
                </FieldRow>
              </Panel>

              {/* DMX Channels */}
              <Panel
                title={`DMX Channels — ${currentMode.name} Mode`}
                actions={
                  <span className="text-xs tabular-nums text-wash">
                    {currentMode.channelCount} channels
                  </span>
                }
              >
                <DmxTable mode={currentMode} />
              </Panel>

              {/* Wheels */}
              {fixture.wheels && fixture.wheels.length > 0 && (
                <Panel title="Wheels">
                  <div className="flex flex-col gap-4">
                    {fixture.wheels.map((wheel) => (
                      <WheelDisplay key={wheel.name} wheel={wheel} />
                    ))}
                  </div>
                </Panel>
              )}

              {/* Beam Properties */}
              {fixture.beam && hasBeamData(fixture.beam) && (
                <Panel title="Beam Properties">
                  <div className="grid grid-cols-3 gap-4">
                    {fixture.beam.lampType && (
                      <Field label="Lamp Type" value={fixture.beam.lampType} />
                    )}
                    {fixture.beam.beamAngle !== undefined && (
                      <Field
                        label="Beam Angle"
                        value={`${fixture.beam.beamAngle}\u00B0`}
                      />
                    )}
                    {fixture.beam.fieldAngle !== undefined && (
                      <Field
                        label="Field Angle"
                        value={`${fixture.beam.fieldAngle}\u00B0`}
                      />
                    )}
                    {fixture.beam.colorTemperature !== undefined && (
                      <Field
                        label="Color Temp"
                        value={`${fixture.beam.colorTemperature} K`}
                      />
                    )}
                    {fixture.beam.cri !== undefined && (
                      <Field label="CRI" value={`${fixture.beam.cri}`} />
                    )}
                    {fixture.beam.luminousFlux !== undefined && (
                      <Field
                        label="Luminous Flux"
                        value={`${fixture.beam.luminousFlux} lm`}
                      />
                    )}
                    {fixture.beam.beamType && (
                      <Field label="Beam Type" value={fixture.beam.beamType} />
                    )}
                  </div>
                </Panel>
              )}

              {/* Physical */}
              <Panel title="Physical Description">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Weight" value={fixture.physical.weight} />
                  <Field
                    label="Power"
                    value={fixture.physical.powerConsumption}
                  />
                  <Field label="Width" value={fixture.physical.width} />
                  <Field label="Height" value={fixture.physical.height} />
                  <Field label="Depth" value={fixture.physical.depth} />
                  {fixture.physical.panRange !== undefined && (
                    <Field
                      label="Pan Range"
                      value={`${fixture.physical.panRange}\u00B0`}
                    />
                  )}
                  {fixture.physical.tiltRange !== undefined && (
                    <Field
                      label="Tilt Range"
                      value={`${fixture.physical.tiltRange}\u00B0`}
                    />
                  )}
                </div>
              </Panel>
            </div>
          </main>
        </div>
      )}

      {status === "error" && (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <AlertCircle className="h-8 w-8 text-error" />
          <p className="text-sm text-error">
            {session.errorMessage ?? "Extraction failed. Please try again."}
          </p>
          <a
            href="/"
            className="border border-haze px-4 py-2 text-sm font-medium uppercase tracking-widest text-flood transition-colors duration-150 hover:border-spot"
          >
            Start Over
          </a>
        </main>
      )}
    </div>
  );
}

function ExtractionStep({
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
  let textClass = "text-wash";
  let borderClass = "border-transparent";
  let bgClass = "";
  if (done) {
    textClass = "text-flood";
    borderClass = "border-cyan/30";
    bgClass = "bg-grid";
  } else if (active) {
    textClass = "text-cyan";
    borderClass = "border-cyan";
    bgClass = "bg-grid";
  }
  return (
    <div
      className={`flex items-center gap-2 border-l-2 px-3 py-2 ${borderClass} ${bgClass}`}
    >
      <span className={`text-xs font-bold tabular-nums ${done ? "text-cyan" : active ? "text-cyan" : "text-wash"}`}>
        {number}
      </span>
      <span className={`text-sm ${textClass}`}>{label}</span>
      {done && <CheckCircle className="ml-auto h-3.5 w-3.5 text-ok" />}
      {active && (
        <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-cyan" />
      )}
    </div>
  );
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-4 first:pt-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-wash">
        {label}
      </span>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  sublabel,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-l-2 px-3 py-2 ${
        active
          ? "border-cyan bg-grid text-flood"
          : "border-transparent text-spot"
      }`}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-sm">{label}</span>
        {sublabel && <span className="text-xs text-wash">{sublabel}</span>}
      </div>
    </div>
  );
}

function WheelDisplay({ wheel }: { wheel: Wheel }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-spot">
          {wheel.name}
        </span>
        <span className="text-xs text-wash">{wheel.type}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {wheel.slots.map((slot, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 border border-haze bg-pit px-2 py-1"
          >
            {slot.color && (
              <div
                className="h-3 w-3 border border-haze"
                style={{ backgroundColor: slot.color }}
              />
            )}
            <span className="text-xs text-flood">{slot.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function hasBeamData(beam: NonNullable<FixtureData["beam"]>): boolean {
  return !!(
    beam.lampType ||
    beam.beamAngle !== undefined ||
    beam.fieldAngle !== undefined ||
    beam.colorTemperature !== undefined ||
    beam.cri !== undefined ||
    beam.luminousFlux !== undefined ||
    beam.beamType
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

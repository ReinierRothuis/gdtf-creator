import { useState, useEffect, useCallback } from "react";
import {
  Download,
  CheckCircle,
  Layers,
  FileText,
  AlertCircle,
} from "lucide-react";
import type { Route } from "./+types/session";
import { Topbar } from "~/components/topbar";
import { Panel } from "~/components/panel";
import { Field, FieldRow } from "~/components/field";
import { DmxTable } from "~/components/dmx-table";
import { ExtractionProgress } from "~/components/extraction-progress";
import {
  MOCK_FIXTURE,
  EXTRACTION_STAGES,
  type SessionStatus,
} from "~/lib/mock-data";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Session — GDTF Creator" },
    { name: "description", content: "Fixture data extraction session" },
  ];
}

export default function Session({ params }: Route.ComponentProps) {
  const [status, setStatus] = useState<SessionStatus>("extracting");
  const [stageIndex, setStageIndex] = useState(0);
  const [selectedMode, setSelectedMode] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportReady, setExportReady] = useState(false);

  const stage = EXTRACTION_STAGES[stageIndex];
  const fixture = MOCK_FIXTURE;
  const currentMode = fixture.dmxModes[selectedMode];

  // Simulate extraction progress
  useEffect(() => {
    if (status !== "extracting") return;

    const timer = setInterval(() => {
      setStageIndex((prev) => {
        const next = prev + 1;
        if (next >= EXTRACTION_STAGES.length) {
          clearInterval(timer);
          setStatus("complete");
          return prev;
        }
        return next;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [status]);

  const handleExport = useCallback(() => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportReady(true);
    }, 2000);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <Topbar sessionActive />

      {status === "extracting" && (
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-widest text-spot">
              Session{" "}
              <span className="tabular-nums text-flood">{params.id}</span>
            </p>
          </div>
          <ExtractionProgress
            progress={stage.progress}
            stage={stage.label}
          />
        </main>
      )}

      {status === "complete" && (
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
                <DmxTable channels={currentMode.channels} />
              </Panel>

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
            Extraction failed. Please try again.
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

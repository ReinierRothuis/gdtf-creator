import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DmxMode, ChannelFunction } from "../../convex/schema/fixture";

const GRID = "grid grid-cols-[60px_1fr_1fr_80px_36px] gap-px bg-haze";
const HD =
  "bg-truss px-3 py-2 text-xs font-bold uppercase tracking-widest text-spot";

export function DmxTable({ mode }: { mode: DmxMode }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="border border-haze">
      {/* Header */}
      <div className={GRID}>
        <div className={HD}>Ch</div>
        <div className={HD}>Attribute</div>
        <div className={HD}>Name</div>
        <div className={HD}>Default</div>
        <div className="bg-truss" />
      </div>

      {/* Global channels */}
      {mode.channels.map((ch) => {
        const key = `g-${ch.channel}`;
        const hasFns = ch.functions && ch.functions.length > 0;
        const isOpen = expanded.has(key);

        return (
          <div key={key}>
            <div className={GRID}>
              <div className="bg-deck px-3 py-2 text-sm font-bold tabular-nums text-flood">
                {String(ch.channel).padStart(3, "0")}
              </div>
              <div className="bg-deck px-3 py-2 text-sm font-mono text-flood">
                {ch.gdtfAttribute}
              </div>
              <div className="bg-deck px-3 py-2 text-sm text-flood">
                {ch.prettyName}
              </div>
              <div className="bg-deck px-3 py-2 text-sm tabular-nums text-spot">
                {ch.defaultValue}
              </div>
              <div className="bg-deck flex items-center justify-center">
                {hasFns && (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="p-1 text-wash transition-colors duration-150 hover:text-flood"
                    aria-label={
                      isOpen ? "Collapse functions" : "Expand functions"
                    }
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                )}
              </div>
            </div>

            {isOpen && hasFns && (
              <FunctionDetail functions={ch.functions!} />
            )}
          </div>
        );
      })}

      {/* Sub-fixtures */}
      {mode.subFixtures && (
        <>
          <div className="flex items-center gap-2 bg-rig px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan">
              {mode.subFixtures.name}
            </span>
            <span className="text-xs tabular-nums text-spot">
              &times; {mode.subFixtures.count}
            </span>
            <span className="text-xs text-wash">
              from ch {mode.subFixtures.firstChannel}
            </span>
          </div>

          <div className={GRID}>
            <div className={HD}>#</div>
            <div className={HD}>Attribute</div>
            <div className={HD}>Name</div>
            <div className={HD}>Default</div>
            <div className="bg-truss" />
          </div>

          {mode.subFixtures.channels.map((ch, i) => {
            const key = `sf-${i}`;
            const hasFns = ch.functions && ch.functions.length > 0;
            const isOpen = expanded.has(key);

            return (
              <div key={key}>
                <div className={GRID}>
                  <div className="bg-deck px-3 py-2 text-sm font-bold tabular-nums text-cyan">
                    {i + 1}
                  </div>
                  <div className="bg-deck px-3 py-2 text-sm font-mono text-flood">
                    {ch.gdtfAttribute}
                  </div>
                  <div className="bg-deck px-3 py-2 text-sm text-flood">
                    {ch.prettyName}
                  </div>
                  <div className="bg-deck px-3 py-2 text-sm tabular-nums text-spot">
                    {ch.defaultValue}
                  </div>
                  <div className="bg-deck flex items-center justify-center">
                    {hasFns && (
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        className="p-1 text-wash transition-colors duration-150 hover:text-flood"
                        aria-label={
                          isOpen ? "Collapse functions" : "Expand functions"
                        }
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && hasFns && (
                  <FunctionDetail functions={ch.functions!} />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function FunctionDetail({ functions }: { functions: ChannelFunction[] }) {
  return (
    <div className="ml-[59px] border-l-2 border-cyan-dim">
      {functions.map((fn, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_70px_100px] gap-px bg-haze"
        >
          <div className="relative overflow-hidden bg-pit px-3 py-1.5 text-xs text-flood">
            <div
              className="absolute inset-y-0 bg-cyan/10"
              style={{
                left: `${(fn.dmxFrom / 255) * 100}%`,
                width: `${((fn.dmxTo - fn.dmxFrom + 1) / 256) * 100}%`,
              }}
            />
            <span className="relative">
              {fn.name}
              {fn.attribute && (
                <span className="ml-1.5 text-wash">[{fn.attribute}]</span>
              )}
            </span>
          </div>
          <div className="bg-pit px-3 py-1.5 text-xs tabular-nums text-spot">
            {fn.dmxFrom}&ndash;{fn.dmxTo}
          </div>
          <div className="bg-pit px-3 py-1.5 text-xs tabular-nums text-wash">
            {fn.physicalFrom !== undefined && fn.physicalTo !== undefined
              ? `${fn.physicalFrom}\u2192${fn.physicalTo}`
              : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

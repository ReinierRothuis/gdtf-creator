import type { DmxChannel } from "~/lib/mock-data";

const COL_CLASSES = "grid grid-cols-[60px_1fr_100px_80px] gap-px bg-haze";

export function DmxTable({ channels }: { channels: DmxChannel[] }) {
  return (
    <div className="border border-haze">
      {/* Header */}
      <div className={COL_CLASSES}>
        <div className="bg-truss px-3 py-2 text-xs font-bold uppercase tracking-widest text-spot">
          Ch
        </div>
        <div className="bg-truss px-3 py-2 text-xs font-bold uppercase tracking-widest text-spot">
          Function
        </div>
        <div className="bg-truss px-3 py-2 text-xs font-bold uppercase tracking-widest text-spot">
          Default
        </div>
        <div className="bg-truss px-3 py-2 text-xs font-bold uppercase tracking-widest text-spot">
          DMX
        </div>
      </div>
      {/* Rows */}
      {channels.map((ch) => (
        <div key={ch.channel} className={COL_CLASSES}>
          <div className="bg-deck px-3 py-2 text-sm font-bold tabular-nums text-flood">
            {String(ch.channel).padStart(3, "0")}
          </div>
          <div className="bg-deck px-3 py-2 text-sm text-flood">
            {ch.function}
          </div>
          <div className="bg-deck px-3 py-2 text-sm tabular-nums text-spot">
            {ch.defaultValue}
          </div>
          <div className="bg-deck px-3 py-2 text-sm tabular-nums text-spot">
            {ch.dmxRange}
          </div>
        </div>
      ))}
    </div>
  );
}

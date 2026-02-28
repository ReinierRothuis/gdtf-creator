export function ExtractionProgress({
  progress,
  stage,
}: {
  progress: number;
  stage: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Waveform animation */}
      <div className="flex items-end gap-1">
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

      {/* Stage label */}
      <p className="text-xs uppercase tracking-widest text-cyan">{stage}</p>

      {/* Progress bar */}
      <div className="flex w-full flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="uppercase tracking-widest text-spot">
            Extraction Progress
          </span>
          <span className="tabular-nums text-flood">{progress}%</span>
        </div>
        <div className="h-1 w-full bg-pit">
          <div
            className="h-full bg-cyan transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

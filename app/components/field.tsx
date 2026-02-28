export function Field({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-widest text-spot">
        {label}
      </span>
      <span
        className={`text-sm text-flood ${mono ? "tabular-nums" : "font-sans"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

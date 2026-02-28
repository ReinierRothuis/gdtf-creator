export function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border border-haze bg-deck">
      <div className="flex items-center justify-between border-b border-haze px-4 py-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-spot">
          {title}
        </h3>
        {actions}
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </div>
  );
}

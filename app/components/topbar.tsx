import { Link } from "react-router";

export function Topbar({ sessionActive }: { sessionActive?: boolean }) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-haze bg-truss px-4">
      <Link to="/" className="flex items-center gap-1.5">
        <span className="text-sm font-bold uppercase tracking-widest text-cyan">
          GDTF
        </span>
        <span className="text-sm font-bold uppercase tracking-widest text-flood">
          Creator
        </span>
      </Link>
      {sessionActive && (
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="px-2 py-1 text-xs uppercase tracking-widest text-spot transition-colors duration-150 hover:bg-grid hover:text-flood"
          >
            New
          </Link>
        </div>
      )}
    </header>
  );
}
